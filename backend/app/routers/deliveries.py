from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import Table, insert, or_, select, update
from sqlalchemy.orm import Session

from app.cache.redis_cache import get_json, invalidate_patterns, make_key, set_json
from app.core.config import settings
from app.db.deps import get_db
from app.db.schema import accounts_user as users
from app.db.schema import companies_companymember as company_members
from app.db.schema import delivery_deliveryassignment as deliveries
from app.db.schema import orders_order as orders
from app.db.schema import orders_orderitem as order_items
from app.deps.auth import get_current_user
from app.domain.order_state import (
    DELIVERY_STATUS_DELIVERED,
    DELIVERY_STATUS_FAILED,
    DELIVERY_STATUS_ON_THE_WAY,
    DELIVERY_STATUS_PARTIALLY_DELIVERED,
    ORDER_STATUS_DELIVERED,
    ORDER_STATUS_DELIVERING,
    ORDER_STATUS_FAILED,
    ORDER_STATUS_PARTIALLY_DELIVERED,
    can_transition_delivery,
    can_transition_order,
)
from app.services.audit import log_audit_event
from app.services.notifications import create_notification_event

router = APIRouter(tags=["deliveries"])


def _domain_error(code: str, message: str, *, details: dict | None = None) -> dict:
    payload = {"error": {"code": code, "message": message}}
    if details:
        payload["error"]["details"] = details
    return payload


def _col(tbl: Table, name: str):
    c = tbl.c.get(name)
    if c is None:
        raise HTTPException(500, detail=f"DB schema mismatch: column '{tbl.name}.{name}' not found")
    return c


def _company_ids_for_user(db: Session, user_id: int) -> list[int]:
    return [int(r[0]) for r in db.execute(select(company_members.c.company_id).where(company_members.c.user_id == user_id)).all()]


def _user_ids_for_company(db: Session, company_id: int) -> list[int]:
    return [
        int(r[0])
        for r in db.execute(select(company_members.c.user_id).where(company_members.c.company_id == int(company_id))).all()
    ]


def _member_role_for_company(db: Session, user_id: int, company_id: int) -> str | None:
    row = db.execute(
        select(company_members.c.role).where(
            company_members.c.user_id == int(user_id),
            company_members.c.company_id == int(company_id),
        )
    ).first()
    if not row or row[0] is None:
        return None
    return str(row[0]).upper()


def _is_order_participant(db: Session, user_id: int, order_row: dict) -> bool:
    ids = _company_ids_for_user(db, user_id)
    if not ids:
        return False
    return int(order_row.get("buyer_company_id")) in ids or int(order_row.get("supplier_company_id")) in ids


def _is_supplier_delivery_manager(db: Session, user_id: int, order_row: dict) -> bool:
    supplier_company_id = int(order_row.get("supplier_company_id"))
    return _member_role_for_company(db, user_id, supplier_company_id) in {"OWNER", "ADMIN", "MANAGER"}


def _can_be_assigned_courier(db: Session, courier_id: int, order_row: dict) -> bool:
    buyer_company_id = int(order_row.get("buyer_company_id"))
    supplier_company_id = int(order_row.get("supplier_company_id"))
    return _member_role_for_company(db, courier_id, buyer_company_id) is not None or _member_role_for_company(
        db, courier_id, supplier_company_id
    ) is not None


def _assignable_couriers_for_order(db: Session, order_row: dict) -> list[dict]:
    company_ids = [int(order_row.get("buyer_company_id")), int(order_row.get("supplier_company_id"))]
    rows = db.execute(
        select(users, company_members.c.company_id)
        .select_from(company_members.join(users, company_members.c.user_id == users.c.id))
        .where(
            company_members.c.company_id.in_(company_ids),
            users.c.is_courier_enabled == True,  # noqa: E712
        )
        .order_by(users.c.id.asc())
    ).mappings().all()

    out: dict[int, dict] = {}
    for row in rows:
        user_id = int(row["id"])
        if user_id not in out:
            out[user_id] = {
                "id": user_id,
                "email": row.get("email") or "",
                "first_name": row.get("first_name") or "",
                "last_name": row.get("last_name") or "",
                "phone": row.get("phone") or "",
                "company_ids": [],
            }
        out[user_id]["company_ids"].append(int(row["company_id"]))
    return list(out.values())


def _invalidate_delivery_related_cache() -> None:
    invalidate_patterns("v1:deliveries:*", "v1:orders:*", "v1:notifications:*", "v1:analytics:*")


class DeliveryUpsertPayload(BaseModel):
    order: int = Field(..., ge=1)
    courier: int | None = Field(default=None, ge=1)
    tracking_link: str = ""
    notes: str = ""


class DeliveryItemFulfillmentPayload(BaseModel):
    product_id: int = Field(..., ge=1)
    fulfilled_qty: float = Field(..., ge=0)
    undelivered_qty: float = Field(default=0, ge=0)


class DeliverySetStatusPayload(BaseModel):
    status: str
    items: list[DeliveryItemFulfillmentPayload] | None = None


def _sync_order_fulfillment_for_delivered(db: Session, order_id: int) -> None:
    rows = db.execute(select(order_items).where(order_items.c.order_id == order_id)).mappings().all()
    for row in rows:
        qty = row.get("qty")
        if not isinstance(qty, Decimal):
            qty = Decimal(str(qty))
        db.execute(
            update(order_items)
            .where(order_items.c.id == row["id"])
            .values({"fulfilled_qty": qty, "undelivered_qty": Decimal("0")})
        )


def _apply_partial_fulfillment(db: Session, order_id: int, items: list[DeliveryItemFulfillmentPayload]) -> None:
    if not items:
        raise HTTPException(
            422,
            detail=_domain_error(
                "PARTIAL_ITEMS_REQUIRED",
                "items with fulfillment data are required for PARTIALLY_DELIVERED",
            ),
        )
    item_rows = db.execute(select(order_items).where(order_items.c.order_id == order_id)).mappings().all()
    item_map = {int(r["product_id"]): dict(r) for r in item_rows}
    for it in items:
        row = item_map.get(int(it.product_id))
        if not row:
            raise HTTPException(
                422,
                detail=_domain_error(
                    "ORDER_ITEM_NOT_FOUND",
                    "product_id is not present in order items",
                    details={"product_id": it.product_id},
                ),
            )
        qty = row.get("qty")
        if not isinstance(qty, Decimal):
            qty = Decimal(str(qty))
        fulfilled = Decimal(str(it.fulfilled_qty))
        undelivered = Decimal(str(it.undelivered_qty))
        if fulfilled + undelivered > qty:
            raise HTTPException(
                422,
                detail=_domain_error(
                    "FULFILLMENT_OVERFLOW",
                    "fulfilled_qty + undelivered_qty cannot exceed ordered qty",
                    details={"product_id": it.product_id},
                ),
            )
        db.execute(
            update(order_items)
            .where(order_items.c.id == row["id"])
            .values({"fulfilled_qty": fulfilled, "undelivered_qty": undelivered})
        )


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
        select(deliveries, orders.c.comment.label("order_comment"))
        .select_from(deliveries.join(orders, deliveries.c.order_id == orders.c.id))
        .where(or_(*conds))
        .order_by(deliveries.c.created_at.desc() if "created_at" in deliveries.c else deliveries.c.id.desc())
    )
    rows = db.execute(q).mappings().all()
    response = [dict(r) for r in rows]
    set_json(cache_key, response, settings.CACHE_TTL_DELIVERIES)
    return response


@router.get("/deliveries/by_order/{order_id}/")
def get_delivery_by_order(order_id: int, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
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


@router.get("/deliveries/couriers/by_order/{order_id}/")
def get_assignable_couriers(order_id: int, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    order_row = db.execute(select(orders).where(orders.c.id == order_id)).mappings().first()
    if not order_row:
        raise HTTPException(404, detail="order not found")
    if not _is_supplier_delivery_manager(db, int(user["id"]), dict(order_row)):
        raise HTTPException(403, detail="Only supplier delivery managers can view assignable couriers")

    cache_key = make_key("deliveries", "couriers_by_order", int(user["id"]), order_id)
    cached = get_json(cache_key)
    if isinstance(cached, list):
        return cached

    response = _assignable_couriers_for_order(db, dict(order_row))
    set_json(cache_key, response, settings.CACHE_TTL_DELIVERIES)
    return response


@router.post("/deliveries/upsert_for_order/")
def upsert_for_order(payload: DeliveryUpsertPayload, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    u_id = int(user["id"])
    order_row = db.execute(select(orders).where(orders.c.id == payload.order)).mappings().first()
    if not order_row:
        raise HTTPException(404, detail="order not found")
    if not _is_supplier_delivery_manager(db, u_id, dict(order_row)):
        raise HTTPException(403, detail="Only supplier delivery managers can assign courier or edit delivery")

    courier_id = payload.courier
    if courier_id is not None:
        courier = db.execute(select(users).where(users.c.id == courier_id)).mappings().first()
        if not courier:
            raise HTTPException(404, detail="courier not found")
        if "is_courier_enabled" in users.c and not courier.get("is_courier_enabled", False):
            raise HTTPException(400, detail="user is not courier-enabled")
        if not _can_be_assigned_courier(db, courier_id, dict(order_row)):
            raise HTTPException(400, detail="courier must belong to buyer or supplier company")

    existing = db.execute(select(deliveries).where(deliveries.c.order_id == payload.order)).mappings().first()
    now = datetime.now(timezone.utc)

    if existing:
        values = {"tracking_link": payload.tracking_link or "", "notes": payload.notes or ""}
        if courier_id is not None:
            values["courier_id"] = courier_id
        db.execute(update(deliveries).where(deliveries.c.id == existing["id"]).values(values))
        db.commit()
        _invalidate_delivery_related_cache()
        row = db.execute(select(deliveries).where(deliveries.c.id == existing["id"])).mappings().first()
        return dict(row) if row else dict(existing)

    values = {"order_id": payload.order, "tracking_link": payload.tracking_link or "", "notes": payload.notes or ""}
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
    request: Request,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    delivery = db.execute(select(deliveries).where(deliveries.c.id == delivery_id).with_for_update()).mappings().first()
    if not delivery:
        raise HTTPException(404, detail="delivery not found")

    order_row = db.execute(select(orders).where(orders.c.id == delivery["order_id"]).with_for_update()).mappings().first()
    if not order_row:
        raise HTTPException(404, detail="order not found")

    u_id = int(user["id"])
    participant = _is_order_participant(db, u_id, dict(order_row))
    supplier_manager = _is_supplier_delivery_manager(db, u_id, dict(order_row))
    is_courier = delivery.get("courier_id") is not None and int(delivery["courier_id"]) == u_id
    if not (supplier_manager or is_courier):
        raise HTTPException(403, detail="Only assigned courier or supplier delivery manager can change delivery status")

    current_delivery_status = str(delivery.get("status") or "")
    target_delivery_status = (payload.status or "").upper()
    if not can_transition_delivery(current_delivery_status, target_delivery_status):
        raise HTTPException(
            409,
            detail=_domain_error(
                "INVALID_STATE_TRANSITION",
                "Delivery transition is not allowed",
                details={"from": current_delivery_status, "to": target_delivery_status},
            ),
        )

    db.execute(update(deliveries).where(deliveries.c.id == delivery_id).values({"status": target_delivery_status}))

    current_order_status = str(order_row.get("status") or "")
    target_order_status: str | None = None
    if target_delivery_status == DELIVERY_STATUS_ON_THE_WAY:
        target_order_status = ORDER_STATUS_DELIVERING
    elif target_delivery_status == DELIVERY_STATUS_PARTIALLY_DELIVERED:
        target_order_status = ORDER_STATUS_PARTIALLY_DELIVERED
        _apply_partial_fulfillment(db, int(order_row["id"]), payload.items or [])
    elif target_delivery_status == DELIVERY_STATUS_DELIVERED:
        target_order_status = ORDER_STATUS_DELIVERED
        _sync_order_fulfillment_for_delivered(db, int(order_row["id"]))
    elif target_delivery_status == DELIVERY_STATUS_FAILED:
        target_order_status = ORDER_STATUS_FAILED

    if target_order_status and can_transition_order(current_order_status, target_order_status):
        db.execute(update(orders).where(orders.c.id == order_row["id"]).values({"status": target_order_status}))

    recipient_user_ids = sorted(
        {
            *_user_ids_for_company(db, int(order_row.get("buyer_company_id"))),
            *_user_ids_for_company(db, int(order_row.get("supplier_company_id"))),
        }
    )
    create_notification_event(
        db,
        domain="delivery",
        event_type="delivery_status_changed",
        resource_type="delivery",
        resource_id=str(delivery_id),
        title=f"Доставка по заказу USC-{int(order_row['id'])}",
        text=f"Статус: {target_delivery_status}",
        user_ids=recipient_user_ids,
        payload={
            "delivery_id": delivery_id,
            "order_id": int(order_row["id"]),
            "from": current_delivery_status,
            "to": target_delivery_status,
        },
    )

    log_audit_event(
        db,
        domain="deliveries",
        action="set_status",
        resource_type="delivery",
        resource_id=str(delivery_id),
        actor_user_id=u_id,
        actor_company_id=None,
        request_id=getattr(request.state, "request_id", ""),
        ip=request.client.host if request.client else "",
        user_agent=request.headers.get("user-agent", ""),
        payload={"from": current_delivery_status, "to": target_delivery_status, "order_id": int(order_row["id"])},
    )
    db.commit()
    _invalidate_delivery_related_cache()

    updated = db.execute(select(deliveries).where(deliveries.c.id == delivery_id)).mappings().first()
    return dict(updated) if updated else dict(delivery)
