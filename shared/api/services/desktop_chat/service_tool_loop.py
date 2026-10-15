# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Desktop AI Chat non-stream multi-round tool loop.
# Invariants:
# - Stream Wave A: short prep session then LLM/SSE without request-scoped ORM; writes via isolated sessions.
# - `chat.updated_at` is refreshed with `utc_now_naive()` on successful turn mutations.
# - Project vault usage always passes access checks before retrieval.
# - Up to MAX_DESKTOP_TOOL_ROUNDS (3); factual asks get one refuse-to-invent evidence nudge if tools unused.
# Related:
# - api/routers/desktop_ai_chat.py
# - api/services/desktop_chat/db_session.py
# - api/services/desktop_chat_ensemble/stream_turn.py
# ---
"""Orchestration: history, RAG blocks, Llama stream or tool-loop, persist messages."""

from __future__ import annotations

import asyncio
import logging
import re
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-untyped]

from api.services.desktop_chat.tools import image_ugs as desktop_image_ugs_tool
from api.services.desktop_chat.tools import web_search_tool as desktop_web_search_tool
from api.services.desktop_chat.tools.registry import (
    MAX_DESKTOP_TOOL_ROUNDS,
    execute_desktop_tool,
    normalize_tool_calls_from_llama,
    trim_tool_content,
)
from api.services.llama_service import LlamaService

logger = logging.getLogger(__name__)

from api.services.desktop_chat.service_helpers import (
    _CONTENT_ID_IN_TOOL_PREVIEW,
    _IMAGE_FOLLOWUP_NUDGE_USER,
    _WEB_SEARCH_FOLLOWUP_NUDGE_USER,
    _WEB_SEARCH_NO_HITS_FOLLOWUP_NUDGE_USER,
    _WEB_SEARCH_REPAIR_NUDGE_USER,
    _assistant_claims_no_web_data,
    _desktop_image_tool_result_looks_failed,
    _llama_tool_calls_payload_from_normalized,
    _web_search_tool_result_has_hits,
    try_recover_tool_calls_from_assistant_text,
)

_REFUSE_TO_INVENT_NUDGE_USER = (
    "Если для ответа нужны проверяемые факты (сеть, доки, файлы чата, vault) — "
    "вызови доступный инструмент (desktop_web_search / mcp_call research|kbsew / knowledge_base_search) "
    "или явно напиши, что данных нет и чего не хватает. Не выдумывай факты и URL."
)

_FACTUAL_ASK_RE = re.compile(
    r"(?i)"
    r"(?:"
    r"\bфакт|"
    r"\bскол?ько|"
    r"\bкогда\b|"
    r"\bгде\b|"
    r"найди|"
    r"проверь|"
    r"поиск|"
    r"в\s+сети|"
    r"в\s+доках|"
    r"в\s+файлах|"
    r"\bwho\b|"
    r"\bwhat\b|"
    r"\bwhen\b|"
    r"\bwhere\b|"
    r"search\b|"
    r"look\s+up|"
    r"according\s+to"
    r")"
)


def _last_user_text(messages: list[dict[str, Any]]) -> str:
    for msg in reversed(messages):
        if str(msg.get("role") or "") == "user":
            return str(msg.get("content") or "")
    return ""


def _should_evidence_nudge(*, tools: list[dict[str, Any]], messages: list[dict[str, Any]]) -> bool:
    if not tools:
        return False
    return bool(_FACTUAL_ASK_RE.search(_last_user_text(messages)))


async def run_tool_loop(
    *,
    db_pool: asyncpg.Pool,
    llama: LlamaService,
    messages: list[dict[str, Any]],
    model: str,
    tools: list[dict[str, Any]],
    user_id: UUID,
    company_id: UUID | None,
    project_id: UUID | None,
    defaults: dict[str, Any],
    web_search_allowed: bool = False,
    desktop_chat_id: UUID | None = None,
    tool_progress_queue: asyncio.Queue[dict[str, Any]] | None = None,
    kbsew_agent: str = "desktop",
    kbsew_registry: list[Any] | None = None,
) -> tuple[str, list[dict[str, Any]]]:
    """Non-stream multi-round tool calling; returns final assistant text and trace."""
    trace: list[dict[str, Any]] = []
    working = [dict(x) for x in messages]
    web_search_hits_any = False
    evidence_nudge_used = False

    for round_i in range(MAX_DESKTOP_TOOL_ROUNDS):
        # После tool-сообщений многие модели дают «безопасный» отказ; чуть ниже температура + nudge user.
        chat_temperature = 0.45 if round_i > 0 else 0.65
        result = await llama.chat(
            working,
            model=model,
            stream=False,
            tools=tools or None,
            tool_choice="auto" if tools else None,
            temperature=chat_temperature,
        )
        if result.get("error"):
            err = str(result.get("error") or "llama error")
            trace.append({"round": round_i, "error": err})
            return f"[Ошибка модели: {err}]", trace

        tcalls = normalize_tool_calls_from_llama(result)
        text = (result.get("text") or "").strip()
        recovered_from_text = False

        if not tcalls:
            recovered = try_recover_tool_calls_from_assistant_text(text)
            if recovered:
                tcalls = recovered
                recovered_from_text = True
                trace.append(
                    {
                        "round": round_i,
                        "recovered_tool_calls_from_text": True,
                        "preview": text[:200],
                    }
                )

        if not tcalls:
            # Wave 3: one evidence retry — refuse-to-invent when tools exist but unused on factual ask.
            if (
                tools
                and not evidence_nudge_used
                and round_i < MAX_DESKTOP_TOOL_ROUNDS - 1
                and _should_evidence_nudge(tools=tools, messages=working)
            ):
                evidence_nudge_used = True
                working.append({"role": "assistant", "content": text or ""})
                working.append({"role": "user", "content": _REFUSE_TO_INVENT_NUDGE_USER})
                trace.append({"round": round_i, "evidence_nudge": True, "preview": text[:200]})
                continue
            if web_search_hits_any and _assistant_claims_no_web_data(text):
                trace.append({"round": round_i, "web_search_repair_retry": True, "preview": text[:200]})
                repaired = await llama.chat(
                    [*working, {"role": "user", "content": _WEB_SEARCH_REPAIR_NUDGE_USER}],
                    model=model,
                    stream=False,
                    tools=None,
                    tool_choice=None,
                    temperature=0.2,
                )
                if not repaired.get("error"):
                    fixed = (repaired.get("text") or "").strip()
                    if fixed:
                        text = fixed
            trace.append({"round": round_i, "final": True, "preview": text[:200]})
            return text or "(пустой ответ)", trace

        llama_tool_calls = _llama_tool_calls_payload_from_normalized(tcalls)
        assistant_msg: dict[str, Any] = {
            "role": "assistant",
            "content": "" if recovered_from_text else (text or ""),
            "tool_calls": llama_tool_calls,
        }
        working.append(assistant_msg)

        round_trace: list[dict[str, Any]] = []
        image_tool_succeeded = False
        web_search_tool_called = False
        web_search_tool_succeeded = False
        for call in tcalls:
            name = call.get("name") or ""
            args = call.get("arguments") if isinstance(call.get("arguments"), dict) else {}
            recent_for_search = [
                {"role": str(m.get("role") or ""), "content": str(m.get("content") or "")}
                for m in working
                if str(m.get("role") or "") in ("user", "assistant")
            ]
            out = await execute_desktop_tool(
                db_pool=db_pool,
                name=str(name),
                arguments=args,
                user_id=user_id,
                company_id=company_id,
                project_id=project_id,
                defaults=defaults,
                web_search_allowed=web_search_allowed,
                desktop_chat_id=desktop_chat_id,
                tool_progress_queue=tool_progress_queue,
                recent_messages=recent_for_search,
                kbsew_agent=kbsew_agent,
                kbsew_registry=kbsew_registry,
            )
            entry: dict[str, Any] = {"name": name, "ok": True, "preview": out[:400]}
            if str(name) == desktop_image_ugs_tool.TOOL_NAME:
                m = _CONTENT_ID_IN_TOOL_PREVIEW.search(out)
                if m:
                    entry["content_id"] = m.group(1).lower()
            round_trace.append(entry)
            working.append({"role": "tool", "tool_name": str(name), "content": trim_tool_content(out)})
            if (
                str(name) == desktop_image_ugs_tool.TOOL_NAME
                and defaults.get("tools_image_enabled", True)
                and not _desktop_image_tool_result_looks_failed(out)
            ):
                image_tool_succeeded = True
            if (
                str(name) == desktop_web_search_tool.TOOL_NAME
                and defaults.get("tools_web_search_enabled", False)
                and web_search_allowed
            ):
                web_search_tool_called = True
                if _web_search_tool_result_has_hits(out):
                    web_search_tool_succeeded = True
        trace.append({"round": round_i, "tools": round_trace})
        if web_search_tool_succeeded:
            web_search_hits_any = True
            working.append({"role": "user", "content": _WEB_SEARCH_FOLLOWUP_NUDGE_USER})
        elif web_search_tool_called:
            working.append({"role": "user", "content": _WEB_SEARCH_NO_HITS_FOLLOWUP_NUDGE_USER})
        elif image_tool_succeeded:
            working.append({"role": "user", "content": _IMAGE_FOLLOWUP_NUDGE_USER})

    return "Превышено число раундов инструментов.", trace
