# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Orchestrator integration for the companion **Tool Router** sidecar — shadow log, gated dispatch, branch tagging.
# Invariants:
# - Shadow mode never short-circuits orchestration; partial/full respect tool allowlists and min confidence.
# - ``recent_music_theme`` is injected only for music retry/another-one lines (avoids sticky false music routes).
# Related:
# - api/ewa_platform/companion/sidecar/tool_router.py
# - api/ewa_platform/companion/orchestration/task_orchestrator.py
# - documentation/product/ewa/EWA-COMPANION-TOOL-ROUTER.md
# ---
"""Dispatch companion Tool Router decisions into ``tool_registry`` handlers."""

from __future__ import annotations

import logging
import os
from collections.abc import Mapping
from typing import Any

import httpx

from api.ewa_platform.companion.orchestration.tool_registry import (
    ToolContext,
    _user_line_is_music_feedback_or_praise,
    _user_line_requests_music_another_one,
    _user_line_requests_music_retry,
)
from api.ewa_platform.companion.sidecar.tool_router import (
    companion_tool_router_base_url,
    companion_tool_router_enabled,
    companion_tool_router_min_confidence,
    companion_tool_router_mode,
    router_plan_to_tool_args,
    router_tool_allowed_in_current_mode,
    run_companion_tool_router,
)

logger = logging.getLogger(__name__)


def _user_line_allows_recent_music_theme_hint(user_line: str) -> bool:
    """True when sticky last-music theme may help classify a continuation turn."""

    return _user_line_requests_music_retry(user_line) or _user_line_requests_music_another_one(user_line)


async def _recent_music_theme_hint(pool: Any, *, principal_id: str) -> str | None:
    try:
        from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg

        row = await companion_pg.companion_task_find_latest_completed_by_intent(
            pool,
            principal_id=principal_id,
            intent_kind="music_generation_background",
        )
        if row is None:
            return None
        plan = row.get("plan_payload")
        if not isinstance(plan, Mapping):
            return None
        theme = str(plan.get("theme_preview") or "").strip()
        return theme or None
    except Exception as exc:  # noqa: BLE001
        from api.ewa_platform.companion.observability.degrade_log import companion_degrade_debug

        companion_degrade_debug(
            logger,
            "recent_music_theme_hint",
            "latest music theme hint lookup failed",
            exc=exc,
            principal_id=principal_id,
        )
        return None


async def maybe_dispatch_companion_tool_router(
    pool: Any,
    *,
    tool_ctx: ToolContext,
    user_line: str,
    shell_norm: Mapping[str, Any] | None,
    russian_user: bool,
    run_tool_branch: Any,
) -> dict[str, Any] | None:
    """Run Tool Router sidecar; return orchestrator response when dispatching, else ``None``."""

    if not companion_tool_router_enabled():
        return None
    base = companion_tool_router_base_url()
    if not base:
        return None
    try:
        timeout_sec = float(os.getenv("EWA_COMPANION_TOOL_ROUTER_TIMEOUT_SEC", "12").strip() or "12")
    except ValueError:
        timeout_sec = 12.0
    timeout_sec = max(3.0, min(timeout_sec, 45.0))
    client_timeout = httpx.Timeout(timeout_sec + 2.0)

    recent_theme: str | None = None
    if _user_line_allows_recent_music_theme_hint(user_line):
        recent_theme = await _recent_music_theme_hint(pool, principal_id=tool_ctx.principal_id)
    else:
        logger.info(
            "[STEP] companion_tool_router_theme_hint_skipped reason=not_music_continuation line_chars=%d",
            len((user_line or "").strip()),
        )

    async with httpx.AsyncClient(timeout=client_timeout) as client:
        plan = await run_companion_tool_router(
            client,
            user_line=user_line,
            shell_norm=shell_norm,
            russian_user=russian_user,
            recent_music_theme=recent_theme,
        )

    if plan is None:
        return None

    mode = companion_tool_router_mode()
    min_c = companion_tool_router_min_confidence()
    would_dispatch = (
        plan.tool != "chat_only" and float(plan.confidence) >= min_c and router_tool_allowed_in_current_mode(plan.tool)
    )

    if mode == "shadow":
        logger.info(
            "[STEP] companion_tool_router_shadow tool=%s confidence=%.2f would_dispatch=%s",
            plan.tool,
            float(plan.confidence),
            "true" if would_dispatch else "false",
        )
        return None

    if plan.tool == "chat_only" or float(plan.confidence) < min_c:
        logger.info(
            "[STEP] companion_tool_router_skip tool=%s confidence=%.2f reason=below_threshold",
            plan.tool,
            float(plan.confidence),
        )
        return None

    if not router_tool_allowed_in_current_mode(plan.tool):
        logger.info(
            "[STEP] companion_tool_router_skip tool=%s reason=mode_%s_not_allowed",
            plan.tool,
            mode,
        )
        return None

    if plan.tool in (
        "music_generation",
        "music_generation_xl_base",
        "music_studio_open",
    ) and _user_line_is_music_feedback_or_praise(user_line):
        logger.info(
            "[STEP] companion_tool_router_skip tool=%s reason=music_feedback_or_praise",
            plan.tool,
        )
        return None

    from api.ewa_platform.companion.orchestration.turn_context_guards import side_effect_tools_suppressed_for_turn

    if side_effect_tools_suppressed_for_turn(user_line, tool_ctx.profile):
        logger.info(
            "[STEP] companion_tool_router_skip tool=%s reason=file_focus_chat",
            plan.tool,
        )
        return None

    args = router_plan_to_tool_args(plan)
    args["user_line"] = user_line
    short = await run_tool_branch(plan.tool, args, tool_ctx, user_line=user_line)
    if short is None:
        logger.info(
            "[STEP] companion_tool_router_dispatch_miss tool=%s handler_returned_none=true",
            plan.tool,
        )
        return None

    branch = str(short.get("orchestration_branch") or plan.tool).strip() or plan.tool
    short["orchestration_branch"] = f"tool_router_{branch}"
    logger.info(
        "[STEP] companion_orchestration_decision branch=tool_router_dispatch tool=%s status=ok short_circuit=true",
        plan.tool,
    )
    return short


__all__ = (
    "_user_line_allows_recent_music_theme_hint",
    "maybe_dispatch_companion_tool_router",
)
