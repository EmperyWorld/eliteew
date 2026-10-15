# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Web probe runner for ensemble action packs (reuse desktop_web_search).
# Invariants:
# - Respects web_search_allowed; empty/error never fabricates hits.
# Related:
# - api/services/desktop_chat/tools/web_search_tool.py
# ---
"""Web search runner for ensemble actions."""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from api.services.desktop_chat.context_evidence import web_context_sources
from api.services.desktop_chat.db_session import desktop_ai_chat_session
from api.services.desktop_chat.tools.web_search_tool import run_web_search_with_sources
from api.services.desktop_chat_ensemble.actions.budget import MAX_RESULT_DETAIL_CHARS
from api.services.desktop_chat_ensemble.actions.types import ActionResult, PlannedAction

logger = logging.getLogger(__name__)


def _renumber_web_sources(
    sources: list[dict[str, str]],
    *,
    existing: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    max_w = 0
    for row in existing:
        cid = str(row.get("citation_id") or "")
        if len(cid) >= 2 and cid[0] == "W" and cid[1:].isdigit():
            max_w = max(max_w, int(cid[1:]))
    out: list[dict[str, Any]] = []
    for i, src in enumerate(sources):
        row = dict(src)
        row["citation_id"] = f"W{max_w + i + 1}"
        out.append(row)
    return out


async def run_web_action(
    action: PlannedAction,
    *,
    user_id: UUID,
    web_search_allowed: bool,
    existing_sources: list[dict[str, Any]] | None = None,
    recent_messages: list[dict[str, str | None]] | None = None,
) -> ActionResult:
    if not web_search_allowed:
        return ActionResult(
            action_id=action.action_id,
            kind="web",
            query=action.query,
            status="skipped",
            summary="Веб-поиск недоступен в этом ходе",
            error="web_disabled",
        )
    try:
        async with desktop_ai_chat_session() as db:
            block, sources = await run_web_search_with_sources(
                db,
                user_id=user_id,
                query=action.query,
                enabled=True,
                recent_messages=recent_messages,
            )
    except Exception as exc:
        logger.warning(
            "[STEP] ensemble_action web_fail action_id=%s err=%s",
            action.action_id,
            exc,
        )
        return ActionResult(
            action_id=action.action_id,
            kind="web",
            query=action.query,
            status="error",
            summary="Ошибка веб-поиска",
            error=str(exc)[:240],
        )

    if not sources:
        return ActionResult(
            action_id=action.action_id,
            kind="web",
            query=action.query,
            status="empty",
            summary="Нет проверяемых веб-хитов",
            detail=(block or "")[:MAX_RESULT_DETAIL_CHARS],
        )

    public = web_context_sources(sources)
    remapped = _renumber_web_sources(public, existing=list(existing_sources or []))
    titles = [str(s.get("title") or s.get("url") or "")[:80] for s in remapped[:3]]
    return ActionResult(
        action_id=action.action_id,
        kind="web",
        query=action.query,
        status="ok",
        summary="; ".join(t for t in titles if t) or f"{len(remapped)} источников",
        detail=(block or "")[:MAX_RESULT_DETAIL_CHARS],
        context_sources=remapped,
    )
