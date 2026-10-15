# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral tests for Admin workers-ops Celery snapshot / revoke / purge / pool matching.
# Invariants:
# - Inspect and broker I/O are mocked; no live Redis required.
# Related:
# - api/services/workers_ops/snapshot.py
# - api/services/workers_ops/pools.py
# - api/services/workers_ops/inspect_celery.py
# ---
"""Tests for workers_ops package."""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from api.services.workers_ops import actions, catalog, pools, queue_depths, snapshot
from api.services.workers_ops import celery_workers_ops_service as svc


class _FakeInspect:
    def __init__(self, **payload: Any) -> None:
        self._payload = payload

    def ping(self) -> dict[str, Any]:
        return self._payload.get(
            "ping",
            {
                "worker@h1": {"ok": "pong"},
                "agentic-worker@h2": {"ok": "pong"},
                "companion-worker@h3": {"ok": "pong"},
            },
        )

    def stats(self) -> dict[str, Any]:
        return self._payload.get("stats", {"worker@h1": {"pool": {"max-concurrency": 2}}})

    def active_queues(self) -> dict[str, Any]:
        return self._payload.get(
            "active_queues",
            {
                "worker@h1": [{"name": "short"}, {"name": "maintenance"}],
                "agentic-worker@h2": [{"name": "ewa_agentic"}, {"name": "ewa_agentic_step"}],
                "companion-worker@h3": [{"name": "ewa_companion"}],
            },
        )

    def active(self) -> dict[str, Any]:
        return self._payload.get(
            "active",
            {"worker@h1": [{"id": "t1", "name": "api.tasks.demo", "args": [], "kwargs": {}}]},
        )

    def reserved(self) -> dict[str, Any]:
        return self._payload.get("reserved", {})

    def scheduled(self) -> dict[str, Any]:
        return self._payload.get("scheduled", {})

    def registered(self) -> dict[str, Any]:
        return self._payload.get("registered", {"worker@h1": ["api.tasks.demo"]})


@pytest.mark.asyncio
async def test_build_workers_ops_snapshot_shapes() -> None:
    fake_app = MagicMock()
    fake_app.control.inspect.return_value = _FakeInspect()
    fake_app.conf.task_queues = (
        SimpleNamespace(name="short", routing_key="short"),
        SimpleNamespace(name="maintenance", routing_key="maintenance"),
    )
    fake_app.conf.task_default_queue = "short"
    fake_app.conf.beat_schedule = {
        "demo-beat": {"task": "api.tasks.demo", "schedule": 60},
    }
    fake_app.conf.task_annotations = {
        "*": {"rate_limit": "100/m"},
        "api.tasks.demo": {"rate_limit": None},
    }

    mock_depths = {"status": "ok", "error": None, "depths": {"short": 2, "maintenance": 0}}
    mock_policy = {"default_rate_limit": "100/m", "exempt_tasks": ["api.tasks.demo"]}

    db = MagicMock()
    with (
        patch("api.tasks.celery_app.celery_app", fake_app),
        patch.object(snapshot, "celery_queue_depths", return_value=mock_depths),
        patch.object(snapshot, "celery_rate_limit_policy", return_value=mock_policy),
        patch(
            "api.monitoring.metrics.build_celery_beat_health_slice",
            new_callable=AsyncMock,
            return_value={"status": "ok", "stale": False, "last_success_unix": 1.0},
        ),
        patch(
            "api.services.ugs.queue_ops_snapshot.build_queue_ops_snapshot",
            new_callable=AsyncMock,
            return_value={
                "rabbitmq": {"ok": True},
                "redis_leases": {"active_count": 1},
            },
        ),
    ):
        snap = await snapshot.build_workers_ops_snapshot(db)

    assert snap["celery"]["status"] == "ok"
    assert "worker@h1" in snap["celery"]["workers_online"]
    assert snap["celery"]["active"][0]["id"] == "t1"
    assert any(q["name"] == "short" for q in snap["celery"]["queues"])
    assert snap["celery"]["queue_depths"] == mock_depths
    assert snap["celery"]["rate_limit_policy"] == mock_policy
    assert snap["celery"]["inspect_phases"]["essential_sec"] is not None
    assert snap["beat"]["health"]["stale"] is False
    assert snap["rabbitmq"]["redis_leases"]["active_count"] == 1
    pool_ids = {p["id"] for p in snap["expected_pools"]}
    assert "celery-general" in pool_ids
    assert "celery-beat" in pool_ids
    general = next(p for p in snap["expected_pools"] if p["id"] == "celery-general")
    assert general["online"] is True
    assert "worker@h1" in general["matched_workers"]
    agentic = next(p for p in snap["expected_pools"] if p["id"] == "celery-agentic")
    assert agentic["online"] is True
    companion = next(p for p in snap["expected_pools"] if p["id"] == "celery-companion")
    assert companion["online"] is True
    rmq = next(p for p in snap["expected_pools"] if p["id"] == "queue-worker")
    assert rmq["online"] is True
    for pool in snap["expected_pools"]:
        assert str(pool["container"]).endswith("-prod-baked")


def test_match_expected_pools_hostname_without_queues() -> None:
    celery_slice = {
        "workers_online": ["worker@x", "agentic-worker@y", "companion-worker@z"],
        "active_queues": {},
    }
    beat_slice = {"status": "ok", "stale": False, "last_success_unix": 1.0}
    rows = pools.match_expected_pools(celery_slice, beat_slice)
    by_id = {r["id"]: r for r in rows}
    assert by_id["celery-general"]["online"] is True
    assert by_id["celery-agentic"]["online"] is True
    assert by_id["celery-companion"]["online"] is True
    assert by_id["celery-beat"]["online"] is True


def test_workers_matching_prefixes_excludes_agentic_from_general() -> None:
    matched = pools.workers_matching_prefixes(
        ["worker@a", "agentic-worker@b", "companion-worker@c"],
        ("worker@",),
    )
    assert matched == ["worker@a"]


def test_celery_queue_depths_degrades_on_redis_failure() -> None:
    fake_app = MagicMock()
    fake_app.conf.task_queues = (SimpleNamespace(name="short", routing_key="short"),)
    fake_app.conf.task_default_queue = "short"
    with (
        patch("api.tasks.celery_app.celery_app", fake_app),
        patch.object(queue_depths, "celery_redis_client", return_value=None),
    ):
        depths = queue_depths.celery_queue_depths()

    assert depths["status"] == "degraded"
    assert depths["depths"] == {}
    assert depths["error"] == "redis_unavailable"


def test_celery_rate_limit_policy_from_annotations() -> None:
    fake_app = MagicMock()
    fake_app.conf.task_annotations = {
        "*": {"rate_limit": "100/m"},
        "api.tasks.alpha": {"rate_limit": None},
        "api.tasks.beta": {"rate_limit": "10/m"},
    }
    with patch("api.tasks.celery_app.celery_app", fake_app):
        policy = catalog.celery_rate_limit_policy()

    assert policy["default_rate_limit"] == "100/m"
    assert policy["exempt_tasks"] == ["api.tasks.alpha"]


def test_purge_rejects_unknown_queue() -> None:
    fake_app = MagicMock()
    fake_app.conf.task_queues = (SimpleNamespace(name="short", routing_key="short"),)
    fake_app.conf.task_default_queue = "short"
    with patch("api.tasks.celery_app.celery_app", fake_app):
        with pytest.raises(ValueError, match="queue_not_allowed"):
            actions.purge_celery_queue("not-a-real-queue")


def test_purge_allowed_queue_calls_broker() -> None:
    channel = MagicMock()
    channel.queue_purge.return_value = 3
    conn = MagicMock()
    conn.default_channel = channel
    cm = MagicMock()
    cm.__enter__.return_value = conn
    cm.__exit__.return_value = None

    fake_app = MagicMock()
    fake_app.conf.task_queues = (SimpleNamespace(name="short", routing_key="short"),)
    fake_app.conf.task_default_queue = "short"
    fake_app.connection_or_acquire.return_value = cm

    with patch("api.tasks.celery_app.celery_app", fake_app):
        result = actions.purge_celery_queue("short")

    assert result == {"ok": True, "queue": "short", "purged": 3}
    channel.queue_purge.assert_called_once_with("short")


def test_revoke_calls_control() -> None:
    fake_app = MagicMock()
    with patch("api.tasks.celery_app.celery_app", fake_app):
        result = actions.revoke_celery_task("abc-123", terminate=True)

    fake_app.control.revoke.assert_called_once_with("abc-123", terminate=True)
    assert result["ok"] is True
    assert result["terminate"] is True


def test_revoke_requires_task_id() -> None:
    with pytest.raises(ValueError, match="task_id_required"):
        actions.revoke_celery_task("  ")


def test_facade_reexports_public_api() -> None:
    assert callable(svc.build_workers_ops_snapshot)
    assert callable(svc.known_celery_queue_names)
    assert callable(svc.purge_celery_queue)
    assert callable(svc.revoke_celery_task)
