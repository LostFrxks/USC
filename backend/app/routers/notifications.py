from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.cache.redis_cache import get_json, make_key, set_json
from app.core.config import settings
from app.db.deps import get_db
from app.deps.auth import get_current_user
from app.services.notifications import (
    list_notifications_for_user,
    mark_all_notifications_read,
    mark_notification_read,
)

router = APIRouter(tags=["notifications"])


@router.get("/notifications/")
def list_notifications(
    limit: int = Query(20, ge=1, le=100),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    u_id = int(user["id"])
    cache_key = make_key("notifications", "list", u_id, limit)
    cached = get_json(cache_key)
    if isinstance(cached, dict) and isinstance(cached.get("items"), list):
        return cached

    result = list_notifications_for_user(db, user_id=u_id, limit=limit)
    payload = {"items": result.items, "unread_count": result.unread_count}
    set_json(cache_key, payload, settings.CACHE_TTL_NOTIFICATIONS)
    return payload


@router.post("/notifications/{notification_id}/read/")
def read_notification(notification_id: int, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    if notification_id <= 0:
        raise HTTPException(400, detail="notification_id must be positive")
    changed = mark_notification_read(db, user_id=int(user["id"]), notification_id=notification_id)
    db.commit()
    return {"updated": changed}


@router.post("/notifications/read_all/")
def read_all_notifications(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    updated = mark_all_notifications_read(db, user_id=int(user["id"]))
    db.commit()
    return {"updated_count": updated}

