from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import and_, delete, insert, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.schema import idempotency_record


@dataclass(frozen=True)
class IdempotencyReservation:
    state: str
    response_status: int | None = None
    response_body: dict[str, Any] | None = None


def canonical_body_hash(payload: dict[str, Any]) -> str:
    body = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(body.encode("utf-8")).hexdigest()


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def reserve_idempotency(
    db: Session,
    *,
    scope: str,
    idempotency_key: str,
    payload: dict[str, Any],
) -> IdempotencyReservation:
    key = (idempotency_key or "").strip()
    if not key:
        return IdempotencyReservation(state="disabled")

    now = _now_utc()
    body_hash = canonical_body_hash(payload)
    ttl_hours = max(1, int(settings.IDEMPOTENCY_TTL_HOURS or 24))
    expires_at = now + timedelta(hours=ttl_hours)

    # Opportunistic cleanup in same scope.
    db.execute(delete(idempotency_record).where(idempotency_record.c.scope == scope, idempotency_record.c.expires_at <= now))

    existing = (
        db.execute(
            select(idempotency_record).where(
                and_(
                    idempotency_record.c.scope == scope,
                    idempotency_record.c.idempotency_key == key,
                    idempotency_record.c.expires_at > now,
                )
            )
        )
        .mappings()
        .first()
    )
    if existing:
        if str(existing.get("body_hash")) != body_hash:
            return IdempotencyReservation(state="conflict")
        status_code = existing.get("response_status")
        response_json = str(existing.get("response_body_json") or "").strip()
        if status_code is not None and response_json:
            try:
                return IdempotencyReservation(
                    state="replay",
                    response_status=int(status_code),
                    response_body=json.loads(response_json),
                )
            except Exception:
                return IdempotencyReservation(state="in_progress")
        return IdempotencyReservation(state="in_progress")

    try:
        db.execute(
            insert(idempotency_record).values(
                {
                    "scope": scope,
                    "idempotency_key": key,
                    "body_hash": body_hash,
                    "response_status": None,
                    "response_body_json": None,
                    "resource_type": "order",
                    "resource_id": None,
                    "created_at": now,
                    "expires_at": expires_at,
                }
            )
        )
    except IntegrityError:
        existing_retry = (
            db.execute(
                select(idempotency_record).where(
                    and_(
                        idempotency_record.c.scope == scope,
                        idempotency_record.c.idempotency_key == key,
                        idempotency_record.c.expires_at > now,
                    )
                )
            )
            .mappings()
            .first()
        )
        if not existing_retry:
            return IdempotencyReservation(state="in_progress")
        if str(existing_retry.get("body_hash")) != body_hash:
            return IdempotencyReservation(state="conflict")
        return IdempotencyReservation(state="in_progress")

    return IdempotencyReservation(state="new")


def save_idempotency_response(
    db: Session,
    *,
    scope: str,
    idempotency_key: str,
    resource_id: str,
    status_code: int,
    response_body: dict[str, Any],
) -> None:
    key = (idempotency_key or "").strip()
    if not key:
        return
    db.execute(
        update(idempotency_record)
        .where(
            and_(
                idempotency_record.c.scope == scope,
                idempotency_record.c.idempotency_key == key,
            )
        )
        .values(
            {
                "response_status": int(status_code),
                "response_body_json": json.dumps(response_body, ensure_ascii=False),
                "resource_id": resource_id,
            }
        )
    )

