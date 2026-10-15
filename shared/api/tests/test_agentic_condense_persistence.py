# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Phase 3.5c Stage A — condense atomic persist + checkpoint list_since_seq (fake asyncpg).
# Related:
# - api/ewa_platform/persistence_pg/agentic_asyncpg.py
# - api/ewa_platform/agentic/context/memory_tiers.py
# ---

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

import pytest

from api.ewa_platform.agentic.context.condense_contracts import CONDENSE_KIND
from api.ewa_platform.agentic.context.memory_tiers import patch_last_condense_seq, read_active_slice
from api.ewa_platform.persistence_pg import agentic_asyncpg as agentic_pg


class _FakeTransaction:
    async def __aenter__(self) -> _FakeTransaction:
        return self

    async def __aexit__(self, *_args: object) -> None:
        return None


def _now() -> datetime:
    return datetime(2026, 7, 5, 12, 0, 0, tzinfo=UTC)


def _session_row(
    *,
    session_revision: int = 5,
    status: str = "executing",
    plan_summary: str = "warm baseline",
    working_memory_json: dict[str, Any] | None = None,
) -> dict[str, Any]:
    now = _now()
    return {
        "id": "sess-condense-1",
        "principal_id": "principal-1",
        "status": status,
        "session_revision": session_revision,
        "goal_json": {"text": "research papers"},
        "plan_summary": plan_summary,
        "active_node_id": None,
        "policy_json": {},
        "working_memory_json": working_memory_json or {"active_slice": {"last_condense_seq": 0}},
        "gate_json": {},
        "linked_task_run_id": None,
        "lease_holder": "worker-a",
        "leased_until": now,
        "last_heartbeat_at": now,
        "iteration_count": 10,
        "created_at": now,
        "updated_at": now,
        "completed_at": None,
    }


def _checkpoint_row(*, seq: int, kind: str = "act") -> dict[str, Any]:
    now = _now()
    return {
        "id": 1000 + seq,
        "session_id": "sess-condense-1",
        "node_id": None,
        "seq": seq,
        "kind": kind,
        "payload_json": {"summary": f"event-{seq}"},
        "payload_bytes": 32,
        "llm_model": None,
        "token_estimate": None,
        "created_at": now,
    }


class _CondenseFakeConn:
    """Minimal asyncpg conn simulating session row lock + checkpoint store."""

    def __init__(
        self,
        *,
        session_revision: int = 5,
        plan_summary: str = "warm baseline",
        working_memory_json: dict[str, Any] | None = None,
        checkpoints: list[dict[str, Any]] | None = None,
    ) -> None:
        self.session = _session_row(
            session_revision=session_revision,
            plan_summary=plan_summary,
            working_memory_json=working_memory_json,
        )
        self.checkpoints = list(checkpoints or [])
        self.persist_calls = 0

    def transaction(self) -> _FakeTransaction:
        return _FakeTransaction()

    async def fetch(self, query: str, *args: Any) -> list[dict[str, Any]]:
        q = query.strip().lower()
        if "seq >" in q and "order by seq asc" in q:
            session_id = str(args[0])
            after_seq = int(args[1])
            if session_id != "sess-condense-1":
                return []
            kinds = list(args[2]) if "kind = any" in q else None
            rows = [cp for cp in self.checkpoints if int(cp["seq"]) > after_seq]
            if kinds:
                rows = [cp for cp in rows if cp["kind"] in kinds]
            rows.sort(key=lambda r: int(r["seq"]))
            limit = int(args[-1])
            return rows[:limit]
        return []

    async def fetchrow(self, query: str, *args: Any) -> dict[str, Any] | None:
        q = query.strip().lower()
        if "for update" in q and "ewa_agentic_sessions" in q:
            session_id, principal_id = str(args[0]), str(args[1])
            if session_id != "sess-condense-1" or principal_id != "principal-1":
                return None
            return dict(self.session)

        if "insert into ewa_agentic_checkpoint_logs" in q:
            session_id = str(args[0])
            seq = int(args[1])
            kind = str(args[2])
            payload_json = json.loads(str(args[3]))
            row = _checkpoint_row(seq=seq, kind=kind)
            row["payload_json"] = payload_json
            self.checkpoints.append(row)
            return row

        if "update ewa_agentic_sessions" in q and "plan_summary" in q:
            session_id, principal_id = str(args[0]), str(args[1])
            new_rev = int(args[2])
            plan_summary = str(args[3])
            wm = json.loads(str(args[4]))
            if session_id != "sess-condense-1" or principal_id != "principal-1":
                return None
            self.persist_calls += 1
            self.session["session_revision"] = new_rev
            self.session["plan_summary"] = plan_summary
            self.session["working_memory_json"] = wm
            return dict(self.session)

        return None

    async def fetchval(self, query: str, *args: Any) -> int:
        q = query.strip().lower()
        if "max(seq)" in q:
            session_id = str(args[0])
            seqs = [int(cp["seq"]) for cp in self.checkpoints if cp["session_id"] == session_id]
            return (max(seqs) if seqs else 0) + 1
        return 0


class _FakeConnContext:
    def __init__(self, conn: _CondenseFakeConn) -> None:
        self._conn = conn

    async def __aenter__(self) -> _CondenseFakeConn:
        return self._conn

    async def __aexit__(self, *_args: object) -> None:
        return None


class _FakePool:
    def __init__(self, conn: _CondenseFakeConn) -> None:
        self._conn = conn

    def acquire(self) -> _FakeConnContext:
        return _FakeConnContext(self._conn)


@pytest.mark.asyncio
async def test_checkpoint_list_since_seq_returns_ascending_window() -> None:
    conn = _CondenseFakeConn(
        checkpoints=[
            _checkpoint_row(seq=1, kind="think"),
            _checkpoint_row(seq=2, kind="act"),
            _checkpoint_row(seq=3, kind="act"),
            _checkpoint_row(seq=4, kind="condense"),
        ]
    )
    pool = _FakePool(conn)

    rows = await agentic_pg.agentic_checkpoint_list_since_seq(
        pool,  # type: ignore[arg-type]
        session_id="sess-condense-1",
        after_seq=2,
    )
    assert [r["seq"] for r in rows] == [3, 4]


@pytest.mark.asyncio
async def test_persist_condense_atomic_updates_warm_and_wm() -> None:
    conn = _CondenseFakeConn(session_revision=7)
    pool = _FakePool(conn)
    wm = patch_last_condense_seq(conn.session["working_memory_json"], 5)

    session, checkpoint, err = await agentic_pg.agentic_persist_condense_atomic(
        pool,  # type: ignore[arg-type]
        session_id="sess-condense-1",
        principal_id="principal-1",
        expect_revision=7,
        plan_summary="Condensed warm memory paragraph",
        last_condense_seq=5,
        working_memory_json=wm,
        condense_payload={"from_seq": 0, "to_seq": 5, "trigger": "test"},
    )

    assert err is None
    assert session is not None
    assert checkpoint is not None
    assert session["session_revision"] == 8
    assert session["plan_summary"] == "Condensed warm memory paragraph"
    assert read_active_slice(session["working_memory_json"])["last_condense_seq"] == 5
    assert checkpoint["kind"] == CONDENSE_KIND
    assert checkpoint["payload_json"]["to_seq"] == 5


@pytest.mark.asyncio
async def test_persist_condense_collision_second_writer_gets_revision_conflict() -> None:
    """Two workers with the same expect_revision: first wins, second fail-closed."""

    conn = _CondenseFakeConn(session_revision=9, plan_summary="before condense")
    pool = _FakePool(conn)

    wm_a = patch_last_condense_seq(conn.session["working_memory_json"], 3)
    session_a, cp_a, err_a = await agentic_pg.agentic_persist_condense_atomic(
        pool,  # type: ignore[arg-type]
        session_id="sess-condense-1",
        principal_id="principal-1",
        expect_revision=9,
        plan_summary="Writer A condensed summary",
        last_condense_seq=3,
        working_memory_json=wm_a,
        condense_payload={"from_seq": 0, "to_seq": 3, "trigger": "test", "writer": "A"},
    )
    assert err_a is None
    assert session_a is not None
    assert session_a["session_revision"] == 10

    wm_b = patch_last_condense_seq(conn.session["working_memory_json"], 6)
    session_b, cp_b, err_b = await agentic_pg.agentic_persist_condense_atomic(
        pool,  # type: ignore[arg-type]
        session_id="sess-condense-1",
        principal_id="principal-1",
        expect_revision=9,
        plan_summary="Writer B must not overwrite",
        last_condense_seq=6,
        working_memory_json=wm_b,
        condense_payload={"from_seq": 3, "to_seq": 6, "trigger": "test", "writer": "B"},
    )

    assert err_b == "revision_conflict"
    assert session_b is None
    assert cp_b is None
    assert conn.session["plan_summary"] == "Writer A condensed summary"
    assert read_active_slice(conn.session["working_memory_json"])["last_condense_seq"] == 3
    assert conn.persist_calls == 1
    condense_rows = [cp for cp in conn.checkpoints if cp["kind"] == CONDENSE_KIND]
    assert len(condense_rows) == 1
    assert cp_a is not None
    assert condense_rows[0]["payload_json"].get("writer") == "A"


@pytest.mark.asyncio
async def test_persist_condense_rejects_non_advancing_seq() -> None:
    conn = _CondenseFakeConn(
        session_revision=4,
        working_memory_json={"active_slice": {"last_condense_seq": 8}},
    )
    pool = _FakePool(conn)
    wm = patch_last_condense_seq(conn.session["working_memory_json"], 8)

    session, checkpoint, err = await agentic_pg.agentic_persist_condense_atomic(
        pool,  # type: ignore[arg-type]
        session_id="sess-condense-1",
        principal_id="principal-1",
        expect_revision=4,
        plan_summary="should not persist",
        last_condense_seq=8,
        working_memory_json=wm,
        condense_payload={"from_seq": 0, "to_seq": 8, "trigger": "test"},
    )

    assert err == "condense_seq_not_advanced"
    assert session is None
    assert checkpoint is None
    assert conn.persist_calls == 0


@pytest.mark.asyncio
async def test_persist_condense_treats_missing_last_condense_seq_as_zero() -> None:
    """WM without last_condense_seq is read as seq=0; first condense to seq=2 succeeds."""

    conn = _CondenseFakeConn(
        session_revision=3,
        working_memory_json={"active_slice": {"last_act_summaries": []}},
    )
    pool = _FakePool(conn)
    wm = patch_last_condense_seq(conn.session["working_memory_json"], 2)

    session, checkpoint, err = await agentic_pg.agentic_persist_condense_atomic(
        pool,  # type: ignore[arg-type]
        session_id="sess-condense-1",
        principal_id="principal-1",
        expect_revision=3,
        plan_summary="Warm after first condense",
        last_condense_seq=2,
        working_memory_json=wm,
        condense_payload={"from_seq": 0, "to_seq": 2, "trigger": "test"},
    )

    assert err is None
    assert session is not None
    assert checkpoint is not None
    assert read_active_slice(session["working_memory_json"])["last_condense_seq"] == 2


@pytest.mark.asyncio
async def test_persist_condense_rejects_terminal_session() -> None:
    conn = _CondenseFakeConn(session_revision=2, plan_summary="done")
    conn.session["status"] = "completed"
    pool = _FakePool(conn)
    wm = patch_last_condense_seq(conn.session["working_memory_json"], 1)

    session, checkpoint, err = await agentic_pg.agentic_persist_condense_atomic(
        pool,  # type: ignore[arg-type]
        session_id="sess-condense-1",
        principal_id="principal-1",
        expect_revision=2,
        plan_summary="too late",
        last_condense_seq=1,
        working_memory_json=wm,
        condense_payload={"from_seq": 0, "to_seq": 1, "trigger": "test"},
    )

    assert err == "terminal_session"
    assert session is None
    assert checkpoint is None
