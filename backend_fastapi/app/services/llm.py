from __future__ import annotations

import json
from typing import Any
from urllib import request as urlrequest
from urllib.error import HTTPError, URLError

from app.core.config import settings


def _provider() -> str:
    return (settings.LLM_PROVIDER or "gemini").strip().lower()


def _gemini_chat_json(*, system_prompt: str, user_content: str, temperature: float) -> dict[str, Any] | None:
    if not settings.GEMINI_API_KEY:
        return None

    url = f"{settings.GEMINI_BASE_URL.rstrip('/')}/models/{settings.GEMINI_MODEL}:generateContent?key={settings.GEMINI_API_KEY}"
    payload = {
        "contents": [
            {"role": "user", "parts": [{"text": f"SYSTEM:\n{system_prompt}\n\nUSER:\n{user_content}"}]}
        ],
        "generationConfig": {
            "temperature": temperature,
            "responseMimeType": "application/json",
        },
    }
    req = urlrequest.Request(
        url=url,
        method="POST",
        headers={"Content-Type": "application/json"},
        data=json.dumps(payload).encode("utf-8"),
    )
    try:
        with urlrequest.urlopen(req, timeout=float(settings.OPENAI_TIMEOUT_SECONDS)) as resp:
            raw = resp.read().decode("utf-8")
        parsed = json.loads(raw)
        candidates = parsed.get("candidates") or []
        if not candidates:
            return None
        parts = ((candidates[0].get("content") or {}).get("parts") or [])
        if not parts:
            return None
        text = str(parts[0].get("text") or "").strip()
        if not text:
            return None
        return json.loads(text)
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, ValueError, TypeError):
        return None


def _openai_chat_json(*, system_prompt: str, user_content: str, temperature: float) -> dict[str, Any] | None:
    if not settings.OPENAI_API_KEY:
        return None
    payload = {
        "model": settings.OPENAI_MODEL,
        "temperature": temperature,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
    }

    req = urlrequest.Request(
        url=f"{settings.OPENAI_BASE_URL.rstrip('/')}/chat/completions",
        method="POST",
        headers={
            "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
            "Content-Type": "application/json",
        },
        data=json.dumps(payload).encode("utf-8"),
    )
    try:
        with urlrequest.urlopen(req, timeout=float(settings.OPENAI_TIMEOUT_SECONDS)) as resp:
            raw = resp.read().decode("utf-8")
        parsed = json.loads(raw)
        content = (((parsed.get("choices") or [{}])[0].get("message") or {}).get("content") or "").strip()
        if not content:
            return None
        return json.loads(content)
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, ValueError, TypeError):
        return None


def llm_chat_json(*, system_prompt: str, user_content: str, temperature: float = 0.2) -> dict[str, Any] | None:
    provider = _provider()
    if provider == "gemini":
        out = _gemini_chat_json(system_prompt=system_prompt, user_content=user_content, temperature=temperature)
        if out is not None:
            return out
        return _openai_chat_json(system_prompt=system_prompt, user_content=user_content, temperature=temperature)
    out = _openai_chat_json(system_prompt=system_prompt, user_content=user_content, temperature=temperature)
    if out is not None:
        return out
    return _gemini_chat_json(system_prompt=system_prompt, user_content=user_content, temperature=temperature)


def llm_policy_check(question: str) -> bool | None:
    policy_prompt = (
        "You are a strict safety classifier for chat input. "
        "Return ONLY JSON with keys: decision (allow|block), reason (short string). "
        "Block if message includes harassment/abuse, explicit sexual content, sexual content involving minors, "
        "violent wrongdoing instructions, illegal wrongdoing instructions, or self-harm instructions. "
        "Allow normal business questions, analytics questions, neutral small talk, and non-harmful profanity. "
        "Do not overblock."
    )
    out = llm_chat_json(system_prompt=policy_prompt, user_content=question, temperature=0)
    if not isinstance(out, dict):
        return None
    decision = str(out.get("decision") or "").strip().lower()
    if decision == "block":
        return True
    if decision == "allow":
        return False
    return None
