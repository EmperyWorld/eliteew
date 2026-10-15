# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Gate E6 locks for durable EWA ops heartbeat/reaper metrics and Prometheus alarm refresh.
# Invariants:
# - Redis failures remain best-effort; missing heartbeat is not an alarm by default.
# - API /metrics must be able to refresh worker-emitted state from Redis.
# Related:
# - api/monitoring/metrics.py
# - documentation/product/ewa/EWA-ECOSYSTEM-VULNERABILITY-MAP-2026-07-09.md (E6)
# ---

from __future__ import annotations

import asyncio
from collections.abc import Callable, Coroutine
from pathlib import Path
from typing import Any

import pytest

from api.monitoring import metrics

API_ROOT = Path(__file__).resolve().parents[1]


class _FakeRedis:
    def __init__(self) -> None:
        self.strings: dict[str, str] = {}
        self.hashes: dict[str, dict[str, str]] = {}

    async def set(self, key: str, value: str) -> None:
        self.strings[key] = str(value)

    async def get(self, key: str) -> str | None:
        return self.strings.get(key)

    async def hset(self, key: str, *, mapping: dict[str, str]) -> int:
        self.hashes.setdefault(key, {}).update(mapping)
        return len(mapping)

    async def hgetall(self, key: str) -> dict[str, str]:
        return dict(self.hashes.get(key, {}))


@pytest.fixture(autouse=True)
def _reset_e6_alarm_state() -> None:  # pyright: ignore[reportUnusedFunction]
    for alarm in (
        "ewa_celery_beat_stale",
        "ewa_companion_generic_orphans_sustained",
        "ewa_media_orphans_sustained",
    ):
        metrics._alarm_breach_since.pop(alarm, None)
        metrics.set_ops_alarm_state(alarm=alarm, active=False)


def _read(rel_path: str) -> str:
    return (API_ROOT / rel_path).read_text(encoding="utf-8")


def _alarm_gauge_active(alarm: str) -> bool:
    return metrics.ops_alarm_state.labels(alarm=alarm)._value.get() == 1.0


def test_metrics_registry_contains_ewa_e6_contracts() -> None:
    source = _read("monitoring/metrics.py")
    for name in (
        "ewa_celery_beat_last_success_timestamp_seconds",
        "ewa_companion_reaper_last_reaped",
        "ewa_companion_reaper_last_success_timestamp_seconds",
        "ewa_companion_reaper_runs_total",
        "ewa_companion_job_enqueue_total",
        "ewa_companion_job_execute_total",
        "record_ewa_celery_beat_success",
        "record_ewa_universal_reaper_sweep",
        "refresh_ewa_ops_observability_from_redis",
    ):
        assert name in source


def test_record_universal_reaper_sweep_writes_redis_and_gauges(monkeypatch: pytest.MonkeyPatch) -> None:
    redis = _FakeRedis()
    monkeypatch.setattr(metrics, "_get_ewa_ops_redis_client", lambda: _async_value(redis))
    monkeypatch.setattr(metrics.time, "time", lambda: 1_000.0)
    monkeypatch.setattr(metrics, "_run_ewa_ops_redis_coro", _run_coro_now)

    metrics.record_ewa_universal_reaper_sweep(
        counts={
            "music": 2,
            "image": 3,
            "presentation": 0,
            "generic": 1,
            "agentic_orphans_swept": 4,
        },
        ok=True,
    )

    assert redis.strings[metrics.EWA_REAPER_LAST_SUCCESS_KEY] == "1000.0"
    assert redis.hashes[metrics.EWA_REAPER_LAST_REAPED_KEY] == {
        "music": "2",
        "image": "3",
        "presentation": "0",
        "generic": "1",
        "agentic_orphans_swept": "4",
    }
    assert metrics.ewa_companion_reaper_last_reaped.labels(domain="generic")._value.get() == 1.0
    assert metrics.ewa_companion_reaper_last_success_timestamp_seconds._value.get() == 1_000.0


def test_refresh_from_redis_marks_stale_beat_when_timestamp_old(monkeypatch: pytest.MonkeyPatch) -> None:
    redis = _FakeRedis()
    redis.strings[metrics.EWA_CELERY_BEAT_LAST_SUCCESS_KEY] = "1000"
    redis.strings[metrics.EWA_REAPER_LAST_SUCCESS_KEY] = "1500"
    redis.hashes[metrics.EWA_REAPER_LAST_REAPED_KEY] = {
        "music": "0",
        "image": "0",
        "presentation": "0",
        "generic": "0",
        "agentic_orphans_swept": "0",
    }
    monkeypatch.setattr(metrics, "_get_ewa_ops_redis_client", lambda: _async_value(redis))
    monkeypatch.setenv("EWA_CELERY_BEAT_STALE_SECONDS", "600")
    monkeypatch.setattr(metrics.time, "time", lambda: 2_000.0)

    asyncio.run(metrics.refresh_ewa_ops_observability_from_redis_async())

    assert metrics.ewa_celery_beat_last_success_timestamp_seconds._value.get() == 1_000.0
    assert _alarm_gauge_active("ewa_celery_beat_stale") is True


def test_refresh_from_redis_missing_heartbeat_stays_inactive_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    redis = _FakeRedis()
    monkeypatch.setattr(metrics, "_get_ewa_ops_redis_client", lambda: _async_value(redis))
    monkeypatch.delenv("EWA_CELERY_BEAT_STALE_REQUIRE_HEARTBEAT", raising=False)

    asyncio.run(metrics.refresh_ewa_ops_observability_from_redis_async())

    assert _alarm_gauge_active("ewa_celery_beat_stale") is False


def test_e6_emit_sites_are_wired() -> None:
    universal_reaper = _read("tasks/ewa_universal_orphan_reaper.py")
    celery_beat_guard = _read("ewa_platform/workers/celery_beat_guard.py")
    enqueue = _read("ewa_platform/companion/jobs/enqueue.py")
    executor = _read("ewa_platform/companion/jobs/executor.py")
    monitoring = _read("utils/monitoring.py")
    main = _read("main.py")
    oauth = _read("middleware/oauth2_protection.py")

    assert "record_ewa_universal_reaper_sweep" in universal_reaper
    assert "record_ewa_celery_beat_success" in universal_reaper
    assert "record_ewa_celery_beat_success" in celery_beat_guard
    assert "observe_ewa_companion_job_enqueue" in enqueue
    assert "observe_ewa_companion_job_execute_result" in executor
    assert "refresh_ewa_ops_observability_from_redis" in monitoring
    assert "refresh_prometheus_metrics_overlays" in main
    assert 'r"^/metrics$"' in oauth


async def _async_value(value: Any) -> Any:  # noqa: ANN401 - test helper returns arbitrary fake
    return value


def _run_coro_now(factory: Callable[[], Coroutine[Any, Any, Any]]) -> None:
    asyncio.run(factory())
