# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Chat RAG + project vault probes for ensemble action packs.
# Invariants:
# - Vault requires project access via search_marketing_project_rag_chunks ACL.
# - Citation IDs remapped to avoid collisions with existing context_sources.
# Related:
# - api/services/desktop_chat/rag_service.py
# - api/services/marketing_project_rag_service.py
# ---
"""RAG / vault runners for ensemble actions."""

from __future__ import annotations

import logging
from dataclasses import replace
from typing import Any, Literal
from uuid import UUID

import asyncpg  # type: ignore[import-untyped]

from api.services.desktop_chat.context_evidence import (
    build_context_sources,
    format_context_chunks_for_prompt,
    public_context_sources,
)
from api.services.desktop_chat.rag_service import search_desktop_chat_rag_chunks
from api.services.desktop_chat_ensemble.actions.budget import MAX_RESULT_DETAIL_CHARS
from api.services.desktop_chat_ensemble.actions.types import ActionResult, PlannedAction
from api.services.marketing_project_rag_service import search_marketing_project_rag_chunks

logger = logging.getLogger(__name__)

RagKind = Literal["chat_rag", "project_vault"]


def _max_prefix(existing: list[dict[str, Any]], prefix: str) -> int:
    n = 0
    for row in existing:
        cid = str(row.get("citation_id") or "")
        if len(cid) >= 2 and cid[0] == prefix and cid[1:].isdigit():
            n = max(n, int(cid[1:]))
    return n


async def run_rag_action(
    action: PlannedAction,
    *,
    kind: RagKind,
    db_pool: asyncpg.Pool,
    user_id: UUID,
    chat_id: UUID | None,
    project_id: UUID | None,
    existing_sources: list[dict[str, Any]] | None = None,
) -> ActionResult:
    existing = list(existing_sources or [])
    try:
        if kind == "chat_rag":
            if chat_id is None:
                return ActionResult(
                    action_id=action.action_id,
                    kind=kind,
                    query=action.query,
                    status="skipped",
                    summary="Нет chat_id для RAG",
                    error="no_chat_id",
                )
            chunks = await search_desktop_chat_rag_chunks(
                query=action.query,
                chat_id=chat_id,
                limit=6,
            )
            scope = "chat"
            prefix = "C"
        else:
            if project_id is None:
                return ActionResult(
                    action_id=action.action_id,
                    kind=kind,
                    query=action.query,
                    status="skipped",
                    summary="Нет проекта для vault",
                    error="no_project",
                )
            chunks = await search_marketing_project_rag_chunks(
                db_pool,
                query=action.query,
                project_id=project_id,
                user_id=user_id,
                limit=6,
                skip_internal_rerank=True,
            )
            scope = "project"
            prefix = "P"
    except Exception as exc:
        logger.warning(
            "[STEP] ensemble_action rag_fail kind=%s action_id=%s err=%s",
            kind,
            action.action_id,
            exc,
        )
        return ActionResult(
            action_id=action.action_id,
            kind=kind,
            query=action.query,
            status="error",
            summary="Ошибка поиска по материалам",
            error=str(exc)[:240],
        )

    if not chunks:
        return ActionResult(
            action_id=action.action_id,
            kind=kind,
            query=action.query,
            status="empty",
            summary="Нет релевантных фрагментов",
        )

    typed = build_context_sources(chunks, scope=scope)  # type: ignore[arg-type]
    start = _max_prefix(existing, prefix)
    remapped_typed = [replace(src, citation_id=f"{prefix}{start + i + 1}") for i, src in enumerate(typed)]
    remapped = public_context_sources(remapped_typed)
    detail = format_context_chunks_for_prompt(
        chunks,
        scope=scope,  # type: ignore[arg-type]
        sources=remapped_typed,
        max_chars=MAX_RESULT_DETAIL_CHARS,
    )
    titles = [str(s.get("title") or "")[:80] for s in remapped[:3]]
    return ActionResult(
        action_id=action.action_id,
        kind=kind,
        query=action.query,
        status="ok",
        summary="; ".join(t for t in titles if t) or f"{len(remapped)} материалов",
        detail=detail[:MAX_RESULT_DETAIL_CHARS],
        context_sources=remapped,
    )
