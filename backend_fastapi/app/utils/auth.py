from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt

from app.core.config import settings


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def create_access_token(*, subject: str, extra: dict[str, Any] | None = None) -> str:
    exp = _now_utc() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRES_MINUTES)
    payload: dict[str, Any] = {"sub": subject, "type": "access", "exp": exp}
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(*, subject: str, extra: dict[str, Any] | None = None) -> str:
    exp = _now_utc() + timedelta(days=settings.REFRESH_TOKEN_EXPIRES_DAYS)
    payload: dict[str, Any] = {"sub": subject, "type": "refresh", "exp": exp}
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])


# ---------------------------
# PBKDF2 password hashes (legacy format)
# ---------------------------
def verify_legacy_password(raw_password: str, stored_password: str) -> bool:
    """
    Supports legacy PBKDF2 format:
    pbkdf2_sha256$<iterations>$<salt>$<hash>
    """
    if not stored_password:
        return False

    if stored_password.startswith("pbkdf2_sha256$"):
        try:
            _algo, iterations_s, salt, hash_b64 = stored_password.split("$", 3)
            iterations = int(iterations_s)
        except Exception:
            return False

        dk = hashlib.pbkdf2_hmac(
            "sha256",
            raw_password.encode("utf-8"),
            salt.encode("utf-8"),
            iterations,
        )
        computed_b64 = base64.b64encode(dk).decode("ascii").strip()
        return hmac.compare_digest(computed_b64, hash_b64)

    # Unknown/unsupported hashers (argon2, bcrypt, etc.)
    return False


def make_legacy_password(raw_password: str, *, iterations: int = 600_000) -> str:
    salt = secrets.token_hex(6)  # 12 hex chars
    dk = hashlib.pbkdf2_hmac(
        "sha256",
        raw_password.encode("utf-8"),
        salt.encode("utf-8"),
        iterations,
    )
    hash_b64 = base64.b64encode(dk).decode("ascii").strip()
    return f"pbkdf2_sha256${iterations}${salt}${hash_b64}"
