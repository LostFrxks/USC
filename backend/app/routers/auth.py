from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import insert, select, update
from sqlalchemy.orm import Session

from app.cache.redis_cache import delete_key, get_json, make_key, set_json
from app.db.deps import get_db
from app.db.schema import accounts_user as users
from app.db.schema import companies_company as companies
from app.db.schema import companies_companymember as company_members
from app.core.config import settings
from app.deps.auth import get_current_user
from app.observability import observe_db_query_failure, observe_login_attempt
from app.security.auth_guard import AuthGuardError, auth_guard
from app.security.rate_limit import RateLimitError, RateLimitRule, rate_limit
from app.security.refresh_sessions import (
    get_refresh_session,
    revoke_all_refresh_sessions_for_user,
    revoke_refresh_session,
)
from app.services.audit import log_audit_event
from app.services.auth_cookies import clear_refresh_cookie, extract_refresh_token, set_refresh_cookie
from app.services.auth_tokens import issue_token_pair
from app.utils.auth import create_access_token, create_refresh_token, decode_token, make_legacy_password, refresh_expires_at, verify_legacy_password
from app.utils.emailer import can_send, send_email

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginPayload(BaseModel):
    email: str
    password: str = Field(min_length=1)
    captcha_token: Optional[str] = None


class TokenPair(BaseModel):
    access: str
    refresh: Optional[str] = None


class RefreshPayload(BaseModel):
    refresh: str | None = None


class RegisterPayload(BaseModel):
    email: str
    password: str
    code: str = ""
    first_name: str = ""
    last_name: str = ""
    phone: str = ""
    role: str = "buyer"


class RegisterResponse(BaseModel):
    id: int
    email: str
    first_name: str = ""
    last_name: str = ""
    phone: str = ""
    role: str = "buyer"


class PhoneRequestPayload(BaseModel):
    phone: str


class PhoneRequestResponse(BaseModel):
    sent: bool
    code: Optional[str] = None
    expires_in: int = 300


class PhoneVerifyPayload(BaseModel):
    phone: str
    code: str
    role: str = "buyer"
    email: Optional[str] = None
    first_name: str = ""
    last_name: str = ""
    captcha_token: Optional[str] = None


class EmailRequestPayload(BaseModel):
    email: str


class EmailVerifyPayload(BaseModel):
    email: str
    code: str
    role: str = "buyer"
    first_name: str = ""
    last_name: str = ""
    phone: str = ""
    captcha_token: Optional[str] = None


class LogoutPayload(BaseModel):
    refresh: str | None = None


class PasswordResetRequestPayload(BaseModel):
    email: str


class PasswordResetConfirmPayload(BaseModel):
    email: str
    code: str
    new_password: str
    captcha_token: Optional[str] = None


def _col(name: str):
    c = users.c.get(name)
    if c is None:
        raise HTTPException(500, detail=f"DB schema mismatch: column 'accounts_user.{name}' not found")
    return c


def _normalize_phone(phone: str) -> str:
    return "".join(ch for ch in phone if ch.isdigit() or ch == "+")


def _is_valid_email(email: str) -> bool:
    if not email or "@" not in email:
        return False
    parts = email.split("@")
    return len(parts) == 2 and all(parts)


ROLE_COLUMNS = ("role", "user_role", "user_type", "account_type")


def _get_role_from_row(row: dict) -> Optional[str]:
    for col in ROLE_COLUMNS:
        if col in users.c and row.get(col) is not None:
            return str(row.get(col))
    return None


def _set_role_value(values: dict, role: str):
    for col in ROLE_COLUMNS:
        if col in users.c:
            values[col] = role
            break


def _make_placeholder_email(phone: str) -> str:
    digits = "".join(ch for ch in phone if ch.isdigit())
    if not digits:
        digits = "user"
    return f"{digits}@phone.local"


def _default_company_name(email: str, first_name: str, last_name: str) -> str:
    label = "USC Company"
    name = " ".join([first_name.strip(), last_name.strip()]).strip()
    if name:
        label = name
    elif email and "@" in email:
        label = email.split("@", 1)[0]
    return f"{label} Co."


def _ensure_company_for_user(db: Session, *, user_id: int, role: str, email: str, first_name: str, last_name: str):
    exists = db.execute(select(company_members.c.id).where(company_members.c.user_id == user_id)).first()
    if exists:
        return

    now = datetime.now(timezone.utc)
    company_type = "SUPPLIER" if role.lower() == "supplier" else "BUYER"

    # Keep inserts robust even if DB columns are NOT NULL and do not have defaults.
    values = {"name": _default_company_name(email, first_name, last_name)}
    if "company_type" in companies.c:
        values["company_type"] = company_type
    if "phone" in companies.c:
        values["phone"] = ""
    if "address" in companies.c:
        values["address"] = ""
    if "created_at" in companies.c:
        values["created_at"] = now

    ins = insert(companies).values(values).returning(companies.c.id)
    company_id = int(db.execute(ins).scalar_one())

    member_values = {"user_id": user_id, "company_id": company_id}
    if "role" in company_members.c:
        member_values["role"] = "OWNER"
    if "created_at" in company_members.c:
        member_values["created_at"] = now

    db.execute(insert(company_members).values(member_values))


PHONE_CODES: dict[str, tuple[str, datetime]] = {}
EMAIL_CODES: dict[str, tuple[str, datetime]] = {}


def _code_expires_at() -> datetime:
    ttl = max(60, int(settings.EMAIL_CODE_EXPIRES_SECONDS or 300))
    return datetime.now(timezone.utc) + timedelta(seconds=ttl)


def _code_length() -> int:
    return max(4, min(8, int(settings.EMAIL_CODE_LENGTH or 6)))


def _generate_code() -> str:
    digits = _code_length()
    min_val = 10 ** (digits - 1)
    max_val = (10**digits) - 1
    return str(secrets.randbelow(max_val - min_val + 1) + min_val)


def _otp_cache_key(channel: str, target: str) -> str:
    return make_key("otp", channel, target)


def _set_verification_code(channel: str, target: str, code: str, expires_at: datetime) -> None:
    ttl_seconds = max(60, int(settings.EMAIL_CODE_EXPIRES_SECONDS or 300))
    payload = {"code": code, "exp": expires_at.isoformat()}
    set_json(_otp_cache_key(channel, target), payload, ttl_seconds)

    if channel == "phone":
        PHONE_CODES[target] = (code, expires_at)
    else:
        EMAIL_CODES[f"{channel}:{target}"] = (code, expires_at)


def _get_verification_code(channel: str, target: str) -> tuple[str, datetime] | None:
    cached = get_json(_otp_cache_key(channel, target))
    if isinstance(cached, dict):
        code = str(cached.get("code") or "").strip()
        exp_raw = str(cached.get("exp") or "").strip()
        if code and exp_raw:
            try:
                exp_dt = datetime.fromisoformat(exp_raw)
                if exp_dt.tzinfo is None:
                    exp_dt = exp_dt.replace(tzinfo=timezone.utc)
                return code, exp_dt
            except ValueError:
                pass

    if channel == "phone":
        return PHONE_CODES.get(target)
    return EMAIL_CODES.get(f"{channel}:{target}")


def _clear_verification_code(channel: str, target: str) -> None:
    delete_key(_otp_cache_key(channel, target))
    if channel == "phone":
        PHONE_CODES.pop(target, None)
    else:
        EMAIL_CODES.pop(f"{channel}:{target}", None)


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for") or ""
    if fwd:
        return fwd.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def _request_id(request: Request) -> str:
    return str(getattr(request.state, "request_id", "") or "")


def _error_payload(reason_code: str, *, captcha_required: bool = False, lockout_seconds: int | None = None) -> dict:
    payload: dict = {
        "reason_code": reason_code,
        "captcha_required": bool(captcha_required),
    }
    if lockout_seconds is not None:
        payload["lockout_seconds"] = int(max(0, lockout_seconds))
    return payload


def _apply_rate_limit(namespace: str, identity: str, rules: list[RateLimitRule]) -> None:
    try:
        rate_limit.check(namespace=namespace, identity=identity, rules=rules)
    except RateLimitError as e:
        raise HTTPException(
            status_code=429,
            detail={
                "reason_code": "rate_limited",
                "retry_after": e.retry_after,
            },
            headers={"Retry-After": str(e.retry_after)},
        )


def _auth_guard_precheck(*, scope: str, target: str, ip: str, captcha_token: str | None = None) -> None:
    try:
        auth_guard.precheck(scope=scope, target=target, ip=ip, captcha_token=captcha_token)
    except AuthGuardError as e:
        status = 429 if e.reason_code == "locked_out" else 403
        raise HTTPException(
            status_code=status,
            detail=_error_payload(
                e.reason_code,
                captcha_required=e.captcha_required,
                lockout_seconds=e.lockout_seconds,
            ),
        )


def _auth_guard_failure(*, scope: str, target: str, ip: str) -> None:
    auth_guard.failure(scope=scope, target=target, ip=ip)


def _auth_guard_success(*, scope: str, target: str, ip: str) -> None:
    auth_guard.success(scope=scope, target=target, ip=ip)


def _raise_after_failure(*, scope: str, target: str, ip: str, status_code: int, detail: str) -> None:
    _auth_guard_failure(scope=scope, target=target, ip=ip)
    lockout = auth_guard.lockout_ttl(scope=scope, target=target, ip=ip)
    if lockout > 0:
        raise HTTPException(
            status_code=429,
            detail=_error_payload("locked_out", captcha_required=True, lockout_seconds=lockout),
        )
    raise HTTPException(status_code=status_code, detail=detail)


@router.post("/login/", response_model=TokenPair)
def login(payload: LoginPayload, request: Request, response: Response, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    if not _is_valid_email(email):
        raise HTTPException(400, detail="Invalid email")
    ip = _client_ip(request)
    _apply_rate_limit(
        "auth_login",
        identity=f"{ip}|{email}",
        rules=[
            RateLimitRule(limit=10, window_seconds=60, key_suffix=f"ip:{ip}"),
            RateLimitRule(limit=5, window_seconds=600, key_suffix=f"email_ip:{email}:{ip}"),
        ],
    )
    _auth_guard_precheck(scope="login", target=email, ip=ip, captcha_token=payload.captcha_token)
    try:
        u = db.execute(select(users).where(_col("email") == email)).mappings().first()
    except Exception:
        observe_db_query_failure(endpoint="auth_login")
        raise
    if not u:
        observe_login_attempt(result="failure")
        log_audit_event(
            db,
            domain="auth",
            action="login",
            resource_type="user",
            resource_id=email,
            request_id=_request_id(request),
            ip=ip,
            user_agent=request.headers.get("user-agent", ""),
            outcome="failure",
            payload={"reason": "user_not_found"},
        )
        _raise_after_failure(scope="login", target=email, ip=ip, status_code=401, detail="Invalid credentials")

    if not verify_legacy_password(payload.password, str(u.get("password") or "")):
        observe_login_attempt(result="failure")
        log_audit_event(
            db,
            domain="auth",
            action="login",
            resource_type="user",
            resource_id=str(u.get("id") or email),
            actor_user_id=int(u.get("id")),
            request_id=_request_id(request),
            ip=ip,
            user_agent=request.headers.get("user-agent", ""),
            outcome="failure",
            payload={"reason": "invalid_password"},
        )
        _raise_after_failure(scope="login", target=email, ip=ip, status_code=401, detail="Invalid credentials")

    role = _get_role_from_row(u) or None
    _auth_guard_success(scope="login", target=email, ip=ip)
    observe_login_attempt(result="success")
    pair_data = issue_token_pair(
        db,
        user_id=int(u.get("id")),
        email=str(u.get("email") or email),
        role=role,
        ip=ip,
        user_agent=request.headers.get("user-agent"),
    )
    log_audit_event(
        db,
        domain="auth",
        action="login",
        resource_type="user",
        resource_id=str(u.get("id")),
        actor_user_id=int(u.get("id")),
        request_id=_request_id(request),
        ip=ip,
        user_agent=request.headers.get("user-agent", ""),
        outcome="success",
    )
    db.commit()
    set_refresh_cookie(response, pair_data["refresh"])
    return TokenPair(**pair_data)


# SimpleJWT-ish aliases (JSON body; not form-encoded)
@router.post("/token/", response_model=TokenPair)
def token(payload: LoginPayload, request: Request, response: Response, db: Session = Depends(get_db)):
    return login(payload, request, response, db)


@router.post("/token/refresh/", response_model=TokenPair)
def token_refresh(payload: RefreshPayload, request: Request, response: Response, db: Session = Depends(get_db)):
    ip = _client_ip(request)
    _apply_rate_limit(
        "auth_token_refresh",
        identity=ip,
        rules=[RateLimitRule(limit=20, window_seconds=600, key_suffix=f"ip:{ip}")],
    )
    refresh_token = extract_refresh_token(request, payload.refresh)
    if not refresh_token:
        raise HTTPException(401, detail="Invalid refresh token")
    try:
        data = decode_token(refresh_token)
    except Exception:
        log_audit_event(
            db,
            domain="auth",
            action="token_refresh",
            resource_type="session",
            request_id=_request_id(request),
            ip=ip,
            user_agent=request.headers.get("user-agent", ""),
            outcome="failure",
            payload={"reason": "decode_failed"},
        )
        raise HTTPException(401, detail="Invalid refresh token")

    if data.get("type") != "refresh":
        raise HTTPException(401, detail="Invalid refresh token")

    jti = str(data.get("jti") or "")
    sid = str(data.get("sid") or "")
    subject = str(data.get("sub") or "")
    if not jti or not sid or not subject:
        raise HTTPException(401, detail="Invalid refresh token")

    session = get_refresh_session(db, jti=jti)
    if not session:
        log_audit_event(
            db,
            domain="auth",
            action="token_refresh",
            resource_type="session",
            resource_id=jti,
            request_id=_request_id(request),
            ip=ip,
            user_agent=request.headers.get("user-agent", ""),
            outcome="failure",
            payload={"reason": "session_not_found"},
        )
        raise HTTPException(401, detail="Invalid refresh token")
    if session.user_id != int(subject):
        raise HTTPException(401, detail="Invalid refresh token")
    if session.revoked_at is not None:
        raise HTTPException(401, detail="Refresh token revoked")
    if session.expires_at <= datetime.now(timezone.utc):
        revoke_refresh_session(db, jti=jti)
        db.commit()
        raise HTTPException(401, detail="Refresh token expired")

    role = str(data.get("role") or "") or None
    pair_data = issue_token_pair(
        db,
        user_id=int(subject),
        email=str(data.get("email") or ""),
        role=role,
        ip=ip,
        user_agent=request.headers.get("user-agent"),
        sid=sid,
    )
    new_jti = str(decode_token(pair_data["refresh"]).get("jti") or "")
    revoke_refresh_session(db, jti=jti, replaced_by_jti=(new_jti or None))
    log_audit_event(
        db,
        domain="auth",
        action="token_refresh",
        resource_type="session",
        resource_id=jti,
        actor_user_id=int(subject),
        request_id=_request_id(request),
        ip=ip,
        user_agent=request.headers.get("user-agent", ""),
        outcome="success",
        payload={"replaced_by_jti": new_jti},
    )
    db.commit()
    set_refresh_cookie(response, pair_data["refresh"])
    return TokenPair(**pair_data)


@router.post("/register/", response_model=RegisterResponse)
def register(payload: RegisterPayload, request: Request, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    code_input = payload.code.strip()
    ip = _client_ip(request)
    _apply_rate_limit(
        "auth_register",
        identity=f"{ip}|{email}",
        rules=[
            RateLimitRule(limit=5, window_seconds=3600, key_suffix=f"ip:{ip}"),
            RateLimitRule(limit=3, window_seconds=3600, key_suffix=f"email:{email}"),
        ],
    )

    if not _is_valid_email(email):
        raise HTTPException(400, detail="Invalid email")
    if not payload.password or len(payload.password) < 6:
        raise HTTPException(400, detail="Password too short")
    if not code_input:
        raise HTTPException(400, detail="Email code required")
    entry = _get_verification_code("email", email)
    if not entry:
        raise HTTPException(400, detail="Code not requested")
    code, exp = entry
    if datetime.now(timezone.utc) > exp:
        _clear_verification_code("email", email)
        raise HTTPException(400, detail="Code expired")
    if code_input != code:
        raise HTTPException(400, detail="Invalid code")
    existing = db.execute(select(_col("id")).where(_col("email") == email)).first()
    if existing:
        raise HTTPException(400, detail="User with this email already exists")
    if payload.phone:
        existing_phone = db.execute(select(_col("id")).where(_col("phone") == _normalize_phone(payload.phone))).first()
        if existing_phone:
            raise HTTPException(400, detail="User with this phone already exists")

    password_hash = make_legacy_password(payload.password)
    now = datetime.now(timezone.utc)

    values = {
        "email": email,
        "password": password_hash,
        "first_name": payload.first_name or "",
        "last_name": payload.last_name or "",
        "phone": _normalize_phone(payload.phone) if payload.phone else "",
    }
    if payload.role:
        _set_role_value(values, payload.role)

    # defaults (if columns exist)
    if "is_active" in users.c:
        values["is_active"] = True
    if "is_staff" in users.c:
        values["is_staff"] = False
    if "is_superuser" in users.c:
        values["is_superuser"] = False
    if "is_courier_enabled" in users.c:
        values["is_courier_enabled"] = False
    if "created_at" in users.c:
        values["created_at"] = now
    if "last_login" in users.c:
        values["last_login"] = None

    try:
        ins = insert(users).values(values).returning(_col("id"))
        user_id = int(db.execute(ins).scalar_one())
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(400, detail=f"Register failed. DB says: {e}")

    try:
        _ensure_company_for_user(
            db,
            user_id=user_id,
            role=payload.role or "buyer",
            email=email,
            first_name=payload.first_name or "",
            last_name=payload.last_name or "",
        )
        db.commit()
    except Exception:
        db.rollback()

    _clear_verification_code("email", email)
    log_audit_event(
        db,
        domain="auth",
        action="register",
        resource_type="user",
        resource_id=str(user_id),
        actor_user_id=user_id,
        request_id=_request_id(request),
        ip=ip,
        user_agent=request.headers.get("user-agent", ""),
        outcome="success",
        payload={"role": payload.role or "buyer", "email": email},
    )
    return RegisterResponse(
        id=user_id,
        email=email,
        first_name=payload.first_name or "",
        last_name=payload.last_name or "",
        phone=payload.phone or "",
        role=payload.role or "buyer",
    )


@router.post("/phone/request/", response_model=PhoneRequestResponse)
def phone_request(payload: PhoneRequestPayload, request: Request):
    phone = _normalize_phone(payload.phone)
    if not phone or len(phone) < 6:
        raise HTTPException(400, detail="Invalid phone")
    ip = _client_ip(request)
    _apply_rate_limit(
        "auth_phone_request",
        identity=f"{ip}|{phone}",
        rules=[
            RateLimitRule(limit=3, window_seconds=600, key_suffix=f"phone:{phone}"),
            RateLimitRule(limit=10, window_seconds=3600, key_suffix=f"ip:{ip}"),
        ],
    )

    code = _generate_code()
    expires_at = _code_expires_at()
    _set_verification_code("phone", phone, code, expires_at)
    expires_in = max(60, int(settings.EMAIL_CODE_EXPIRES_SECONDS or 300))
    return PhoneRequestResponse(sent=True, code=code, expires_in=expires_in)


@router.post("/phone/verify/", response_model=TokenPair)
def phone_verify(payload: PhoneVerifyPayload, request: Request, response: Response, db: Session = Depends(get_db)):
    phone = _normalize_phone(payload.phone)
    if not phone or len(phone) < 6:
        raise HTTPException(400, detail="Invalid phone")
    if not payload.code or len(payload.code) < 4:
        raise HTTPException(400, detail="Invalid code")
    ip = _client_ip(request)
    _apply_rate_limit(
        "auth_phone_verify",
        identity=f"{ip}|{phone}",
        rules=[
            RateLimitRule(limit=8, window_seconds=600, key_suffix=f"phone:{phone}"),
            RateLimitRule(limit=20, window_seconds=3600, key_suffix=f"ip:{ip}"),
        ],
    )
    _auth_guard_precheck(scope="phone_verify", target=phone, ip=ip, captcha_token=payload.captcha_token)

    entry = _get_verification_code("phone", phone)
    if not entry:
        _raise_after_failure(scope="phone_verify", target=phone, ip=ip, status_code=400, detail="Code not requested")

    code, exp = entry
    if datetime.now(timezone.utc) > exp:
        _clear_verification_code("phone", phone)
        _raise_after_failure(scope="phone_verify", target=phone, ip=ip, status_code=400, detail="Code expired")
    if payload.code != code:
        _raise_after_failure(scope="phone_verify", target=phone, ip=ip, status_code=400, detail="Invalid code")

    u = db.execute(select(users).where(_col("phone") == phone)).mappings().first()

    if not u:
        email = str(payload.email) if payload.email and _is_valid_email(payload.email) else _make_placeholder_email(phone)
        # ensure unique email
        while db.execute(select(_col("id")).where(_col("email") == email)).first():
            email = _make_placeholder_email(phone) + f".{secrets.randbelow(9999)}"

        password_hash = make_legacy_password(secrets.token_urlsafe(8))
        now = datetime.now(timezone.utc)
        values = {
            "email": email,
            "password": password_hash,
            "first_name": payload.first_name or "",
            "last_name": payload.last_name or "",
            "phone": phone,
        }
        if payload.role:
            _set_role_value(values, payload.role)
        if "is_active" in users.c:
            values["is_active"] = True
        if "is_staff" in users.c:
            values["is_staff"] = False
        if "is_superuser" in users.c:
            values["is_superuser"] = False
        if "is_courier_enabled" in users.c:
            values["is_courier_enabled"] = False
        if "created_at" in users.c:
            values["created_at"] = now
        if "last_login" in users.c:
            values["last_login"] = None

        try:
            ins = insert(users).values(values).returning(_col("id"))
            user_id = int(db.execute(ins).scalar_one())
            db.commit()
        except Exception as e:
            db.rollback()
            raise HTTPException(400, detail=f"Register failed. DB says: {e}")

        try:
            _ensure_company_for_user(
                db,
                user_id=user_id,
                role=payload.role or "buyer",
                email=email,
                first_name=payload.first_name or "",
                last_name=payload.last_name or "",
            )
            db.commit()
        except Exception:
            db.rollback()

        u = {"id": user_id, "email": email}
        if payload.role:
            u["role"] = payload.role
    else:
        if payload.role:
            # update role if column exists
            values = {}
            _set_role_value(values, payload.role)
            if values:
                db.execute(update(users).where(_col("id") == u.get("id")).values(values))
                db.commit()

        try:
            _ensure_company_for_user(
                db,
                user_id=int(u.get("id")),
                role=payload.role or _get_role_from_row(u) or "buyer",
                email=str(u.get("email") or ""),
                first_name=str(u.get("first_name") or ""),
                last_name=str(u.get("last_name") or ""),
            )
            db.commit()
        except Exception:
            db.rollback()

    role = _get_role_from_row(u) or payload.role
    _clear_verification_code("phone", phone)
    _auth_guard_success(scope="phone_verify", target=phone, ip=ip)
    pair_data = issue_token_pair(
        db,
        user_id=int(u.get("id")),
        email=str(u.get("email") or ""),
        role=role,
        ip=ip,
        user_agent=request.headers.get("user-agent"),
    )
    log_audit_event(
        db,
        domain="auth",
        action="phone_verify",
        resource_type="user",
        resource_id=str(u.get("id")),
        actor_user_id=int(u.get("id")),
        request_id=_request_id(request),
        ip=ip,
        user_agent=request.headers.get("user-agent", ""),
        outcome="success",
        payload={"phone": phone},
    )
    db.commit()
    set_refresh_cookie(response, pair_data["refresh"])
    return TokenPair(**pair_data)


@router.post("/email/request/", response_model=PhoneRequestResponse)
def email_request(payload: EmailRequestPayload, request: Request):
    email = payload.email.strip().lower()
    if not _is_valid_email(email):
        raise HTTPException(400, detail="Invalid email")
    ip = _client_ip(request)
    _apply_rate_limit(
        "auth_email_request",
        identity=f"{ip}|{email}",
        rules=[
            RateLimitRule(limit=3, window_seconds=600, key_suffix=f"email:{email}"),
            RateLimitRule(limit=10, window_seconds=3600, key_suffix=f"ip:{ip}"),
        ],
    )

    code = _generate_code()
    expires_at = _code_expires_at()
    _set_verification_code("email", email, code, expires_at)
    expires_in = max(60, int(settings.EMAIL_CODE_EXPIRES_SECONDS or 300))
    if can_send():
        try:
            send_email(
                email,
                subject="USC verification code",
                text=f"Your USC verification code: {code}\nValid for {expires_in // 60} minutes.",
            )
            return PhoneRequestResponse(sent=True, code=None, expires_in=expires_in)
        except Exception:
            raise HTTPException(502, detail="Failed to send email code")

    if settings.EMAIL_CODE_DEV_FALLBACK:
        return PhoneRequestResponse(sent=True, code=code, expires_in=expires_in)
    raise HTTPException(503, detail="Email provider is not configured")


@router.post("/email/verify/", response_model=TokenPair)
def email_verify(payload: EmailVerifyPayload, request: Request, response: Response, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    if not _is_valid_email(email):
        raise HTTPException(400, detail="Invalid email")
    if not payload.code or len(payload.code) < 4:
        raise HTTPException(400, detail="Invalid code")
    ip = _client_ip(request)
    _apply_rate_limit(
        "auth_email_verify",
        identity=f"{ip}|{email}",
        rules=[
            RateLimitRule(limit=8, window_seconds=600, key_suffix=f"email:{email}"),
            RateLimitRule(limit=20, window_seconds=3600, key_suffix=f"ip:{ip}"),
        ],
    )
    _auth_guard_precheck(scope="email_verify", target=email, ip=ip, captcha_token=payload.captcha_token)

    entry = _get_verification_code("email", email)
    if not entry:
        _raise_after_failure(scope="email_verify", target=email, ip=ip, status_code=400, detail="Code not requested")
    code, exp = entry
    if datetime.now(timezone.utc) > exp:
        _clear_verification_code("email", email)
        _raise_after_failure(scope="email_verify", target=email, ip=ip, status_code=400, detail="Code expired")
    if payload.code != code:
        _raise_after_failure(scope="email_verify", target=email, ip=ip, status_code=400, detail="Invalid code")

    u = db.execute(select(users).where(_col("email") == email)).mappings().first()

    if not u:
        password_hash = make_legacy_password(secrets.token_urlsafe(8))
        now = datetime.now(timezone.utc)
        values = {
            "email": email,
            "password": password_hash,
            "first_name": payload.first_name or "",
            "last_name": payload.last_name or "",
            "phone": _normalize_phone(payload.phone) if payload.phone else "",
        }
        if payload.role:
            _set_role_value(values, payload.role)
        if "is_active" in users.c:
            values["is_active"] = True
        if "is_staff" in users.c:
            values["is_staff"] = False
        if "is_superuser" in users.c:
            values["is_superuser"] = False
        if "is_courier_enabled" in users.c:
            values["is_courier_enabled"] = False
        if "created_at" in users.c:
            values["created_at"] = now
        if "last_login" in users.c:
            values["last_login"] = None

        try:
            ins = insert(users).values(values).returning(_col("id"))
            user_id = int(db.execute(ins).scalar_one())
            db.commit()
        except Exception as e:
            db.rollback()
            raise HTTPException(400, detail=f"Register failed. DB says: {e}")

        try:
            _ensure_company_for_user(
                db,
                user_id=user_id,
                role=payload.role or "buyer",
                email=email,
                first_name=payload.first_name or "",
                last_name=payload.last_name or "",
            )
            db.commit()
        except Exception:
            db.rollback()

        u = {"id": user_id, "email": email}
        if payload.role:
            u["role"] = payload.role
    else:
        if payload.role:
            values = {}
            _set_role_value(values, payload.role)
            if values:
                db.execute(update(users).where(_col("id") == u.get("id")).values(values))
                db.commit()

        try:
            _ensure_company_for_user(
                db,
                user_id=int(u.get("id")),
                role=payload.role or _get_role_from_row(u) or "buyer",
                email=str(u.get("email") or ""),
                first_name=str(u.get("first_name") or ""),
                last_name=str(u.get("last_name") or ""),
            )
            db.commit()
        except Exception:
            db.rollback()

    role = _get_role_from_row(u) or payload.role
    _clear_verification_code("email", email)
    _auth_guard_success(scope="email_verify", target=email, ip=ip)
    pair_data = issue_token_pair(
        db,
        user_id=int(u.get("id")),
        email=str(u.get("email") or email),
        role=role,
        ip=ip,
        user_agent=request.headers.get("user-agent"),
    )
    log_audit_event(
        db,
        domain="auth",
        action="email_verify",
        resource_type="user",
        resource_id=str(u.get("id")),
        actor_user_id=int(u.get("id")),
        request_id=_request_id(request),
        ip=ip,
        user_agent=request.headers.get("user-agent", ""),
        outcome="success",
        payload={"email": email},
    )
    db.commit()
    set_refresh_cookie(response, pair_data["refresh"])
    return TokenPair(**pair_data)


@router.post("/password_reset/request/", response_model=PhoneRequestResponse)
def password_reset_request(payload: PasswordResetRequestPayload, request: Request, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    if not _is_valid_email(email):
        raise HTTPException(400, detail="Invalid email")
    ip = _client_ip(request)
    _apply_rate_limit(
        "auth_password_reset_request",
        identity=f"{ip}|{email}",
        rules=[
            RateLimitRule(limit=3, window_seconds=600, key_suffix=f"email:{email}"),
            RateLimitRule(limit=10, window_seconds=3600, key_suffix=f"ip:{ip}"),
        ],
    )

    user_row = db.execute(select(users).where(_col("email") == email)).mappings().first()
    if not user_row:
        raise HTTPException(404, detail="User not found")

    code = _generate_code()
    expires_at = _code_expires_at()
    _set_verification_code("password_reset", email, code, expires_at)
    expires_in = max(60, int(settings.EMAIL_CODE_EXPIRES_SECONDS or 300))

    if can_send():
        try:
            send_email(
                email,
                subject="USC password reset code",
                text=f"Your USC password reset code: {code}\nValid for {expires_in // 60} minutes.",
            )
            return PhoneRequestResponse(sent=True, code=None, expires_in=expires_in)
        except Exception:
            raise HTTPException(502, detail="Failed to send password reset code")

    if settings.EMAIL_CODE_DEV_FALLBACK:
        return PhoneRequestResponse(sent=True, code=code, expires_in=expires_in)
    raise HTTPException(503, detail="Email provider is not configured")


@router.post("/password_reset/confirm/")
def password_reset_confirm(payload: PasswordResetConfirmPayload, request: Request, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    if not _is_valid_email(email):
        raise HTTPException(400, detail="Invalid email")
    if not payload.code or len(payload.code) < 4:
        raise HTTPException(400, detail="Invalid code")
    if not payload.new_password or len(payload.new_password) < 6:
        raise HTTPException(400, detail="Password too short")

    ip = _client_ip(request)
    _apply_rate_limit(
        "auth_password_reset_confirm",
        identity=f"{ip}|{email}",
        rules=[
            RateLimitRule(limit=8, window_seconds=600, key_suffix=f"email:{email}"),
            RateLimitRule(limit=20, window_seconds=3600, key_suffix=f"ip:{ip}"),
        ],
    )
    _auth_guard_precheck(scope="password_reset_confirm", target=email, ip=ip, captcha_token=payload.captcha_token)

    entry = _get_verification_code("password_reset", email)
    if not entry:
        _raise_after_failure(scope="password_reset_confirm", target=email, ip=ip, status_code=400, detail="Code not requested")
    code, exp = entry
    if datetime.now(timezone.utc) > exp:
        _clear_verification_code("password_reset", email)
        _raise_after_failure(scope="password_reset_confirm", target=email, ip=ip, status_code=400, detail="Code expired")
    if payload.code != code:
        _raise_after_failure(scope="password_reset_confirm", target=email, ip=ip, status_code=400, detail="Invalid code")

    user_row = db.execute(select(users).where(_col("email") == email)).mappings().first()
    if not user_row:
        raise HTTPException(404, detail="User not found")

    db.execute(
        update(users)
        .where(_col("id") == int(user_row.get("id")))
        .values({"password": make_legacy_password(payload.new_password)})
    )
    revoked = revoke_all_refresh_sessions_for_user(db, user_id=int(user_row.get("id")))
    _clear_verification_code("password_reset", email)
    _auth_guard_success(scope="password_reset_confirm", target=email, ip=ip)
    log_audit_event(
        db,
        domain="auth",
        action="password_reset",
        resource_type="user",
        resource_id=str(user_row.get("id")),
        actor_user_id=int(user_row.get("id")),
        request_id=_request_id(request),
        ip=ip,
        user_agent=request.headers.get("user-agent", ""),
        outcome="success",
        payload={"revoked_count": revoked, "email": email},
    )
    db.commit()
    return {"reset": True, "revoked_count": revoked}


@router.post("/logout/")
def logout(payload: LogoutPayload, request: Request, response: Response, db: Session = Depends(get_db)):
    refresh_token = extract_refresh_token(request, payload.refresh)
    if not refresh_token:
        raise HTTPException(401, detail="Invalid refresh token")
    try:
        data = decode_token(refresh_token)
    except Exception:
        raise HTTPException(401, detail="Invalid refresh token")

    if data.get("type") != "refresh":
        raise HTTPException(401, detail="Invalid refresh token")

    jti = str(data.get("jti") or "")
    if not jti:
        raise HTTPException(401, detail="Invalid refresh token")

    affected = revoke_refresh_session(db, jti=jti)
    log_audit_event(
        db,
        domain="auth",
        action="logout",
        resource_type="session",
        resource_id=jti,
        request_id=_request_id(request),
        ip=_client_ip(request),
        user_agent=request.headers.get("user-agent", ""),
        outcome="success" if affected > 0 else "failure",
    )
    db.commit()
    clear_refresh_cookie(response)
    return {"revoked": affected > 0}


@router.post("/logout_all/")
def logout_all(request: Request, response: Response, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    affected = revoke_all_refresh_sessions_for_user(db, user_id=int(user["id"]))
    log_audit_event(
        db,
        domain="auth",
        action="logout_all",
        resource_type="user",
        resource_id=str(user["id"]),
        actor_user_id=int(user["id"]),
        request_id=_request_id(request),
        ip=_client_ip(request),
        user_agent=request.headers.get("user-agent", ""),
        outcome="success",
        payload={"revoked_count": affected},
    )
    db.commit()
    clear_refresh_cookie(response)
    return {"revoked_count": affected}
