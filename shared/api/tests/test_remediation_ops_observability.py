#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Regression checks for remediation workstream 5 observability hooks and alarm contracts.
# Invariants:
# - Runtime retries/latency telemetry must be wired for embedding + rerank paths.
# - Queue alarm hooks must expose beat/worker and sustained depth/age signals.
# Related:
# - api/monitoring/metrics.py
# - api/core/database_manager.py
# - api/services/chat_memory_service.py
# - api/services/rerank_client.py
# ---
"""Ops observability remediation regression tests."""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest

from api.monitoring import metrics

API_ROOT = Path(__file__).resolve().parents[1]

_ALARM_NAMES = (
    "beat_on_workers_off",
    "queue_depth_sustained",
    "queue_age_sustained",
)


@pytest.fixture(autouse=True)
def reset_metrics_alarm_state() -> Iterator[None]:
    metrics._alarm_breach_since.clear()
    for alarm in _ALARM_NAMES:
        metrics.set_ops_alarm_state(alarm=alarm, active=False)
    yield
    metrics._alarm_breach_since.clear()


def _alarm_gauge_active(alarm: str) -> bool:
    return metrics.ops_alarm_state.labels(alarm=alarm)._value.get() == 1.0


def _read(rel_path: str) -> str:
    return (API_ROOT / rel_path).read_text(encoding="utf-8")


def test_metrics_registry_contains_runtime_retry_and_alarm_contracts() -> None:
    source = _read("monitoring/metrics.py")
    assert "event_loop_lag_seconds" in source
    assert "embedding_request_duration_seconds" in source
    assert "embedding_retry_outcomes_total" in source
    assert "rerank_request_duration_seconds" in source
    assert "rerank_retry_outcomes_total" in source
    assert "queue_duplicate_suppression_total" in source
    assert "ops_alarm_state" in source
    assert "update_ugs_queue_alarm_states" in source
    assert "update_beat_workers_off_alarm" in source


def test_database_manager_records_event_loop_lag_metric() -> None:
    source = _read("core/database_manager.py")
    assert "observe_event_loop_lag" in source
    assert "lag_seconds = max(0.0" in source


def test_observe_event_loop_lag_updates_prometheus_gauge() -> None:
    metrics.observe_event_loop_lag(lag_seconds=0.05)
    assert metrics.event_loop_lag_seconds._value.get() == 0.05


def test_embedding_and_rerank_paths_emit_latency_and_retry_metrics() -> None:
    chat_memory = _read("services/chat_memory_service.py")
    rerank_client = _read("services/rerank_client.py")
    assert "observe_embedding_request" in chat_memory
    assert "observe_embedding_retry" in chat_memory
    assert 'operation="chat_memory_single"' in chat_memory
    assert 'operation="chat_memory_batch"' in chat_memory
    assert "observe_rerank_request" in rerank_client
    assert "observe_rerank_retry" in rerank_client


def test_queue_alarm_and_duplicate_suppression_hooks_are_wired() -> None:
    queue_ops = _read("services/ugs/queue_ops_snapshot.py")
    queue_mgr = _read("services/ugs/queue_manager_service.py")
    dedup = _read("ewa_platform/companion/turn/turn_dedup.py")
    rabbit = _read("services/rabbitmq_service.py")
    assert "update_beat_workers_off_alarm" in queue_ops
    assert "beat_on_workers_off" in queue_ops
    assert "update_ugs_queue_alarm_states" in queue_mgr
    assert "observe_queue_duplicate_suppression" in dedup
    assert "rabbitmq_queue_messages_unacked" in rabbit


def test_beat_on_workers_off_alarm_activates_when_beat_enabled_backlog_and_no_leases() -> None:
    active = metrics.update_beat_workers_off_alarm(
        beat_enabled=True,
        active_worker_leases=0,
        backlog_total=3,
    )
    assert active is True
    assert _alarm_gauge_active("beat_on_workers_off") is True


@pytest.mark.parametrize(
    ("beat_enabled", "active_worker_leases", "backlog_total"),
    [
        (False, 0, 5),
        (True, 0, 0),
        (True, 1, 5),
        (True, 2, 10),
    ],
)
def test_beat_on_workers_off_alarm_stays_inactive_without_full_breach(
    beat_enabled: bool,
    active_worker_leases: int,
    backlog_total: int,
) -> None:
    active = metrics.update_beat_workers_off_alarm(
        beat_enabled=beat_enabled,
        active_worker_leases=active_worker_leases,
        backlog_total=backlog_total,
    )
    assert active is False
    assert _alarm_gauge_active("beat_on_workers_off") is False


def test_beat_on_workers_off_alarm_treats_none_leases_as_zero() -> None:
    active = metrics.update_beat_workers_off_alarm(
        beat_enabled=True,
        active_worker_leases=None,
        backlog_total=1,
    )
    assert active is True
    assert _alarm_gauge_active("beat_on_workers_off") is True


def test_queue_depth_sustained_alarm_activates_after_sustained_breach(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(metrics, "_QUEUE_DEPTH_ALARM_THRESHOLD", 10)
    monkeypatch.setattr(metrics, "_SUSTAINED_ALARM_SECONDS", 60)
    clock = {"now": 1_000.0}
    monkeypatch.setattr(metrics.time, "monotonic", lambda: clock["now"])

    first = metrics.update_ugs_queue_alarm_states(total_queued=15, pending_oldest_age_seconds=None)
    assert first == {"queue_depth_sustained": False, "queue_age_sustained": False}
    assert _alarm_gauge_active("queue_depth_sustained") is False

    clock["now"] = 1_030.0
    mid = metrics.update_ugs_queue_alarm_states(total_queued=15, pending_oldest_age_seconds=None)
    assert mid["queue_depth_sustained"] is False
    assert _alarm_gauge_active("queue_depth_sustained") is False

    clock["now"] = 1_060.0
    sustained = metrics.update_ugs_queue_alarm_states(total_queued=15, pending_oldest_age_seconds=None)
    assert sustained["queue_depth_sustained"] is True
    assert _alarm_gauge_active("queue_depth_sustained") is True


def test_queue_depth_sustained_alarm_clears_when_breach_ends(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(metrics, "_QUEUE_DEPTH_ALARM_THRESHOLD", 10)
    monkeypatch.setattr(metrics, "_SUSTAINED_ALARM_SECONDS", 60)
    clock = {"now": 2_000.0}
    monkeypatch.setattr(metrics.time, "monotonic", lambda: clock["now"])

    metrics.update_ugs_queue_alarm_states(total_queued=15, pending_oldest_age_seconds=None)
    clock["now"] = 2_060.0
    active = metrics.update_ugs_queue_alarm_states(total_queued=15, pending_oldest_age_seconds=None)
    assert active["queue_depth_sustained"] is True

    cleared = metrics.update_ugs_queue_alarm_states(total_queued=5, pending_oldest_age_seconds=None)
    assert cleared == {"queue_depth_sustained": False, "queue_age_sustained": False}
    assert _alarm_gauge_active("queue_depth_sustained") is False
    assert "queue_depth_sustained" not in metrics._alarm_breach_since
