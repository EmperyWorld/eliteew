# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for UGS queue worker resilience (Redis lease + DLQ helpers).
# Invariants:
# - Tests must not require live Redis or RabbitMQ.
# Related:
# - api/services/ugs/queue_worker_resilience.py
# ---
"""Tests for UGS queue worker resilience helpers."""

from __future__ import annotations

import pytest

from api.core.database_manager import DatabaseConnectionError


@pytest.mark.asyncio
async def test_acquire_ugs_worker_lease_degrades_when_redis_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.services.ugs import queue_worker_resilience as qwr

    async def _raise() -> None:
        raise DatabaseConnectionError("no redis")

    monkeypatch.setattr(qwr, "get_redis_client", _raise)
    ok, token = await qwr.acquire_ugs_worker_lease("550e8400-e29b-41d4-a716-446655440000")
    assert ok is True
    assert token is None


@pytest.mark.asyncio
async def test_acquire_ugs_worker_lease_conflict_when_key_exists(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.services.ugs import queue_worker_resilience as qwr

    class _Redis:
        async def set(self, name: object, value: object, nx: bool = False, ex: object | None = None) -> None:
            return None

    async def _client() -> _Redis:
        return _Redis()

    monkeypatch.setattr(qwr, "get_redis_client", _client)
    ok, token = await qwr.acquire_ugs_worker_lease("550e8400-e29b-41d4-a716-446655440000")
    assert ok is False
    assert token is None


@pytest.mark.asyncio
async def test_touch_ugs_worker_lease_refreshes_ttl(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.services.ugs import queue_worker_resilience as qwr

    calls: list[tuple[str, int]] = []

    class _Redis:
        def __init__(self) -> None:
            self.store: dict[str, bytes] = {qwr._lease_key("550e8400-e29b-41d4-a716-446655440000"): b"tok"}

        async def get(self, key: str) -> bytes | None:
            return self.store.get(key)

        async def expire(self, key: str, seconds: int) -> bool:
            calls.append((key, seconds))
            return True

    r = _Redis()

    async def _client() -> _Redis:
        return r

    monkeypatch.setattr(qwr, "get_redis_client", _client)
    monkeypatch.setattr(qwr, "_lease_ttl_seconds", lambda: 3600)

    await qwr.touch_ugs_worker_lease("550e8400-e29b-41d4-a716-446655440000", "tok")
    assert calls and calls[0][1] == 3600


def test_get_ugs_worker_lease_touch_interval_seconds_default() -> None:
    from api.services.ugs.queue_worker_resilience import get_ugs_worker_lease_touch_interval_seconds

    assert get_ugs_worker_lease_touch_interval_seconds() >= 30


@pytest.mark.asyncio
async def test_release_ugs_worker_lease_deletes_matching_token(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.services.ugs import queue_worker_resilience as qwr

    deleted: list[str] = []

    class _Redis:
        def __init__(self) -> None:
            self.store: dict[str, bytes] = {qwr._lease_key("550e8400-e29b-41d4-a716-446655440000"): b"tok"}

        async def get(self, key: str) -> bytes | None:
            return self.store.get(key)

        async def delete(self, key: str) -> int:
            if key in self.store:
                deleted.append(key)
                del self.store[key]
                return 1
            return 0

    r = _Redis()

    async def _client() -> _Redis:
        return r

    monkeypatch.setattr(qwr, "get_redis_client", _client)
    await qwr.release_ugs_worker_lease("550e8400-e29b-41d4-a716-446655440000", "tok")
    assert deleted
