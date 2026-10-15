# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lock: MusicForge metric_inc dual-writes Prometheus counter labels.
# Invariants:
# - observe_music_forge_metric maps name + optional step; never raises.
# Related:
# - api/services/music_forge/observability.py
# - api/monitoring/metrics.py
# ---
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from api.monitoring import metrics as metrics_mod
from api.services.music_forge import observability as obs_mod


def test_observe_music_forge_metric_increments_labeled_counter() -> None:
    before = metrics_mod.music_forge_metric_total.labels(name="run_completed", step="")._value.get()
    metrics_mod.observe_music_forge_metric("run_completed")
    after = metrics_mod.music_forge_metric_total.labels(name="run_completed", step="")._value.get()
    assert after == before + 1


def test_observe_music_forge_metric_includes_step_label() -> None:
    before = metrics_mod.music_forge_metric_total.labels(name="run_failed", step="audio_comfy")._value.get()
    metrics_mod.observe_music_forge_metric("run_failed", step="audio_comfy")
    after = metrics_mod.music_forge_metric_total.labels(name="run_failed", step="audio_comfy")._value.get()
    assert after == before + 1


@pytest.mark.asyncio
async def test_music_forge_metric_inc_calls_prometheus_even_without_redis(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seen: list[tuple[str, dict]] = []

    def _observe(name: str, **labels: object) -> None:
        seen.append((name, dict(labels)))

    monkeypatch.setattr(obs_mod, "_redis", AsyncMock(return_value=None))
    monkeypatch.setattr(
        "api.monitoring.metrics.observe_music_forge_metric",
        _observe,
    )

    await obs_mod.music_forge_metric_inc("run_create")
    assert seen == [("run_create", {})]


@pytest.mark.asyncio
async def test_music_forge_metric_inc_redis_and_prometheus(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    redis = MagicMock()
    redis.incr = AsyncMock(return_value=3)
    redis.expire = AsyncMock(return_value=True)
    seen: list[str] = []

    monkeypatch.setattr(obs_mod, "_redis", AsyncMock(return_value=redis))
    monkeypatch.setattr(
        "api.monitoring.metrics.observe_music_forge_metric",
        lambda name, **labels: seen.append(name),
    )

    await obs_mod.music_forge_metric_inc("run_failed", step="lyrics_gate")
    assert seen == ["run_failed"]
    redis.incr.assert_awaited()
    redis.expire.assert_awaited()
