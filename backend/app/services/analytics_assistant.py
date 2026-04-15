from __future__ import annotations

import json
import re
from urllib import request as urlrequest
from urllib.error import HTTPError, URLError

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.schema import accounts_user as users
from app.db.schema import companies_company as companies


def pct_delta(prev: float, cur: float) -> float | None:
    if prev <= 0:
        return None
    return ((cur - prev) / prev) * 100


def safe_float(value, default: float = 0.0) -> float:
    try:
        return float(value)
    except Exception:
        return default


_TECH_PREFIX_RE = re.compile(r"(?:\d+\.\s*)?analytics_modules\.[\w.]+:\s*", flags=re.IGNORECASE)
_TECH_TOKEN_RE = re.compile(r"\banalytics_modules(?:\.[\w-]+)+:?", flags=re.IGNORECASE)
_QUOTED_TOKEN_RE = re.compile(r'[«"“”]\s*([A-Za-zА-Яа-яЁё0-9][A-Za-zА-Яа-яЁё0-9 _/\-]{0,40})\s*[»"“”]')


def sanitize_assistant_line(text: str) -> str:
    clean = str(text or "").replace("**", "").strip()
    if not clean:
        return ""
    clean = _TECH_PREFIX_RE.sub("", clean)
    clean = _TECH_TOKEN_RE.sub("", clean)
    clean = _QUOTED_TOKEN_RE.sub(lambda m: m.group(1).strip(), clean)
    clean = re.sub(r"\s+(?:вот что можно сделать|что делать|практические шаги)\s*:\s*$", "", clean, flags=re.IGNORECASE)
    clean = re.sub(r"\(\s*\)", "", clean)
    clean = re.sub(r"\s+([,.;:!?])", r"\1", clean)
    clean = re.sub(r"([(\[])\s+", r"\1", clean)
    clean = re.sub(r"\s+([)\]])", r"\1", clean)
    clean = re.sub(r"\s{2,}", " ", clean).strip()
    clean = clean.strip(" ,;:-")
    return clean


def sanitize_assistant_list(values: list[str], *, limit: int) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for raw in values:
        clean = sanitize_assistant_line(str(raw))
        if not clean:
            continue
        dedup = clean.lower()
        if dedup in seen:
            continue
        seen.add(dedup)
        out.append(clean)
        if len(out) >= limit:
            break
    return out


def sanitize_assistant_payload(payload: dict) -> dict:
    out = dict(payload or {})
    out["summary"] = sanitize_assistant_line(str(out.get("summary") or ""))
    out["probable_causes"] = sanitize_assistant_list([str(x) for x in (out.get("probable_causes") or [])], limit=4)
    out["actions"] = sanitize_assistant_list([str(x) for x in (out.get("actions") or [])], limit=5)
    metrics = out.get("metrics")
    if isinstance(metrics, dict):
        top_name = sanitize_assistant_line(str(metrics.get("top_category_name") or ""))
        metrics["top_category_name"] = top_name or "—"
        out["metrics"] = metrics
    return out


def assistant_question_intent(question: str) -> tuple[bool, bool]:
    q = (question or "").lower()
    cause_markers = ["почему", "причин", "причина", "из-за", "отчего", "why", "reason", "root cause"]
    action_markers = ["что делать", "что мне делать", "как улучш", "как поднять", "что посоветуешь", "совет", "план", "действ", "next step", "action"]
    wants_causes = any(marker in q for marker in cause_markers)
    wants_actions = any(marker in q for marker in action_markers)
    return wants_causes, wants_actions


def looks_analytics_question(question: str) -> bool:
    q = (question or "").lower()
    if not q:
        return False
    keywords = [
        "analytics", "metric", "kpi", "growth", "revenue", "profit", "sales", "order", "delivery", "cancel", "risk",
        "forecast", "plan", "recommend", "advice", "выруч", "продаж", "заказ", "достав", "отмен", "риск", "прогноз",
        "метрик", "аналит", "что делать", "как улучш", "почему",
    ]
    return any(k in q for k in keywords)


def looks_abusive_minimal(question: str) -> bool:
    q = (question or "").lower()
    if not q:
        return False
    abusive_terms = ["сын бляди", "son of a bitch", "пошел нах", "иди нах", "fuck you", "идиот", "долбаеб"]
    return any(t in q for t in abusive_terms)


def policy_block_response() -> dict:
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


def llm_policy_check(question: str) -> bool | None:
    if not settings.OPENAI_API_KEY:
        return None
    policy_prompt = (
        "You are a strict safety classifier for chat input. "
        "Return ONLY JSON with keys: decision (allow|block), reason (short string). "
        "Block if message includes harassment/abuse, explicit sexual content, sexual content involving minors, "
        "violent wrongdoing instructions, illegal wrongdoing instructions, or self-harm instructions. "
        "Allow normal business questions, analytics questions, neutral small talk, and non-harmful profanity. "
        "Do not overblock."
    )
    payload = {
        "model": settings.OPENAI_MODEL,
        "temperature": 0,
        "response_format": {"type": "json_object"},
        "messages": [{"role": "system", "content": policy_prompt}, {"role": "user", "content": question}],
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
        decision = str(out.get("decision") or "").strip().lower()
        if decision == "block":
            return True
        if decision == "allow":
            return False
        return None
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, ValueError, TypeError):
        return None


def build_actor_context(db: Session, user: dict, company_id: int, role: str, selected_month: str | None) -> dict:
    u_id = int(user.get("id"))
    user_row = db.execute(
        select(users.c.id, users.c.email, users.c.first_name, users.c.last_name, users.c.phone).where(users.c.id == u_id)
    ).mappings().first()
    company_row = db.execute(
        select(companies.c.id, companies.c.name, companies.c.company_type, companies.c.phone, companies.c.address).where(companies.c.id == company_id)
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
        "session": {"role": role, "selected_month": selected_month},
    }


def assistant_answer(summary: dict, question: str, selected_month: str | None) -> dict:
    sales = summary.get("sales_trends") or []
    funnel = summary.get("status_funnel") or []
    categories = summary.get("category_breakdown") or []
    market_info = summary.get("market") or {}

    sales_values = [float(x.get("revenue") or 0) for x in sales]
    current_sales = sales_values[-1] if sales_values else 0.0
    prev_sales = sales_values[-2] if len(sales_values) >= 2 else 0.0
    mom = pct_delta(prev_sales, current_sales)

    focus = None
    if selected_month:
        focus = next((x for x in sales if str(x.get("month")) == selected_month), None)
    if not focus and sales:
        focus = sales[-1]

    delivered = sum(int(x.get("count") or 0) for x in funnel if str(x.get("status") or "").upper() == "DELIVERED")
    cancelled = sum(int(x.get("count") or 0) for x in funnel if str(x.get("status") or "").upper() in {"CANCELLED", "CANCELED"})
    total = sum(int(x.get("count") or 0) for x in funnel)
    delivery_rate = (delivered / total) * 100 if total else 0.0
    cancel_rate = (cancelled / total) * 100 if total else 0.0

    top_cat = categories[0] if categories else None
    top_cat_name = str(top_cat.get("name")) if top_cat else "—"
    top_cat_share = float(top_cat.get("share_pct") or 0) if top_cat else 0.0
    share = float(market_info.get("company_share_pct") or 0)

    raw_causes: list[str] = []
    raw_actions: list[str] = []
    buyer_recommendations = summary.get("buyer_recommendations") or {}
    analytics_modules = summary.get("analytics_modules") or {}
    module_alerts = analytics_modules.get("alerts") or []
    module_actions = analytics_modules.get("actions") or []
    cheaper_alternatives = buyer_recommendations.get("cheaper_alternatives") or []
    reliable_suppliers = buyer_recommendations.get("reliable_suppliers") or []

    if mom is not None and mom <= -10:
        raw_causes.append(f"Выручка за последний месяц снизилась на {abs(mom):.1f}% к предыдущему периоду, это основной драйвер просадки.")
        raw_actions.append("Запустить короткое промо на 7-10 дней по топ-2 SKU для возврата объема.")
    elif mom is not None and mom >= 8:
        raw_causes.append(f"Наблюдается сильный рост MoM: +{mom:.1f}%, спрос ускоряется.")
        raw_actions.append("Увеличить страховой остаток по лидирующим SKU, чтобы не потерять рост из-за out-of-stock.")

    if cancel_rate >= 10:
        raw_causes.append(f"Высокая доля отмен ({cancel_rate:.1f}%) съедает часть выручки.")
        raw_actions.append("Поставить SLA на подтверждение заказа до 30 минут и мониторить долю отмен ежедневно.")
    if delivery_rate < 70:
        raw_causes.append(f"Низкий delivery rate ({delivery_rate:.1f}%) ограничивает реализацию спроса.")
        raw_actions.append("Усилить контроль этапов CONFIRMED/DELIVERING, чтобы закрывать больше заказов в DELIVERED.")

    if top_cat_share >= 55:
        raw_causes.append(f"Выручка сильно сконцентрирована в категории {top_cat_name} ({top_cat_share:.1f}%).")
        raw_actions.append("Диверсифицировать ассортимент: добавить 2-3 SKU из второй по доле категории.")

    if share < 3:
        raw_causes.append(f"Доля компании на рынке пока низкая ({share:.2f}%).")
        raw_actions.append("Забрать долю через ценовой тест: -3% на флагманские товары в течение 2 недель.")

    if str(summary.get("role") or "").lower() == "buyer":
        if cheaper_alternatives:
            alt = cheaper_alternatives[0]
            raw_actions.append(
                f"Для {alt.get('anchor_product_name')} переключите часть закупок на "
                f"{alt.get('candidate_supplier_name')} ({alt.get('candidate_product_name')}): "
                f"экономия до {float(alt.get('savings_pct') or 0):.1f}%."
            )
        if reliable_suppliers:
            top_supplier = reliable_suppliers[0]
            raw_actions.append(
                f"Увеличьте долю заказов у {top_supplier.get('supplier_name')} "
                f"(надежность {float(top_supplier.get('score') or 0):.1f}/100) для снижения операционного риска."
            )
    else:
        supplier_module = analytics_modules.get("supplier") or {}
        price_mod = supplier_module.get("price_competitiveness") or {}
        top_overpriced = (price_mod.get("top_overpriced_skus") or [None])[0]
        if top_overpriced:
            raw_actions.append(
                f"Скорректируйте цену на {top_overpriced.get('name')}: отклонение от медианы рынка "
                f"{float(top_overpriced.get('gap_pct') or 0):.1f}%."
            )

    if module_alerts:
        alert = module_alerts[0]
        raw_causes.append(f"{str(alert.get('title') or 'Сигнал')}: {str(alert.get('message') or '').strip()}")
    if module_actions:
        for action in module_actions[:2]:
            impact_abs = action.get("expected_impact_abs")
            impact_pct = action.get("expected_impact_pct")
            impact_hint = ""
            if impact_abs is not None:
                impact_hint = f" Оценка эффекта: ~{float(impact_abs):.0f} сом."
            elif impact_pct is not None:
                impact_hint = f" Оценка эффекта: ~{float(impact_pct):.1f}%."
            raw_actions.append(f"{str(action.get('title') or '')}: {str(action.get('rationale') or '').strip()}{impact_hint}")

    if focus:
        fm = str(focus.get("month") or "")
        fv = float(focus.get("revenue") or 0)
        focus_line = f"Фокус-месяц {fm}: выручка {fv:.0f}."
    else:
        focus_line = "Фокус-месяц не выбран."

    q = question.lower()
    if "почему" in q:
        summary_text = f"{focus_line} Ключевые факторы: динамика MoM, отмены, delivery rate и структура категорий."
    elif "что делать" in q or "совет" in q:
        summary_text = f"{focus_line} Приоритет: стабилизировать исполнение и усилить продажи в сильных категориях."
    else:
        summary_text = f"{focus_line} Состояние: MoM {('—' if mom is None else f'{mom:+.1f}%')}, delivery {delivery_rate:.1f}%, отмены {cancel_rate:.1f}%."

    wants_causes, wants_actions = assistant_question_intent(question)
    if wants_causes and not raw_causes:
        raw_causes.append("Существенных негативных отклонений в текущем срезе не обнаружено.")
    if wants_actions and not raw_actions:
        raw_actions.append("Поддерживайте текущую стратегию и мониторьте ключевые KPI ежедневно.")

    probable_causes = sanitize_assistant_list(raw_causes[:4] if wants_causes else [], limit=4)
    actions = sanitize_assistant_list(raw_actions[:5] if wants_actions else [], limit=5)
    signal_count = len(raw_causes)
    confidence = min(0.95, max(0.55, 0.55 + signal_count * 0.07))
    return {
        "summary": sanitize_assistant_line(summary_text),
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


def llm_assistant_answer(summary: dict, question: str, selected_month: str | None, actor_context: dict | None = None) -> dict | None:
    if not settings.OPENAI_API_KEY:
        return None
    compact = {
        "assistant_runtime": {"provider": "openai_compatible", "model": settings.OPENAI_MODEL},
        "actor_context": actor_context or {},
        "company_id": summary.get("company_id"),
        "role": summary.get("role"),
        "days": summary.get("days"),
        "total_orders": int(summary.get("total_orders") or 0),
        "total_revenue": safe_float(summary.get("total_revenue")),
        "market": summary.get("market") or {},
        "sales_trends": (summary.get("sales_trends") or [])[-12:],
        "market_trends": (summary.get("market_trends") or [])[-12:],
        "category_breakdown_top": (summary.get("category_breakdown") or [])[:5],
        "status_funnel": summary.get("status_funnel") or [],
        "insights": summary.get("insights") or [],
        "buyer_recommendations": summary.get("buyer_recommendations") or {},
        "analytics_modules": summary.get("analytics_modules") or {},
        "selected_month": selected_month,
        "question": question,
    }
    system_prompt = (
        "You are an analytics assistant for a B2B supply app. "
        "Always answer directly and use provided metrics as evidence. "
        "If the user asks an analytics/business question (causes, risks, growth, plan, priorities, what to do), "
        "return actionable guidance: probable_causes must contain 2-4 items and actions must contain 3-5 concrete steps. "
        "Actions must be prioritized, practical, and tied to the numbers in context. "
        "Use analytics_modules.alerts and analytics_modules.actions as primary context for risks and recommendations. "
        "If expected_impact_abs or expected_impact_pct exists, mention these figures in actions. "
        "Summary should be concise (2-4 sentences) and explain what is happening in the data. "
        "If data is insufficient, say so explicitly and avoid invented facts. "
        "Use actor_context for personalization when relevant. "
        "If buyer_recommendations are present, include concrete supplier/product suggestions from them in actions. "
        "Never output technical keys like analytics_modules.* in user-facing text. "
        "Do not wrap simple category/status names in quotes. "
        "Use 'сом' as currency label when mentioning money values in this product context. "
        "If input is abusive/sexual/illegal-harmful, refuse with exactly: "
        "'Этот запрос нарушает условия пользования. Пожалуйста, переформулируйте вопрос.' "
        "and set probable_causes/actions empty and show_metrics=false. "
        "For non-analytics small talk, reply briefly, probable_causes/actions empty, show_metrics=false. "
        "Return STRICT JSON only with keys: summary (string), probable_causes (string[]), actions (string[]), "
        "confidence (number 0..1), focus_month (string|null), metrics (object: mom_pct, delivery_rate_pct, "
        "cancel_rate_pct, market_share_pct, top_category_name, top_category_share_pct), show_metrics (boolean)."
    )
    payload = {
        "model": settings.OPENAI_MODEL,
        "temperature": 0.45,
        "response_format": {"type": "json_object"},
        "messages": [{"role": "system", "content": system_prompt}, {"role": "user", "content": json.dumps(compact, ensure_ascii=False)}],
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
        if not isinstance(out, dict):
            return None
        metrics = out.get("metrics") or {}
        normalized = {
            "summary": str(out.get("summary") or ""),
            "probable_causes": [str(x) for x in (out.get("probable_causes") or [])],
            "actions": [str(x) for x in (out.get("actions") or [])],
            "confidence": max(0.0, min(1.0, safe_float(out.get("confidence"), 0.7))),
            "focus_month": out.get("focus_month"),
            "show_metrics": bool(out.get("show_metrics", True)),
            "metrics": {
                "mom_pct": None if metrics.get("mom_pct") is None else safe_float(metrics.get("mom_pct")),
                "delivery_rate_pct": safe_float(metrics.get("delivery_rate_pct")),
                "cancel_rate_pct": safe_float(metrics.get("cancel_rate_pct")),
                "market_share_pct": safe_float(metrics.get("market_share_pct")),
                "top_category_name": str(metrics.get("top_category_name") or "—"),
                "top_category_share_pct": safe_float(metrics.get("top_category_share_pct")),
            },
        }
        return sanitize_assistant_payload(normalized)
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, ValueError, TypeError):
        return None
