from __future__ import annotations

from fastapi import Request, Response

from app.core.config import settings


def cookie_samesite() -> str:
    value = (settings.AUTH_COOKIE_SAMESITE or "lax").strip().lower()
    if value not in {"lax", "strict", "none"}:
        return "lax"
    return value


def set_refresh_cookie(response: Response, refresh_token: str) -> None:
    response.set_cookie(
        key=settings.AUTH_REFRESH_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        secure=bool(settings.AUTH_COOKIE_SECURE),
        samesite=cookie_samesite(),
        path=settings.AUTH_COOKIE_PATH or "/",
        domain=(settings.AUTH_COOKIE_DOMAIN or None),
        max_age=int(settings.REFRESH_TOKEN_EXPIRES_DAYS) * 24 * 60 * 60,
    )


def clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.AUTH_REFRESH_COOKIE_NAME,
        path=settings.AUTH_COOKIE_PATH or "/",
        domain=(settings.AUTH_COOKIE_DOMAIN or None),
    )


def extract_refresh_token(request: Request, payload_refresh: str | None) -> str | None:
    from_payload = (payload_refresh or "").strip()
    if from_payload:
        return from_payload
    from_cookie = (request.cookies.get(settings.AUTH_REFRESH_COOKIE_NAME) or "").strip()
    return from_cookie or None
