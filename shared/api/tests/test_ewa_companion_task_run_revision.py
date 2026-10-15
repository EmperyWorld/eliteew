# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for ``run_revision`` optimistic concurrency on companion task runs (persistence layer).
# Invariants:
# - No live Postgres — fake asyncpg pool/connection only.
# Related:
# - api/ewa_platform/persistence_pg/companion_asyncpg.py
# - api/ewa_platform/migrations/applied/018_ewa_companion_task_runs_revision.sql
# ---

from __future__ import annotations

import asyncio
import json
from datetime import UTC, datetime
from typing import Any

import pytest

from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg


class _FakeTransaction:
    async def __aenter__(self) -> _FakeTransaction:
        return self

    async def __aexit__(self, *_args: object) -> None:
        return None


def _base_run_row(*, run_revision: int = 1, status: str = "pending") -> dict[str, Any]:
    now = datetime(2026, 5, 27, 12, 0, 0, tzinfo=UTC)
    return {
        "id": "run-1",
        "principal_id": "principal-1",
        "status": status,
        "intent_kind": "music_generation",
        "user_message": "make a song",
        "plan_payload": {},
        "confirmation_state": {},
        "result_payload": {},
        "error_payload": {},
        "execution_mode": "sync",
        "workflow_id": None,
        "workflow_version": None,
        "run_revision": run_revision,
        "created_at": now,
        "updated_at": now,
        "completed_at": None,
    }


class _FakeConn:
    """Minimal asyncpg connection double for ``companion_task_run_update``."""

    def __init__(self, *, run_revision: int = 1, status: str = "pending") -> None:
        self.run_revision = run_revision
        self.status = status
        self.audit_calls: list[dict[str, Any]] = []

    def transaction(self) -> _FakeTransaction:
        return _FakeTransaction()

    async def fetchrow(self, query: str, *args: Any) -> dict[str, Any] | None:
        _run_id, _principal_id, status, _rp, _ep, _cs, _pp, terminal, expect_revision = args
        if expect_revision is not None and int(expect_revision) != self.run_revision:
            return None
        if self.status in {"completed", "cancelled"} and self.status != str(status):
            return None
        self.run_revision += 1
        self.status = str(status)
        row = _base_run_row(run_revision=self.run_revision, status=self.status)
        if terminal:
            row["completed_at"] = row["updated_at"]
        return row

    async def execute(self, query: str, *args: Any) -> None:
        if "ewa_companion_profile_audit" in query:
            self.audit_calls.append(
                {
                    "principal_id": args[0],
                    "action": args[1],
                    "detail": json.loads(str(args[2])),
                }
            )


class _FakeAcquire:
    def __init__(self, conn: _FakeConn) -> None:
        self._conn = conn

    async def __aenter__(self) -> _FakeConn:
        return self._conn

    async def __aexit__(self, *_args: object) -> None:
        return None


class _FakePool:
    def __init__(self, conn: _FakeConn) -> None:
        self._conn = conn

    def acquire(self) -> _FakeAcquire:
        return _FakeAcquire(self._conn)


@pytest.mark.unit
def test_task_run_from_row_exposes_run_revision() -> None:
    row = _base_run_row(run_revision=4)
    out = companion_pg._task_run_from_row(row)
    assert out is not None
    assert out["run_revision"] == 4


@pytest.mark.unit
def test_task_run_from_row_defaults_run_revision_when_missing() -> None:
    row = _base_run_row(run_revision=1)
    del row["run_revision"]
    out = companion_pg._task_run_from_row(row)
    assert out is not None
    assert out["run_revision"] == 1


@pytest.mark.unit
def test_task_run_update_increments_revision_without_expect_revision() -> None:
    conn = _FakeConn(run_revision=2)
    pool = _FakePool(conn)

    out = asyncio.run(
        companion_pg.companion_task_run_update(
            pool,
            run_id="run-1",
            principal_id="principal-1",
            status="running",
        )
    )

    assert out is not None
    assert out["run_revision"] == 3
    assert out["status"] == "running"
    assert conn.run_revision == 3
    assert conn.audit_calls and conn.audit_calls[0]["action"] == "companion_task_run_update"


@pytest.mark.unit
def test_task_run_update_succeeds_when_expect_revision_matches() -> None:
    conn = _FakeConn(run_revision=5)
    pool = _FakePool(conn)

    out = asyncio.run(
        companion_pg.companion_task_run_update(
            pool,
            run_id="run-1",
            principal_id="principal-1",
            status="completed",
            expect_revision=5,
        )
    )

    assert out is not None
    assert out["run_revision"] == 6
    assert out["status"] == "completed"
    assert out["completed_at"] is not None


@pytest.mark.unit
def test_task_run_update_returns_none_on_revision_mismatch() -> None:
    conn = _FakeConn(run_revision=3)
    pool = _FakePool(conn)

    out = asyncio.run(
        companion_pg.companion_task_run_update(
            pool,
            run_id="run-1",
            principal_id="principal-1",
            status="running",
            expect_revision=2,
        )
    )

    assert out is None
    assert conn.run_revision == 3
    assert conn.audit_calls == []


@pytest.mark.unit
def test_task_run_update_refuses_to_reactivate_completed_or_cancelled_runs() -> None:
    for protected_status in ("completed", "cancelled"):
        conn = _FakeConn(run_revision=7, status=protected_status)
        pool = _FakePool(conn)

        out = asyncio.run(
            companion_pg.companion_task_run_update(
                pool,
                run_id="run-1",
                principal_id="principal-1",
                status="running",
            )
        )

        assert out is None
        assert conn.run_revision == 7
        assert conn.status == protected_status
        assert conn.audit_calls == []
