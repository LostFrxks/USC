from __future__ import annotations

import json
import threading
from datetime import datetime, timedelta, timezone

from app.cache.redis_cache import get_json, make_key, set_json, stable_hash
from app.core.config import settings

_INSIGHTS_CACHE_TTL_SECONDS = 600
_INSIGHTS_CACHE_LOCK = threading.Lock()
_INSIGHTS_CACHE: dict[tuple[int, str, int], tuple[datetime, list[str]]] = {}


def analytics_summary_cache_key(*, user_id: int, company_id: int, role: str, days: int) -> str:
    return make_key("analytics", "summary", user_id, company_id, role, days)


def analytics_assistant_cache_key(
    *,
    user_id: int,
    company_id: int,
    role: str,
    days: int,
    selected_month: str | None,
    question: str,
) -> str:
    q_norm = (question or "").strip().lower()
    q_hash = stable_hash(q_norm, 20)
    return make_key("analytics", "assistant", user_id, company_id, role, days, "v2", selected_month or "_", q_hash)


def analytics_what_if_simulate_cache_key(
    *,
    user_id: int,
    company_id: int,
    role: str,
    days: int,
    horizon_days: int,
    selected_month: str | None,
    drilldown_by: str,
    levers: dict[str, float],
) -> str:
    payload = json.dumps(
        {
            "days": int(days),
            "horizon_days": int(horizon_days),
            "selected_month": selected_month or "_",
            "drilldown_by": drilldown_by,
            "levers": levers,
        },
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return make_key("analytics_what_if", "simulate", user_id, company_id, role, stable_hash(payload, 24))


def analytics_what_if_list_cache_key(*, user_id: int, company_id: int, role: str, limit: int) -> str:
    return make_key("analytics_what_if", "list", user_id, company_id, role, limit)


def get_cached_insights(company_id: int, role: str, days: int) -> list[str] | None:
    redis_key = make_key("analytics", "insights", company_id, role, days)
    cached_redis = get_json(redis_key)
    if isinstance(cached_redis, list):
        clean = [str(x).strip() for x in cached_redis if str(x).strip()]
        if clean:
            return clean[:3]

    key = (company_id, role, days)
    now = datetime.now(timezone.utc)
    with _INSIGHTS_CACHE_LOCK:
        item = _INSIGHTS_CACHE.get(key)
        if not item:
            return None
        expires_at, value = item
        if expires_at <= now:
            _INSIGHTS_CACHE.pop(key, None)
            return None
        return value[:]


def set_cached_insights(company_id: int, role: str, days: int, insights: list[str]) -> None:
    redis_key = make_key("analytics", "insights", company_id, role, days)
    set_json(redis_key, insights[:3], settings.CACHE_TTL_ANALYTICS_INSIGHTS)

    key = (company_id, role, days)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=_INSIGHTS_CACHE_TTL_SECONDS)
    with _INSIGHTS_CACHE_LOCK:
        _INSIGHTS_CACHE[key] = (expires_at, insights[:3])
