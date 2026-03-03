from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import and_, delete, func, insert, select, update
from sqlalchemy.orm import Session

from app.cache.redis_cache import invalidate_patterns
from app.db.schema import ai_chat_message, ai_chat_session


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _session_title_seed(text: str) -> str:
    clean = " ".join(str(text or "").strip().split())
    if not clean:
        return "Новый чат"
    return clean[:120]


def _next_id(db: Session, table) -> int:
    return int(db.execute(select(func.coalesce(func.max(table.c.id), 0) + 1)).scalar_one())


def _invalidate_chat_cache(user_id: int, session_id: int | None = None) -> None:
    patterns = [f"v1:analytics_chats:list:{int(user_id)}:*"]
    if session_id is not None:
        patterns.append(f"v1:analytics_chats:session:{int(session_id)}:*")
    invalidate_patterns(*patterns)


def create_chat_session(db: Session, *, user_id: int, company_id: int, role: str, title: str | None = None) -> dict[str, Any]:
    now = _now_utc()
    session_id = _next_id(db, ai_chat_session)
    row = (
        db.execute(
            insert(ai_chat_session)
            .values(
                {
                    "id": session_id,
                    "user_id": int(user_id),
                    "company_id": int(company_id),
                    "role": (role or "supplier").strip().lower(),
                    "title": _session_title_seed(title or ""),
                    "created_at": now,
                    "updated_at": now,
                    "last_message_at": None,
                }
            )
            .returning(ai_chat_session)
        )
        .mappings()
        .first()
    )
    if not row:
        raise RuntimeError("Failed to create chat session")
    _invalidate_chat_cache(int(user_id), int(row["id"]))
    return dict(row)


def get_chat_session(
    db: Session,
    *,
    session_id: int,
    user_id: int,
    company_id: int | None = None,
    role: str | None = None,
) -> dict[str, Any] | None:
    conds = [ai_chat_session.c.id == int(session_id), ai_chat_session.c.user_id == int(user_id)]
    if company_id is not None:
        conds.append(ai_chat_session.c.company_id == int(company_id))
    if role is not None:
        conds.append(ai_chat_session.c.role == (role or "").strip().lower())
    row = db.execute(select(ai_chat_session).where(and_(*conds))).mappings().first()
    return dict(row) if row else None


def list_chat_sessions(
    db: Session,
    *,
    user_id: int,
    company_id: int,
    role: str,
    limit: int = 30,
    message_limit: int = 180,
) -> list[dict[str, Any]]:
    session_rows = (
        db.execute(
            select(ai_chat_session)
            .where(
                and_(
                    ai_chat_session.c.user_id == int(user_id),
                    ai_chat_session.c.company_id == int(company_id),
                    ai_chat_session.c.role == (role or "supplier").strip().lower(),
                )
            )
            .order_by(ai_chat_session.c.updated_at.desc(), ai_chat_session.c.id.desc())
            .limit(max(1, min(100, int(limit))))
        )
        .mappings()
        .all()
    )
    if not session_rows:
        return []

    session_ids = [int(r["id"]) for r in session_rows]

    count_rows = (
        db.execute(
            select(ai_chat_message.c.session_id, func.count(ai_chat_message.c.id).label("count"))
            .where(ai_chat_message.c.session_id.in_(session_ids))
            .group_by(ai_chat_message.c.session_id)
        )
        .mappings()
        .all()
    )
    count_map = {int(r["session_id"]): int(r["count"] or 0) for r in count_rows}

    msg_rows = (
        db.execute(
            select(ai_chat_message)
            .where(ai_chat_message.c.session_id.in_(session_ids))
            .order_by(ai_chat_message.c.session_id.asc(), ai_chat_message.c.created_at.asc(), ai_chat_message.c.id.asc())
        )
        .mappings()
        .all()
    )
    by_session: dict[int, list[dict[str, Any]]] = {sid: [] for sid in session_ids}
    per_session_limit = max(1, min(500, int(message_limit)))
    for row in msg_rows:
        sid = int(row["session_id"])
        bucket = by_session.setdefault(sid, [])
        bucket.append(dict(row))

    out: list[dict[str, Any]] = []
    for srow in session_rows:
        sid = int(srow["id"])
        raw_messages = by_session.get(sid, [])
        if len(raw_messages) > per_session_limit:
            raw_messages = raw_messages[-per_session_limit:]
        messages: list[dict[str, Any]] = []
        for m in raw_messages:
            payload = None
            raw_payload = m.get("payload_json")
            if isinstance(raw_payload, str) and raw_payload.strip():
                try:
                    payload = json.loads(raw_payload)
                except Exception:
                    payload = None
            messages.append(
                {
                    "id": int(m["id"]),
                    "role": str(m.get("role") or "assistant"),
                    "text": str(m.get("text") or ""),
                    "created_at": m.get("created_at"),
                    "payload": payload,
                }
            )
        preview = messages[-1]["text"] if messages else ""
        out.append(
            {
                "id": sid,
                "title": str(srow.get("title") or "Новый чат"),
                "created_at": srow.get("created_at"),
                "updated_at": srow.get("updated_at"),
                "last_message_at": srow.get("last_message_at"),
                "message_count": int(count_map.get(sid, len(messages))),
                "preview": " ".join(preview.split())[:160],
                "messages": messages,
            }
        )
    return out


def rename_chat_session(db: Session, *, session_id: int, user_id: int, title: str) -> bool:
    clean_title = _session_title_seed(title)
    result = db.execute(
        update(ai_chat_session)
        .where(and_(ai_chat_session.c.id == int(session_id), ai_chat_session.c.user_id == int(user_id)))
        .values({"title": clean_title, "updated_at": _now_utc()})
    )
    changed = int(result.rowcount or 0) > 0
    if changed:
        _invalidate_chat_cache(int(user_id), int(session_id))
    return changed


def delete_chat_session(db: Session, *, session_id: int, user_id: int) -> bool:
    session_row = get_chat_session(db, session_id=session_id, user_id=user_id)
    if not session_row:
        return False
    db.execute(
        delete(ai_chat_session).where(
            and_(ai_chat_session.c.id == int(session_id), ai_chat_session.c.user_id == int(user_id))
        )
    )
    _invalidate_chat_cache(int(user_id), int(session_id))
    return True


def append_chat_message(
    db: Session,
    *,
    session_id: int,
    user_id: int,
    role: str,
    text: str,
    payload: dict[str, Any] | None = None,
) -> int:
    row = get_chat_session(db, session_id=session_id, user_id=user_id)
    if not row:
        raise ValueError("chat session not found")
    now = _now_utc()
    next_msg_id = _next_id(db, ai_chat_message)
    message_id = int(
        db.execute(
            insert(ai_chat_message)
            .values(
                {
                    "id": next_msg_id,
                    "session_id": int(session_id),
                    "role": (role or "assistant").strip().lower(),
                    "text": str(text or ""),
                    "payload_json": None if payload is None else json.dumps(payload, ensure_ascii=False),
                    "created_at": now,
                }
            )
            .returning(ai_chat_message.c.id)
        ).scalar_one()
    )
    db.execute(
        update(ai_chat_session)
        .where(ai_chat_session.c.id == int(session_id))
        .values({"updated_at": now, "last_message_at": now})
    )
    _invalidate_chat_cache(int(user_id), int(session_id))
    return message_id
