from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps.auth import get_current_user
from app.cache.redis_cache import get_json, make_key, set_json
from app.core.config import settings
from app.db.deps import get_db
from app.db.schema import accounts_user as users
from app.db.schema import companies_company as companies
from app.db.schema import companies_companymember as company_members

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
