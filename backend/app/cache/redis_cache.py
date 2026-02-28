from __future__ import annotations

import hashlib
import json
import logging
from datetime import date, datetime, timezone
from fnmatch import fnmatch
from typing import Any

import redis

from app.core.config import settings

logger = logging.getLogger(__name__)

_client: redis.Redis | None = None


class CacheError(RuntimeError):
    pass


def _enabled() -> bool:
    return bool((settings.REDIS_URL or "").strip())


def _client_or_none() -> redis.Redis | None:
    global _client
    if not _enabled():
        return None
    if _client is None:
        _client = redis.Redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_timeout=float(settings.REDIS_TIMEOUT_SECONDS),
            socket_connect_timeout=float(settings.REDIS_TIMEOUT_SECONDS),
            retry_on_timeout=True,
        )
    return _client


def get_redis_client() -> redis.Redis | None:
    return _client_or_none()


def _k(key: str) -> str:
    prefix = (settings.REDIS_PREFIX or "usc").strip() or "usc"
    return f"{prefix}:{key}"


def stable_hash(text: str, length: int = 16) -> str:
    return hashlib.sha1((text or "").encode("utf-8")).hexdigest()[:length]


def make_key(namespace: str, *parts: Any) -> str:
    normalized = [namespace.strip().strip(":")]
    for p in parts:
        if p is None:
            normalized.append("_")
        elif isinstance(p, bool):
            normalized.append("1" if p else "0")
        else:
            normalized.append(str(p).strip().replace(" ", "_") or "_")
    return "v1:" + ":".join(normalized)


def _json_default(value: Any) -> str:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return str(value)


def get_json(key: str) -> Any | None:
    c = _client_or_none()
    if c is None:
        return None
    try:
        raw = c.get(_k(key))
        if not raw:
            logger.info("cache_miss key=%s", key)
            return None
        logger.info("cache_hit key=%s", key)
        return json.loads(raw)
    except Exception as e:
        logger.warning("Redis get failed for key=%s: %s", key, e)
        return None


def set_json(key: str, value: Any, ttl_seconds: int) -> bool:
    c = _client_or_none()
    if c is None:
        return False
    try:
        payload = json.dumps(value, ensure_ascii=False, separators=(",", ":"), default=_json_default)
        c.setex(_k(key), max(1, int(ttl_seconds)), payload)
        logger.info("cache_set key=%s ttl=%s", key, ttl_seconds)
        return True
    except Exception as e:
        logger.warning("Redis set failed for key=%s: %s", key, e)
        return False


def delete_key(key: str) -> bool:
    c = _client_or_none()
    if c is None:
        return False
    try:
        c.delete(_k(key))
        logger.info("cache_delete key=%s", key)
        return True
    except Exception as e:
        logger.warning("Redis delete failed for key=%s: %s", key, e)
        return False


def ping() -> bool:
    c = _client_or_none()
    if c is None:
        return False
    try:
        return bool(c.ping())
    except Exception:
        return False


def key_count(pattern: str = "*") -> int:
    c = _client_or_none()
    if c is None:
        return 0
    try:
        wildcard = _k(pattern)
        total = 0
        for _ in c.scan_iter(match=wildcard, count=200):
            total += 1
        return total
    except Exception:
        return 0


def cache_status() -> dict[str, Any]:
    enabled = _enabled()
    is_up = ping() if enabled else False
    return {
        "redis_enabled": enabled,
        "redis_ping": is_up,
        "redis_prefix": (settings.REDIS_PREFIX or "usc").strip() or "usc",
        "sample_keys_count": key_count("*"),
    }


def invalidate_patterns(*patterns: str) -> int:
    c = _client_or_none()
    if c is None:
        return 0

    # patterns are passed as internal keys (without prefix), e.g. "v1:orders:*"
    deleted = 0
    try:
        expanded: list[str] = []
        for p in patterns:
            if not p:
                continue
            expanded.append(_k(p))

        if not expanded:
            return 0

        keys_to_delete: list[str] = []
        for key in c.scan_iter(match=_k("*"), count=300):
            if any(fnmatch(key, pat) for pat in expanded):
                keys_to_delete.append(key)

        if keys_to_delete:
            deleted = int(c.delete(*keys_to_delete) or 0)
        logger.info("cache_invalidate patterns=%s deleted=%s", patterns, deleted)
        return deleted
    except Exception as e:
        logger.warning("Redis invalidate failed for patterns=%s: %s", patterns, e)
        return 0


def quick_write_probe() -> bool:
    probe_key = make_key("health", "probe", stable_hash(str(datetime.now(timezone.utc).timestamp()), 10))
    if not set_json(probe_key, {"ok": True}, 3):
        return False
    return get_json(probe_key) is not None
