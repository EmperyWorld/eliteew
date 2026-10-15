# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Isolate normal Desktop AI Chat /stream from an active Discussion session.
# Invariants:
# - Active discussion statuses block /stream; dedicated Discussion endpoints own the chat.
# Related:
# - routers/desktop_ai_chat_stream_routes.py
# ---
"""Discussion stream isolation helpers."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from api.services.desktop_chat_ensemble.discussion.repository import get_active_session_for_chat


async def active_discussion_blocks_stream(db: AsyncSession, chat_id: UUID) -> UUID | None:
    """Return active discussion session id if normal stream must be rejected."""
    session = await get_active_session_for_chat(db, chat_id)
    return session.id if session is not None else None
