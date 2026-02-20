from fastapi import APIRouter

from app.cache.redis_cache import cache_status, quick_write_probe
from app.core.config import settings
from app.services.llm import llm_chat_json

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/health/cache")
def health_cache():
    status = cache_status()
    status["cache_write_test"] = quick_write_probe() if status["redis_enabled"] else False
    return status


@router.get("/health/llm")
def health_llm():
    provider = (settings.LLM_PROVIDER or "gemini").lower()
    out = llm_chat_json(
        system_prompt="Return strict JSON with key ok:boolean",
        user_content="ping",
        temperature=0,
    )
    return {
        "provider": provider,
        "model": settings.GEMINI_MODEL if provider == "gemini" else settings.OPENAI_MODEL,
        "configured": bool(settings.GEMINI_API_KEY if provider == "gemini" else settings.OPENAI_API_KEY),
        "ok": isinstance(out, dict),
    }
