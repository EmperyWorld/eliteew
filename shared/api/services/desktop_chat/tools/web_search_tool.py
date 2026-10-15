# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Desktop AI chat web search tool — Yandex Search API via search_service with per-user quota.
# Invariants:
# - Quota enforcement is owned by web_search() when user_id+db are passed.
# Related:
# - api/services/search_service.py
# - api/services/web_search_quota_service.py
# ---

from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from api.services.search_service import (
    format_search_results_for_prompt,
    get_web_search_query,
    resolve_web_search_provider_for_surface,
    web_search,
)
from api.services.web_search_quota_service import (
    WebSearchQuotaExceededError,
    format_quota_denied_user_message,
)

TOOL_NAME = "desktop_web_search"
LLAMA_TOOL = {
    "type": "function",
    "function": {
        "name": TOOL_NAME,
        "description": (
            "Поиск актуальной информации в интернете по запросу. "
            "Используй для новостей, курсов, документации и фактов вне локальной базы."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Поисковый запрос"},
            },
            "required": ["query"],
        },
    },
}


async def run_web_search(
    db: AsyncSession,
    *,
    user_id: UUID,
    query: str,
    enabled: bool,
    recent_messages: list[dict[str, str | None]] | None = None,
) -> str:
    q = (query or "").strip()
    if not enabled:
        return f"Веб-поиск отключён администратором для этого чата. Запрос не выполнен: {q[:200]!r}"
    if not q:
        return "Укажите непустой поисковый запрос."
    provider = await resolve_web_search_provider_for_surface(db=db, surface="desktop")
    if not provider:
        return f"Веб-поиск не настроен на сервере (нет Yandex Search API). Запрос не выполнен: {q[:200]!r}"
    search_query = get_web_search_query(q, list(recent_messages or []))
    if not search_query:
        return "Не удалось сформировать поисковый запрос."
    try:
        hits = await web_search(search_query, limit=8, user_id=user_id, db=db, surface="desktop")
    except WebSearchQuotaExceededError as exc:
        return format_quota_denied_user_message(exc.status)
    if not hits:
        return f"По запросу {search_query[:160]!r} ничего не найдено."
    block = format_search_results_for_prompt(hits)
    return block or f"По запросу {search_query[:160]!r} ничего не найдено."


async def run_web_search_with_sources(
    db: AsyncSession,
    *,
    user_id: UUID,
    query: str,
    enabled: bool,
    recent_messages: list[dict[str, str | None]] | None = None,
) -> tuple[str, list[dict[str, str]]]:
    block = await run_web_search(
        db,
        user_id=user_id,
        query=query,
        enabled=enabled,
        recent_messages=recent_messages,
    )
    lowered = block.casefold()
    if not enabled or "отключён" in block or "не настроен" in block or "ничего не найдено" in lowered:
        return block, []
    from api.services.desktop_chat.web_search_sources import parse_web_search_prompt_block

    return block, parse_web_search_prompt_block(block)
