from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.cache.redis_cache import get_json, invalidate_patterns, make_key, set_json
from app.core.config import settings
from app.db.deps import get_db
from app.db.schema import accounts_user as users
from app.db.schema import companies_company as companies
from app.db.schema import companies_companymember as company_members
from app.deps.auth import get_current_user
from app.services.audit import log_audit_event

router = APIRouter(tags=["profile"])

ROLE_COLUMNS = ("role", "user_role", "user_type", "account_type")


def _get_role_from_row(row: dict) -> str | None:
    for col in ROLE_COLUMNS:
        if col in users.c and row.get(col) is not None:
            return str(row.get(col))
    return None


def _default_company_name(email: str, first_name: str, last_name: str) -> str:
    label = "USC Company"
    name = " ".join([first_name.strip(), last_name.strip()]).strip()
    if name:
        label = name
    elif email and "@" in email:
        label = email.split("@", 1)[0]
    return f"{label} Co."


def _normalize_phone(phone: str) -> str:
    return "".join(ch for ch in str(phone or "") if ch.isdigit() or ch == "+")


def _is_valid_email(email: str) -> bool:
    if not email or "@" not in email:
        return False
    parts = email.split("@")
    return len(parts) == 2 and all(parts)


class ProfileUpdatePayload(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    email: str | None = None
    active_company_id: int | None = None
    company_name: str | None = None
    company_phone: str | None = None
    company_address: str | None = None


def _ensure_company_for_user(*, user: dict, db: Session):
    u_id = int(user["id"])
    exists = db.execute(select(company_members.c.id).where(company_members.c.user_id == u_id)).first()
    if exists:
        return

    company_type = "SUPPLIER" if str(_get_role_from_row(user) or "").lower() == "supplier" else "BUYER"
    now = datetime.now(timezone.utc)

    values = {"name": _default_company_name(user.get("email") or "", user.get("first_name") or "", user.get("last_name") or "")}
    if "company_type" in companies.c:
        values["company_type"] = company_type
    if "phone" in companies.c:
        values["phone"] = ""
    if "address" in companies.c:
        values["address"] = ""
    if "created_at" in companies.c:
        values["created_at"] = now

    ins = companies.insert().values(values).returning(companies.c.id)
    company_id = int(db.execute(ins).scalar_one())

    member_values = {"user_id": u_id, "company_id": company_id}
    if "role" in company_members.c:
        member_values["role"] = "OWNER"
    if "created_at" in company_members.c:
        member_values["created_at"] = now

    db.execute(company_members.insert().values(member_values))
    db.commit()


def _me_payload(*, user: dict, db: Session):
    u_id = int(user["id"])

    rows = db.execute(
        select(
            company_members.c.company_id.label("company_id"),
            companies.c.name.label("name"),
            companies.c.company_type.label("company_type"),
            companies.c.phone.label("phone"),
            companies.c.address.label("address"),
            company_members.c.role.label("role"),
        )
        .select_from(company_members.join(companies, company_members.c.company_id == companies.c.id))
        .where(company_members.c.user_id == u_id)
        .order_by(company_members.c.id.asc())
    ).mappings().all()

    if not rows:
        try:
            _ensure_company_for_user(user=user, db=db)
            rows = db.execute(
                select(
                    company_members.c.company_id.label("company_id"),
                    companies.c.name.label("name"),
                    companies.c.company_type.label("company_type"),
                    companies.c.phone.label("phone"),
                    companies.c.address.label("address"),
                    company_members.c.role.label("role"),
                )
                .select_from(company_members.join(companies, company_members.c.company_id == companies.c.id))
                .where(company_members.c.user_id == u_id)
                .order_by(company_members.c.id.asc())
            ).mappings().all()
        except Exception:
            rows = []

    companies_payload = [
        {
            "company_id": int(r["company_id"]),
            "name": r["name"],
            "company_type": r["company_type"],
            "phone": r.get("phone"),
            "address": r.get("address"),
            "role": r["role"],
        }
        for r in rows
    ]

    role = _get_role_from_row(user)
    if not role:
        has_supplier = any(str(r.get("company_type") or "").upper() == "SUPPLIER" for r in rows)
        has_buyer = any(str(r.get("company_type") or "").upper() == "BUYER" for r in rows)
        if has_supplier:
            role = "supplier"
        elif has_buyer:
            role = "buyer"

    return {
        "id": u_id,
        "email": user.get("email"),
        "first_name": user.get("first_name") or "",
        "last_name": user.get("last_name") or "",
        "phone": user.get("phone") or "",
        "role": role,
        "is_courier_enabled": bool(user.get("is_courier_enabled") or False),
        "companies": companies_payload,
    }


@router.get("/me/")
def me(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    u_id = int(user["id"])
    cache_key = make_key("profile", "me", u_id)
    cached = get_json(cache_key)
    if isinstance(cached, dict):
        return cached

    payload = _me_payload(user=user, db=db)
    set_json(cache_key, payload, settings.CACHE_TTL_PROFILE_ME)
    return payload


@router.get("/auth/me/")
def me_auth(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    u_id = int(user["id"])
    cache_key = make_key("profile", "auth_me", u_id)
    cached = get_json(cache_key)
    if isinstance(cached, dict):
        return cached

    payload = _me_payload(user=user, db=db)
    set_json(cache_key, payload, settings.CACHE_TTL_PROFILE_ME)
    return payload


@router.patch("/profile/me/")
def update_me(payload: ProfileUpdatePayload, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    u_id = int(user["id"])
    current_user = db.execute(select(users).where(users.c.id == u_id)).mappings().first()
    if not current_user:
        raise HTTPException(404, detail="User not found")

    user_updates: dict[str, str] = {}
    if payload.first_name is not None:
        user_updates["first_name"] = payload.first_name.strip()
    if payload.last_name is not None:
        user_updates["last_name"] = payload.last_name.strip()
    if payload.phone is not None:
        normalized_phone = _normalize_phone(payload.phone)
        if normalized_phone:
            exists_phone = db.execute(
                select(users.c.id).where(users.c.phone == normalized_phone, users.c.id != u_id)
            ).first()
            if exists_phone:
                raise HTTPException(status_code=409, detail="Phone already in use")
        user_updates["phone"] = normalized_phone
    if payload.email is not None:
        email = payload.email.strip().lower()
        if not _is_valid_email(email):
            raise HTTPException(status_code=422, detail="Invalid email")
        exists_email = db.execute(select(users.c.id).where(users.c.email == email, users.c.id != u_id)).first()
        if exists_email:
            raise HTTPException(status_code=409, detail="Email already in use")
        user_updates["email"] = email

    if user_updates:
        db.execute(update(users).where(users.c.id == u_id).values(user_updates))

    company_updates: dict[str, str] = {}
    if payload.company_name is not None:
        company_updates["name"] = payload.company_name.strip()
    if payload.company_phone is not None:
        company_updates["phone"] = _normalize_phone(payload.company_phone)
    if payload.company_address is not None:
        company_updates["address"] = payload.company_address.strip()

    if company_updates:
        active_company_id = int(payload.active_company_id or 0)
        if active_company_id <= 0:
            raise HTTPException(status_code=422, detail="active_company_id is required for company update")
        membership = db.execute(
            select(company_members.c.id).where(
                company_members.c.user_id == u_id, company_members.c.company_id == active_company_id
            )
        ).first()
        if not membership:
            raise HTTPException(status_code=403, detail="No permission to update this company")
        db.execute(update(companies).where(companies.c.id == active_company_id).values(company_updates))

    log_audit_event(
        db,
        domain="profile",
        action="profile_update",
        resource_type="user",
        resource_id=str(u_id),
        actor_user_id=u_id,
        actor_company_id=payload.active_company_id,
        outcome="success",
        payload={"user_fields": sorted(user_updates.keys()), "company_fields": sorted(company_updates.keys())},
    )
    db.commit()
    invalidate_patterns("v1:profile:*", "v1:companies:*")

    refreshed_user = db.execute(select(users).where(users.c.id == u_id)).mappings().first()
    if not refreshed_user:
        raise HTTPException(500, detail="Failed to load updated profile")
    response = _me_payload(user=dict(refreshed_user), db=db)
    return response
