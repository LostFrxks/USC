from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
import json
import threading
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.constants import POLICY_VIOLATION_RU
from app.cache.redis_cache import get_json, make_key, set_json, stable_hash
from app.services.llm import llm_chat_json, llm_policy_check
from app.deps.auth import get_current_user
from app.db.deps import get_db
from app.db.schema import accounts_user as users
from app.db.schema import catalog_category as categories
from app.db.schema import catalog_product as products
from app.db.schema import companies_company as companies
from app.db.schema import companies_companymember as company_members
from app.db.schema import orders_order as orders
from app.db.schema import orders_orderitem as items

router = APIRouter(tags=["analytics"])

_INSIGHTS_CACHE_TTL_SECONDS = 600
_INSIGHTS_CACHE_LOCK = threading.Lock()
_INSIGHTS_CACHE: dict[tuple[int, str, int], tuple[datetime, list[str]]] = {}




class AnalyticsAssistantMetrics(BaseModel):
    mom_pct: float | None = None
    delivery_rate_pct: float = 0.0
    cancel_rate_pct: float = 0.0
    market_share_pct: float = 0.0
    top_category_name: str = "?"
    top_category_share_pct: float = 0.0


class AnalyticsAssistantOut(BaseModel):
    summary: str
    probable_causes: list[str]
    actions: list[str]
    confidence: float
    focus_month: str | None = None
    show_metrics: bool = True
    metrics: AnalyticsAssistantMetrics

class AnalyticsAssistantRequest(BaseModel):
    company_id: int = Field(..., ge=1)
    role: str = Field(default="supplier")
    days: int = Field(default=365, ge=7, le=3650)
    question: str = Field(..., min_length=2, max_length=500)
    selected_month: Optional[str] = Field(default=None)


def _pct_delta(prev: float, cur: float) -> float | None:
    if prev <= 0:
        return None
    return ((cur - prev) / prev) * 100


def _assistant_answer(summary: dict, question: str, selected_month: str | None) -> dict:
    sales = summary.get("sales_trends") or []
    market = summary.get("market_trends") or []
    funnel = summary.get("status_funnel") or []
    categories = summary.get("category_breakdown") or []
    market_info = summary.get("market") or {}

    sales_values = [float(x.get("revenue") or 0) for x in sales]
    current_sales = sales_values[-1] if sales_values else 0.0
    prev_sales = sales_values[-2] if len(sales_values) >= 2 else 0.0
    mom = _pct_delta(prev_sales, current_sales)

    focus = None
    if selected_month:
        focus = next((x for x in sales if str(x.get("month")) == selected_month), None)
    if not focus and sales:
        focus = sales[-1]

    delivered = sum(int(x.get("count") or 0) for x in funnel if str(x.get("status") or "").upper() == "DELIVERED")
    cancelled = sum(
        int(x.get("count") or 0)
        for x in funnel
        if str(x.get("status") or "").upper() in {"CANCELLED", "CANCELED"}
    )
    total = sum(int(x.get("count") or 0) for x in funnel)
    delivery_rate = (delivered / total) * 100 if total else 0.0
    cancel_rate = (cancelled / total) * 100 if total else 0.0

    top_cat = categories[0] if categories else None
    top_cat_name = str(top_cat.get("name")) if top_cat else "—"
    top_cat_share = float(top_cat.get("share_pct") or 0) if top_cat else 0.0
    share = float(market_info.get("company_share_pct") or 0)

    probable_causes: list[str] = []
    actions: list[str] = []

    if mom is not None and mom <= -10:
        probable_causes.append(
            f"Выручка за последний месяц снизилась на {abs(mom):.1f}% к предыдущему периоду, это основной драйвер просадки."
        )
        actions.append("Запустить короткое промо на 7-10 дней по топ-2 SKU для возврата объема.")
    elif mom is not None and mom >= 8:
        probable_causes.append(f"Наблюдается сильный рост MoM: +{mom:.1f}%, спрос ускоряется.")
        actions.append("Увеличить страховой остаток по лидирующим SKU, чтобы не потерять рост из-за out-of-stock.")
    else:
        probable_causes.append("Изменение по месяцу умеренное, вероятнее всего это нормальная рыночная флуктуация.")
        actions.append("Поддерживать текущий прайс и контролировать подтверждение заказов в пиковые дни.")

    if cancel_rate >= 10:
        probable_causes.append(f"Высокая доля отмен ({cancel_rate:.1f}%) съедает часть выручки.")
        actions.append("Поставить SLA на подтверждение заказа до 30 минут и мониторить долю отмен ежедневно.")
    if delivery_rate < 70:
        probable_causes.append(f"Низкий delivery rate ({delivery_rate:.1f}%) ограничивает реализацию спроса.")
        actions.append("Усилить контроль этапов CONFIRMED/DELIVERING, чтобы закрывать больше заказов в DELIVERED.")

    if top_cat_share >= 55:
        probable_causes.append(f"Выручка сильно сконцентрирована в категории «{top_cat_name}» ({top_cat_share:.1f}%).")
        actions.append("Диверсифицировать ассортимент: добавить 2-3 SKU из второй по доле категории.")
    else:
        actions.append("Сфокусировать рекламу на категориях с долей >20% для максимального ROMI.")

    if share < 3:
        probable_causes.append(f"Доля компании на рынке пока низкая ({share:.2f}%).")
        actions.append("Забрать долю через ценовой тест: -3% на флагманские товары в течение 2 недель.")

    if focus:
        fm = str(focus.get("month") or "")
        fv = float(focus.get("revenue") or 0)
        focus_line = f"Фокус-месяц {fm}: выручка {fv:.0f}."
    else:
        focus_line = "Фокус-месяц не выбран."

    q = question.lower()
    if "почему" in q:
        summary_text = (
            f"{focus_line} Ключевые факторы: динамика MoM, отмены, delivery rate и структура категорий."
        )
    elif "что делать" in q or "совет" in q:
        summary_text = (
            f"{focus_line} Приоритет: стабилизировать исполнение и усилить продажи в сильных категориях."
        )
    else:
        summary_text = (
            f"{focus_line} Состояние: MoM {('—' if mom is None else f'{mom:+.1f}%')}, "
            f"delivery {delivery_rate:.1f}%, отмены {cancel_rate:.1f}%."
        )

    signal_count = len(probable_causes)
    confidence = min(0.95, max(0.55, 0.55 + signal_count * 0.07))

    return {
        "summary": summary_text,
        "probable_causes": probable_causes[:4],
        "actions": actions[:5],
        "confidence": round(confidence, 2),
        "focus_month": str(focus.get("month")) if focus else None,
        "show_metrics": True,
        "metrics": {
            "mom_pct": None if mom is None else round(mom, 2),
            "delivery_rate_pct": round(delivery_rate, 2),
            "cancel_rate_pct": round(cancel_rate, 2),
            "market_share_pct": round(share, 2),
            "top_category_name": top_cat_name,
            "top_category_share_pct": round(top_cat_share, 2),
        },
    }


def _safe_float(value, default: float = 0.0) -> float:
    try:
        return float(value)
    except Exception:
        return default


def _looks_analytics_question(question: str) -> bool:
    q = (question or "").lower()
    if not q:
        return False
    keywords = [
        "analytics",
        "metric",
        "kpi",
        "growth",
        "revenue",
        "profit",
        "sales",
        "order",
        "delivery",
        "cancel",
        "risk",
        "forecast",
        "plan",
        "recommend",
        "advice",
        "выруч",
        "продаж",
        "заказ",
        "достав",
        "отмен",
        "риск",
        "прогноз",
        "метрик",
        "аналит",
        "что делать",
        "как улучш",
        "почему",
    ]
    return any(k in q for k in keywords)


def _contains_cyrillic(text: str) -> bool:
    return any("а" <= ch.lower() <= "я" or ch.lower() == "ё" for ch in text)


def _policy_block_response() -> dict:
    return {
        "summary": "Этот запрос нарушает условия пользования. Пожалуйста, переформулируйте вопрос.",
        "probable_causes": [],
        "actions": [],
        "confidence": 1.0,
        "focus_month": None,
        "show_metrics": False,
        "metrics": {
            "mom_pct": None,
            "delivery_rate_pct": 0.0,
            "cancel_rate_pct": 0.0,
            "market_share_pct": 0.0,
            "top_category_name": "—",
            "top_category_share_pct": 0.0,
        },
    }


def _looks_abusive_minimal(question: str) -> bool:
    q = (question or "").lower()
    if not q:
        return False
    # Minimal non-strict guard for explicit insults/abuse phrases.
    abusive_terms = [
        "сын бляди",
        "son of a bitch",
        "пошел нах",
        "иди нах",
        "fuck you",
        "идиот",
        "долбаеб",
    ]
    return any(t in q for t in abusive_terms)


def _llm_policy_check(question: str) -> bool | None:
    """
    Returns:
      - True  => block question
      - False => allow question
      - None  => unable to classify (e.g. provider unavailable)
    """
    return llm_policy_check(question)

def _build_actor_context(db: Session, user: dict, company_id: int, role: str, selected_month: str | None) -> dict:
    u_id = int(user.get("id"))
    user_row = db.execute(
        select(
            users.c.id,
            users.c.email,
            users.c.first_name,
            users.c.last_name,
            users.c.phone,
        ).where(users.c.id == u_id)
    ).mappings().first()
    company_row = db.execute(
        select(
            companies.c.id,
            companies.c.name,
            companies.c.company_type,
            companies.c.phone,
            companies.c.address,
        ).where(companies.c.id == company_id)
    ).mappings().first()

    full_name = ""
    if user_row:
        first = str(user_row.get("first_name") or "").strip()
        last = str(user_row.get("last_name") or "").strip()
        full_name = f"{first} {last}".strip()

    return {
        "user": {
            "id": u_id,
            "name": full_name or None,
            "email": (str(user_row.get("email")) if user_row and user_row.get("email") else None),
            "phone": (str(user_row.get("phone")) if user_row and user_row.get("phone") else None),
        },
        "company": {
            "id": company_id,
            "name": (str(company_row.get("name")) if company_row and company_row.get("name") else None),
            "type": (str(company_row.get("company_type")) if company_row and company_row.get("company_type") else None),
            "phone": (str(company_row.get("phone")) if company_row and company_row.get("phone") else None),
            "address": (str(company_row.get("address")) if company_row and company_row.get("address") else None),
        },
        "session": {
            "role": role,
            "selected_month": selected_month,
        },
    }


def _llm_assistant_answer(
    summary: dict,
    question: str,
    selected_month: str | None,
    actor_context: dict | None = None,
) -> dict | None:
    compact = {
        "assistant_runtime": {
            "provider": "gemini_or_openai",
            "model": settings.GEMINI_MODEL if (settings.LLM_PROVIDER or "gemini").lower() == "gemini" else settings.OPENAI_MODEL,
        },
        "actor_context": actor_context or {},
        "company_id": summary.get("company_id"),
        "role": summary.get("role"),
        "days": summary.get("days"),
        "total_orders": int(summary.get("total_orders") or 0),
        "total_revenue": _safe_float(summary.get("total_revenue")),
        "market": summary.get("market") or {},
        "sales_trends": (summary.get("sales_trends") or [])[-12:],
        "market_trends": (summary.get("market_trends") or [])[-12:],
        "category_breakdown_top": (summary.get("category_breakdown") or [])[:5],
        "status_funnel": summary.get("status_funnel") or [],
        "insights": summary.get("insights") or [],
        "selected_month": selected_month,
        "question": question,
    }

    system_prompt = (
        "You are an analytics assistant for a B2B supply app. "
        "Always answer directly and use provided metrics as evidence. "
        "If the user asks an analytics/business question (causes, risks, growth, plan, priorities, what to do), "
        "return actionable guidance: probable_causes must contain 2-4 items and actions must contain 3-5 concrete steps. "
        "Actions must be prioritized, practical, and tied to the numbers in context. "
        "Summary should be concise (2-4 sentences) and explain what is happening in the data. "
        "If data is insufficient, say so explicitly and avoid invented facts. "
        "Use actor_context for personalization when relevant. "
        "If input is abusive/sexual/illegal-harmful, refuse with exactly: "
        "'???? ?????? ???????? ??????? ???????????. ??????????, ???????????????? ??????.' "
        "and set probable_causes/actions empty and show_metrics=false. "
        "For non-analytics small talk, reply briefly, probable_causes/actions empty, show_metrics=false. "
        "Return STRICT JSON only with keys: summary (string), probable_causes (string[]), actions (string[]), risks (string[]), "
        "confidence (number 0..1), focus_month (string|null), metrics (object: mom_pct, delivery_rate_pct, "
        "cancel_rate_pct, market_share_pct, top_category_name, top_category_share_pct), show_metrics (boolean)."
    )

    out = llm_chat_json(
        system_prompt=system_prompt,
        user_content=json.dumps(compact, ensure_ascii=False),
        temperature=0.45,
    )
    if not isinstance(out, dict):
        return None

    metrics = out.get("metrics") or {}
    probable_causes = [str(x) for x in (out.get("probable_causes") or [])][:4]
    actions = [str(x) for x in (out.get("actions") or [])][:5]
    risks = [str(x) for x in (out.get("risks") or [])][:3]
    if risks:
        probable_causes = probable_causes + [f"????: {r}" for r in risks]

    return {
        "summary": str(out.get("summary") or ""),
        "probable_causes": probable_causes[:5],
        "actions": actions,
        "confidence": max(0.0, min(1.0, _safe_float(out.get("confidence"), 0.7))),
        "focus_month": out.get("focus_month"),
        "show_metrics": bool(out.get("show_metrics", True)),
        "metrics": {
            "mom_pct": None if metrics.get("mom_pct") is None else _safe_float(metrics.get("mom_pct")),
            "delivery_rate_pct": _safe_float(metrics.get("delivery_rate_pct")),
            "cancel_rate_pct": _safe_float(metrics.get("cancel_rate_pct")),
            "market_share_pct": _safe_float(metrics.get("market_share_pct")),
            "top_category_name": str(metrics.get("top_category_name") or "?"),
            "top_category_share_pct": _safe_float(metrics.get("top_category_share_pct")),
        },
    }

def _company_ids_for_user(db: Session, user_id: int) -> list[int]:
    return [
        int(r[0])
        for r in db.execute(select(company_members.c.company_id).where(company_members.c.user_id == user_id)).all()
    ]


def _month_key(value: str | date | datetime | None) -> str:
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.strftime("%Y-%m")
    if isinstance(value, date):
        return value.strftime("%Y-%m")
    text = str(value)
    if len(text) >= 7:
        return text[:7]
    return text


def _get_cached_insights(company_id: int, role: str, days: int) -> list[str] | None:
    redis_key = make_key("analytics", "insights", company_id, role, days)
    cached = get_json(redis_key)
    if isinstance(cached, list):
        clean = [str(x).strip() for x in cached if str(x).strip()]
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


def _set_cached_insights(company_id: int, role: str, days: int, insights: list[str]) -> None:
    clean = [str(x).strip() for x in insights if str(x).strip()][:3]
    if not clean:
        return

    redis_key = make_key("analytics", "insights", company_id, role, days)
    set_json(redis_key, clean, settings.CACHE_TTL_ANALYTICS_INSIGHTS)

    key = (company_id, role, days)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=_INSIGHTS_CACHE_TTL_SECONDS)
    with _INSIGHTS_CACHE_LOCK:
        _INSIGHTS_CACHE[key] = (expires_at, clean)


def _llm_generate_insights(summary_payload: dict) -> list[str] | None:
    prompt = (
        "?? ????????????? copilot B2B-???????? ??? ???????????? ????????. "
        "???? ?????? ?? ??????? ?????. "
        "????? JSON ?????? ????: {\"insights\": [\"...\", \"...\", \"...\"]}. "
        "??????????: 2-3 ???????? ??????, ?????? ? 1 ???????????, ?????????? ?? payload, ??? markdown."
    )
    out = llm_chat_json(
        system_prompt=prompt,
        user_content=json.dumps(summary_payload, ensure_ascii=False),
        temperature=0.2,
    )
    if not isinstance(out, dict):
        return None
    items = out.get("insights")
    if not isinstance(items, list):
        return None
    clean = [str(x).strip() for x in items if str(x).strip()]
    if clean and not any(_contains_cyrillic(x) for x in clean):
        return None
    return clean[:3] if clean else None

def _build_insights(
    sales_trends: list[dict],
    category_breakdown: list[dict],
    status_funnel: list[dict],
) -> list[str]:
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
        out.append(
            f"Высокая концентрация в категории «{top_cat.get('name')}»: {float(top_cat.get('share_pct')):.1f}% выручки."
        )

    total = sum(int(x.get("count") or 0) for x in status_funnel)
    cancelled = 0
    for x in status_funnel:
        status = str(x.get("status") or "").upper()
        if status in {"CANCELLED", "CANCELED"}:
            cancelled += int(x.get("count") or 0)
    if total > 0:
        cancelled_share = (cancelled / total) * 100
        if cancelled_share >= 15:
            out.append(f"Доля отмен высокая ({cancelled_share:.1f}%) — усилите SLA подтверждения и контроль наличия.")
        elif cancelled_share == 0:
            out.append("Отмен за период не было — операционная дисциплина на хорошем уровне.")

    if not out:
        out.append("Недостаточно данных для устойчивых выводов — накопите больше заказов за период.")
    return out[:3]


@router.get("/analytics/summary/")
def analytics_summary(
    company_id: int = Query(..., ge=1),
    role: str = Query("supplier"),
    days: int = Query(180, ge=7, le=3650),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    u_id = int(user["id"])
    if company_id not in _company_ids_for_user(db, u_id):
        raise HTTPException(403, detail="Not allowed")

    role_norm = (role or "").strip().lower()
    if role_norm not in {"supplier", "buyer"}:
        role_norm = "supplier"

    summary_cache_key = make_key("analytics", "summary", company_id, role_norm, days)
    cached_summary = get_json(summary_cache_key)
    if isinstance(cached_summary, dict):
        return cached_summary

    company_col = orders.c.supplier_company_id if role_norm == "supplier" else orders.c.buyer_company_id
    since_dt = datetime.now(timezone.utc) - timedelta(days=days)

    delivered_company = (
        select(orders.c.id, orders.c.created_at)
        .where(
            company_col == company_id,
            orders.c.status == "DELIVERED",
            orders.c.created_at >= since_dt,
        )
        .subquery()
    )

    total_orders = db.execute(select(func.count()).select_from(delivered_company)).scalar_one()

    total_revenue = db.execute(
        select(func.coalesce(func.sum(items.c.qty * items.c.price_snapshot), 0))
        .select_from(items.join(delivered_company, items.c.order_id == delivered_company.c.id))
    ).scalar_one()

    daily_rows = db.execute(
        select(
            func.date(delivered_company.c.created_at).label("day"),
            func.coalesce(func.sum(items.c.qty * items.c.price_snapshot), 0).label("revenue"),
        )
        .select_from(items.join(delivered_company, items.c.order_id == delivered_company.c.id))
        .group_by(func.date(delivered_company.c.created_at))
        .order_by(func.date(delivered_company.c.created_at))
    ).all()

    top_rows = db.execute(
        select(
            items.c.product_id.label("product_id"),
            products.c.name.label("name"),
            func.coalesce(func.sum(items.c.qty * items.c.price_snapshot), 0).label("revenue"),
            func.coalesce(func.sum(items.c.qty), 0).label("qty_total"),
        )
        .select_from(
            items.join(delivered_company, items.c.order_id == delivered_company.c.id).join(
                products, items.c.product_id == products.c.id
            )
        )
        .group_by(items.c.product_id, products.c.name)
        .order_by(func.sum(items.c.qty * items.c.price_snapshot).desc())
        .limit(10)
    ).all()

    sales_month_rows = db.execute(
        select(
            func.date_trunc("month", delivered_company.c.created_at).label("month"),
            func.coalesce(func.sum(items.c.qty * items.c.price_snapshot), 0).label("revenue"),
        )
        .select_from(items.join(delivered_company, items.c.order_id == delivered_company.c.id))
        .group_by(func.date_trunc("month", delivered_company.c.created_at))
        .order_by(func.date_trunc("month", delivered_company.c.created_at))
    ).all()

    delivered_market = (
        select(orders.c.id, orders.c.created_at)
        .where(
            orders.c.status == "DELIVERED",
            orders.c.created_at >= since_dt,
        )
        .subquery()
    )

    market_revenue = db.execute(
        select(func.coalesce(func.sum(items.c.qty * items.c.price_snapshot), 0))
        .select_from(items.join(delivered_market, items.c.order_id == delivered_market.c.id))
    ).scalar_one()
    market_orders = db.execute(select(func.count()).select_from(delivered_market)).scalar_one()

    market_month_rows = db.execute(
        select(
            func.date_trunc("month", delivered_market.c.created_at).label("month"),
            func.coalesce(func.sum(items.c.qty * items.c.price_snapshot), 0).label("revenue"),
        )
        .select_from(items.join(delivered_market, items.c.order_id == delivered_market.c.id))
        .group_by(func.date_trunc("month", delivered_market.c.created_at))
        .order_by(func.date_trunc("month", delivered_market.c.created_at))
    ).all()

    cat_rows = db.execute(
        select(
            func.coalesce(categories.c.name, "Без категории").label("name"),
            func.coalesce(func.sum(items.c.qty * items.c.price_snapshot), 0).label("revenue"),
        )
        .select_from(
            items.join(delivered_company, items.c.order_id == delivered_company.c.id)
            .join(products, items.c.product_id == products.c.id)
            .outerjoin(categories, products.c.category_id == categories.c.id)
        )
        .group_by(func.coalesce(categories.c.name, "Без категории"))
        .order_by(func.sum(items.c.qty * items.c.price_snapshot).desc())
    ).all()

    status_rows = db.execute(
        select(
            orders.c.status.label("status"),
            func.count().label("count"),
        )
        .where(company_col == company_id, orders.c.created_at >= since_dt)
        .group_by(orders.c.status)
        .order_by(
            case(
                (orders.c.status == "PENDING", 1),
                (orders.c.status == "CONFIRMED", 2),
                (orders.c.status == "DELIVERING", 3),
                (orders.c.status == "DELIVERED", 4),
                (orders.c.status == "CANCELLED", 5),
                else_=9,
            )
        )
    ).all()

    daily_revenue = [
        {"day": str(row.day) if isinstance(row.day, date) else str(row.day), "revenue": float(row.revenue or 0)}
        for row in daily_rows
    ]

    top_products = [
        {
            "product_id": int(row.product_id),
            "name": row.name,
            "revenue": float(row.revenue or 0),
            "qty_total": float(row.qty_total or 0),
        }
        for row in top_rows
    ]

    sales_trends = [{"month": _month_key(r.month), "revenue": float(r.revenue or 0)} for r in sales_month_rows]
    market_trends = [{"month": _month_key(r.month), "revenue": float(r.revenue or 0)} for r in market_month_rows]

    cat_total = sum(float(r.revenue or 0) for r in cat_rows)
    category_breakdown = [
        {
            "name": str(r.name),
            "revenue": float(r.revenue or 0),
            "share_pct": round((float(r.revenue or 0) / cat_total) * 100, 2) if cat_total > 0 else 0,
        }
        for r in cat_rows
    ]

    status_funnel = [{"status": str(r.status), "count": int(r.count or 0)} for r in status_rows]
    base_insights = _build_insights(sales_trends=sales_trends, category_breakdown=category_breakdown, status_funnel=status_funnel)

    market_revenue_f = float(market_revenue or 0)
    total_revenue_f = float(total_revenue or 0)
    company_share_pct = round((total_revenue_f / market_revenue_f) * 100, 2) if market_revenue_f > 0 else 0
    insights = _get_cached_insights(company_id=company_id, role=role_norm, days=days) or base_insights
    llm_available = bool(settings.GEMINI_API_KEY or settings.OPENAI_API_KEY)
    if insights is base_insights and llm_available:
        llm_insights = _llm_generate_insights(
            {
                "company_id": company_id,
                "role": role_norm,
                "days": days,
                "total_orders": int(total_orders or 0),
                "total_revenue": total_revenue_f,
                "market": {
                    "platform_revenue": market_revenue_f,
                    "platform_orders": int(market_orders or 0),
                    "company_share_pct": company_share_pct,
                },
                "sales_trends": sales_trends[-12:],
                "category_breakdown_top": category_breakdown[:5],
                "status_funnel": status_funnel,
                "fallback_insights": base_insights,
            }
        )
        if llm_insights:
            insights = llm_insights[:3]
            _set_cached_insights(company_id=company_id, role=role_norm, days=days, insights=insights)

    response = {
        "company_id": company_id,
        "role": role_norm,
        "days": days,
        "total_orders": int(total_orders or 0),
        "total_revenue": total_revenue_f,
        "daily_revenue": daily_revenue,
        "top_products": top_products,
        "market": {
            "platform_revenue": market_revenue_f,
            "platform_orders": int(market_orders or 0),
            "company_share_pct": company_share_pct,
        },
        "market_trends": market_trends,
        "sales_trends": sales_trends,
        "category_breakdown": category_breakdown,
        "status_funnel": status_funnel,
        "insights": insights,
    }
    set_json(summary_cache_key, response, settings.CACHE_TTL_ANALYTICS_SUMMARY)
    return response


@router.post("/analytics/assistant/query", response_model=AnalyticsAssistantOut)
def analytics_assistant_query(
    payload: AnalyticsAssistantRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if _looks_abusive_minimal(payload.question):
        return _policy_block_response()

    question_norm = (payload.question or "").strip().lower()
    assistant_cache_key = make_key(
        "analytics",
        "assistant",
        int(user["id"]),
        payload.company_id,
        (payload.role or "supplier").strip().lower(),
        payload.days,
        payload.selected_month or "",
        stable_hash(question_norm),
    )
    cached_answer = get_json(assistant_cache_key)
    if isinstance(cached_answer, dict):
        return cached_answer

    actor_context = _build_actor_context(
        db=db,
        user=user,
        company_id=payload.company_id,
        role=payload.role,
        selected_month=payload.selected_month,
    )
    summary = analytics_summary(
        company_id=payload.company_id,
        role=payload.role,
        days=payload.days,
        user=user,
        db=db,
    )
    llm = _llm_assistant_answer(
        summary=summary,
        question=payload.question,
        selected_month=payload.selected_month,
        actor_context=actor_context,
    )
    if llm is not None:
        if _looks_analytics_question(payload.question):
            if not llm.get("probable_causes") or not llm.get("actions"):
                fallback = _assistant_answer(summary=summary, question=payload.question, selected_month=payload.selected_month)
                if not llm.get("probable_causes"):
                    llm["probable_causes"] = fallback.get("probable_causes", [])
                if not llm.get("actions"):
                    llm["actions"] = fallback.get("actions", [])
                if not llm.get("summary"):
                    llm["summary"] = fallback.get("summary", "")
                llm["show_metrics"] = bool(llm.get("show_metrics", True))
        set_json(assistant_cache_key, llm, settings.CACHE_TTL_ANALYTICS_ASSISTANT)
        return llm

    fallback = _assistant_answer(summary=summary, question=payload.question, selected_month=payload.selected_month)
    set_json(assistant_cache_key, fallback, settings.CACHE_TTL_ANALYTICS_ASSISTANT)
    return fallback





