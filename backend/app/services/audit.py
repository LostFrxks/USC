from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import insert
from sqlalchemy.orm import Session

from app.db.schema import audit_event

SENSITIVE_KEYS = {"password", "refresh", "access", "token", "code", "otp", "jwt"}


def _mask_value(value: Any) -> Any:
    if isinstance(value, str):
        if len(value) <= 6:
            return "***"
        return f"{value[:2]}***{value[-2:]}"
    if isinstance(value, (int, float, bool)) or value is None:
        return value
    if isinstance(value, list):
        return [_mask_value(v) for v in value]
    if isinstance(value, dict):
        return {k: _mask_value(v) for k, v in value.items()}
    return str(value)


def _sanitize_payload(payload: dict[str, Any] | None) -> str:
    if not payload:
        return "{}"
    safe: dict[str, Any] = {}
    for key, value in payload.items():
        if key.lower() in SENSITIVE_KEYS:
            safe[key] = "***"
        else:
            safe[key] = _mask_value(value)
    return json.dumps(safe, ensure_ascii=False)


def log_audit_event(
    db: Session,
    *,
    domain: str,
    action: str,
    resource_type: str,
    resource_id: str | None = None,
    actor_user_id: int | None = None,
    actor_company_id: int | None = None,
    request_id: str | None = None,
    ip: str | None = None,
    user_agent: str | None = None,
    outcome: str = "success",
    payload: dict[str, Any] | None = None,
) -> None:
    values = {
        "occurred_at": datetime.now(timezone.utc),
        "actor_user_id": actor_user_id,
        "actor_company_id": actor_company_id,
        "domain": domain,
        "action": action,
        "resource_type": resource_type,
        "resource_id": resource_id or "",
        "request_id": request_id or "",
        "ip": (ip or "")[:64],
        "user_agent": (user_agent or "")[:255],
        "outcome": (outcome or "success")[:32],
        "payload_json": _sanitize_payload(payload),
    }
    try:
        db.execute(insert(audit_event).values(values))
    except Exception:
        # Audit must not break product flow.
        pass

