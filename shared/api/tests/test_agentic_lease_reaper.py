# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Phase 4.1.3 — lease reaper and gate sweep unit tests.
# ---

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import pytest

from api.ewa_platform.agentic.jobs.executor import (
    reclaim_stale_agentic_leases,
    sweep_expired_agentic_gates,
)
from api.ewa_platform.agentic.kernel import state_machine as fsm


class _FakeTransaction:
    async def __aenter__(self) -> _FakeTransaction:
        return self

    async def __aexit__(self, *_args: object) -> None:
        return None


class _FakeConn:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.rows = rows
        self.executed: list[tuple[str, tuple[Any, ...]]] = []

    def transaction(self) -> _FakeTransaction:
        return _FakeTransaction()

    async def fetch(self, query: str, *args: Any) -> list[dict[str, Any]]:
        q = query.strip().lower()
        if "leased_until" in q:
            return self.rows
        if "awaiting_human" in q or "status = $1" in q:
            return self.rows
        return []

    async def execute(self, query: str, *args: Any) -> None:
        self.executed.append((query, args))


class _FakeConnContext:
    def __init__(self, conn: _FakeConn) -> None:
        self._conn = conn

    async def __aenter__(self) -> _FakeConn:
        return self._conn

    async def __aexit__(self, *_args: object) -> None:
        return None


class _FakePool:
    def __init__(self, conn: _FakeConn) -> None:
        self._conn = conn

    def acquire(self) -> _FakeConnContext:
        return _FakeConnContext(self._conn)


async def _async_none() -> None:
    return None


@pytest.mark.asyncio
async def test_reclaim_stale_agentic_leases_releases_and_counts(monkeypatch: pytest.MonkeyPatch) -> None:
    enqueued: list[dict[str, Any]] = []

    def _fake_enqueue(**kwargs: Any) -> None:
        enqueued.append(dict(kwargs))

    monkeypatch.setattr(
        "api.ewa_platform.agentic.jobs.executor.enqueue_agentic_loop_tick",
        lambda **kw: _fake_enqueue(**kw),
    )
    monkeypatch.setattr(
        "api.ewa_platform.agentic.jobs.executor.conn_execute_release",
        lambda *_a, **_k: _async_none(),
    )

    rows = [
        {"id": "sess-a", "principal_id": "p-1", "session_revision": 3},
        {"id": "sess-b", "principal_id": "p-2", "session_revision": 1},
    ]
    pool = _FakePool(_FakeConn(rows))
    count = await reclaim_stale_agentic_leases(pool)  # type: ignore[arg-type]
    assert count == 2
    assert [e["session_id"] for e in enqueued] == ["sess-a", "sess-b"]
    assert all(e.get("expected_revision") is None for e in enqueued)


@pytest.mark.asyncio
async def test_sweep_expired_agentic_gates_skips_fresh_gate(monkeypatch: pytest.MonkeyPatch) -> None:
    future = (datetime.now(tz=UTC) + timedelta(hours=1)).isoformat()
    rows = [
        {
            "id": "sess-g1",
            "principal_id": "p-1",
            "session_revision": 2,
            "gate_json": {"expires_at": future},
            "policy_json": {},
        }
    ]
    pool = _FakePool(_FakeConn(rows))
    count = await sweep_expired_agentic_gates(pool)  # type: ignore[arg-type]
    assert count == 0


@pytest.mark.asyncio
async def test_sweep_expired_agentic_gates_transitions_expired(monkeypatch: pytest.MonkeyPatch) -> None:
    past = (datetime.now(tz=UTC) - timedelta(hours=1)).isoformat()
    rows = [
        {
            "id": "sess-g2",
            "principal_id": "p-1",
            "session_revision": 4,
            "gate_json": {"expires_at": past, "kind": "confirm"},
            "policy_json": {"gate_on_timeout": "pause"},
        }
    ]
    transitions: list[str] = []

    async def _fake_transition(*_a: Any, **kwargs: Any) -> Any:
        from api.ewa_platform.agentic.kernel.state_machine import TransitionResult

        transitions.append(str(kwargs.get("event")))
        return TransitionResult(
            ok=True,
            session={
                "id": "sess-g2",
                "principal_id": "p-1",
                "status": fsm.STATUS_PAUSED,
                "linked_task_run_id": "run-g2",
            },
        )

    synced: list[str] = []

    async def _fake_sync(*_a: Any, **kwargs: Any) -> dict[str, Any]:
        synced.append(str(kwargs["session"]["id"]))
        return {"id": "run-g2", "status": "running"}

    monkeypatch.setattr(
        "api.ewa_platform.agentic.kernel.state_machine.apply_session_transition",
        _fake_transition,
    )
    monkeypatch.setattr(
        "api.ewa_platform.agentic.jobs.executor.safe_sync_and_publish_task_run_from_session",
        _fake_sync,
    )
    pool = _FakePool(_FakeConn(rows))
    count = await sweep_expired_agentic_gates(pool)  # type: ignore[arg-type]
    assert count == 1
    assert transitions == ["gate_timeout_pause"]
    assert synced == ["sess-g2"]
