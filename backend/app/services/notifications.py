from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import and_, func, insert, select, update
from sqlalchemy.orm import Session

from app.cache.redis_cache import invalidate_patterns
from app.db.schema import notification_event, notification_user_state


@dataclass(frozen=True)
class NotificationListResult:
    items: list[dict[str, Any]]
    unread_count: int


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _invalidate_notifications_cache_for_users(user_ids: list[int]) -> None:
    patterns = [f"v1:notifications:list:{uid}:*" for uid in user_ids]
    if patterns:
        invalidate_patterns(*patterns)


def create_notification_event(
    db: Session,
    *,
    domain: str,
    event_type: str,
    resource_type: str,
    resource_id: str,
    title: str,
    text: str,
    user_ids: list[int],
    payload: dict[str, Any] | None = None,
) -> int | None:
    recipients = sorted({int(uid) for uid in user_ids if int(uid) > 0})
    if not recipients:
        return None

    now = _now_utc()
    event_id = int(
        db.execute(
            insert(notification_event)
            .values(
                {
                    "domain": (domain or "system")[:32],
                    "event_type": (event_type or "event")[:64],
                    "resource_type": (resource_type or "resource")[:64],
                    "resource_id": (resource_id or "")[:128],
                    "title": (title or "")[:255],
                    "text": text or "",
                    "payload_json": json.dumps(payload or {}, ensure_ascii=False),
                    "created_at": now,
                }
            )
            .returning(notification_event.c.id)
        ).scalar_one()
    )

    state_rows = [
        {
            "notification_id": event_id,
            "user_id": uid,
            "is_read": False,
            "read_at": None,
            "created_at": now,
        }
        for uid in recipients
    ]
    db.execute(insert(notification_user_state), state_rows)
    _invalidate_notifications_cache_for_users(recipients)
    return event_id


def list_notifications_for_user(db: Session, *, user_id: int, limit: int) -> NotificationListResult:
    rows = (
        db.execute(
            select(
                notification_user_state.c.notification_id,
                notification_user_state.c.is_read,
                notification_user_state.c.read_at,
                notification_event.c.domain,
                notification_event.c.event_type,
                notification_event.c.resource_type,
                notification_event.c.resource_id,
                notification_event.c.title,
                notification_event.c.text,
                notification_event.c.payload_json,
                notification_event.c.created_at,
            )
            .select_from(
                notification_user_state.join(
                    notification_event, notification_user_state.c.notification_id == notification_event.c.id
                )
            )
            .where(notification_user_state.c.user_id == int(user_id))
            .order_by(notification_event.c.created_at.desc(), notification_event.c.id.desc())
            .limit(int(limit))
        )
        .mappings()
        .all()
    )

    unread_count = int(
        db.execute(
            select(func.count(notification_user_state.c.id)).where(
                and_(notification_user_state.c.user_id == int(user_id), notification_user_state.c.is_read.is_(False))
            )
        ).scalar_one()
    )

    items: list[dict[str, Any]] = []
    for row in rows:
        payload = {}
        raw_payload = str(row.get("payload_json") or "").strip()
        if raw_payload:
            try:
                payload = json.loads(raw_payload)
            except Exception:
                payload = {}

        items.append(
            {
                "id": int(row.get("notification_id")),
                "domain": row.get("domain"),
                "event_type": row.get("event_type"),
                "resource_type": row.get("resource_type"),
                "resource_id": row.get("resource_id"),
                "title": row.get("title"),
                "text": row.get("text"),
                "payload": payload,
                "created_at": row.get("created_at"),
                "is_read": bool(row.get("is_read")),
                "read_at": row.get("read_at"),
            }
        )

    return NotificationListResult(items=items, unread_count=unread_count)


def mark_notification_read(db: Session, *, user_id: int, notification_id: int) -> bool:
    result = db.execute(
        update(notification_user_state)
        .where(
            and_(
                notification_user_state.c.user_id == int(user_id),
                notification_user_state.c.notification_id == int(notification_id),
                notification_user_state.c.is_read.is_(False),
            )
        )
        .values({"is_read": True, "read_at": _now_utc()})
    )
    _invalidate_notifications_cache_for_users([int(user_id)])
    return int(result.rowcount or 0) > 0


def mark_all_notifications_read(db: Session, *, user_id: int) -> int:
    result = db.execute(
        update(notification_user_state)
        .where(and_(notification_user_state.c.user_id == int(user_id), notification_user_state.c.is_read.is_(False)))
        .values({"is_read": True, "read_at": _now_utc()})
    )
    _invalidate_notifications_cache_for_users([int(user_id)])
    return int(result.rowcount or 0)

