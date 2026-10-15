# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Desktop AI chat tool — semantic search in KBSEW knowledge barrels (RAG retrieval).
# Invariants:
# - Read-only; calls KBSEW search API via kbsew_client (same contract as kbsew_gateway).
# - Discovery mode auto-selects barrel when barrel_id is omitted.
# Related:
# - api/services/kbsew/kbsew_client.py
# - api/services/kbsew/kbsew_registry.py
# - KBSEW/api/routers/search.py
# ---

from __future__ import annotations

import logging
from typing import Any

from api.services.desktop_chat.kbsew_search_settings import (
    KbsewSearchSettings,
    is_barrel_allowed,
    normalize_barrel_uuid,
    normalize_kbsew_search_settings,
)
from api.services.kbsew.kbsew_client import (
    KbsewBarrelDisabledError,
    KbsewClientError,
    KbsewIndexStaleError,
    KbsewNotFoundError,
    KbsewServiceUnavailableError,
)
from api.services.kbsew.kbsew_registry import (
    KbsewBarrelInfo,
    fetch_kbsew_registry,
    select_barrel_for_query,
)
from api.services.kbsew.kbsew_retrieval import kbsew_search_with_settings
from api.services.kbsew.kbsew_trace import get_kbsew_trace_id

logger = logging.getLogger(__name__)

TOOL_NAME = "knowledge_base_search"
_KBSEW_UNAVAILABLE_USER_MSG = "База знаний временно недоступна (embedding-сервис). Повторите позже."
_BASE_LLAMA_TOOL = {
    "type": "function",
    "function": {
        "name": TOOL_NAME,
        "description": (
            "Semantic search in a KBSEW knowledge barrel (indexed PDF/document knowledge base). "
            "Provide a natural-language query; barrel_id is optional when discovery mode can pick a barrel."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Natural-language search query (same language as source documents).",
                },
                "barrel_id": {
                    "type": "string",
                    "description": "Optional UUID of the KBSEW barrel; omit to auto-select the best match.",
                },
            },
            "required": ["query"],
        },
    },
}


LLAMA_TOOL = _BASE_LLAMA_TOOL


def build_knowledge_base_search_llama_tool(allowed_barrels: list[str]) -> dict[str, Any]:
    barrels = [b for b in allowed_barrels if b]
    tool = dict(_BASE_LLAMA_TOOL)
    fn = dict(tool["function"])
    params = dict(fn["parameters"])
    props = dict(params["properties"])
    barrel_prop: dict[str, Any] = {
        "type": "string",
        "description": "Optional UUID of an allowed KBSEW knowledge barrel; server auto-selects when omitted.",
    }
    if barrels:
        barrel_prop["enum"] = barrels
    props["barrel_id"] = barrel_prop
    params["properties"] = props
    params["required"] = ["query"]
    fn["parameters"] = params
    if len(barrels) == 1:
        fn["description"] = (
            f"Semantic search in the configured KBSEW knowledge barrel ({barrels[0]}). "
            "Provide query; barrel_id optional."
        )
    else:
        fn["description"] = (
            "Semantic search in allowed KBSEW knowledge barrels. Provide query; "
            "barrel_id optional — server picks the best barrel by domain match."
        )
    tool["function"] = fn
    return tool


def format_kb_chunks_for_prompt(*, query: str, barrel_id: str, chunks: list[str]) -> str:
    if not chunks:
        return f"По запросу {query[:160]!r} в barrel {barrel_id} ничего не найдено."
    lines = [f"Результаты поиска в barrel {barrel_id} по запросу {query[:160]!r}:"]
    for index, chunk in enumerate(chunks, start=1):
        lines.append(f"\n--- фрагмент {index} ---\n{chunk}")
    return "\n".join(lines)


async def _resolve_barrel_id(
    *,
    query: str,
    barrel_id: str,
    settings: KbsewSearchSettings,
    agent_id: str,
    registry: list[KbsewBarrelInfo] | None,
) -> tuple[str | None, str | None]:
    bid = normalize_barrel_uuid(barrel_id) or ""
    if bid:
        if not is_barrel_allowed(bid, settings):
            return None, (
                f"Barrel {bid!r} не входит в список разрешённых бочек для этого чата. "
                f"Разрешены: {', '.join(settings.allowed_barrels) or '(нет)'}"
            )
        return bid, None

    barrels = registry
    if barrels is None:
        barrels = await fetch_kbsew_registry(settings, agent_id=agent_id)
    discovered = select_barrel_for_query(query, barrels=barrels, settings=settings)
    if not discovered:
        return None, "Не удалось выбрать barrel для discovery mode: нет активных разрешённых бочек."
    logger.info(
        "[STEP] kbsew_discovery_barrel_selected trace_id=%s barrel_id=%s query=%r",
        get_kbsew_trace_id(),
        discovered,
        query[:120],
    )
    return discovered, None


async def run_knowledge_base_search(
    *,
    query: str,
    barrel_id: str = "",
    enabled: bool,
    allowed_barrels: list[str] | None = None,
    kbsew_settings: KbsewSearchSettings | None = None,
    agent_id: str = "desktop",
    registry: list[KbsewBarrelInfo] | None = None,
) -> str:
    q = (query or "").strip()
    if not enabled:
        return (
            "Поиск по базе знаний KBSEW отключён администратором. "
            f"Запрос не выполнен: query={q[:120]!r}, barrel_id={barrel_id!r}"
        )
    if not q:
        return "Укажите непустой поисковый запрос (query)."

    if allowed_barrels is not None:
        settings = kbsew_settings or KbsewSearchSettings(enabled=True, allowed_barrels=allowed_barrels)
    else:
        settings = kbsew_settings or normalize_kbsew_search_settings(None)

    bid, err = await _resolve_barrel_id(
        query=q,
        barrel_id=barrel_id,
        settings=settings,
        agent_id=agent_id,
        registry=registry,
    )
    if err:
        return err
    assert bid is not None

    try:
        chunks = await kbsew_search_with_settings(query=q, barrel_id=bid, settings=settings)
    except KbsewNotFoundError:
        return f"Barrel {bid!r} не найден в базе знаний."
    except KbsewIndexStaleError as exc:
        pipeline = exc.required_pipeline or "текущий"
        logger.info(
            "[STEP] kbsew_search_tool_index_stale trace_id=%s barrel_id=%s pipeline=%s stale_assets=%s",
            get_kbsew_trace_id(),
            bid,
            pipeline,
            exc.stale_assets,
        )
        return (
            f"Индекс базы знаний для barrel {bid} сейчас обновляется "
            f"(требуется pipeline {pipeline}; устаревших активов: {exc.stale_assets}). "
            "Не отвечай фактами из базы знаний в этом ходе — повтори поиск после обновления."
        )
    except KbsewBarrelDisabledError:
        return f"Barrel {bid!r} отключён администратором. Поиск не выполнен."
    except KbsewServiceUnavailableError:
        return _KBSEW_UNAVAILABLE_USER_MSG
    except KbsewClientError as exc:
        logger.warning(
            "[STEP] kbsew_search_tool_fail trace_id=%s barrel_id=%s reason=%s",
            get_kbsew_trace_id(),
            bid,
            exc,
        )
        return f"Поиск в базе знаний недоступен: {exc}"

    return format_kb_chunks_for_prompt(query=q, barrel_id=bid, chunks=chunks)
