from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import insert, or_, select, update
from sqlalchemy.orm import Session

from app.deps.auth import get_current_user
from app.cache.redis_cache import get_json, invalidate_patterns, make_key, set_json
from app.core.config import settings
from app.db.deps import get_db
from app.db.schema import accounts_user as users
from app.db.schema import companies_companymember as company_members
from app.db.schema import delivery_deliveryassignment as deliveries
from app.db.schema import orders_order as orders

router = APIRouter(tags=["deliveries"])


def _col(tbl: Table, name: str):
    c = tbl.c.get(name)
    if c is None:
        raise HTTPException(500, detail=f"DB schema mismatch: column '{tbl.name}.{name}' not found")
    return c


def _company_ids_for_user(db: Session, user_id: int) -> list[int]:
    return [int(r[0]) for r in db.execute(select(company_members.c.company_id).where(company_members.c.user_id == user_id)).all()]


def _is_order_participant(db: Session, user_id: int, order_row: dict) -> bool:
    ids = _company_ids_for_user(db, user_id)
    if not ids:
        return False
    return int(order_row.get("buyer_company_id")) in ids or int(order_row.get("supplier_company_id")) in ids




def _invalidate_delivery_related_cache() -> None:
    invalidate_patterns("v1:deliveries:*", "v1:orders:*", "v1:notifications:*", "v1:analytics:*")

class DeliveryUpsertPayload(BaseModel):
    order: int = Field(..., ge=1)
    courier: int | None = Field(default=None, ge=1)
    tracking_link: str = ""
    notes: str = ""


class DeliverySetStatusPayload(BaseModel):
    status: str


@router.get("/deliveries/")
def list_deliveries(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    u_id = int(user["id"])
    cache_key = make_key("deliveries", "list", u_id)
    cached = get_json(cache_key)
    if isinstance(cached, list):
        return cached

    company_ids = _company_ids_for_user(db, u_id)

    conds = [deliveries.c.courier_id == u_id]
    if company_ids:
        conds.append(orders.c.buyer_company_id.in_(company_ids))
        conds.append(orders.c.supplier_company_id.in_(company_ids))

    q = (
        select(deliveries)
        .select_from(deliveries.join(orders, deliveries.c.order_id == orders.c.id))
        .where(or_(*conds))
        .order_by(deliveries.c.created_at.desc() if "created_at" in deliveries.c else deliveries.c.id.desc())
    )

    rows = db.execute(q).mappings().all()
    response = [dict(r) for r in rows]
    set_json(cache_key, response, settings.CACHE_TTL_DELIVERIES)
    return response


@router.get("/deliveries/by_order/{order_id}/")
def get_delivery_by_order(
    order_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    u_id = int(user["id"])
    cache_key = make_key("deliveries", "by_order", u_id, order_id)
    cached = get_json(cache_key)
    if isinstance(cached, dict):
        return None if cached.get("__empty__") else cached

    order_row = db.execute(select(orders).where(orders.c.id == order_id)).mappings().first()
    if not order_row:
        raise HTTPException(404, detail="order not found")

    if not _is_order_participant(db, u_id, dict(order_row)):
        raise HTTPException(403, detail="Not allowed")

    row = db.execute(select(deliveries).where(deliveries.c.order_id == order_id)).mappings().first()
    response = dict(row) if row else None
    set_json(cache_key, response if response is not None else {"__empty__": True}, settings.CACHE_TTL_DELIVERIES)
    return response


@router.post("/deliveries/upsert_for_order/")
def upsert_for_order(
    payload: DeliveryUpsertPayload,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    u_id = int(user["id"])

    order_row = db.execute(select(orders).where(orders.c.id == payload.order)).mappings().first()
    if not order_row:
        raise HTTPException(404, detail="order not found")

    if not _is_order_participant(db, u_id, dict(order_row)):
        raise HTTPException(403, detail="Not allowed")

    # validate courier (optional)
    courier_id = payload.courier
    if courier_id is not None:
        courier = db.execute(select(users).where(users.c.id == courier_id)).mappings().first()
        if not courier:
            raise HTTPException(404, detail="courier not found")
        if "is_courier_enabled" in users.c and not courier.get("is_courier_enabled", False):
            raise HTTPException(400, detail="user is not courier-enabled")

    existing = db.execute(select(deliveries).where(deliveries.c.order_id == payload.order)).mappings().first()
    now = datetime.now(timezone.utc)

    if existing:
        values = {
            "tracking_link": payload.tracking_link or "",
            "notes": payload.notes or "",
        }
        if courier_id is not None:
            values["courier_id"] = courier_id
        db.execute(update(deliveries).where(deliveries.c.id == existing["id"]).values(values))
        db.commit()
        _invalidate_delivery_related_cache()
        row = db.execute(select(deliveries).where(deliveries.c.id == existing["id"])).mappings().first()
        return dict(row) if row else dict(existing)

    # create
    values = {
        "order_id": payload.order,
        "tracking_link": payload.tracking_link or "",
        "notes": payload.notes or "",
    }
    if "created_at" in deliveries.c:
        values["created_at"] = now
    if courier_id is not None:
        values["courier_id"] = courier_id
    if "status" in deliveries.c:
        values["status"] = "ASSIGNED"

    try:
        ins = insert(deliveries).values(values).returning(_col(deliveries, "id"))
        delivery_id = int(db.execute(ins).scalar_one())
        db.commit()
        _invalidate_delivery_related_cache()
    except Exception as e:
        db.rollback()
        raise HTTPException(400, detail=f"Upsert failed. DB says: {e}")

    row = db.execute(select(deliveries).where(deliveries.c.id == delivery_id)).mappings().first()
    return dict(row) if row else {"id": delivery_id, **values}


@router.post("/deliveries/{delivery_id}/set_status/")
def set_status(
    delivery_id: int,
    payload: DeliverySetStatusPayload,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    delivery = db.execute(select(deliveries).where(deliveries.c.id == delivery_id)).mappings().first()
    if not delivery:
        raise HTTPException(404, detail="delivery not found")

    order_row = db.execute(select(orders).where(orders.c.id == delivery["order_id"])).mappings().first()
    if not order_row:
        raise HTTPException(404, detail="order not found")

    u_id = int(user["id"])
    participant = _is_order_participant(db, u_id, dict(order_row))
    is_courier = delivery.get("courier_id") is not None and int(delivery["courier_id"]) == u_id
    if not (participant or is_courier):
        raise HTTPException(403, detail="Not allowed")

    allowed = {"ASSIGNED", "PICKED_UP", "ON_THE_WAY", "DELIVERED", "FAILED"}
    if payload.status not in allowed:
        raise HTTPException(400, detail=f"status must be one of {sorted(allowed)}")

    db.execute(update(deliveries).where(deliveries.c.id == delivery_id).values({"status": payload.status}))

    # Sync order status (minimal logic)
    order_status = str(order_row.get("status") or "")
    if payload.status == "ON_THE_WAY" and order_status not in {"CANCELLED", "DELIVERED"}:
        db.execute(update(orders).where(orders.c.id == order_row["id"]).values({"status": "DELIVERING"}))

    if payload.status == "DELIVERED" and order_status != "CANCELLED":
        db.execute(update(orders).where(orders.c.id == order_row["id"]).values({"status": "DELIVERED"}))

    db.commit()
    _invalidate_delivery_related_cache()

    updated = db.execute(select(deliveries).where(deliveries.c.id == delivery_id)).mappings().first()
    return dict(updated) if updated else dict(delivery)
