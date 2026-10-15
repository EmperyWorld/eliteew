# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Gate G2 regression locks for no-lease orphan session sweeper.
# Related:
# - documentation/product/ewa/EWA-FORENSIC-AUDIT-RECOVERY-PLAN-2026-07-09.md (Gate G2)
# - api/ewa_platform/agentic/jobs/executor.py
# ---

from __future__ import annotations

from typing import Any

import pytest

from api.ewa_platform.agentic.jobs.executor import (
    WM_ORPHAN_SWEEP_COUNT,
    sweep_orphaned_agentic_sessions,
)


class _FakeTransaction:
    async def __aenter__(self) -> _FakeTransaction:
        return self

    async def __aexit__(self, *_args: object) -> None:
        return None


class _FakeConn:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.rows = rows

    def transaction(self) -> _FakeTransaction:
        return _FakeTransaction()

    async def fetch(self, query: str, *args: Any) -> list[dict[str, Any]]:
        q = query.strip().lower()
        if "leased_until is null" in q:
            return self.rows
        return []

    async def execute(self, query: str, *args: Any) -> None:
        return None


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


@pytest.mark.asyncio
async def test_orphan_sweep_reenqueues_without_revision(monkeypatch: pytest.MonkeyPatch) -> None:
    enqueued: list[dict[str, Any]] = []
    updates: list[dict[str, Any]] = []

    def _enqueue_loop(**kwargs: Any) -> str:
        enqueued.append(dict(kwargs))
        return "loop-1"

    async def _update(*_a: Any, **kwargs: Any) -> dict[str, Any]:
        updates.append(dict(kwargs))
        return {
            "id": kwargs["session_id"],
            "principal_id": kwargs["principal_id"],
            "status": "planning",
            "session_revision": 2,
            "working_memory_json": kwargs.get("working_memory_json") or {},
        }

    monkeypatch.setenv("EWA_AGENTIC_ORPHAN_MAX_RECOVERIES", "3")
    monkeypatch.setenv("EWA_AGENTIC_STEP_SCHEDULER_ENABLED", "0")
    monkeypatch.setattr(
        "api.ewa_platform.agentic.jobs.executor.enqueue_agentic_loop_tick",
        _enqueue_loop,
    )
    monkeypatch.setattr(
        "api.ewa_platform.agentic.jobs.executor.enqueue_agentic_step",
        lambda **_k: "step-1",
    )
    monkeypatch.setattr(
        "api.ewa_platform.persistence_pg.agentic_asyncpg.agentic_session_update",
        _update,
    )

    rows = [
        {
            "id": "sess-orphan",
            "principal_id": "p-1",
            "session_revision": 1,
            "status": "planning",
            "working_memory_json": {},
            "updated_at": None,
        },
    ]
    count = await sweep_orphaned_agentic_sessions(_FakePool(_FakeConn(rows)))  # type: ignore[arg-type]
    assert count == 1
    assert len(enqueued) == 1
    assert enqueued[0]["session_id"] == "sess-orphan"
    assert enqueued[0].get("expected_revision") is None
    assert updates[0]["working_memory_json"][WM_ORPHAN_SWEEP_COUNT] == 1


@pytest.mark.asyncio
async def test_orphan_sweep_terminalizes_after_max_recoveries(monkeypatch: pytest.MonkeyPatch) -> None:
    terminalized: list[str] = []

    async def _terminalize(*_a: Any, **kwargs: Any) -> dict[str, Any]:
        terminalized.append(str(kwargs["session_id"]))
        return {"id": kwargs["session_id"], "status": "failed"}

    monkeypatch.setenv("EWA_AGENTIC_ORPHAN_MAX_RECOVERIES", "2")
    monkeypatch.setattr(
        "api.ewa_platform.agentic.jobs.executor.terminalize_session_nonretryable",
        _terminalize,
    )
    monkeypatch.setattr(
        "api.ewa_platform.agentic.jobs.executor.enqueue_agentic_loop_tick",
        lambda **_k: None,
    )

    rows = [
        {
            "id": "sess-dead",
            "principal_id": "p-1",
            "session_revision": 9,
            "status": "executing",
            "working_memory_json": {WM_ORPHAN_SWEEP_COUNT: 2},
            "updated_at": None,
        },
    ]
    count = await sweep_orphaned_agentic_sessions(_FakePool(_FakeConn(rows)))  # type: ignore[arg-type]
    assert count == 1
    assert terminalized == ["sess-dead"]


@pytest.mark.asyncio
async def test_orphan_sweep_executing_enqueues_step_when_scheduler_on(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    steps: list[str] = []
    loops: list[str] = []

    async def _update(*_a: Any, **kwargs: Any) -> dict[str, Any]:
        return {
            "id": kwargs["session_id"],
            "status": "executing",
            "working_memory_json": kwargs.get("working_memory_json") or {},
        }

    monkeypatch.setenv("EWA_AGENTIC_ORPHAN_MAX_RECOVERIES", "5")
    monkeypatch.setattr(
        "api.ewa_platform.agentic.jobs.executor.agentic_step_scheduler_enabled",
        lambda: True,
    )
    monkeypatch.setattr(
        "api.ewa_platform.agentic.jobs.executor.enqueue_agentic_step",
        lambda **kw: steps.append(str(kw["session_id"])) or "step-x",
    )
    monkeypatch.setattr(
        "api.ewa_platform.agentic.jobs.executor.enqueue_agentic_loop_tick",
        lambda **kw: loops.append(str(kw["session_id"])) or "loop-x",
    )
    monkeypatch.setattr(
        "api.ewa_platform.persistence_pg.agentic_asyncpg.agentic_session_update",
        _update,
    )

    rows = [
        {
            "id": "sess-exec",
            "principal_id": "p-1",
            "session_revision": 4,
            "status": "executing",
            "working_memory_json": {},
            "updated_at": None,
        },
    ]
    count = await sweep_orphaned_agentic_sessions(_FakePool(_FakeConn(rows)))  # type: ignore[arg-type]
    assert count == 1
    assert steps == ["sess-exec"]
    assert loops == []
