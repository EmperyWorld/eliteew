# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral tests for the E4 process-level EWA worker asyncpg pool singleton.
# Invariants:
# - No live Postgres; opener and data-plane bootstrap are mocked.
# - Callers must not close the worker pool returned by ``open_initialized_ewa_worker_pool``.
# Related:
# - api/ewa_platform/workers/ewa_pool.py
# - api/core/celery_async.py
# ---

from __future__ import annotations

from collections.abc import Iterator
from unittest.mock import AsyncMock, MagicMock

import pytest

from api.ewa_platform.workers import ewa_pool


def _fake_pool(name: str) -> MagicMock:
    pool = MagicMock(name=name)
    pool.is_closing = MagicMock(return_value=False)
    pool.close = AsyncMock()
    return pool


@pytest.fixture(autouse=True)
def reset_worker_pool_refs() -> Iterator[None]:
    ewa_pool.reset_ewa_worker_pool_for_tests()
    yield
    ewa_pool.reset_ewa_worker_pool_for_tests()


@pytest.mark.asyncio
async def test_get_ewa_worker_pool_reuses_singleton(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_pool = _fake_pool("ewa-worker-pool")
    open_pool = AsyncMock(return_value=fake_pool)
    init_data_plane = AsyncMock()

    monkeypatch.setenv("EWA_DATABASE_URL", "postgresql://ewa.example/test")
    monkeypatch.setattr(ewa_pool, "open_ewa_orchestration_pool", open_pool)
    monkeypatch.setattr(ewa_pool, "init_ewa_data_plane", init_data_plane)

    first = await ewa_pool.get_ewa_worker_pool(min_size=1, max_size=4)
    second = await ewa_pool.get_ewa_worker_pool(min_size=1, max_size=4)

    assert first is fake_pool
    assert second is fake_pool
    open_pool.assert_awaited_once_with("postgresql://ewa.example/test", min_size=1, max_size=4)
    init_data_plane.assert_awaited_once_with(fake_pool)
    fake_pool.close.assert_not_awaited()


@pytest.mark.asyncio
async def test_open_initialized_ewa_worker_pool_does_not_require_caller_close(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake_pool = _fake_pool("ewa-worker-pool")
    monkeypatch.setenv("EWA_DATABASE_URL", "postgresql://ewa.example/test")
    monkeypatch.setattr(ewa_pool, "open_ewa_orchestration_pool", AsyncMock(return_value=fake_pool))
    monkeypatch.setattr(ewa_pool, "init_ewa_data_plane", AsyncMock())

    pool = await ewa_pool.open_initialized_ewa_worker_pool(min_size=1, max_size=4)
    again = await ewa_pool.open_initialized_ewa_worker_pool(min_size=1, max_size=4)

    assert pool is fake_pool
    assert again is fake_pool
    fake_pool.close.assert_not_awaited()


@pytest.mark.asyncio
async def test_reset_ewa_worker_pool_for_tests_drops_singleton_refs(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    first_pool = _fake_pool("first-worker-pool")
    second_pool = _fake_pool("second-worker-pool")
    open_pool = AsyncMock(side_effect=[first_pool, second_pool])
    init_data_plane = AsyncMock()

    monkeypatch.setenv("EWA_DATABASE_URL", "postgresql://ewa.example/test")
    monkeypatch.setattr(ewa_pool, "open_ewa_orchestration_pool", open_pool)
    monkeypatch.setattr(ewa_pool, "init_ewa_data_plane", init_data_plane)

    first = await ewa_pool.get_ewa_worker_pool(min_size=1, max_size=4)
    ewa_pool.reset_ewa_worker_pool_for_tests()
    second = await ewa_pool.get_ewa_worker_pool(min_size=1, max_size=4)

    assert first is first_pool
    assert second is second_pool
    assert open_pool.await_count == 2
    assert init_data_plane.await_count == 2
    first_pool.close.assert_not_awaited()
    second_pool.close.assert_not_awaited()
