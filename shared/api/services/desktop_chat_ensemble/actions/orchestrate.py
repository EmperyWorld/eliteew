# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Coordinate plan → dispatch → merge for one ensemble action pack.
# Invariants:
# - Continues on per-action failure; never fabricates hits.
# - Sequential execution (Wave 1) to respect llama/search quotas.
# Related:
# - documentation/product/DESKTOP-ENSEMBLE-ACTIONS.md
# ---
"""Orchestrate one ensemble mid-turn action pack."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-untyped]

from api.services.desktop_chat_ensemble.actions.agent_planner import plan_actions_agentic
from api.services.desktop_chat_ensemble.actions.merge import build_pack_result
from api.services.desktop_chat_ensemble.actions.runners.dispatch import dispatch_action
from api.services.desktop_chat_ensemble.actions.stream_emit import (
    sse_action_done,
    sse_action_progress,
    sse_action_start,
)
from api.services.desktop_chat_ensemble.actions.types import (
    ActionMode,
    ActionPackResult,
    ActionResult,
    CapabilitySnapshot,
)

logger = logging.getLogger(__name__)


async def run_action_pack(
    *,
    db_pool: asyncpg.Pool,
    user_id: UUID,
    chat_id: UUID | None,
    project_id: UUID | None,
    defaults: dict[str, Any],
    capabilities: CapabilitySnapshot,
    mode: ActionMode,
    user_text: str,
    draft_body: str = "",
    web_search_allowed: bool,
    existing_sources: list[dict[str, Any]] | None = None,
    recent_messages: list[dict[str, str | None]] | None = None,
    kbsew_agent: str = "desktop",
    kbsew_registry: list[Any] | None = None,
    model: str = "",
) -> AsyncIterator[str | ActionPackResult]:
    """Yield SSE lines, then a final ActionPackResult as the last item."""
    # Wave 2: always try agent-decided sidecar (user text and/or draft gaps); heuristic on miss.
    planned = await plan_actions_agentic(
        user_text=user_text,
        draft_body=draft_body,
        capabilities=capabilities,
        model=model or str(defaults.get("default_llama_model") or ""),
        defaults=defaults,
        prefer_agent=True,
    )
    if not planned:
        pack = build_pack_result(
            ran=False,
            mode=mode,
            skipped_reason="no_planned_actions",
            results=[],
        )
        yield sse_action_done(pack)
        yield pack
        return

    yield sse_action_start(mode=mode, planned=planned)
    logger.info(
        "[STEP] ensemble_actions pack_start mode=%s count=%s kinds=%s",
        mode,
        len(planned),
        [a.kind for a in planned],
    )

    results: list[ActionResult] = []
    accumulated_sources = list(existing_sources or [])
    total = len(planned)
    for index, action in enumerate(planned, start=1):
        result = await dispatch_action(
            action,
            db_pool=db_pool,
            user_id=user_id,
            chat_id=chat_id,
            project_id=project_id,
            defaults=defaults,
            web_search_allowed=web_search_allowed,
            existing_sources=accumulated_sources,
            recent_messages=recent_messages,
            kbsew_agent=kbsew_agent,
            kbsew_registry=kbsew_registry,
        )
        results.append(result)
        for src in result.context_sources:
            if isinstance(src, dict):
                accumulated_sources.append(src)
        yield sse_action_progress(
            action_id=action.action_id,
            kind=action.kind,
            index=index,
            total=total,
            status=result.status,
            summary=result.summary,
        )
        yield ": keep-alive\n\n"

    pack = build_pack_result(
        ran=True,
        mode=mode,
        skipped_reason=None,
        results=results,
    )
    ok_n = sum(1 for r in results if r.status == "ok")
    empty_n = sum(1 for r in results if r.status == "empty")
    error_n = sum(1 for r in results if r.status == "error")
    logger.info(
        "[STEP] ensemble_actions pack_done mode=%s ok=%s empty=%s error=%s",
        mode,
        ok_n,
        empty_n,
        error_n,
    )
    if pack.ran and ok_n == 0 and (empty_n + error_n) > 0:
        # Empty-only = honest no-hits (often empty chat index); ERROR paths stay WARNING.
        log_fn = logger.warning if error_n > 0 else logger.info
        log_fn(
            "[STEP] ensemble_actions_ungrounded mode=%s ok=%s empty=%s error=%s kinds=%s",
            mode,
            ok_n,
            empty_n,
            error_n,
            ",".join(sorted({r.kind for r in results}))[:120],
        )
    yield sse_action_done(pack)
    yield pack
