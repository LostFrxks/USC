from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.deps.auth import get_current_user
from app.cache.redis_cache import get_json, make_key, set_json
from app.core.config import settings
from app.db.deps import get_db
from app.db.schema import companies_companymember as company_members
from app.db.schema import delivery_deliveryassignment as deliveries
from app.db.schema import orders_order as orders

router = APIRouter(tags=["notifications"])


def _company_ids_for_user(db: Session, user_id: int) -> list[int]:
    return [
        int(r[0])
        for r in db.execute(select(company_members.c.company_id).where(company_members.c.user_id == user_id)).all()
    ]


def _is_new(ts: datetime | None) -> bool:
    if not ts:
        return False
    return ts >= datetime.now(timezone.utc) - timedelta(hours=24)


@router.get("/notifications/")
def list_notifications(
    limit: int = Query(20, ge=1, le=100),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    u_id = int(user["id"])
    cache_key = make_key("notifications", "list", u_id, limit)
    cached = get_json(cache_key)
    if isinstance(cached, list):
        return cached

    company_ids = _company_ids_for_user(db, u_id)
    events: list[dict] = []

    if company_ids:
        order_rows = db.execute(
            select(
                orders.c.id,
                orders.c.status,
                orders.c.created_at,
                orders.c.buyer_company_id,
                orders.c.supplier_company_id,
                orders.c.comment,
            )
            .where(or_(orders.c.buyer_company_id.in_(company_ids), orders.c.supplier_company_id.in_(company_ids)))
            .order_by(orders.c.created_at.desc() if "created_at" in orders.c else orders.c.id.desc())
            .limit(limit)
        ).mappings().all()

        for row in order_rows:
            created = row.get("created_at")
            status = str(row.get("status") or "")
            events.append(
                {
                    "id": f"order-{row.get('id')}",
                    "type": "order",
                    "title": f"Новый заказ USC-{row.get('id')}",
                    "text": f"Статус: {status}",
                    "order_id": int(row.get("id")),
                    "status": status,
                    "created_at": created,
                    "is_new": _is_new(created),
                }
            )

        delivery_rows = db.execute(
            select(
                deliveries.c.id,
                deliveries.c.order_id,
                deliveries.c.status,
                deliveries.c.created_at,
            )
            .select_from(deliveries.join(orders, deliveries.c.order_id == orders.c.id))
            .where(or_(orders.c.buyer_company_id.in_(company_ids), orders.c.supplier_company_id.in_(company_ids)))
            .order_by(deliveries.c.created_at.desc() if "created_at" in deliveries.c else deliveries.c.id.desc())
            .limit(limit)
        ).mappings().all()

        for row in delivery_rows:
            created = row.get("created_at")
            status = str(row.get("status") or "")
            events.append(
                {
                    "id": f"delivery-{row.get('id')}",
                    "type": "delivery",
                    "title": f"Доставка по заказу USC-{row.get('order_id')}",
                    "text": f"Статус: {status}",
                    "order_id": int(row.get("order_id")),
                    "status": status,
                    "created_at": created,
                    "is_new": _is_new(created),
                }
            )

    events.sort(key=lambda x: x.get("created_at") or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    events = events[:limit]

    response = [
        {
            **e,
            "created_at": e["created_at"].isoformat() if e.get("created_at") else None,
        }
        for e in events
    ]
    set_json(cache_key, response, settings.CACHE_TTL_NOTIFICATIONS)
    return response
