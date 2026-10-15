# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Verify get_database_manager() re-inits shared httpx after Celery asyncio loop reset drops clients.
# Invariants:
# - No live Postgres; patches initialize only.
# Related:
# - api/core/database_manager.py
# - api/ewa_platform/companion/orchestration/tool_registry.py (music pipeline)
# ---

from __future__ import annotations

import asyncio
from typing import Any, cast
from unittest.mock import AsyncMock

import pytest


@pytest.mark.asyncio
async def test_get_database_manager_reinits_http_clients_after_event_loop_change(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import api.core.database_manager as dm
    from api.core.http_clients import get_httpx_client, init_http_clients

    await init_http_clients()
    get_httpx_client()

    stale_loop = cast(asyncio.AbstractEventLoop, object())
    dm.db_manager.is_initialized = True
    dm.db_manager._event_loop = stale_loop
    dm.db_manager.postgres_session_factory = cast(Any, True)

    close_mock = AsyncMock()
    monkeypatch.setattr("api.core.http_clients.close_http_clients", close_mock)
    monkeypatch.setattr(dm.db_manager, "initialize", AsyncMock())

    manager = await dm.get_database_manager()
    assert manager is dm.db_manager
    close_mock.assert_awaited_once()
    get_httpx_client()
