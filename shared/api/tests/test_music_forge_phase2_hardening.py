# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Phase 2 locks: circuit breaker open → unavailable; dedicated audio type_key; Redis metrics key shape.
# Invariants:
# - assert_upstream_closed raises when opened_at within cooldown.
# - MUSIC_FORGE_AUDIO_TYPE_KEY is forge-owned, not Evolution shared key.
# Related:
# - api/services/music_forge/breaker.py
# - api/services/music_forge/algorithm/constants.py
# ---
"""MusicForge Phase 2 hardening contract tests."""

from __future__ import annotations

import time
from typing import Any
from unittest.mock import AsyncMock

import pytest

from api.services.music_forge.algorithm.constants import MUSIC_FORGE_AUDIO_TYPE_KEY
from api.services.music_forge.breaker import (
    BREAKER_THRESHOLD,
    MusicForgeUpstreamUnavailableError,
    assert_upstream_closed,
    get_breaker_state,
    record_upstream_failure,
    record_upstream_success,
)
from api.services.music_forge.observability import REDIS_COUNTER_PREFIX, _counter_key


def test_dedicated_forge_audio_type_key() -> None:
    assert MUSIC_FORGE_AUDIO_TYPE_KEY == "music_generator_forge_audio"
    assert MUSIC_FORGE_AUDIO_TYPE_KEY != "music_generator_evolution_xl_base"


def test_metric_counter_key_shape() -> None:
    assert _counter_key("run_create", {}) == f"{REDIS_COUNTER_PREFIX}:run_create"
    assert "step=audio" in _counter_key("run_failed", {"step": "audio"})


class _FakeRedis:
    def __init__(self) -> None:
        self.store: dict[str, Any] = {}

    async def get(self, key: str) -> Any:
        return self.store.get(key)

    async def set(self, key: str, value: str) -> None:
        self.store[key] = value

    async def incr(self, key: str) -> int:
        self.store[key] = int(self.store.get(key) or 0) + 1
        return int(self.store[key])

    async def expire(self, key: str, _ttl: int) -> None:
        return None

    async def delete(self, *keys: str) -> None:
        for key in keys:
            self.store.pop(key, None)


@pytest.mark.asyncio
async def test_breaker_opens_after_threshold(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = _FakeRedis()
    monkeypatch.setattr("api.services.music_forge.breaker._redis", AsyncMock(return_value=fake))
    for _ in range(BREAKER_THRESHOLD):
        await record_upstream_failure("comfy")
    state = await get_breaker_state("comfy")
    assert state["open"] is True
    assert int(state["failures"]) >= BREAKER_THRESHOLD
    with pytest.raises(MusicForgeUpstreamUnavailableError):
        await assert_upstream_closed("comfy")


@pytest.mark.asyncio
async def test_breaker_success_closes(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = _FakeRedis()
    monkeypatch.setattr("api.services.music_forge.breaker._redis", AsyncMock(return_value=fake))
    for _ in range(BREAKER_THRESHOLD):
        await record_upstream_failure("comfy")
    await record_upstream_success("comfy")
    state = await get_breaker_state("comfy")
    assert state["open"] is False
    assert int(state["failures"]) == 0
    await assert_upstream_closed("comfy")  # no raise


@pytest.mark.asyncio
async def test_breaker_half_open_after_cooldown(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = _FakeRedis()
    monkeypatch.setattr("api.services.music_forge.breaker._redis", AsyncMock(return_value=fake))
    await record_upstream_failure("comfy")
    # Force open stamp in the past beyond cooldown
    from api.services.music_forge import breaker as breaker_mod

    fake.store[breaker_mod._open_key("comfy")] = str(time.time() - breaker_mod.BREAKER_COOLDOWN_SEC - 1)
    fake.store[breaker_mod._fail_key("comfy")] = str(BREAKER_THRESHOLD)
    state = await get_breaker_state("comfy")
    assert state["open"] is False
    await assert_upstream_closed("comfy")


@pytest.mark.asyncio
async def test_create_run_blocked_when_comfy_breaker_open(monkeypatch: pytest.MonkeyPatch) -> None:
    """Layer C: open Comfy breaker → create_run returns HTTP 503 (no INSERT)."""
    from fastapi import HTTPException

    from api.schemas.music_forge import MusicForgeRunCreate
    from api.services.music_forge.billing_gate import MusicForgeBillingGate
    from api.services.music_forge.config import MusicForgeConfigService, code_default_bundle
    from api.services.music_forge.pipeline import MusicForgePipelineService

    fake = _FakeRedis()
    monkeypatch.setattr("api.services.music_forge.breaker._redis", AsyncMock(return_value=fake))
    for _ in range(BREAKER_THRESHOLD):
        await record_upstream_failure("comfy")

    async def _noop_preflight(self, *, user_id: str, audio_type_key: str) -> None:
        return None

    async def _noop_budget(self, *, user_id: str, user_role: str | None) -> None:
        return None

    class _NoExecuteSession:
        async def execute(self, *_a: object, **_k: object) -> None:
            raise AssertionError("create_run must not touch DB when breaker is open")

        async def commit(self) -> None:
            raise AssertionError("create_run must not commit when breaker is open")

    monkeypatch.setattr(MusicForgeBillingGate, "preflight_credits", _noop_preflight)
    monkeypatch.setattr(MusicForgeBillingGate, "enforce_run_budget", _noop_budget)
    monkeypatch.setattr(
        MusicForgeConfigService,
        "get_active",
        AsyncMock(return_value=code_default_bundle()),
    )
    service = MusicForgePipelineService(_NoExecuteSession())  # type: ignore[arg-type]
    with pytest.raises(HTTPException) as exc_info:
        await service.create_run(
            user_id="22222222-2222-2222-2222-222222222222",
            body=MusicForgeRunCreate(idea="Night drive"),
        )
    assert exc_info.value.status_code == 503
    assert exc_info.value.detail == "music_forge_upstream_unavailable"
