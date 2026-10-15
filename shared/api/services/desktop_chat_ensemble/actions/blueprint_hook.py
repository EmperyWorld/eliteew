# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Thin helper to run an action pack from blueprint stream_turn without bloating it.
# Invariants:
# - Yields SSE strings then returns (pack, findings_markdown).
# Related:
# - api/services/desktop_chat_ensemble/blueprint/stream_turn.py
# ---
"""Blueprint stream helper for ensemble action packs."""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-untyped]

from api.services.desktop_chat_ensemble.actions.merge import merge_action_sources_into_rag_ctx
from api.services.desktop_chat_ensemble.actions.orchestrate import run_action_pack
from api.services.desktop_chat_ensemble.actions.types import (
    ActionMode,
    ActionPackResult,
    CapabilitySnapshot,
    capabilities_without_empty_chat_rag,
)


async def stream_action_pack_phase(
    *,
    db_pool: asyncpg.Pool,
    user_id: UUID,
    chat_id: UUID | None,
    project_id: UUID | None,
    defaults: dict[str, Any],
    capabilities: CapabilitySnapshot,
    mode: ActionMode,
    user_text: str,
    draft_body: str,
    web_search_allowed: bool,
    rag_ctx: dict[str, Any],
    recent_messages: list[dict[str, str | None]] | None = None,
    kbsew_agent: str = "desktop",
    kbsew_registry: list[Any] | None = None,
    model: str = "",
) -> AsyncIterator[str | tuple[ActionPackResult, dict[str, Any], str]]:
    """Yield SSE lines; final yielded value is ``(pack, updated_rag_ctx, findings_md)``."""
    existing = rag_ctx.get("context_sources")
    existing_list = [row for row in existing if isinstance(row, dict)] if isinstance(existing, list) else []
    # Turn prefetch already set chat_rag_chunks; 0 ⇒ do not re-plan empty chat_rag.
    raw_chunks = rag_ctx.get("chat_rag_chunks")
    chat_rag_chunks: int | None
    if type(raw_chunks) is int:
        chat_rag_chunks = raw_chunks
    elif type(raw_chunks) is float:
        chat_rag_chunks = int(raw_chunks)
    else:
        chat_rag_chunks = None
    pack_capabilities = capabilities_without_empty_chat_rag(
        capabilities,
        chat_rag_chunks=chat_rag_chunks,
    )
    pack: ActionPackResult | None = None
    async for item in run_action_pack(
        db_pool=db_pool,
        user_id=user_id,
        chat_id=chat_id,
        project_id=project_id,
        defaults=defaults,
        capabilities=pack_capabilities,
        mode=mode,
        user_text=user_text,
        draft_body=draft_body,
        web_search_allowed=web_search_allowed,
        existing_sources=existing_list,
        recent_messages=recent_messages,
        kbsew_agent=kbsew_agent,
        kbsew_registry=kbsew_registry,
        model=model,
    ):
        if isinstance(item, str):
            yield item
        else:
            pack = item
    if pack is None:
        return
    updated = merge_action_sources_into_rag_ctx(rag_ctx, pack.context_sources)
    if pack.ran and any(r.status == "ok" and r.kind == "web" for r in pack.results):
        updated = dict(updated)
        updated["web_search_used"] = True
    yield (pack, updated, pack.findings_markdown or "")
