from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.security.refresh_sessions import create_refresh_session
from app.utils.auth import create_access_token, create_refresh_token, decode_token, refresh_expires_at


def issue_token_pair(
    db: Session,
    *,
    user_id: int,
    email: str,
    role: str | None = None,
    ip: str | None = None,
    user_agent: str | None = None,
    sid: str | None = None,
) -> dict[str, str]:
    subject = str(user_id)
    extra = {"email": email}
    if role:
        extra["role"] = role
    if sid:
        extra["sid"] = sid

    access = create_access_token(subject=subject, extra=extra)
    refresh = create_refresh_token(subject=subject, extra=extra)
    refresh_data = decode_token(refresh)
    jti = str(refresh_data.get("jti") or "")
    refresh_sid = str(refresh_data.get("sid") or sid or "")
    if not jti or not refresh_sid:
        raise HTTPException(500, detail="Failed to generate refresh session claims")

    create_refresh_session(
        db,
        user_id=user_id,
        jti=jti,
        sid=refresh_sid,
        expires_at=refresh_expires_at(),
        ip=ip,
        user_agent=(user_agent or "")[:255],
        metadata={"issued_via": "auth_router"},
    )
    return {"access": access, "refresh": refresh}
