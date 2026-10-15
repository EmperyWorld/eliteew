# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Trust T5 / V-H2 lock: Celery beat health slice for ``/api/health`` honesty.
# Invariants:
# - Missing heartbeat defaults to ``unknown`` (not silent healthy) unless require-heartbeat env.
# - Stale heartbeat returns ``stale`` and must degrade overall health merge.
# Related:
# - api/monitoring/metrics.py
# - api/ewa_platform/desktop/ewa_health_snapshot.py
# - documentation/product/ewa/EWA-TRUST-RESTORATION-PROGRAM-2026-07-09.md
# ---

from __future__ import annotations

import asyncio
import time
from typing import Any

import pytest

from api.ewa_platform.desktop.ewa_health_snapshot import merge_api_overall_status_with_celery_beat
from api.monitoring import metrics


class _FakeRedis:
    def __init__(self) -> None:
        self.strings: dict[str, str] = {}
        self.hashes: dict[str, dict[str, str]] = {}

    async def set(self, key: str, value: str) -> None:
        self.strings[key] = str(value)

    async def get(self, key: str) -> str | None:
        return self.strings.get(key)

    async def hset(self, key: str, mapping: dict[str, str] | None = None, **_kwargs: Any) -> None:
        self.hashes[key] = {str(k): str(v) for k, v in dict(mapping or {}).items()}

    async def hgetall(self, key: str) -> dict[str, str]:
        return dict(self.hashes.get(key) or {})


@pytest.fixture(autouse=True)
def reset_beat_alarm(monkeypatch: pytest.MonkeyPatch) -> None:
    metrics.set_ops_alarm_state(alarm="ewa_celery_beat_stale", active=False)
    metrics.ewa_celery_beat_last_success_timestamp_seconds.set(0.0)
    monkeypatch.delenv("EWA_CELERY_BEAT_STALE_REQUIRE_HEARTBEAT", raising=False)
    monkeypatch.delenv("EWA_CELERY_BEAT_STALE_SECONDS", raising=False)


@pytest.mark.unit
def test_build_celery_beat_health_slice_ok(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = _FakeRedis()
    now = time.time()
    fake.strings[metrics.EWA_CELERY_BEAT_LAST_SUCCESS_KEY] = str(now)

    async def _get_redis() -> _FakeRedis:
        return fake

    monkeypatch.setattr(metrics, "_get_ewa_ops_redis_client", _get_redis)
    out = asyncio.run(metrics.build_celery_beat_health_slice())
    assert out["status"] == "ok"
    assert out["stale"] is False
    assert out["spof"] is True


@pytest.mark.unit
def test_build_celery_beat_health_slice_stale(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = _FakeRedis()
    fake.strings[metrics.EWA_CELERY_BEAT_LAST_SUCCESS_KEY] = str(time.time() - 10_000)
    monkeypatch.setenv("EWA_CELERY_BEAT_STALE_SECONDS", "600")

    async def _get_redis() -> _FakeRedis:
        return fake

    monkeypatch.setattr(metrics, "_get_ewa_ops_redis_client", _get_redis)
    out = asyncio.run(metrics.build_celery_beat_health_slice())
    assert out["status"] == "stale"
    assert out["stale"] is True


@pytest.mark.unit
def test_merge_api_overall_status_with_celery_beat_degrades_healthy() -> None:
    assert merge_api_overall_status_with_celery_beat("healthy", "stale") == "degraded"
    assert merge_api_overall_status_with_celery_beat("healthy", "ok") == "healthy"
    assert merge_api_overall_status_with_celery_beat("unhealthy", "stale") == "unhealthy"
