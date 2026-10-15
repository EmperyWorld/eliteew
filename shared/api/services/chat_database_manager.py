#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Thin wrapper over global DatabaseManager for chat system.
# Invariants:
# - Same PostgreSQL/Redis pools as the rest of the app.
# - Do not soft-skip encryption.pii_key; key is set on SQLAlchemy pool connect.
# Related:
# - api/core/database_manager.py
# - api/core/pii_session.py
# ---
"""
ELITE CHAT DATABASE MANAGER
Thin wrapper over global DatabaseManager for chat system.
"""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.core.database_manager import (
    DatabaseConnectionError,
    DatabaseManager,
    get_database_manager,
)

logger = logging.getLogger(__name__)


class ChatDatabaseManager:
    """Database manager for Elite Chat.

    Thin wrapper that delegates to the global DatabaseManager so chat
    uses the same PostgreSQL and Redis pools as the rest of the app.
    """

    def __init__(self) -> None:
        self._initialized = False

    async def initialize(self) -> None:
        """Ensure global DatabaseManager is initialized."""
        if self._initialized:
            return
        manager = await get_database_manager()
        # initialize() is idempotent; if already initialized this is a no-op
        if not manager.is_initialized:
            await manager.initialize()
        self._initialized = True

    @asynccontextmanager
    async def get_postgres_session(self) -> AsyncIterator[AsyncSession]:
        """Get PostgreSQL session from global DatabaseManager.

        Uses postgres_session_factory directly to avoid nested async
        context managers, which can raise RuntimeError on close
        (athrow(): asynchronous generator is already running).

        encryption.pii_key is applied on pool connect (not soft-skipped here).
        """
        if not self._initialized:
            await self.initialize()
        manager: DatabaseManager = await get_database_manager()
        if not manager.postgres_session_factory:
            raise DatabaseConnectionError("PostgreSQL not available")
        async with manager.postgres_session_factory() as session:
            yield session

    async def get_redis_client(self) -> Any:  # noqa: ANN401
        """Get Redis client from global DatabaseManager."""
        if not self._initialized:
            await self.initialize()
        manager: DatabaseManager = await get_database_manager()
        return await manager.get_redis_client()

    async def close(self) -> None:
        """No-op close; lifecycle is managed by DatabaseManager."""
        self._initialized = False


# Global instance
_chat_db_manager: ChatDatabaseManager | None = None


async def get_chat_database_manager() -> ChatDatabaseManager:
    """Get global instance of chat database manager."""
    global _chat_db_manager

    if _chat_db_manager is None:
        _chat_db_manager = ChatDatabaseManager()
        await _chat_db_manager.initialize()

    return _chat_db_manager
