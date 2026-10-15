# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   Агент маркетингового кабинета с инструментами: Llama tool-calling (functiongemma) +
#   исполнение на сервере.
# Invariants:
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
# Related:
#   - shared/api/main.py (регистрация роутеров); см. затронутые services/models.
# ------------------------------------------------------------------------------
"""
Агент маркетингового кабинета с инструментами: Llama tool-calling (functiongemma) + исполнение на сервере.

Инструменты — whitelist; только данные текущего проекта с проверкой доступа.
"""

from __future__ import annotations

import json
import logging
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]

from api.services.marketing_project_rag_service import (
    format_rag_chunks_for_prompt,
    search_marketing_project_rag_chunks,
)

logger = logging.getLogger(__name__)

MAX_AGENT_TOOL_RESULTS_CHARS = 16_000
MAX_ROUTER_TOOL_CALLS = 6

# Схемы для Llama /api/chat (OpenAI-совместимый формат tools)
MARKETING_AGENT_TOOLS_LLAMA: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "search_project_documents",
            "description": (
                "Семантический поиск по текстам загруженных документов проекта (RAG в Qdrant). "
                "Вызывай, когда нужны факты из файлов, цитаты или детали, которых нет в счётчиках."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Запрос по смыслу (на русском или английском)",
                    }
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_entity_counts",
            "description": (
                "Сводка по заполненности кабинета: сколько JTBD, ценностных предложений, "
                "сегментов, кампаний, исследований, контента и т.д. в этом проекте."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_job_stories",
            "description": (
                "Краткий список Job Stories проекта: заголовок и формулировка задачи (JTBD). "
                "Вызывай для вопросов про потребности клиента, задачи, приоритеты job stories."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {
                        "type": "integer",
                        "description": "Сколько карточек вернуть (1–12), по умолчанию 8",
                    }
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_competitors",
            "description": (
                "Краткий список конкурентов проекта: название и краткое описание. "
                "Вызывай для вопросов про рынок, сравнение, позиционирование относительно конкурентов."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {
                        "type": "integer",
                        "description": "Сколько записей вернуть (1–12), по умолчанию 8",
                    }
                },
                "required": [],
            },
        },
    },
]


def parse_marketing_tool_calls_from_chat_result(chat_result: dict[str, Any]) -> list[dict[str, Any]]:
    """Нормализует tool_calls из ответа Llama /api/chat или OpenAI-compat sidecar (message.tool_calls)."""
    raw = chat_result.get("tool_calls")
    if not raw:
        message = chat_result.get("message")
        if isinstance(message, dict):
            raw = message.get("tool_calls")
    if not raw or not isinstance(raw, list):
        return []
    out: list[dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        fn = item.get("function")
        if not isinstance(fn, dict):
            continue
        name = str(fn.get("name") or "").strip()
        if not name:
            continue
        raw_args = fn.get("arguments")
        args: dict[str, Any] = {}
        if isinstance(raw_args, str) and raw_args.strip():
            try:
                parsed = json.loads(raw_args)
                if isinstance(parsed, dict):
                    args = parsed
            except json.JSONDecodeError:
                logger.warning("marketing_agent: invalid tool arguments JSON: %s", raw_args[:200])
        elif isinstance(raw_args, dict):
            args = raw_args
        out.append({"name": name, "arguments": args})
        if len(out) >= MAX_ROUTER_TOOL_CALLS:
            break
    return out


def parse_llama_tool_calls(llama_chat_result: dict[str, Any]) -> list[dict[str, Any]]:
    """Нормализует tool_calls из ответа Llama /api/chat (alias для обратной совместимости)."""
    return parse_marketing_tool_calls_from_chat_result(llama_chat_result)


async def _tool_search_project_documents(
    db_pool: asyncpg.Pool,
    *,
    project_id: UUID,
    user_id: UUID,
    arguments: dict[str, Any],
) -> str:
    query = str(arguments.get("query") or "").strip()
    if len(query) < 2:
        return "Ошибка: для поиска нужен непустой query."
    chunks = await search_marketing_project_rag_chunks(
        db_pool,
        query=query[:2000],
        project_id=project_id,
        user_id=user_id,
        limit=16,
        min_score=0.22,
    )
    block = format_rag_chunks_for_prompt(chunks, max_chars=8000)
    if not block.strip():
        return "Релевантных фрагментов в документах проекта не найдено (или индекс пуст)."
    return block


async def _tool_list_job_stories(
    db_pool: asyncpg.Pool,
    *,
    project_id: UUID,
    arguments: dict[str, Any],
) -> str:
    raw_limit = arguments.get("limit", 8)
    try:
        limit = max(1, min(12, int(raw_limit)))
    except (TypeError, ValueError):  # fmt: skip
        limit = 8
    async with db_pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT title, statement, importance_score, opportunity_score
            FROM job_stories
            WHERE project_id = $1
              AND deleted_at IS NULL
            ORDER BY updated_at DESC NULLS LAST, created_at DESC
            LIMIT $2
            """,
            project_id,
            limit,
        )
    if not rows:
        return "В проекте пока нет Job Stories."
    lines: list[str] = []
    for i, row in enumerate(rows, start=1):
        title = str(row.get("title") or "").strip() or "(без названия)"
        stmt = str(row.get("statement") or "").strip()
        if len(stmt) > 420:
            stmt = stmt[:420] + "…"
        imp = row.get("importance_score")
        opp = row.get("opportunity_score")
        extra = ""
        if imp is not None or opp is not None:
            extra = f" [важность={imp}, возможность={opp}]"
        lines.append(f"{i}. **{title}**{extra}\n   {stmt}")
    return "Job Stories (кратко):\n" + "\n\n".join(lines)


async def _tool_list_competitors(
    db_pool: asyncpg.Pool,
    *,
    project_id: UUID,
    arguments: dict[str, Any],
) -> str:
    raw_limit = arguments.get("limit", 8)
    try:
        limit = max(1, min(12, int(raw_limit)))
    except (TypeError, ValueError):  # fmt: skip
        limit = 8
    async with db_pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT name, description, competitor_type, market_position
            FROM competitors
            WHERE project_id = $1
              AND deleted_at IS NULL
            ORDER BY updated_at DESC NULLS LAST, created_at DESC
            LIMIT $2
            """,
            project_id,
            limit,
        )
    if not rows:
        return "В проекте пока нет записей о конкурентах."
    lines: list[str] = []
    for i, row in enumerate(rows, start=1):
        name = str(row.get("name") or "").strip() or "(без имени)"
        desc = str(row.get("description") or "").strip()
        if len(desc) > 400:
            desc = desc[:400] + "…"
        ctype = str(row.get("competitor_type") or "").strip()
        pos = str(row.get("market_position") or "").strip()
        meta = ", ".join(x for x in (ctype, pos) if x)
        meta_s = f" ({meta})" if meta else ""
        lines.append(f"{i}. **{name}**{meta_s}\n   {desc or '—'}")
    return "Конкуренты (кратко):\n" + "\n\n".join(lines)


async def _tool_get_entity_counts(
    db_pool: asyncpg.Pool,
    *,
    project_id: UUID,
) -> str:
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT
                (SELECT COUNT(*) FROM job_stories WHERE project_id = $1 AND deleted_at IS NULL) AS jtbd,
                (SELECT COUNT(*) FROM value_propositions WHERE project_id = $1 AND deleted_at IS NULL)
                    AS value_propositions,
                (SELECT COUNT(*) FROM swot_analyses WHERE project_id = $1 AND deleted_at IS NULL) AS swot,
                (SELECT COUNT(*) FROM competitors WHERE project_id = $1 AND deleted_at IS NULL) AS competitors,
                (SELECT COUNT(*) FROM research_projects WHERE project_id = $1 AND deleted_at IS NULL) AS researches,
                (SELECT COUNT(*) FROM unified_content WHERE project_id = $1 AND deleted_at IS NULL) AS content,
                (SELECT COUNT(*) FROM marketing_segments WHERE project_id = $1 AND deleted_at IS NULL) AS segments,
                (SELECT COUNT(*) FROM marketing_campaigns WHERE project_id = $1 AND deleted_at IS NULL) AS campaigns,
                (SELECT COUNT(*) FROM marketing_funnels WHERE project_id = $1 AND deleted_at IS NULL) AS funnels,
                (SELECT COUNT(*) FROM marketing_tasks WHERE project_id = $1 AND deleted_at IS NULL) AS tasks,
                (SELECT COUNT(*) FROM marketing_alerts WHERE project_id = $1 AND deleted_at IS NULL) AS alerts
            """,
            project_id,
        )
    if row is None:
        return "{}"
    data = {k: int(row[k] or 0) for k in row}
    return json.dumps(data, ensure_ascii=False, indent=2)


async def execute_marketing_agent_tools(
    db_pool: asyncpg.Pool,
    *,
    project_id: UUID,
    user_id: UUID,
    planned: list[dict[str, Any]],
) -> tuple[str, list[dict[str, Any]]]:
    """
    Выполняет whitelist инструментов. Возвращает (текст для синтеза, трассы для UI).
    """
    traces: list[dict[str, Any]] = []
    parts: list[str] = []

    for i, call in enumerate(planned, start=1):
        name = str(call.get("name") or "")
        args = call.get("arguments")
        if not isinstance(args, dict):
            args = {}
        try:
            if name == "search_project_documents":
                text = await _tool_search_project_documents(
                    db_pool, project_id=project_id, user_id=user_id, arguments=args
                )
            elif name == "get_entity_counts":
                text = await _tool_get_entity_counts(db_pool, project_id=project_id)
            elif name == "list_job_stories":
                text = await _tool_list_job_stories(db_pool, project_id=project_id, arguments=args)
            elif name == "list_competitors":
                text = await _tool_list_competitors(db_pool, project_id=project_id, arguments=args)
            else:
                text = f"Неизвестный инструмент (игнор): {name}"
            preview = text[:1200] + ("…" if len(text) > 1200 else "")
            traces.append({"name": name, "ok": True, "result_preview": preview})
            parts.append(f"### Результат инструмента `{name}` (#{i})\n{text}")
        except Exception as exc:
            logger.exception("[STEP] marketing_agent.tool_failed name=%s", name)
            traces.append({"name": name, "ok": False, "error": str(exc)})
            parts.append(f"### Ошибка инструмента `{name}`: {exc}")

    combined = "\n\n".join(parts).strip()
    if len(combined) > MAX_AGENT_TOOL_RESULTS_CHARS:
        combined = combined[:MAX_AGENT_TOOL_RESULTS_CHARS] + "\n…(обрезано)"
    return combined, traces
