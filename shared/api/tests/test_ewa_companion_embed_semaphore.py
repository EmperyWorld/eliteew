# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Behavioural tests for the stack2 embed semaphore + per-turn telemetry counter
# (``api.ewa_platform.companion.sidecar.stack2_semaphore``).
# Invariants:
# - Concurrent ``embed_slot`` calls never exceed ``EWA_COMPANION_EMBED_PARALLELISM``.
# - ``reset_embed_counter`` zeroes the per-turn counter; ``get_embed_counter`` reflects how many calls fired.
# Related:
# - api/ewa_platform/companion/sidecar/stack2_semaphore.py
# ---
"""Tests for embed_slot semaphore parallelism + per-turn counter."""

from __future__ import annotations

import asyncio
import importlib

import pytest


def _fresh_module(monkeypatch: pytest.MonkeyPatch, parallelism: int):
    """Reload the semaphore module under a specific parallelism setting (reset the lazy singleton)."""
    monkeypatch.setenv("EWA_COMPANION_EMBED_PARALLELISM", str(parallelism))
    import api.ewa_platform.companion.sidecar.stack2_semaphore as mod  # noqa: PLC0415

    importlib.reload(mod)
    return mod


@pytest.mark.unit
def test_get_companion_embed_parallelism_env_override(monkeypatch: pytest.MonkeyPatch) -> None:
    mod = _fresh_module(monkeypatch, 4)
    assert mod.get_companion_embed_parallelism() == 4
    monkeypatch.setenv("EWA_COMPANION_EMBED_PARALLELISM", "99")
    assert mod.get_companion_embed_parallelism() == 8  # capped


@pytest.mark.unit
def test_embed_slot_caps_concurrency_at_two(monkeypatch: pytest.MonkeyPatch) -> None:
    mod = _fresh_module(monkeypatch, 2)

    async def runner() -> tuple[int, int]:
        active = 0
        peak = 0
        lock = asyncio.Lock()

        async def one() -> None:
            nonlocal active, peak
            async with mod.embed_slot(reason="test"):
                async with lock:
                    active += 1
                    peak = max(peak, active)
                await asyncio.sleep(0.02)
                async with lock:
                    active -= 1

        mod.reset_embed_counter()
        await asyncio.gather(*(one() for _ in range(8)))
        return peak, mod.get_embed_counter()

    peak, counter = asyncio.run(runner())
    assert peak <= 2, "Semaphore must cap parallel embed slots to the configured limit"
    assert counter == 8, "Per-turn counter must reflect every embed_slot acquisition"


@pytest.mark.unit
def test_reset_embed_counter_isolated_per_run(monkeypatch: pytest.MonkeyPatch) -> None:
    mod = _fresh_module(monkeypatch, 1)

    async def runner() -> int:
        mod.reset_embed_counter()
        async with mod.embed_slot(reason="warmup"):
            pass
        return mod.get_embed_counter()

    first = asyncio.run(runner())
    second = asyncio.run(runner())
    assert first == 1
    assert second == 1, "Counter must reset between runs / contexts"
