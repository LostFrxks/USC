from __future__ import annotations

import asyncio
import json
from typing import AsyncIterator

import httpx

from app.core.config import settings


def ndjson_event(payload: dict) -> str:
    return json.dumps(payload, ensure_ascii=False) + "\n"


def stream_text_chunks(text: str, *, chunk_size: int = 16) -> list[str]:
    clean = (text or "").strip()
    if not clean:
        return []
    return [clean[i : i + chunk_size] for i in range(0, len(clean), chunk_size)]


async def llm_stream_text(
    *,
    summary: dict,
    question: str,
    selected_month: str | None,
    actor_context: dict | None = None,
    safe_float,
) -> AsyncIterator[str]:
    compact = {
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
        "analytics_modules": summary.get("analytics_modules") or {},
        "buyer_recommendations": summary.get("buyer_recommendations") or {},
        "selected_month": selected_month,
        "question": question,
    }
    system_prompt = (
        "Ты AI-ассистент аналитики B2B платформы. "
        "Отвечай ТОЛЬКО на русском, коротко и по делу, опираясь на цифры из контекста. "
        "Если вопрос про аналитику/бизнес, дай понятный вывод и 2-4 практичных шага по приоритету. "
        "Если есть analytics_modules.actions/alerts, используй их первыми и упоминай ожидаемый эффект. "
        "Никогда не показывай пользователю технические ключи вида analytics_modules.*. "
        "Не оборачивай простые названия категорий/статусов в кавычки. "
        "Денежные суммы указывай в сом. "
        "Не возвращай JSON, markdown или служебный текст. Только готовый человеко-понятный ответ."
    )
    payload = {
        "model": settings.OPENAI_MODEL,
        "temperature": 0.2,
        "stream": True,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps(compact, ensure_ascii=False)},
        ],
    }
    url = f"{settings.OPENAI_BASE_URL.rstrip('/')}/chat/completions"
    headers = {"Authorization": f"Bearer {settings.OPENAI_API_KEY}", "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=float(settings.OPENAI_TIMEOUT_SECONDS)) as client:
        async with client.stream("POST", url, headers=headers, json=payload) as resp:
            resp.raise_for_status()
            async for raw_line in resp.aiter_lines():
                line = (raw_line or "").strip()
                if not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if not data or data == "[DONE]":
                    continue
                try:
                    parsed = json.loads(data)
                except Exception:
                    continue
                choices = parsed.get("choices") or []
                if not choices:
                    continue
                delta = (choices[0].get("delta") or {}).get("content")
                if delta:
                    yield str(delta)
                await asyncio.sleep(0)
