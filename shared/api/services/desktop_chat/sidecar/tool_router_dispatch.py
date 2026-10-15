# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
#   Gated dispatch for Desktop AI Chat Tool Router — shadow log, execute tool, build follow-up messages.
# Invariants:
#   - Shadow mode never executes tools; partial/full respect allowlists and min confidence.
# Related:
#   - api/services/desktop_chat/sidecar/tool_router.py
#   - api/services/desktop_chat/service.py
# ---
"""Dispatch Desktop Tool Router decisions into execute_desktop_tool + message prep."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Mapping
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-untyped]
from sqlalchemy.ext.asyncio import AsyncSession

from api.schemas.pydantic.desktop_tool_router import DesktopToolRouterResultV1
from api.services.desktop_chat.sidecar.tool_router import (
    desktop_tool_router_enabled,
    desktop_tool_router_min_confidence,
    desktop_tool_router_mode,
    router_plan_to_tool_args,
    router_tool_allowed_in_current_mode,
    run_desktop_tool_router,
)

logger = logging.getLogger(__name__)


async def maybe_run_desktop_tool_router_turn(
    *,
    db: AsyncSession | None = None,
    db_pool: asyncpg.Pool,
    defaults: Mapping[str, Any],
    user_excerpt: str,
    history_tail: str,
    user_id: UUID,
    company_id: UUID | None,
    project_id: UUID | None,
    desktop_chat_id: UUID,
    web_search_allowed: bool = False,
    tool_progress_queue: asyncio.Queue[dict[str, Any]] | None = None,
    kbsew_agent: str = "desktop",
    kbsew_registry: list[Any] | None = None,
) -> tuple[DesktopToolRouterResultV1 | None, list[dict[str, Any]], list[dict[str, Any]]]:
    """
    Run router sidecar when enabled.

    Returns (plan_or_none, tool_trace, extra_messages_for_llm).
    extra_messages: synthetic assistant/tool/user nudges after executed tools.
    Tool execution uses a short-lived session (``db`` optional override for tests).
    """

    if not desktop_tool_router_enabled(defaults):
        return None, [], []

    mode = desktop_tool_router_mode(defaults)
    plan = await run_desktop_tool_router(
        user_excerpt=user_excerpt,
        history_tail=history_tail,
        defaults=defaults,
        web_search_allowed=web_search_allowed,
        kbsew_agent=kbsew_agent,
        kbsew_registry=kbsew_registry,
    )
    if plan is None:
        logger.info("[STEP] desktop_tool_router miss mode=%s", mode)
        return None, [], []

    logger.info(
        "[STEP] desktop_tool_router decision mode=%s tool=%s confidence=%.2f reason=%s",
        mode,
        plan.tool,
        plan.confidence,
        (plan.reason or "")[:120],
    )

    trace: list[dict[str, Any]] = [
        {
            "router_decision": True,
            "mode": mode,
            "tool": plan.tool,
            "confidence": plan.confidence,
            "reason": plan.reason,
        }
    ]
    extra_messages: list[dict[str, Any]] = []

    if mode == "shadow" or plan.tool == "chat_only":
        return plan, trace, extra_messages

    if plan.confidence < desktop_tool_router_min_confidence(defaults):
        trace.append({"skipped": "low_confidence"})
        return plan, trace, extra_messages

    if not router_tool_allowed_in_current_mode(plan.tool, mode=mode):
        trace.append({"skipped": "not_allowed_in_mode", "mode": mode, "tool": plan.tool})
        return plan, trace, extra_messages

    tool_name, tool_args = router_plan_to_tool_args(plan)
    if not tool_name:
        return plan, trace, extra_messages

    from api.services.desktop_chat.tools.registry import execute_desktop_tool, trim_tool_content

    out = await execute_desktop_tool(
        db=db,
        db_pool=db_pool,
        name=tool_name,
        arguments=tool_args,
        user_id=user_id,
        company_id=company_id,
        project_id=project_id,
        defaults=dict(defaults),
        web_search_allowed=web_search_allowed,
        desktop_chat_id=desktop_chat_id,
        tool_progress_queue=tool_progress_queue,
        kbsew_agent=kbsew_agent,
        kbsew_registry=kbsew_registry,
    )
    entry: dict[str, Any] = {"name": tool_name, "ok": True, "preview": out[:400], "router": True}
    trace.append(entry)
    extra_messages.append({"role": "assistant", "content": ""})
    extra_messages.append(
        {"role": "tool", "tool_name": tool_name, "content": trim_tool_content(out)},
    )
    return plan, trace, extra_messages
