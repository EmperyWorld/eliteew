# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Episodic reembed Celery task skips bootstrap/vector I/O when backlog is empty.
# Related:
# - api/ewa_platform/workers/episodic_reembed_task.py
# ---

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, patch

import pytest

from api.ewa_platform.workers import episodic_reembed_task as mod


@pytest.mark.asyncio
async def test_run_batch_empty_pending_skips_bootstrap() -> None:
    pool = object()
    with (
        patch.object(mod, "open_initialized_ewa_worker_pool", new=AsyncMock(return_value=pool)),
        patch(
            "api.ewa_platform.persistence_pg.episodes_asyncpg.episodes_pending_count",
            new=AsyncMock(return_value=0),
        ) as pending,
        patch.object(mod, "bootstrap_ewa_platform_settings", new=AsyncMock()) as boot,
        patch.object(
            mod,
            "companion_reembed_pending_episodes_batch",
            new=AsyncMock(),
        ) as batch,
    ):
        out = await mod._run_batch({})
    assert out["examined"] == 0
    assert out["pending_remaining"] == 0
    pending.assert_awaited_once()
    boot.assert_not_awaited()
    batch.assert_not_awaited()


@pytest.mark.asyncio
async def test_run_batch_soft_skips_on_timeout() -> None:
    pool = object()

    async def boom(*_a: Any, **_k: Any) -> dict[str, Any]:
        raise TimeoutError("Connection timeout")

    with (
        patch.object(mod, "open_initialized_ewa_worker_pool", new=AsyncMock(return_value=pool)),
        patch(
            "api.ewa_platform.persistence_pg.episodes_asyncpg.episodes_pending_count",
            new=AsyncMock(return_value=3),
        ),
        patch.object(mod, "bootstrap_ewa_platform_settings", new=AsyncMock()),
        patch.object(mod, "companion_reembed_pending_episodes_batch", new=boom),
    ):
        out = await mod._run_batch({})
    assert out["skipped"] is True
    assert out["reason"] == "upstream_unreachable"
