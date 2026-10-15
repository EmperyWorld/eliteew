# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Context-Aware Orchestration for KBSEW: Dynamic Prompt Augmentation (DPA) and router hints.
# Invariants:
# - Does not alter vault RAG or web search paths; KBSEW-only orchestration layer.
# Related:
# - api/services/desktop_chat/prompt_compose.py
# - api/services/kbsew/kbsew_registry.py
# - documentation/product/KBSEW.md
# ---

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

from api.services.desktop_chat.kbsew_search_settings import (
    KbsewSearchSettings,
    kbsew_tool_visible_for_agent,
    resolve_kbsew_search_settings,
)
from api.services.kbsew.kbsew_registry import (
    KbsewBarrelInfo,
    barrel_display_lines,
    fetch_kbsew_registry,
    registry_summary_for_meta,
)
from api.services.kbsew.kbsew_trace import get_kbsew_trace_id

logger = logging.getLogger(__name__)

KBSEW_TOOL_NAME = "knowledge_base_search"


def detect_kbsew_agent_surface(chat_settings: Mapping[str, Any] | None) -> str:
    """Map execution context to KBSEW admin agent surface."""

    settings = dict(chat_settings or {})
    if settings.get("amka_ephemeral") or settings.get("amka_run_id"):
        return "marketing"
    return "desktop"


async def load_kbsew_orchestration_context(
    *,
    defaults: Mapping[str, Any],
    agent_id: str,
    chat_settings: Mapping[str, Any] | None = None,
) -> tuple[KbsewSearchSettings, list[KbsewBarrelInfo]]:
    kss = resolve_kbsew_search_settings(defaults, chat_settings)
    barrels = await fetch_kbsew_registry(kss, agent_id=agent_id)
    return kss, barrels


def build_kbsew_dpa_system_block(
    *,
    agent_id: str,
    barrels: list[KbsewBarrelInfo],
    settings: KbsewSearchSettings,
) -> str:
    """Dynamic Prompt Augmentation block appended to the LLM system prompt."""

    if not kbsew_tool_visible_for_agent(settings, agent_id) or not barrels:
        return ""

    lines = barrel_display_lines(barrels)
    barrel_list = "\n".join(lines)
    context_label = {
        "desktop": "Desktop AI Chat",
        "marketing": "Marketing / AMKA",
        "ewa": "EWA companion",
        "ugs": "UGS",
        "imperorg": "Imperorg",
    }.get(agent_id, agent_id)

    return (
        "### Knowledge Context (KBSEW)\n"
        f"Execution surface: {context_label}.\n"
        "You have active access to the following knowledge bases:\n"
        f"{barrel_list}\n\n"
        "If the user's intent matches these domains, product knowledge, or indexed documents, "
        f"you MUST invoke the `{KBSEW_TOOL_NAME}` tool with a concise natural-language query. "
        "When unsure which barrel fits, provide query only — the server can auto-select the best barrel. "
        "Do not claim you searched KBSEW unless the tool returned results in this turn."
    )


def build_kbsew_router_hint(barrels: list[KbsewBarrelInfo]) -> str:
    if not barrels:
        return ""
    lines = barrel_display_lines(barrels)
    if len(barrels) == 1:
        barrel = barrels[0]
        return (
            f"Use knowledge_base_search when the user asks about topics covered by KBSEW barrel "
            f"{barrel.name} ({barrel.barrel_id}). Fill query with a concise Russian search phrase; "
            "barrel_id is optional."
        )
    return (
        "Use knowledge_base_search when indexed KBSEW knowledge may answer the user. "
        "Allowed barrels:\n" + "\n".join(lines) + ". "
        "Fill query; barrel_id is optional — server picks the best match."
    )


async def augment_system_prompt_with_kbsew_dpa(
    *,
    prompt: str,
    defaults: Mapping[str, Any],
    agent_id: str,
    chat_settings: Mapping[str, Any] | None = None,
    barrels: list[KbsewBarrelInfo] | None = None,
) -> tuple[str, dict[str, Any]]:
    """Append DPA block when KBSEW is active for the surface."""

    kss, resolved_barrels = (
        (resolve_kbsew_search_settings(defaults, chat_settings), barrels)
        if barrels is not None
        else await load_kbsew_orchestration_context(
            defaults=defaults,
            agent_id=agent_id,
            chat_settings=chat_settings,
        )
    )
    block = build_kbsew_dpa_system_block(
        agent_id=agent_id,
        barrels=resolved_barrels,
        settings=kss,
    )
    meta: dict[str, Any] = {
        "kbsew_orchestration_applied": bool(block),
        "kbsew_agent_surface": agent_id,
        "kbsew_registry_count": len(resolved_barrels),
        "kbsew_trace_id": get_kbsew_trace_id(),
    }
    if resolved_barrels:
        meta["kbsew_registry"] = registry_summary_for_meta(resolved_barrels)
    if not block:
        return prompt, meta
    return f"{prompt.rstrip()}\n\n{block}", meta


async def append_kbsew_user_context_block(
    *,
    query: str,
    agent_id: str,
    defaults: Mapping[str, Any],
    db: Any | None = None,
    chat_settings: Mapping[str, Any] | None = None,
    max_total_chars: int = 4200,
) -> tuple[str, dict[str, Any]]:
    """Prefetch KBSEW chunks into the user message (autonomous retrieval, not a tool call)."""

    from api.services.kbsew.kbsew_prefetch import KbsewPrefetchOutcome, prefetch_kbsew_outcome

    empty = KbsewPrefetchOutcome(block=None, status="disabled")
    summary = empty.as_summary(agent_id=agent_id)
    try:
        outcome = await prefetch_kbsew_outcome(
            query=query,
            agent_id=agent_id,
            defaults=defaults,
            chat_settings=chat_settings,
            max_total_chars=max_total_chars,
        )
    except Exception as exc:
        logger.debug("[STEP] kbsew_user_context_skip agent=%s reason=%s", agent_id, exc)
        err = KbsewPrefetchOutcome(block=None, status="error", barrels_failed=1)
        return "", err.as_summary(agent_id=agent_id)

    summary = outcome.as_summary(agent_id=agent_id)
    block = (outcome.block or "").strip()
    if not block:
        return "", summary
    titled = f"### Контекст: база знаний ({agent_id})\n{block}"
    return titled, summary
