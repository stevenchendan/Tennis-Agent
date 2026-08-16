"""Shared LangChain helpers: model construction with graceful degradation.

The app is fully functional without an LLM key (deterministic heuristic
report / chat fallbacks); with TENNIS_OPENAI_API_KEY set, LangChain chains
produce the narrative layer.
"""

from __future__ import annotations

from functools import lru_cache

from app.core.config import Settings


def get_chat_model(settings: Settings):
    """Build a ChatOpenAI model, or return None when no key is configured."""
    if not settings.llm_enabled:
        return None
    from langchain_openai import ChatOpenAI

    kwargs = {
        "model": settings.llm_model,
        "temperature": settings.llm_temperature,
        "api_key": settings.openai_api_key,
    }
    if settings.openai_base_url:
        kwargs["base_url"] = settings.openai_base_url  # proxies / gateways
    return ChatOpenAI(**kwargs)
