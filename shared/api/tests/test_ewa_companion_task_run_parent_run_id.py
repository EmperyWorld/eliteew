# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Phase 4.7 contract: parent_run_id column on companion task runs (nested workflow children).
# Invariants:
# - No live Postgres — fake asyncpg pool/connection only.
# Related:
# - api/ewa_platform/persistence_pg/companion_asyncpg.py
# - api/ewa_platform/migrations/applied/021_ewa_companion_task_runs_parent_run_id.sql
# ---

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import Any

import pytest

from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg


def _base_run_row(*, parent_run_id: str | None = None) -> dict[str, Any]:
    now = datetime(2026, 6, 20, 4, 0, 0, tzinfo=UTC)
    return {
        "id": "run-child",
        "principal_id": "principal-1",
        "status": "running",
        "intent_kind": "music_generation_background",
        "user_message": "child",
        "plan_payload": {"workflow_parent_run_id": "run-parent"},
        "confirmation_state": {},
        "result_payload": {},
        "error_payload": {},
        "execution_mode": "async",
        "workflow_id": None,
        "workflow_version": None,
        "run_revision": 1,
        "parent_run_id": parent_run_id,
        "created_at": now,
        "updated_at": now,
        "completed_at": None,
    }


@pytest.mark.unit
def test_task_run_from_row_exposes_parent_run_id() -> None:
    out = companion_pg._task_run_from_row(_base_run_row(parent_run_id="run-parent"))
    assert out is not None
    assert out["parent_run_id"] == "run-parent"


@pytest.mark.unit
def test_task_run_from_row_parent_run_id_none_when_missing() -> None:
    row = _base_run_row(parent_run_id="run-parent")
    del row["parent_run_id"]
    out = companion_pg._task_run_from_row(row)
    assert out is not None
    assert out["parent_run_id"] is None


@pytest.mark.unit
def test_effective_parent_run_id_prefers_explicit() -> None:
    assert (
        companion_pg._effective_parent_run_id(
            parent_run_id="explicit",
            plan_payload={"workflow_parent_run_id": "from-plan"},
        )
        == "explicit"
    )


@pytest.mark.unit
def test_effective_parent_run_id_falls_back_to_plan() -> None:
    assert (
        companion_pg._effective_parent_run_id(
            parent_run_id=None,
            plan_payload={"workflow_parent_run_id": "run-parent"},
        )
        == "run-parent"
    )


class _FakeTransaction:
    async def __aenter__(self) -> _FakeTransaction:
        return self

    async def __aexit__(self, *_args: object) -> None:
        return None


class _FakeConn:
    def __init__(self) -> None:
        self.last_insert_parent: str | None = None
        self.last_fetch_query: str | None = None
        self.fetch_rows: list[dict[str, Any]] = []

    def transaction(self) -> _FakeTransaction:
        return _FakeTransaction()

    async def fetchrow(self, query: str, *args: Any) -> dict[str, Any] | None:
        if "INSERT INTO ewa_companion_task_runs" in query:
            self.last_insert_parent = args[10] if len(args) > 10 else None
            return _base_run_row(parent_run_id=self.last_insert_parent)
        return None

    async def fetch(self, query: str, *args: Any) -> list[dict[str, Any]]:
        self.last_fetch_query = query
        return self.fetch_rows

    async def execute(self, *_args: Any) -> None:
        return None


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
def test_companion_task_run_create_sets_parent_run_id_from_plan() -> None:
    conn = _FakeConn()
    pool = _FakePool(conn)
    out = asyncio.run(
        companion_pg.companion_task_run_create(
            pool,
            principal_id="principal-1",
            intent_kind="music_generation_background",
            user_message="child",
            plan_payload={"workflow_parent_run_id": "run-parent"},
            status="running",
            execution_mode="async",
        )
    )
    assert conn.last_insert_parent == "run-parent"
    assert out is not None
    assert out["parent_run_id"] == "run-parent"


@pytest.mark.unit
def test_companion_task_runs_list_top_level_only_inlines_parent_sql() -> None:
    conn = _FakeConn()
    conn.fetch_rows = [_base_run_row(parent_run_id=None)]
    pool = _FakePool(conn)

    out = asyncio.run(
        companion_pg.companion_task_runs_list(
            pool,
            principal_id="principal-1",
            limit=5,
            top_level_only=True,
        )
    )

    assert out[0]["parent_run_id"] is None
    assert conn.last_fetch_query is not None
    assert "{_PARENT_RUN_ID_MATCH_SQL}" not in conn.last_fetch_query
    assert "workflow_parent_run_id" in conn.last_fetch_query
