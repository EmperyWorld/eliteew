"""Smoke tests for Redis-backed desktop AI chat stream lock coordination modes."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest


def test_acquire_stream_lock_fail_open_when_redis_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.services.desktop_chat import stream_lock as sl

    monkeypatch.setenv("DESKTOP_AI_CHAT_STREAM_LOCK_MODE", "degrade")

    async def _run() -> None:
        with patch.object(
            sl,
            "get_redis_client",
            side_effect=RuntimeError("redis down"),
        ):
            ok = await sl.acquire_stream_lock(uuid4(), uuid4())
            assert ok is True

    asyncio.run(_run())


def test_acquire_stream_lock_strict_raises_when_redis_down(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.services.desktop_chat import stream_lock as sl
    from api.services.desktop_chat.stream_coordination import StreamCoordinationUnavailable

    monkeypatch.setenv("DESKTOP_AI_CHAT_STREAM_LOCK_MODE", "strict")

    async def _run() -> None:
        with patch.object(
            sl,
            "get_redis_client",
            side_effect=RuntimeError("redis down"),
        ):
            with pytest.raises(StreamCoordinationUnavailable):
                await sl.acquire_stream_lock(uuid4(), uuid4())

    asyncio.run(_run())


def test_acquire_stream_lock_conflict_second_holder() -> None:
    from api.services.desktop_chat import stream_lock as sl

    async def _run() -> None:
        chat_id = uuid4()
        user_a = uuid4()
        user_b = uuid4()

        fake = AsyncMock()
        fake.set = AsyncMock(side_effect=[True, False])

        with patch.object(sl, "get_redis_client", AsyncMock(return_value=fake)):
            first = await sl.acquire_stream_lock(chat_id, user_a)
            second = await sl.acquire_stream_lock(chat_id, user_b)
            assert first is True
            assert second is False

    asyncio.run(_run())


def test_try_register_idempotency_second_call_false() -> None:
    from api.services.desktop_chat import stream_lock as sl

    async def _run() -> None:
        uid = uuid4()
        rid = uuid4()

        fake = AsyncMock()
        fake.set = AsyncMock(side_effect=[True, False])

        with patch.object(sl, "get_redis_client", AsyncMock(return_value=fake)):
            assert await sl.try_register_idempotency(uid, rid) is True
            assert await sl.try_register_idempotency(uid, rid) is False

    asyncio.run(_run())


def test_coordination_degraded_increments_metric(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.services.desktop_chat.stream_coordination import observe_coordination_degraded

    monkeypatch.setenv("DESKTOP_AI_CHAT_STREAM_LOCK_MODE", "degrade")
    calls: list[tuple[str, str, str, str]] = []

    def _capture(**kwargs: str) -> None:
        calls.append((kwargs["event"], kwargs["mode"], kwargs["reason"], kwargs["operation"]))

    with patch(
        "api.monitoring.metrics.observe_desktop_stream_coordination",
        side_effect=_capture,
    ):
        observe_coordination_degraded(reason="redis_unavailable", operation="connect")
    assert calls
    assert calls[0][0] == "degraded"
