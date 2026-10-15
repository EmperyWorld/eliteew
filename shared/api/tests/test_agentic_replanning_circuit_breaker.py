# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Circuit breaker locks for replanning death spiral — streak must survive Think, cap opens HITL.
# Related:
# - api/ewa_platform/agentic/kernel/circuit_breaker.py
# - api/ewa_platform/persistence_pg/agentic_asyncpg.py
# ---

from __future__ import annotations

import json
from typing import Any

import pytest

from api.ewa_platform.agentic.config import agentic_max_replanning_attempts
from api.ewa_platform.agentic.kernel.circuit_breaker import (
    REASONING_LOOP_DETECTED,
    evaluate_replanning_step,
    reset_circuit_on_success,
)
from api.ewa_platform.persistence_pg import agentic_asyncpg as agentic_pg


class _NoopTx:
    async def __aenter__(self) -> _NoopTx:
        return self

    async def __aexit__(self, *_args: object) -> None:
        return None


class _CircuitConn:
    def __init__(self, *, revision: int = 4, status: str = "replanning", wm: dict[str, Any] | None = None) -> None:
        self.revision = revision
        self.status = status
        self.plan_summary = ""
        self.working_memory: dict[str, Any] = dict(wm or {})
        self.gate_json: dict[str, Any] = {}

    def transaction(self) -> _NoopTx:
        return _NoopTx()

    async def fetchrow(self, query: str, *args: Any) -> dict[str, Any] | None:
        q = query.strip().lower()
        if "for update" in q:
            return {
                "session_revision": self.revision,
                "status": self.status,
                "plan_summary": self.plan_summary,
                "working_memory_json": self.working_memory,
            }
        if "insert into ewa_agentic_checkpoint_logs" in q:
            if len(args) >= 6:
                return {
                    "id": 99,
                    "session_id": args[0],
                    "node_id": None,
                    "seq": int(args[1]),
                    "kind": str(args[2]),
                    "payload_json": {},
                    "payload_bytes": int(args[4]),
                    "llm_model": args[5] if len(args) > 5 else None,
                    "token_estimate": None,
                    "created_at": None,
                }
            return {"id": 1, "session_id": args[0] if args else "sess-cb-1", "seq": 1, "kind": "error"}
        if "update ewa_agentic_sessions" in q:
            self.revision += 1
            for arg in args[3:]:
                if isinstance(arg, str) and arg.startswith("{"):
                    try:
                        parsed = json.loads(arg)
                    except json.JSONDecodeError:
                        continue
                    if "gate_id" in parsed:
                        self.gate_json = parsed
                    else:
                        self.working_memory = parsed
                elif isinstance(arg, str) and arg in {
                    "replanning",
                    "executing",
                    "planning",
                    "awaiting_human",
                    "failed",
                }:
                    self.status = arg
                elif isinstance(arg, str) and ("[tool_error]" in arg or "[circuit_break]" in arg):
                    self.plan_summary = arg
            return {
                "id": "sess-cb-1",
                "principal_id": "p-1",
                "status": self.status,
                "session_revision": self.revision,
                "goal_json": {},
                "plan_summary": self.plan_summary,
                "active_node_id": None,
                "policy_json": {},
                "working_memory_json": self.working_memory,
                "gate_json": self.gate_json,
                "linked_task_run_id": None,
                "lease_holder": None,
                "leased_until": None,
                "last_heartbeat_at": None,
                "iteration_count": 0,
                "created_at": None,
                "updated_at": None,
                "completed_at": None,
            }
        return None

    async def fetchval(self, query: str, *args: Any) -> int:
        return 1

    async def execute(self, *_args: Any) -> None:
        return None


class _CircuitPool:
    def __init__(self, conn: _CircuitConn) -> None:
        self._conn = conn

    def acquire(self) -> _CircuitAcquire:
        return _CircuitAcquire(self._conn)


class _CircuitAcquire:
    def __init__(self, conn: _CircuitConn) -> None:
        self._conn = conn

    async def __aenter__(self) -> _CircuitConn:
        return self._conn

    async def __aexit__(self, *_args: object) -> None:
        return None


@pytest.mark.asyncio
async def test_tool_error_then_think_does_not_reset_failure_streak() -> None:
    """Test 1 — persistent error: Think success must not zero replanning_count."""

    conn = _CircuitConn(wm={"replanning_count": 1})
    pool = _CircuitPool(conn)
    _cp, session_after = await agentic_pg.agentic_record_replanning_atomic(
        pool,  # type: ignore[arg-type]
        session_id="sess-cb-1",
        principal_id="p-1",
        expect_revision=4,
        reason="tool_act_error:invalid_content_id",
    )
    assert session_after is not None
    assert conn.working_memory.get("replanning_count") == 2

    _cp2, session_think, _err = await agentic_pg.agentic_persist_think_phase_atomic(
        pool,  # type: ignore[arg-type]
        session_id="sess-cb-1",
        principal_id="p-1",
        expect_revision=conn.revision,
        think_payload={"plan_update_summary": "retry with catalog_list"},
    )
    assert session_think is not None
    assert conn.working_memory.get("replanning_count") == 2


@pytest.mark.asyncio
async def test_repeated_tool_errors_open_awaiting_human_gate(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test 2 — circuit break: repeated failures land in awaiting_human with gate."""

    monkeypatch.setenv("EWA_AGENTIC_MAX_REPLANNING_ATTEMPTS", "3")
    monkeypatch.setattr(agentic_pg, "agentic_max_replanning_attempts", lambda: 3)

    conn = _CircuitConn(status="replanning", wm={"replanning_count": 3})
    pool = _CircuitPool(conn)
    _cp, session = await agentic_pg.agentic_record_replanning_atomic(
        pool,  # type: ignore[arg-type]
        session_id="sess-cb-1",
        principal_id="p-1",
        expect_revision=4,
        reason="tool_act_error:still_failing",
    )
    assert session is not None
    assert session["status"] == "awaiting_human"
    assert conn.working_memory.get("replanning_count") == 4
    assert conn.working_memory.get("terminate_reason") == REASONING_LOOP_DETECTED
    assert conn.gate_json.get("kind") == "circuit_break"


@pytest.mark.asyncio
async def test_death_spiral_simulation_stops_before_unbounded_revisions(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Test 3 — bounded churn: cap+1 tool errors cannot exceed threshold revisions."""

    monkeypatch.setenv("EWA_AGENTIC_MAX_REPLANNING_ATTEMPTS", "5")
    cap = agentic_max_replanning_attempts()
    conn = _CircuitConn(status="replanning", wm={"replanning_count": 0})
    pool = _CircuitPool(conn)
    revisions_seen = 0

    for _ in range(cap + 3):
        revisions_seen = conn.revision
        _cp, session = await agentic_pg.agentic_record_replanning_atomic(
            pool,  # type: ignore[arg-type]
            session_id="sess-cb-1",
            principal_id="p-1",
            expect_revision=conn.revision,
            reason="tool_act_error:loop",
        )
        assert session is not None
        if session["status"] == "awaiting_human":
            break
        _cp2, session_think, _err = await agentic_pg.agentic_persist_think_phase_atomic(
            pool,  # type: ignore[arg-type]
            session_id="sess-cb-1",
            principal_id="p-1",
            expect_revision=conn.revision,
            think_payload={"plan_update_summary": "think ok but tools still fail"},
        )
        assert session_think is not None

    assert session["status"] == "awaiting_human"
    assert conn.revision <= revisions_seen + cap + 2
    assert int(conn.working_memory.get("replanning_count") or 0) == cap + 1


def test_successful_act_resets_circuit_only_on_act_path() -> None:
    wm = {"replanning_count": 4, "think_parse_fail_count": 1}
    reset = reset_circuit_on_success(wm)
    assert reset["replanning_count"] == 0
    assert reset["think_parse_fail_count"] == 0
    assert agentic_pg.working_memory_after_successful_act(wm)["replanning_count"] == 0


def test_evaluate_replanning_step_increments_under_cap() -> None:
    status, patch, reason = evaluate_replanning_step({"replanning_count": 1}, max_replanning=5)
    assert status == "replanning"
    assert patch["replanning_count"] == 2
    assert reason is None
