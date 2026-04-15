from __future__ import annotations

import json
from urllib import request as urlrequest
from urllib.error import HTTPError, URLError

from app.core.config import settings


def contains_cyrillic(text: str) -> bool:
    return any("а" <= ch.lower() <= "я" or ch.lower() == "ё" for ch in (text or ""))


def llm_generate_insights(summary_payload: dict) -> list[str] | None:
    if not settings.OPENAI_API_KEY:
        return None

    prompt = (
        "Ты генерируешь короткие бизнес-инсайты для карточки аналитики. "
        "Пиши СТРОГО на русском языке. "
        'Верни ТОЛЬКО JSON формата: {"insights": ["...", "...", "..."]}. '
        "Правила: 2-3 пункта, каждый пункт в 1 предложении, конкретно и по данным из payload, без markdown."
    )
    payload = {
        "model": settings.OPENAI_MODEL,
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": prompt},
            {"role": "user", "content": json.dumps(summary_payload, ensure_ascii=False)},
        ],
    }
    req = urlrequest.Request(
        url=f"{settings.OPENAI_BASE_URL.rstrip('/')}/chat/completions",
        method="POST",
        headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}", "Content-Type": "application/json"},
        data=json.dumps(payload).encode("utf-8"),
    )
    try:
        with urlrequest.urlopen(req, timeout=float(settings.OPENAI_TIMEOUT_SECONDS)) as resp:
            raw = resp.read().decode("utf-8")
        parsed = json.loads(raw)
        content = (((parsed.get("choices") or [{}])[0].get("message") or {}).get("content") or "").strip()
        if not content:
            return None
        out = json.loads(content)
        items = out.get("insights")
        if not isinstance(items, list):
            return None
        clean = [str(x).strip() for x in items if str(x).strip()]
        if clean and not any(contains_cyrillic(x) for x in clean):
            return None
        return clean[:3] if clean else None
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, ValueError, TypeError):
        return None


def build_insights(sales_trends: list[dict], category_breakdown: list[dict], status_funnel: list[dict]) -> list[str]:
    out: list[str] = []
    if len(sales_trends) >= 2:
        prev = float(sales_trends[-2]["revenue"])
        cur = float(sales_trends[-1]["revenue"])
        if prev > 0:
            delta_pct = ((cur - prev) / prev) * 100
            if delta_pct >= 5:
                out.append(f"Выручка за последний месяц выросла на {delta_pct:.1f}% — закрепите рост через приоритетные SKU.")
            elif delta_pct <= -5:
                out.append(f"Выручка за последний месяц снизилась на {abs(delta_pct):.1f}% — проверьте цену, остатки и конверсию.")
        elif cur > 0:
            out.append("В последнем месяце появились оплаченные поставки — можно масштабировать рабочую воронку.")
    top_cat = category_breakdown[0] if category_breakdown else None
    if top_cat and float(top_cat.get("share_pct", 0)) >= 55:
        out.append(f"Высокая концентрация в категории «{top_cat.get('name')}»: {float(top_cat.get('share_pct')):.1f}% выручки.")
    total = sum(int(x.get("count") or 0) for x in status_funnel)
    cancelled = 0
    for item in status_funnel:
        status = str(item.get("status") or "").upper()
        if status in {"CANCELLED", "CANCELED"}:
            cancelled += int(item.get("count") or 0)
    if total > 0:
        cancelled_share = (cancelled / total) * 100
        if cancelled_share >= 15:
            out.append(f"Доля отмен высокая ({cancelled_share:.1f}%) — усилите SLA подтверждения и контроль наличия.")
        elif cancelled_share == 0:
            out.append("Отмен за период не было — операционная дисциплина на хорошем уровне.")
    if not out:
        out.append("Недостаточно данных для устойчивых выводов — накопите больше заказов за период.")
    return out[:3]
