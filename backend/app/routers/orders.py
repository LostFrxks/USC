from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import Table, func, insert, select, update
from sqlalchemy.orm import Session

from app.cache.redis_cache import get_json, invalidate_patterns, make_key, set_json
from app.core.config import settings
from app.db.deps import get_db
from app.db.schema import catalog_product
from app.db.schema import companies_companymember as company_members
from app.db.schema import delivery_deliveryassignment as delivery_assignment
from app.db.schema import orders_order
from app.db.schema import orders_orderitem as orders_item
from app.deps.auth import get_current_user
from app.domain.order_state import (
    DELIVERY_STATUS_ASSIGNED,
    DELIVERY_STATUS_CANCELLED,
    DELIVERY_STATUS_PICKED_UP,
    ORDER_STATUS_CANCELLED,
    ORDER_STATUS_CONFIRMED,
    ORDER_STATUS_PENDING,
    can_transition_order,
)
from app.services.audit import log_audit_event
from app.services.idempotency import reserve_idempotency, save_idempotency_response
from app.services.notifications import create_notification_event

router = APIRouter(prefix="/orders", tags=["orders"])


class OrderItemCreate(BaseModel):
    product_id: int
    qty: float = Field(..., gt=0)


class OrderCreatePayload(BaseModel):
    address: Optional[str] = None
    delivery_address: Optional[str] = None
    comment: str = ""
    buyer_company_id: int
    supplier_company_id: int
    items: List[OrderItemCreate]
    delivery_mode: Optional[str] = None
    status: Optional[str] = None

    def resolved_address(self) -> str:
        a = (self.delivery_address or self.address or "").strip()
        return a or "-"

    def resolved_delivery_mode(self) -> str:
        raw = (self.delivery_mode or "").strip()
        if not raw:
            return "YANDEX"
        up = raw.upper()
        if up in {"BUYER_COURIER", "SUPPLIER_COURIER", "YANDEX"}:
            return up
        if up in {"DELIVERY", "PICKUP"}:
            return "SUPPLIER_COURIER"
        return raw

    def resolved_status(self) -> str:
        raw = (self.status or "").strip()
        if not raw:
            return ORDER_STATUS_PENDING
        up = raw.upper()
        if up == "CREATED":
            return ORDER_STATUS_PENDING
        if up == ORDER_STATUS_PENDING:
            return ORDER_STATUS_PENDING
        return up


class OrderCreateResponse(BaseModel):
    id: int
    status: str


class OrderListRow(BaseModel):
    id: int
    status: str
    created_at: Optional[datetime] = None
    delivery_address: Optional[str] = None
    comment: Optional[str] = None
    items_count: Optional[int] = None
    total: Optional[float] = None


class OrderItemOut(BaseModel):
    product_id: int
    qty: float
    fulfilled_qty: float
    undelivered_qty: float
    price_snapshot: Optional[float] = None
    name: Optional[str] = None


class OrderDetailOut(BaseModel):
    id: int
    status: str
    created_at: Optional[datetime] = None
    delivery_address: Optional[str] = None
    comment: Optional[str] = None
    buyer_company_id: int
    supplier_company_id: int
    items: List[OrderItemOut]


def _domain_error(code: str, message: str, *, details: dict[str, Any] | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {"error": {"code": code, "message": message}}
    if details:
        payload["error"]["details"] = details
    return payload


def _col(tbl: Table, name: str):
    c = tbl.c.get(name)
    if c is None:
        raise HTTPException(500, detail=f"DB schema mismatch: column '{tbl.name}.{name}' not found")
    return c


def _company_ids_for_user(db: Session, user_id: int) -> list[int]:
    return [
        int(r[0])
        for r in db.execute(select(company_members.c.company_id).where(company_members.c.user_id == user_id)).all()
    ]


def _member_of_company(db: Session, user_id: int, company_id: int) -> bool:
    return (
        db.execute(
            select(company_members.c.id).where(
                company_members.c.user_id == int(user_id),
                company_members.c.company_id == int(company_id),
            )
        ).first()
        is not None
    )


def _user_ids_for_company(db: Session, company_id: int) -> list[int]:
    return [
        int(r[0])
        for r in db.execute(select(company_members.c.user_id).where(company_members.c.company_id == int(company_id))).all()
    ]


def _order_participant_user_ids(db: Session, *, buyer_company_id: int, supplier_company_id: int) -> list[int]:
    return sorted({*_user_ids_for_company(db, buyer_company_id), *_user_ids_for_company(db, supplier_company_id)})


def _is_order_participant(db: Session, user_id: int, order_row: dict) -> bool:
    ids = _company_ids_for_user(db, user_id)
    if not ids:
        return False
    return int(order_row.get("buyer_company_id")) in ids or int(order_row.get("supplier_company_id")) in ids


def _serialize_delivery(db: Session, order_id: int) -> dict | None:
    row = db.execute(select(delivery_assignment).where(delivery_assignment.c.order_id == order_id)).mappings().first()
    if not row:
        return None
    return {
        "id": row.get("id"),
        "courier": row.get("courier_id"),
        "status": row.get("status"),
        "tracking_link": row.get("tracking_link"),
        "notes": row.get("notes"),
    }


def _normalize_order_text(
    delivery_address: str | None,
    comment: str | None,
) -> tuple[str | None, str | None]:
    address = (delivery_address or "").strip() or None
    text = (comment or "").strip()
    if address:
        return address, text or None

    if "\n" not in text:
        return None, text or None

    first_line, remainder = text.split("\n", 1)
    inferred_address = first_line.strip() or None
    inferred_comment = remainder.strip() or None
    return inferred_address, inferred_comment


def _order_payload_with_text_fields(payload: dict) -> dict:
    delivery_address, comment = _normalize_order_text(payload.get("delivery_address"), payload.get("comment"))
    data = dict(payload)
    data["delivery_address"] = delivery_address
    data["comment"] = comment
    return data


def _serialize_order_full(db: Session, order_id: int) -> dict:
    order = db.execute(select(orders_order).where(orders_order.c.id == order_id)).mappings().first()
    if not order:
        raise HTTPException(404, detail="Order not found")
    items = db.execute(select(orders_item).where(orders_item.c.order_id == order_id).order_by(orders_item.c.id.asc())).mappings().all()
    data = _order_payload_with_text_fields(dict(order))
    data["items"] = [dict(r) for r in items]
    data["delivery"] = _serialize_delivery(db, order_id)
    return data


def _serialize_orders_bulk(db: Session, order_rows: list[dict]) -> list[dict]:
    if not order_rows:
        return []

    order_ids = [int(row["id"]) for row in order_rows]
    item_rows = db.execute(
        select(orders_item)
        .where(orders_item.c.order_id.in_(order_ids))
        .order_by(orders_item.c.order_id.asc(), orders_item.c.id.asc())
    ).mappings().all()
    delivery_rows = db.execute(
        select(delivery_assignment).where(delivery_assignment.c.order_id.in_(order_ids))
    ).mappings().all()

    items_by_order: dict[int, list[dict]] = {}
    for row in item_rows:
        items_by_order.setdefault(int(row["order_id"]), []).append(dict(row))

    deliveries_by_order = {
        int(row["order_id"]): {
            "id": row.get("id"),
            "courier": row.get("courier_id"),
            "status": row.get("status"),
            "tracking_link": row.get("tracking_link"),
            "notes": row.get("notes"),
        }
        for row in delivery_rows
    }

    serialized: list[dict] = []
    for row in order_rows:
        order_id = int(row["id"])
        payload = _order_payload_with_text_fields(dict(row))
        payload["items"] = items_by_order.get(order_id, [])
        payload["delivery"] = deliveries_by_order.get(order_id)
        serialized.append(payload)
    return serialized


def _invalidate_order_related_cache() -> None:
    invalidate_patterns("v1:orders:*", "v1:notifications:*", "v1:deliveries:*", "v1:products:*", "v1:analytics:*")


@router.get("/", response_model=list[OrderListRow])
def list_orders(
    buyer_company_id: int | None = Query(None, ge=1),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    u_id = int(user["id"])
    cache_key = make_key("orders", "list", u_id, buyer_company_id or "_", limit, offset)
    cached = get_json(cache_key)
    if isinstance(cached, list):
        return cached

    company_ids = _company_ids_for_user(db, u_id)
    if not company_ids:
        return []

    o_id = _col(orders_order, "id")
    o_status = _col(orders_order, "status")
    o_created_at = _col(orders_order, "created_at")
    o_delivery_address = _col(orders_order, "delivery_address")
    o_comment = _col(orders_order, "comment")
    o_buyer = _col(orders_order, "buyer_company_id")
    o_supplier = _col(orders_order, "supplier_company_id")

    oi_order_id = _col(orders_item, "order_id")
    oi_qty = _col(orders_item, "qty")
    oi_price = _col(orders_item, "price_snapshot")

    cond = (o_buyer.in_(company_ids)) | (o_supplier.in_(company_ids))
    if buyer_company_id is not None:
        if buyer_company_id not in company_ids:
            return []
        cond = cond & (o_buyer == buyer_company_id)

    q = (
        select(
            o_id.label("id"),
            o_status.label("status"),
            o_created_at.label("created_at"),
            o_delivery_address.label("delivery_address"),
            o_comment.label("comment"),
            func.count(orders_item.c.id).label("items_count"),
            func.coalesce(func.sum(oi_qty * oi_price), 0).label("total"),
        )
        .select_from(orders_order.outerjoin(orders_item, oi_order_id == o_id))
        .where(cond)
        .group_by(o_id, o_status, o_created_at, o_delivery_address, o_comment)
        .order_by(o_id.desc())
        .limit(limit)
        .offset(offset)
    )

    rows = db.execute(q).mappings().all()
    response = [OrderListRow(**_order_payload_with_text_fields(dict(r))).model_dump() for r in rows]
    set_json(cache_key, response, settings.CACHE_TTL_ORDERS_LIST)
    return response


@router.post("/create/", response_model=OrderCreateResponse)
def create_order(
    payload: OrderCreatePayload,
    request: Request,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not payload.items:
        raise HTTPException(400, detail=_domain_error("EMPTY_ITEMS", "items cannot be empty"))
    status = payload.resolved_status()
    if status != ORDER_STATUS_PENDING:
        raise HTTPException(400, detail=_domain_error("INVALID_INITIAL_STATUS", "Initial order status must be PENDING"))

    u_id = int(user["id"])
    company_ids = _company_ids_for_user(db, u_id)
    if not company_ids or payload.buyer_company_id not in company_ids:
        raise HTTPException(403, detail=_domain_error("BUYER_COMPANY_MISMATCH", "Not allowed: buyer company mismatch"))

    product_ids = [it.product_id for it in payload.items]
    duplicates = sorted({pid for pid in product_ids if product_ids.count(pid) > 1})
    if duplicates:
        raise HTTPException(
            422,
            detail=_domain_error("DUPLICATE_PRODUCT_ID", "Duplicate product_id in payload", details={"product_ids": duplicates}),
        )

    scope = f"buyer:{payload.buyer_company_id}:POST:/orders/create"
    idempotency = reserve_idempotency(
        db,
        scope=scope,
        idempotency_key=idempotency_key or "",
        payload=payload.model_dump(mode="json"),
    )
    if idempotency.state == "conflict":
        raise HTTPException(
            409,
            detail=_domain_error(
                "IDEMPOTENCY_CONFLICT",
                "Same Idempotency-Key was used with a different payload",
            ),
        )
    if idempotency.state == "in_progress":
        raise HTTPException(
            409,
            detail=_domain_error(
                "IDEMPOTENCY_IN_PROGRESS",
                "Request with this Idempotency-Key is still being processed",
            ),
        )
    if idempotency.state == "replay" and idempotency.response_body:
        return JSONResponse(status_code=idempotency.response_status or 200, content=idempotency.response_body)

    o_id = _col(orders_order, "id")
    o_status = _col(orders_order, "status")
    o_delivery_mode = _col(orders_order, "delivery_mode")
    o_delivery_address = _col(orders_order, "delivery_address")
    o_comment = _col(orders_order, "comment")
    o_created_at = _col(orders_order, "created_at")
    o_buyer = _col(orders_order, "buyer_company_id")
    o_supplier = _col(orders_order, "supplier_company_id")

    oi_order_id = _col(orders_item, "order_id")
    oi_product_id = _col(orders_item, "product_id")
    oi_qty = _col(orders_item, "qty")
    oi_fulfilled_qty = _col(orders_item, "fulfilled_qty")
    oi_undelivered_qty = _col(orders_item, "undelivered_qty")
    oi_price = _col(orders_item, "price_snapshot")

    p_id = _col(catalog_product, "id")
    p_price = _col(catalog_product, "price")
    p_supplier = _col(catalog_product, "supplier_company_id")

    prod_rows = db.execute(select(p_id, p_price, p_supplier).where(p_id.in_(product_ids))).all()
    price_map = {int(r[0]): float(r[1]) for r in prod_rows}
    supplier_map = {int(r[0]): int(r[2]) for r in prod_rows}
    missing = [pid for pid in product_ids if pid not in price_map]
    if missing:
        raise HTTPException(422, detail=_domain_error("UNKNOWN_PRODUCT_ID", "Unknown product_id(s)", details={"product_ids": missing}))
    mismatched = [pid for pid in product_ids if supplier_map.get(pid) != payload.supplier_company_id]
    if mismatched:
        raise HTTPException(
            422,
            detail=_domain_error(
                "PRODUCT_SUPPLIER_MISMATCH",
                "Product does not belong to supplier_company_id",
                details={"product_ids": mismatched, "supplier_company_id": payload.supplier_company_id},
            ),
        )

    address = payload.resolved_address()
    comment_clean = (payload.comment or "").strip()
    delivery_mode = payload.resolved_delivery_mode()

    try:
        now = datetime.now(timezone.utc)
        ins = (
            insert(orders_order)
            .values(
                {
                    o_status.name: status,
                    o_delivery_mode.name: delivery_mode,
                    o_delivery_address.name: address,
                    o_comment.name: comment_clean,
                    o_created_at.name: now,
                    o_buyer.name: payload.buyer_company_id,
                    o_supplier.name: payload.supplier_company_id,
                }
            )
            .returning(o_id)
        )
        order_id = int(db.execute(ins).scalar_one())
        items_to_insert = []
        for it in payload.items:
            items_to_insert.append(
                {
                    oi_order_id.name: order_id,
                    oi_product_id.name: it.product_id,
                    oi_qty.name: it.qty,
                    oi_fulfilled_qty.name: 0,
                    oi_undelivered_qty.name: 0,
                    oi_price.name: price_map[it.product_id],
                }
            )
        db.execute(insert(orders_item), items_to_insert)

        existing_delivery = db.execute(
            select(delivery_assignment.c.id).where(delivery_assignment.c.order_id == order_id)
        ).first()
        if not existing_delivery:
            values = {"order_id": order_id, "status": DELIVERY_STATUS_ASSIGNED, "tracking_link": "", "notes": ""}
            if "created_at" in delivery_assignment.c:
                values["created_at"] = now
            db.execute(insert(delivery_assignment).values(values))

        response_payload = OrderCreateResponse(id=order_id, status=status).model_dump()
        save_idempotency_response(
            db,
            scope=scope,
            idempotency_key=idempotency_key or "",
            resource_id=str(order_id),
            status_code=200,
            response_body=response_payload,
        )
        create_notification_event(
            db,
            domain="order",
            event_type="order_created",
            resource_type="order",
            resource_id=str(order_id),
            title=f"Новый заказ USC-{order_id}",
            text=f"Статус: {status}",
            user_ids=_order_participant_user_ids(
                db,
                buyer_company_id=payload.buyer_company_id,
                supplier_company_id=payload.supplier_company_id,
            ),
            payload={"order_id": order_id, "status": status},
        )
        log_audit_event(
            db,
            domain="orders",
            action="create",
            resource_type="order",
            resource_id=str(order_id),
            actor_user_id=u_id,
            actor_company_id=payload.buyer_company_id,
            request_id=getattr(request.state, "request_id", ""),
            ip=request.client.host if request.client else "",
            user_agent=request.headers.get("user-agent", ""),
            payload={"supplier_company_id": payload.supplier_company_id, "items_count": len(payload.items)},
        )
        db.commit()
        _invalidate_order_related_cache()
        return OrderCreateResponse(**response_payload)
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(400, detail=_domain_error("ORDER_INSERT_FAILED", f"Order insert failed: {e}"))


@router.get("/inbox/")
def inbox(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    u_id = int(user["id"])
    cache_key = make_key("orders", "inbox", u_id)
    cached = get_json(cache_key)
    if isinstance(cached, list):
        return cached
    company_ids = _company_ids_for_user(db, u_id)
    if not company_ids:
        return []
    rows = db.execute(
        select(orders_order)
        .where(orders_order.c.supplier_company_id.in_(company_ids))
        .order_by(orders_order.c.id.desc())
    ).mappings().all()
    response = _serialize_orders_bulk(db, [dict(r) for r in rows])
    set_json(cache_key, response, settings.CACHE_TTL_ORDERS_BOX)
    return response


@router.get("/outbox/")
def outbox(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    u_id = int(user["id"])
    cache_key = make_key("orders", "outbox", u_id)
    cached = get_json(cache_key)
    if isinstance(cached, list):
        return cached
    company_ids = _company_ids_for_user(db, u_id)
    if not company_ids:
        return []
    rows = db.execute(
        select(orders_order)
        .where(orders_order.c.buyer_company_id.in_(company_ids))
        .order_by(orders_order.c.id.desc())
    ).mappings().all()
    response = _serialize_orders_bulk(db, [dict(r) for r in rows])
    set_json(cache_key, response, settings.CACHE_TTL_ORDERS_BOX)
    return response


@router.get("/{order_id}/", response_model=OrderDetailOut)
def order_detail(
    order_id: int,
    buyer_company_id: int | None = Query(None, ge=1),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    u_id = int(user["id"])
    o_id = _col(orders_order, "id")
    o_buyer = _col(orders_order, "buyer_company_id")
    o_supplier = _col(orders_order, "supplier_company_id")
    o_status = _col(orders_order, "status")
    o_delivery_address = _col(orders_order, "delivery_address")
    o_comment = _col(orders_order, "comment")
    o_created_at = _col(orders_order, "created_at")

    oi_order_id = _col(orders_item, "order_id")
    oi_product_id = _col(orders_item, "product_id")
    oi_qty = _col(orders_item, "qty")
    oi_fulfilled_qty = _col(orders_item, "fulfilled_qty")
    oi_undelivered_qty = _col(orders_item, "undelivered_qty")
    oi_price = _col(orders_item, "price_snapshot")
    p_name = _col(catalog_product, "name")

    header = db.execute(
        select(
            o_id.label("id"),
            o_status.label("status"),
            o_created_at.label("created_at"),
            o_delivery_address.label("delivery_address"),
            o_comment.label("comment"),
            o_buyer.label("buyer_company_id"),
            o_supplier.label("supplier_company_id"),
        ).where(o_id == order_id)
    ).mappings().first()

    if not header:
        raise HTTPException(404, detail="Order not found")
    if buyer_company_id is not None and int(header.get("buyer_company_id")) != buyer_company_id:
        raise HTTPException(404, detail="Order not found")
    if not _is_order_participant(db, u_id, dict(header)):
        raise HTTPException(403, detail="Not allowed")

    cache_key = make_key("orders", "detail", u_id, order_id, buyer_company_id or "_")
    cached = get_json(cache_key)
    if isinstance(cached, dict):
        return cached

    items_rows = db.execute(
        select(
            oi_product_id.label("product_id"),
            oi_qty.label("qty"),
            oi_fulfilled_qty.label("fulfilled_qty"),
            oi_undelivered_qty.label("undelivered_qty"),
            oi_price.label("price_snapshot"),
            p_name.label("name"),
        )
        .select_from(orders_item.join(catalog_product, oi_product_id == catalog_product.c.id))
        .where(oi_order_id == order_id)
        .order_by(orders_item.c.id.asc())
    ).mappings().all()

    items = [OrderItemOut(**dict(r)) for r in items_rows]
    response = OrderDetailOut(**_order_payload_with_text_fields(dict(header)), items=items).model_dump()
    set_json(cache_key, response, settings.CACHE_TTL_ORDER_DETAIL)
    return response


@router.post("/{order_id}/supplier_confirm/")
def supplier_confirm(order_id: int, request: Request, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    u_id = int(user["id"])
    order = db.execute(select(orders_order).where(orders_order.c.id == order_id).with_for_update()).mappings().first()
    if not order:
        raise HTTPException(404, detail="Order not found")

    order_dict = dict(order)
    if not _is_order_participant(db, u_id, order_dict):
        raise HTTPException(403, detail="Not allowed")

    supplier_company_id = int(order_dict.get("supplier_company_id"))
    if not _member_of_company(db, u_id, supplier_company_id):
        raise HTTPException(403, detail=_domain_error("ONLY_SUPPLIER_CAN_CONFIRM", "Only supplier members can confirm"))

    current_status = str(order_dict.get("status") or "")
    if not can_transition_order(current_status, ORDER_STATUS_CONFIRMED):
        raise HTTPException(
            409,
            detail=_domain_error(
                "INVALID_STATE_TRANSITION",
                "Order transition is not allowed",
                details={"from": current_status, "to": ORDER_STATUS_CONFIRMED},
            ),
        )

    items = db.execute(select(orders_item).where(orders_item.c.order_id == order_id)).mappings().all()
    required: dict[int, Decimal] = {}
    for it in items:
        pid = int(it["product_id"])
        qty = it["qty"]
        if not isinstance(qty, Decimal):
            qty = Decimal(str(qty))
        required[pid] = required.get(pid, Decimal("0")) + qty

    if required:
        p_id = _col(catalog_product, "id")
        p_stock = _col(catalog_product, "stock_qty")
        p_in_stock = _col(catalog_product, "in_stock")
        prod_rows = db.execute(
            select(catalog_product).where(p_id.in_(list(required.keys()))).with_for_update()
        ).mappings().all()
        prod_map = {int(r["id"]): dict(r) for r in prod_rows}

        for pid, need_qty in required.items():
            p = prod_map.get(pid)
            if not p:
                raise HTTPException(400, detail=_domain_error("PRODUCT_NOT_FOUND", "Product not found for order item"))
            if bool(p.get("track_inventory")):
                stock_qty = p.get("stock_qty")
                if stock_qty is None:
                    raise HTTPException(400, detail=_domain_error("STOCK_NOT_SET", f"Stock is not set for product {pid}"))
                if not isinstance(stock_qty, Decimal):
                    stock_qty = Decimal(str(stock_qty))
                if stock_qty < need_qty:
                    raise HTTPException(
                        400, detail=_domain_error("INSUFFICIENT_STOCK", f"Not enough stock for product {pid}")
                    )

        for pid, need_qty in required.items():
            p = prod_map[pid]
            if not bool(p.get("track_inventory")):
                continue
            stock_qty = p.get("stock_qty")
            if not isinstance(stock_qty, Decimal):
                stock_qty = Decimal(str(stock_qty))
            new_stock = stock_qty - need_qty
            db.execute(
                catalog_product.update()
                .where(p_id == pid)
                .values({p_stock.name: new_stock, p_in_stock.name: bool(new_stock > 0)})
            )

    db.execute(update(orders_order).where(orders_order.c.id == order_id).values({"status": ORDER_STATUS_CONFIRMED}))
    create_notification_event(
        db,
        domain="order",
        event_type="order_confirmed",
        resource_type="order",
        resource_id=str(order_id),
        title=f"Заказ USC-{order_id} подтвержден",
        text=f"Статус: {ORDER_STATUS_CONFIRMED}",
        user_ids=_order_participant_user_ids(
            db,
            buyer_company_id=int(order_dict.get("buyer_company_id")),
            supplier_company_id=supplier_company_id,
        ),
        payload={"order_id": order_id, "status": ORDER_STATUS_CONFIRMED},
    )
    log_audit_event(
        db,
        domain="orders",
        action="supplier_confirm",
        resource_type="order",
        resource_id=str(order_id),
        actor_user_id=u_id,
        actor_company_id=supplier_company_id,
        request_id=getattr(request.state, "request_id", ""),
        ip=request.client.host if request.client else "",
        user_agent=request.headers.get("user-agent", ""),
    )
    db.commit()
    _invalidate_order_related_cache()
    return _serialize_order_full(db, order_id)


@router.post("/{order_id}/cancel/")
def cancel(order_id: int, request: Request, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    u_id = int(user["id"])
    order = db.execute(select(orders_order).where(orders_order.c.id == order_id).with_for_update()).mappings().first()
    if not order:
        raise HTTPException(404, detail="Order not found")

    order_dict = dict(order)
    if not _is_order_participant(db, u_id, order_dict):
        raise HTTPException(403, detail="Not allowed")

    status = str(order_dict.get("status") or "")
    buyer_company_id = int(order_dict.get("buyer_company_id"))
    supplier_company_id = int(order_dict.get("supplier_company_id"))
    is_buyer_actor = _member_of_company(db, u_id, buyer_company_id)
    is_supplier_actor = _member_of_company(db, u_id, supplier_company_id)

    allowed = False
    actor_role = "unknown"
    if is_buyer_actor and status == ORDER_STATUS_PENDING:
        allowed = True
        actor_role = "buyer"
    if is_supplier_actor and status in {ORDER_STATUS_PENDING, ORDER_STATUS_CONFIRMED}:
        delivery = db.execute(
            select(delivery_assignment).where(delivery_assignment.c.order_id == order_id)
        ).mappings().first()
        delivery_status = str(delivery.get("status") or "") if delivery else DELIVERY_STATUS_ASSIGNED
        if delivery_status in {DELIVERY_STATUS_ASSIGNED, DELIVERY_STATUS_CANCELLED}:
            allowed = True
            actor_role = "supplier"

    if not allowed:
        raise HTTPException(
            409,
            detail=_domain_error(
                "CANCEL_POLICY_VIOLATION",
                "Cancel policy violation for current actor and state",
                details={"status": status},
            ),
        )

    if not can_transition_order(status, ORDER_STATUS_CANCELLED):
        raise HTTPException(
            409,
            detail=_domain_error(
                "INVALID_STATE_TRANSITION",
                "Order transition is not allowed",
                details={"from": status, "to": ORDER_STATUS_CANCELLED},
            ),
        )

    if status == ORDER_STATUS_CONFIRMED:
        items = db.execute(select(orders_item).where(orders_item.c.order_id == order_id)).mappings().all()
        required: dict[int, Decimal] = {}
        for it in items:
            pid = int(it["product_id"])
            qty = it["qty"]
            if not isinstance(qty, Decimal):
                qty = Decimal(str(qty))
            required[pid] = required.get(pid, Decimal("0")) + qty

        if required:
            p_id = _col(catalog_product, "id")
            p_stock = _col(catalog_product, "stock_qty")
            p_in_stock = _col(catalog_product, "in_stock")
            prod_rows = db.execute(
                select(catalog_product).where(p_id.in_(list(required.keys()))).with_for_update()
            ).mappings().all()
            prod_map = {int(r["id"]): dict(r) for r in prod_rows}
            for pid, qty in required.items():
                p = prod_map.get(pid)
                if not p or not bool(p.get("track_inventory")):
                    continue
                stock_qty = p.get("stock_qty")
                if stock_qty is None:
                    continue
                if not isinstance(stock_qty, Decimal):
                    stock_qty = Decimal(str(stock_qty))
                new_stock = stock_qty + qty
                db.execute(
                    catalog_product.update()
                    .where(p_id == pid)
                    .values({p_stock.name: new_stock, p_in_stock.name: bool(new_stock > 0)})
                )

    db.execute(update(orders_order).where(orders_order.c.id == order_id).values({"status": ORDER_STATUS_CANCELLED}))
    db.execute(
        update(delivery_assignment)
        .where(delivery_assignment.c.order_id == order_id)
        .values({"status": DELIVERY_STATUS_CANCELLED})
    )
    create_notification_event(
        db,
        domain="order",
        event_type="order_cancelled",
        resource_type="order",
        resource_id=str(order_id),
        title=f"Заказ USC-{order_id} отменен",
        text=f"Статус: {ORDER_STATUS_CANCELLED}",
        user_ids=_order_participant_user_ids(
            db,
            buyer_company_id=buyer_company_id,
            supplier_company_id=supplier_company_id,
        ),
        payload={"order_id": order_id, "status": ORDER_STATUS_CANCELLED, "actor_role": actor_role},
    )
    log_audit_event(
        db,
        domain="orders",
        action="cancel",
        resource_type="order",
        resource_id=str(order_id),
        actor_user_id=u_id,
        actor_company_id=supplier_company_id if actor_role == "supplier" else buyer_company_id,
        request_id=getattr(request.state, "request_id", ""),
        ip=request.client.host if request.client else "",
        user_agent=request.headers.get("user-agent", ""),
        payload={"actor_role": actor_role},
    )
    db.commit()
    _invalidate_order_related_cache()
    return _serialize_order_full(db, order_id)


@router.post("/{order_id}/returns/")
def request_return(order_id: int, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    _ = (order_id, user, db)
    raise HTTPException(
        status_code=501,
        detail=_domain_error("RETURNS_DISABLED_IN_MVP", "Returns are disabled in MVP"),
    )
