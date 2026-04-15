from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import and_, func, insert, select, update
from sqlalchemy.orm import Session

from app.db.schema import auth_refresh_session as refresh_sessions


@dataclass
class RefreshSessionRow:
    jti: str
    sid: str
    user_id: int
    expires_at: datetime
    revoked_at: datetime | None
    replaced_by_jti: str | None


def create_refresh_session(
    db: Session,
    *,
    user_id: int,
    jti: str,
    sid: str,
    expires_at: datetime,
    ip: str | None,
    user_agent: str | None,
    metadata: dict | None = None,
) -> None:
    next_id = int(
        db.execute(select(func.coalesce(func.max(refresh_sessions.c.id), 0) + 1)).scalar_one()
    )
    values = {
        "id": next_id,
        "user_id": int(user_id),
        "jti": str(jti),
        "sid": str(sid),
        "expires_at": expires_at,
        "revoked_at": None,
        "replaced_by_jti": None,
        "ip": ip,
        "user_agent": user_agent,
        "metadata_json": json.dumps(metadata or {}, ensure_ascii=False),
        "created_at": datetime.now(timezone.utc),
    }
    db.execute(insert(refresh_sessions).values(values))


def get_refresh_session(db: Session, *, jti: str) -> RefreshSessionRow | None:
    row = (
        db.execute(select(refresh_sessions).where(refresh_sessions.c.jti == str(jti)))
        .mappings()
        .first()
    )
    if not row:
        return None
    expires_at = row.get("expires_at")
    if isinstance(expires_at, datetime) and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    revoked_at = row.get("revoked_at")
    if isinstance(revoked_at, datetime) and revoked_at.tzinfo is None:
        revoked_at = revoked_at.replace(tzinfo=timezone.utc)
    return RefreshSessionRow(
        jti=str(row.get("jti")),
        sid=str(row.get("sid")),
        user_id=int(row.get("user_id")),
        expires_at=expires_at,
        revoked_at=revoked_at,
        replaced_by_jti=row.get("replaced_by_jti"),
    )


def revoke_refresh_session(db: Session, *, jti: str, replaced_by_jti: str | None = None) -> int:
    now = datetime.now(timezone.utc)
    stmt = (
        update(refresh_sessions)
        .where(and_(refresh_sessions.c.jti == str(jti), refresh_sessions.c.revoked_at.is_(None)))
        .values({"revoked_at": now, "replaced_by_jti": replaced_by_jti})
    )
    result = db.execute(stmt)
    return int(result.rowcount or 0)


def revoke_all_refresh_sessions_for_user(db: Session, *, user_id: int) -> int:
    now = datetime.now(timezone.utc)
    stmt = (
        update(refresh_sessions)
        .where(and_(refresh_sessions.c.user_id == int(user_id), refresh_sessions.c.revoked_at.is_(None)))
        .values({"revoked_at": now})
    )
    result = db.execute(stmt)
    return int(result.rowcount or 0)
