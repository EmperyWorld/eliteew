# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Short-lived SQLAlchemy sessions for Desktop AI Chat stream/tools (prep and isolated writes).
# Invariants:
# - Never hold a session across Llama/UGS/SSE await boundaries; open → use → commit/rollback → close.
# Related:
# - api/core/database_manager.py
# - documentation/product/DESKTOP-LLAMA-CHAT.md
# ---
"""Desktop AI Chat DB session helpers (wave A: session lifecycle)."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncSession


@asynccontextmanager
async def desktop_ai_chat_session() -> AsyncIterator[AsyncSession]:
    """Yield a fresh Postgres session; closes before the caller continues past the block."""
    from api.core.database_manager import get_database_manager

    manager = await get_database_manager()
    async with manager.get_postgres_session() as session:
        # Keep loaded attrs usable after commit when prep expunges ORM rows for the stream phase.
        session.sync_session.expire_on_commit = False
        yield session
