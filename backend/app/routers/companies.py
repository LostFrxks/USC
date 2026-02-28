from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import and_, delete, func, insert, select, update
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.deps.auth import get_current_user
from app.db.deps import get_db
from app.db.schema import companies_company as companies
from app.db.schema import companies_companymember as company_members
from app.utils.pagination import drf_page
from app.core.config import settings
from app.cache.redis_cache import get_json, invalidate_patterns, make_key, set_json

router = APIRouter(tags=["companies"])

def _company_col(name: str):
    c = companies.c.get(name)
    if c is None:
        raise HTTPException(500, detail=f"DB schema mismatch: column '{companies.name}.{name}' not found")
    return c

def _company_ids_for_user(db: Session, user_id: int) -> list[int]:
    return [
        int(r[0])
        for r in db.execute(select(company_members.c.company_id).where(company_members.c.user_id == user_id)).all()
    ]

def _ensure_member(db: Session, user_id: int, company_id: int) -> None:
    exists = db.execute(
        select(company_members.c.id).where(
            company_members.c.user_id == user_id,
            company_members.c.company_id == company_id,
        )
    ).first()
    if not exists:
        raise HTTPException(403, detail="Not allowed")

def _serialize_company(row: dict) -> dict:
    return {
        "id": row.get("id"),
        "name": row.get("name"),
        "company_type": row.get("company_type"),
        "phone": row.get("phone"),
        "address": row.get("address"),
        "created_at": row.get("created_at"),
    }



def _invalidate_company_related_cache() -> None:
    invalidate_patterns(
        "v1:companies:*",
        "v1:profile:*",
        "v1:suppliers:*",
        "v1:analytics:*",
        "v1:notifications:*",
    )

class CompanyCreatePayload(BaseModel):
    name: str = Field(min_length=1)
    company_type: str | None = None
    phone: str | None = None
    address: str | None = None

class CompanyUpdatePayload(BaseModel):
    name: str | None = None
    company_type: str | None = None
    phone: str | None = None
    address: str | None = None

@router.get("/companies/")
def list_companies(
    request: Request,
    search: str | None = None,
    limit: int = 50,
    offset: int = 0,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    u_id = int(user["id"])
    term = (search or "").strip()
    cache_key = make_key("companies", "list", u_id, limit, offset, term)
    cached = get_json(cache_key)
    if isinstance(cached, dict):
        return cached

    base = (
        select(companies)
        .select_from(company_members.join(companies, company_members.c.company_id == companies.c.id))
        .where(company_members.c.user_id == u_id)
        .distinct()
    )

    if term and "name" in companies.c:
        base = base.where(companies.c.name.ilike(f"%{term}%"))

    total = db.execute(select(func.count()).select_from(base.subquery())).scalar_one()
    rows = db.execute(base.order_by(companies.c.id.desc()).limit(limit).offset(offset)).mappings().all()
    items = [_serialize_company(dict(r)) for r in rows]
    response = drf_page(items=items, total=total, limit=limit, offset=offset, path=str(request.url.path))
    set_json(cache_key, response, settings.CACHE_TTL_COMPANIES)
    return response

@router.get("/companies/{company_id:int}/")
def get_company(
    company_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    u_id = int(user["id"])
    _ensure_member(db, u_id, company_id)
    cache_key = make_key("companies", "detail", u_id, company_id)
    cached = get_json(cache_key)
    if isinstance(cached, dict):
        return cached

    row = db.execute(select(companies).where(companies.c.id == company_id)).mappings().first()
    if not row:
        raise HTTPException(404, detail="Company not found")
    response = _serialize_company(dict(row))
    set_json(cache_key, response, settings.CACHE_TTL_COMPANIES)
    return response

@router.post("/companies/")
def create_company(
    payload: CompanyCreatePayload,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    values: dict = {"name": payload.name.strip()}
    if "company_type" in companies.c:
        values["company_type"] = payload.company_type or "BUYER"
    if "phone" in companies.c:
        values["phone"] = payload.phone or ""
    if "address" in companies.c:
        values["address"] = payload.address or ""
    if "created_at" in companies.c:
        values["created_at"] = now

    try:
        ins = insert(companies).values(values).returning(_company_col("id"))
        company_id = int(db.execute(ins).scalar_one())
        member_values = {"user_id": int(user["id"]), "company_id": company_id}
        if "role" in company_members.c:
            member_values["role"] = "OWNER"
        if "created_at" in company_members.c:
            member_values["created_at"] = now
        db.execute(insert(company_members).values(member_values))
        db.commit()
        _invalidate_company_related_cache()
    except Exception as e:
        db.rollback()
        raise HTTPException(400, detail=f"Company create failed. DB says: {e}")

    row = db.execute(select(companies).where(companies.c.id == company_id)).mappings().first()
    return _serialize_company(dict(row)) if row else {"id": company_id, **values}

@router.patch("/companies/{company_id:int}/")
def update_company(
    company_id: int,
    payload: CompanyUpdatePayload,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_member(db, int(user["id"]), company_id)
    values: dict = {}
    if payload.name is not None and "name" in companies.c:
        values["name"] = payload.name.strip()
    if payload.company_type is not None and "company_type" in companies.c:
        values["company_type"] = payload.company_type
    if payload.phone is not None and "phone" in companies.c:
        values["phone"] = payload.phone
    if payload.address is not None and "address" in companies.c:
        values["address"] = payload.address

    if values:
        db.execute(update(companies).where(companies.c.id == company_id).values(values))
        db.commit()
        _invalidate_company_related_cache()

    row = db.execute(select(companies).where(companies.c.id == company_id)).mappings().first()
    if not row:
        raise HTTPException(404, detail="Company not found")
    return _serialize_company(dict(row))

@router.delete("/companies/{company_id:int}/", status_code=204)
def delete_company(
    company_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_member(db, int(user["id"]), company_id)
    try:
        db.execute(delete(companies).where(companies.c.id == company_id))
        db.commit()
        _invalidate_company_related_cache()
    except Exception as e:
        db.rollback()
        raise HTTPException(400, detail=f"Company delete failed. DB says: {e}")
    return None


@router.get("/companies/my_memberships/")
def my_memberships(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    u_id = int(user["id"])
    cache_key = make_key("companies", "memberships", u_id)
    cached = get_json(cache_key)
    if isinstance(cached, list):
        return cached

    cols = [
        company_members,
        companies.c.id.label("company_id"),
        companies.c.name.label("company_name"),
        companies.c.company_type.label("company_type"),
    ]
    if "phone" in companies.c:
        cols.append(companies.c.phone.label("company_phone"))
    if "address" in companies.c:
        cols.append(companies.c.address.label("company_address"))
    if "created_at" in companies.c:
        cols.append(companies.c.created_at.label("company_created_at"))

    rows = db.execute(
        select(*cols)
        .select_from(company_members.join(companies, company_members.c.company_id == companies.c.id))
        .where(company_members.c.user_id == u_id)
        .order_by(company_members.c.id.asc())
    ).mappings().all()

    out = []
    for r in rows:
        out.append(
            {
                "id": r.get("id"),
                "role": r.get("role"),
                "company": {
                    "id": r.get("company_id"),
                    "name": r.get("company_name"),
                    "company_type": r.get("company_type"),
                    "phone": r.get("company_phone"),
                    "address": r.get("company_address"),
                    "created_at": r.get("company_created_at"),
                },
                "created_at": r.get("created_at"),
            }
        )

    set_json(cache_key, out, settings.CACHE_TTL_MEMBERSHIPS)
    return out


@router.get("/companies/suppliers/")
def list_suppliers(
    request: Request,
    limit: int = 50,
    offset: int = 0,
    search: str | None = None,  # text search param
    q: str | None = None,  # alias
    db: Session = Depends(get_db),
):
    term = (search or q or "").strip()
    cache_key = make_key("suppliers", "list", limit, offset, term)
    cached = get_json(cache_key)
    if isinstance(cached, dict):
        return cached

    base = select(companies)

    filters = []

    # Prefer canonical schema: companies_company.company_type = "SUPPLIER"
    if "company_type" in companies.c:
        filters.append(companies.c.company_type == "SUPPLIER")
    elif "is_supplier" in companies.c:
        filters.append(companies.c.is_supplier == True)  # noqa: E712

    if term and "name" in companies.c:
        filters.append(companies.c.name.ilike(f"%{term}%"))

    if filters:
        base = base.where(and_(*filters))

    total = db.execute(select(func.count()).select_from(base.subquery())).scalar_one()
    rows = db.execute(base.order_by(companies.c.id.desc()).limit(limit).offset(offset)).mappings().all()

    items = []
    for row in rows:
        r = dict(row)
        items.append(
            {
                "id": r.get("id"),
                "name": r.get("name") or r.get("title") or f"Supplier #{r.get('id')}",
                "address": r.get("address"),
                "phone": r.get("phone"),
            }
        )

    response = drf_page(items=items, total=total, limit=limit, offset=offset, path=str(request.url.path))
    set_json(cache_key, response, settings.CACHE_TTL_SUPPLIERS)
    return response


