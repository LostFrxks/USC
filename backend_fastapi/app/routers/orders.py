from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, insert, select, update
from sqlalchemy.orm import Session

from app.deps.auth import get_current_user
from app.cache.redis_cache import get_json, invalidate_patterns, make_key, set_json
from app.core.config import settings
from app.db.deps import get_db
from app.db.schema import catalog_product
from app.db.schema import companies_companymember as company_members
from app.db.schema import delivery_deliveryassignment as delivery_assignment
from app.db.schema import orders_order
from app.db.schema import orders_orderitem as orders_item

router = APIRouter(prefix="/orders", tags=["orders"])


# ---------------------------
# Schemas
# ---------------------------
class OrderItemCreate(BaseModel):
    product_id: int
    qty: float = Field(..., gt=0)


class OrderCreatePayload(BaseModel):
    # frontend can send either
    address: Optional[str] = None
    delivery_address: Optional[str] = None

    comment: str = ""
    buyer_company_id: int
    supplier_company_id: int
    items: List[OrderItemCreate]

    # optional (legacy frontend values may be "delivery"/"pickup")
    delivery_mode: Optional[str] = None
    status: Optional[str] = None

    def resolved_address(self) -> str:
        a = (self.delivery_address or self.address or "").strip()
        return a or "—"

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
            return "PENDING"
        up = raw.upper()
        if up == "CREATED":
            return "PENDING"
        if up in {"PENDING", "CONFIRMED", "DELIVERING", "DELIVERED", "CANCELLED"}:
            return up
        return raw


class OrderCreateResponse(BaseModel):
    id: int
    status: str


class OrderListRow(BaseModel):
    id: int
    status: str
    created_at: Optional[datetime] = None
    comment: Optional[str] = None
    items_count: Optional[int] = None
    total: Optional[float] = None


class OrderItemOut(BaseModel):
    product_id: int
    qty: float
    price_snapshot: Optional[float] = None
    name: Optional[str] = None


class OrderDetailOut(BaseModel):
    id: int
    status: str
    created_at: Optional[datetime] = None
    comment: Optional[str] = None
    buyer_company_id: int
    supplier_company_id: int
    items: List[OrderItemOut]


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


def _is_order_participant(db: Session, user_id: int, order_row: dict) -> bool:
    ids = _company_ids_for_user(db, user_id)
    if not ids:
        return False
    return int(order_row.get("buyer_company_id")) in ids or int(order_row.get("supplier_company_id")) in ids


def _is_supplier_member(db: Session, user_id: int, supplier_company_id: int) -> bool:
    return (
        db.execute(
            select(company_members.c.id).where(
                company_members.c.user_id == user_id, company_members.c.company_id == supplier_company_id
            )
        ).first()
        is not None
    )


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


def _serialize_order_full(db: Session, order_id: int) -> dict:
    order = db.execute(select(orders_order).where(orders_order.c.id == order_id)).mappings().first()
    if not order:
        raise HTTPException(404, detail="Order not found")

    items = db.execute(select(orders_item).where(orders_item.c.order_id == order_id).order_by(orders_item.c.id.asc())).mappings().all()

    data = dict(order)
    data["items"] = [dict(r) for r in items]
    data["delivery"] = _serialize_delivery(db, order_id)
    return data


def _invalidate_order_related_cache() -> None:
    invalidate_patterns(
        "v1:orders:*",
        "v1:notifications:*",
        "v1:deliveries:*",
        "v1:products:*",
        "v1:analytics:*",
    )


# ---------------------------
# Routes (frontend-compatible)
# ---------------------------
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
            o_comment.label("comment"),
            func.count(orders_item.c.id).label("items_count"),
            func.coalesce(func.sum(oi_qty * oi_price), 0).label("total"),
        )
        .select_from(orders_order.outerjoin(orders_item, oi_order_id == o_id))
        .where(cond)
        .group_by(o_id, o_status, o_created_at, o_comment)
        .order_by(o_id.desc())
        .limit(limit)
        .offset(offset)
    )

    rows = db.execute(q).mappings().all()
    response = [OrderListRow(**dict(r)).model_dump() for r in rows]
    set_json(cache_key, response, settings.CACHE_TTL_ORDERS_LIST)
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
    o_comment = _col(orders_order, "comment")
    o_created_at = _col(orders_order, "created_at")

    oi_order_id = _col(orders_item, "order_id")
    oi_product_id = _col(orders_item, "product_id")
    oi_qty = _col(orders_item, "qty")
    oi_price = _col(orders_item, "price_snapshot")

    p_id = _col(catalog_product, "id")
    p_name = _col(catalog_product, "name")

    header = db.execute(
        select(
            o_id.label("id"),
            o_status.label("status"),
            o_created_at.label("created_at"),
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
            oi_price.label("price_snapshot"),
            p_name.label("name"),
        )
        .select_from(orders_item.join(catalog_product, oi_product_id == p_id))
        .where(oi_order_id == order_id)
        .order_by(orders_item.c.id.asc())
    ).mappings().all()

    items = [OrderItemOut(**dict(r)) for r in items_rows]
    response = OrderDetailOut(**dict(header), items=items).model_dump()
    set_json(cache_key, response, settings.CACHE_TTL_ORDER_DETAIL)
    return response


@router.post("/create/", response_model=OrderCreateResponse)
def create_order(
    payload: OrderCreatePayload,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not payload.items:
        raise HTTPException(400, detail="items cannot be empty")

    u_id = int(user["id"])
    company_ids = _company_ids_for_user(db, u_id)
    if not company_ids or payload.buyer_company_id not in company_ids:
        raise HTTPException(403, detail="Not allowed: buyer company mismatch")

    o_id = _col(orders_order, "id")
    o_status = _col(orders_order, "status")
    o_delivery_mode = _col(orders_order, "delivery_mode")
    o_comment = _col(orders_order, "comment")
    o_created_at = _col(orders_order, "created_at")
    o_buyer = _col(orders_order, "buyer_company_id")
    o_supplier = _col(orders_order, "supplier_company_id")

    oi_order_id = _col(orders_item, "order_id")
    oi_product_id = _col(orders_item, "product_id")
    oi_qty = _col(orders_item, "qty")
    oi_price = _col(orders_item, "price_snapshot")

    p_id = _col(catalog_product, "id")
    p_price = _col(catalog_product, "price")

    address = payload.resolved_address()
    comment_clean = (payload.comment or "").strip()
    combined_comment = f"{address}\n{comment_clean}".strip()

    delivery_mode = payload.resolved_delivery_mode()
    status = payload.resolved_status()

    product_ids = [it.product_id for it in payload.items]
    prod_rows = db.execute(select(p_id, p_price).where(p_id.in_(product_ids))).all()
    price_map = {int(r[0]): float(r[1]) for r in prod_rows}
    missing = [pid for pid in product_ids if pid not in price_map]
    if missing:
        raise HTTPException(400, detail=f"Unknown product_id(s): {missing}")

    try:
        now = datetime.now(timezone.utc)

        ins = (
            insert(orders_order)
            .values(
                {
                    o_status.name: status,
                    o_delivery_mode.name: delivery_mode,
                    o_comment.name: combined_comment,
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
                    oi_price.name: price_map[it.product_id],
                }
            )

        db.execute(insert(orders_item), items_to_insert)

        # Ensure delivery row exists for each order
        existing_delivery = db.execute(
            select(delivery_assignment.c.id).where(delivery_assignment.c.order_id == order_id)
        ).first()
        if not existing_delivery:
            values = {"order_id": order_id, "status": "ASSIGNED", "tracking_link": "", "notes": ""}
            if "created_at" in delivery_assignment.c:
                values["created_at"] = now
            db.execute(insert(delivery_assignment).values(values))

        db.commit()
        _invalidate_order_related_cache()

        return OrderCreateResponse(id=order_id, status=status)

    except Exception as e:
        db.rollback()
        raise HTTPException(400, detail=f"Order insert failed. DB says: {e}")


# ---------------------------
# Actions (auth required)
# ---------------------------
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

    ids = [
        int(r[0])
        for r in db.execute(
            select(orders_order.c.id)
            .where(orders_order.c.supplier_company_id.in_(company_ids))
            .order_by(orders_order.c.id.desc())
        ).all()
    ]
    response = [_serialize_order_full(db, oid) for oid in ids]
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

    ids = [
        int(r[0])
        for r in db.execute(
            select(orders_order.c.id)
            .where(orders_order.c.buyer_company_id.in_(company_ids))
            .order_by(orders_order.c.id.desc())
        ).all()
    ]
    response = [_serialize_order_full(db, oid) for oid in ids]
    set_json(cache_key, response, settings.CACHE_TTL_ORDERS_BOX)
    return response


@router.post("/{order_id}/supplier_confirm/")
def supplier_confirm(order_id: int, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    u_id = int(user["id"])

    # lock order
    order = db.execute(
        select(orders_order).where(orders_order.c.id == order_id).with_for_update()
    ).mappings().first()
    if not order:
        raise HTTPException(404, detail="Order not found")

    order_dict = dict(order)
    if not _is_order_participant(db, u_id, order_dict):
        raise HTTPException(403, detail="Not allowed")

    supplier_company_id = int(order_dict.get("supplier_company_id"))
    if not _is_supplier_member(db, u_id, supplier_company_id):
        raise HTTPException(403, detail="Only supplier members can confirm.")

    if str(order_dict.get("status")) != "PENDING":
        raise HTTPException(400, detail="Order is not in PENDING status.")

    # lock items + products and update stock
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
        p_track = _col(catalog_product, "track_inventory")
        p_stock = _col(catalog_product, "stock_qty")
        p_in_stock = _col(catalog_product, "in_stock")

        prod_rows = db.execute(
            select(catalog_product).where(p_id.in_(list(required.keys()))).with_for_update()
        ).mappings().all()
        prod_map = {int(r["id"]): dict(r) for r in prod_rows}

        for pid, need_qty in required.items():
            p = prod_map.get(pid)
            if not p:
                raise HTTPException(400, detail="Product not found for order item.")

            if bool(p.get("track_inventory")):
                stock_qty = p.get("stock_qty")
                if stock_qty is None:
                    raise HTTPException(400, detail=f"Stock is not set for product {pid}.")

                if not isinstance(stock_qty, Decimal):
                    stock_qty = Decimal(str(stock_qty))

                if stock_qty < need_qty:
                    raise HTTPException(400, detail=f"Not enough stock for product {pid}.")

                # validation only (updates applied below)

        # apply updates
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
                .values(
                    {
                        p_stock.name: new_stock,
                        p_in_stock.name: bool(new_stock > 0),
                    }
                )
            )

    db.execute(update(orders_order).where(orders_order.c.id == order_id).values({"status": "CONFIRMED"}))
    db.commit()
    _invalidate_order_related_cache()
    return _serialize_order_full(db, order_id)


@router.post("/{order_id}/cancel/")
def cancel(order_id: int, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    u_id = int(user["id"])

    order = db.execute(
        select(orders_order).where(orders_order.c.id == order_id).with_for_update()
    ).mappings().first()
    if not order:
        raise HTTPException(404, detail="Order not found")

    order_dict = dict(order)
    if not _is_order_participant(db, u_id, order_dict):
        raise HTTPException(403, detail="Not allowed")

    status = str(order_dict.get("status"))
    if status in {"DELIVERED", "CANCELLED"}:
        raise HTTPException(400, detail="Cannot cancel this order.")

    if status == "CONFIRMED":
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
            p_track = _col(catalog_product, "track_inventory")
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
                    .values(
                        {
                            p_stock.name: new_stock,
                            p_in_stock.name: bool(new_stock > 0),
                        }
                    )
                )

    db.execute(update(orders_order).where(orders_order.c.id == order_id).values({"status": "CANCELLED"}))
    db.commit()
    _invalidate_order_related_cache()
    return _serialize_order_full(db, order_id)
