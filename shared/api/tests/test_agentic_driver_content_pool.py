# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lock: agentic driver loads unified_content blocks from main DATABASE_URL pool,
# not the EWA orchestration pool passed into EwaAgenticDriver(pool).
# Related:
# - api/ewa_platform/agentic/driver/ewa_agentic_driver.py
# ---

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from api.ewa_platform.agentic.driver.ewa_agentic_driver import (
    EwaAgenticDriver,
    resolve_unified_content_pool,
)


@pytest.mark.asyncio
async def test_resolve_unified_content_pool_prefers_explicit() -> None:
    explicit = MagicMock(name="main_pool")
    out = await resolve_unified_content_pool(explicit)
    assert out is explicit


@pytest.mark.asyncio
async def test_resolve_unified_content_pool_uses_get_asyncpg_pool() -> None:
    main = MagicMock(name="app_pool")
    with patch(
        "api.core.database_manager.get_asyncpg_pool",
        new=AsyncMock(return_value=main),
    ):
        out = await resolve_unified_content_pool(None)
    assert out is main


@pytest.mark.asyncio
async def test_driver_read_loads_blocks_via_content_pool_not_agentic_pool() -> None:
    """Observe/read must not query unified_content on the EWA agentic pool."""
    content_id = uuid4()
    agentic_pool = MagicMock(name="ewa_pool")
    content_pool = MagicMock(name="main_pool")

    conn = AsyncMock()
    conn.fetchrow = AsyncMock(
        return_value={
            "content_payload": None,
            "extracted_text": "# EliteEW\n\nBody for driver blocks.",
        }
    )
    acquire_cm = AsyncMock()
    acquire_cm.__aenter__ = AsyncMock(return_value=conn)
    acquire_cm.__aexit__ = AsyncMock(return_value=None)
    content_pool.acquire = MagicMock(return_value=acquire_cm)

    storage = MagicMock()
    storage.get_content = AsyncMock(return_value=SimpleNamespace(version=3, id=content_id))

    session = {
        "id": "sess-1",
        "principal_id": "user-1",
        "goal_json": {"text": "write report"},
        "policy_json": {"unified_content_id": str(content_id)},
        "working_memory_json": {},
    }

    driver = EwaAgenticDriver(agentic_pool, content_pool=content_pool)
    with patch(
        "api.ewa_platform.companion.storage.catalog_pipeline.make_content_storage_service",
        return_value=storage,
    ):
        snapshot = await driver.observe(
            session=session,
            act_tool="file_create",
            act_summary="created",
        )

    assert len(snapshot.content_blocks) >= 1
    assert snapshot.content_version == 3
    assert "EliteEW" in snapshot.content_blocks[0].get("content", "")
    agentic_pool.acquire.assert_not_called()
    content_pool.acquire.assert_called()
    storage.get_content.assert_awaited()
