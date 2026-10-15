# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Dispatch PlannedAction to the matching read-only runner.
# Invariants:
# - Unknown kinds return error ActionResult (never raise to stream).
# Related:
# - documentation/product/DESKTOP-ENSEMBLE-ACTIONS.md
# ---
"""Dispatch ensemble planned actions to runners."""

from __future__ import annotations

from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-untyped]

from api.services.desktop_chat_ensemble.actions.runners import kbsew as kbsew_runner
from api.services.desktop_chat_ensemble.actions.runners import project_rag as rag_runner
from api.services.desktop_chat_ensemble.actions.runners import web as web_runner
from api.services.desktop_chat_ensemble.actions.types import ActionResult, PlannedAction


async def dispatch_action(
    action: PlannedAction,
    *,
    db_pool: asyncpg.Pool,
    user_id: UUID,
    chat_id: UUID | None,
    project_id: UUID | None,
    defaults: dict[str, Any],
    web_search_allowed: bool,
    existing_sources: list[dict[str, Any]],
    recent_messages: list[dict[str, str | None]] | None = None,
    kbsew_agent: str = "desktop",
    kbsew_registry: list[Any] | None = None,
) -> ActionResult:
    if action.kind == "web":
        return await web_runner.run_web_action(
            action,
            user_id=user_id,
            web_search_allowed=web_search_allowed,
            existing_sources=existing_sources,
            recent_messages=recent_messages,
        )
    if action.kind in {"chat_rag", "project_vault"}:
        return await rag_runner.run_rag_action(
            action,
            kind=action.kind,
            db_pool=db_pool,
            user_id=user_id,
            chat_id=chat_id,
            project_id=project_id,
            existing_sources=existing_sources,
        )
    if action.kind == "kbsew":
        return await kbsew_runner.run_kbsew_action(
            action,
            defaults=defaults,
            existing_sources=existing_sources,
            kbsew_agent=kbsew_agent,
            kbsew_registry=kbsew_registry,
        )
    return ActionResult(
        action_id=action.action_id,
        kind=action.kind,
        query=action.query,
        status="error",
        summary="Неизвестный тип действия",
        error=f"unknown_kind:{action.kind}",
    )
