# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for UGS operator queue snapshot (hints, tuning reader, RabbitMQ snapshot shape).
# Invariants:
# - Tests do not require live RabbitMQ, Redis, or Postgres.
# Related:
# - api/services/ugs/queue_ops_snapshot.py
# ---
"""Tests for UGS queue_ops_snapshot (operator tooling, no Prometheus)."""

from __future__ import annotations

import pytest

from api.services.rabbitmq_service import fetch_rabbitmq_queues_snapshot
from api.services.ugs.queue_ops_snapshot import (
    _build_hints,
    _normalize_stale_candidates,
    _read_worker_tuning_snapshot,
    build_operator_slo,
)


def test_read_worker_tuning_snapshot_defaults() -> None:
    snap = _read_worker_tuning_snapshot()
    assert snap["queue_worker_prefetch_count"] == 1
    assert snap["queue_worker_max_attempts"] == 3
    assert snap["stale_horizons"]["pending_orphan_minutes"] == 30


def test_build_hints_dlq_warning() -> None:
    hints = _build_hints(
        postgres_stats={"pending_oldest_age_seconds": 10},
        stale_candidates={},
        rabbitmq={
            "ok": True,
            "queues": [{"name": "ai.generation.queue.dlq", "messages_ready": 2, "messages_unacknowledged": 0}],
        },
        redis_leases={"available": True, "active_leases": 0, "truncated": False},
    )
    codes = {h["code"] for h in hints}
    assert "dlq_messages_ready" in codes


def test_normalize_stale_candidates_exposes_canonical_and_legacy_keys() -> None:
    normalized = _normalize_stale_candidates(
        {
            "stale_pending_orphaned": 2,
            "stale_pending_queue_timeout": 3,
            "stale_processing_timeout": 4,
        }
    )
    assert normalized["pending_orphan"] == 2
    assert normalized["pending_in_queue"] == 3
    assert normalized["processing"] == 4
    assert normalized["total"] == 9
    assert normalized["stale_pending_orphaned"] == 2
    assert normalized["stale_pending_queue_timeout"] == 3
    assert normalized["stale_processing_timeout"] == 4


def test_build_hints_uses_canonical_stale_total_without_double_counting() -> None:
    stale_candidates = _normalize_stale_candidates(
        {
            "stale_pending_orphaned": 1,
            "stale_pending_queue_timeout": 2,
            "stale_processing_timeout": 3,
        }
    )

    hints = _build_hints(
        postgres_stats={"pending_oldest_age_seconds": 10},
        stale_candidates=stale_candidates,
        rabbitmq={"ok": True, "queues": []},
        redis_leases={"available": True, "active_leases": 0, "truncated": False},
    )

    stale_hint = next(h for h in hints if h["code"] == "stale_candidates_present")
    assert "Есть 6 кандидат" in stale_hint["message"]
    assert "orphan=1, in_queue=2, processing=3" in stale_hint["message"]
    assert "Есть 18 кандидат" not in stale_hint["message"]


def test_build_hints_warns_when_redis_lease_unavailable() -> None:
    hints = _build_hints(
        postgres_stats={"pending_oldest_age_seconds": 10, "total_queued": 0},
        stale_candidates={},
        rabbitmq={"ok": True, "queues": []},
        redis_leases={"available": False, "active_leases": None, "truncated": None},
    )

    codes = {h["code"] for h in hints}
    assert "redis_lease_unavailable" in codes


def test_build_hints_warns_when_beat_enabled_but_workers_off() -> None:
    hints = _build_hints(
        postgres_stats={"pending_oldest_age_seconds": 10, "total_queued": 3},
        stale_candidates={},
        rabbitmq={"ok": True, "queues": []},
        redis_leases={"available": True, "active_leases": 0, "truncated": False},
    )

    codes = {h["code"] for h in hints}
    assert "beat_on_workers_off" in codes


def test_build_hints_warns_when_rabbitmq_management_snapshot_failed() -> None:
    hints = _build_hints(
        postgres_stats={"pending_oldest_age_seconds": 10, "total_queued": 0},
        stale_candidates={},
        rabbitmq={"ok": False, "error": "connection refused", "queues": []},
        redis_leases={"available": True, "active_leases": 0, "truncated": False},
    )

    codes = {h["code"] for h in hints}
    assert "rabbitmq_management_snapshot_failed" in codes


def test_build_operator_slo_marks_degraded_on_dlq_and_old_queue() -> None:
    slo = build_operator_slo(
        postgres_stats={"pending_oldest_age_seconds": 2000, "total_queued": 3},
        stale_candidates={"total": 0},
        request_statuses={"completed": 80, "failed": 20},
        dlq_failed_24h=2,
    )
    assert slo["level"] == "degraded"
    assert slo["pending_oldest_age_seconds"] == 2000.0
    assert slo["failed_share"] == 0.2
    assert slo["dlq_finalized_failed_24h"] == 2


def test_build_operator_slo_healthy_when_quiet() -> None:
    slo = build_operator_slo(
        postgres_stats={"pending_oldest_age_seconds": 12, "total_queued": 0},
        stale_candidates={"total": 0},
        request_statuses={"completed": 100, "failed": 1},
        dlq_failed_24h=0,
    )
    assert slo["level"] == "healthy"
    assert slo["failed_share"] == 0.0099


@pytest.mark.asyncio
async def test_fetch_rabbitmq_queues_snapshot_disabled() -> None:
    from api.core.database_manager import DatabaseFeatures  # noqa: PLC0415

    original = DatabaseFeatures.ENABLE_RABBITMQ
    DatabaseFeatures.ENABLE_RABBITMQ = False
    try:
        snap = await fetch_rabbitmq_queues_snapshot()
    finally:
        DatabaseFeatures.ENABLE_RABBITMQ = original
    assert snap["ok"] is False
    assert snap["error"] == "rabbitmq_disabled"
