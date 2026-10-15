# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral tests for agentic LLM Think engine (schema, mapping, error recovery).
# Related:
# - api/ewa_platform/agentic/kernel/engine.py
# - api/ewa_platform/agentic/kernel/think_schema_v1.py
# ---

from __future__ import annotations

import json
from typing import Any

import pytest

from api.ewa_platform.agentic.kernel.engine import assemble_think_messages, invoke_think_llm
from api.ewa_platform.agentic.kernel.think_schema_v1 import (
    AgenticThinkOutputV1,
    ThinkSchemaError,
    parse_think_v1_from_text,
)
from api.ewa_platform.agentic.kernel.types import AgenticContext
from api.ewa_platform.persistence_pg import agentic_asyncpg as agentic_pg


def _ctx(
    *,
    goal: str = "Find info about quantum computing",
    status: str = "executing",
    plan_summary: str = "",
    active_nodes: list[dict[str, Any]] | None = None,
    checkpoints: list[dict[str, Any]] | None = None,
    inbound: list[dict[str, Any]] | None = None,
) -> AgenticContext:
    return AgenticContext(
        session={
            "id": "sess-brain-1",
            "principal_id": "p-1",
            "status": status,
            "session_revision": 3,
            "goal_json": {"text": goal},
            "plan_summary": plan_summary,
            "policy_json": {},
        },
        active_nodes=active_nodes or [],
        tree_summary={"pending": 0, "completed": 1},
        checkpoints=checkpoints or [],
        inbound_messages=inbound or [],
        llm_messages=[],
    )


@pytest.mark.asyncio
async def test_simple_tool_call_catalog_list(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _mock_llm(_messages: list[dict[str, str]], _model: str) -> str:
        return json.dumps(
            {
                "reasoning_trace": "User wants information; catalog_list can search files.",
                "decision_type": "CONTINUE_EXECUTION",
                "action_payload": {
                    "tool_name": "catalog_list",
                    "tool_args": {"user_line": "quantum computing", "mode": "search"},
                },
                "plan_update_summary": "Searching catalog for quantum computing references.",
            }
        )

    monkeypatch.setenv("EWA_AGENTIC_SUBSTRATE_ENABLED", "1")
    monkeypatch.setenv("EWA_AGENTIC_THINK_LLM_ENABLED", "1")

    ctx = _ctx(goal="Find info about quantum computing")
    v1, loop_out = await invoke_think_llm(ctx, llm_complete=_mock_llm)

    assert v1.decision_type == "continue"
    assert loop_out.action == "act"
    assert loop_out.act_tool_name == "catalog_list"
    assert loop_out.act_tool_args.get("mode") == "search"


@pytest.mark.asyncio
async def test_continue_without_user_line_enriched_from_goal(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _mock_llm(_messages: list[dict[str, str]], _model: str) -> str:
        return json.dumps(
            {
                "reasoning_trace": "Search files for DVFU strategy",
                "decision_type": "continue",
                "payload": {
                    "decision_type": "continue",
                    "tool_name": "catalog_list",
                    "tool_args": {"mode": "search"},
                },
                "plan_update_summary": "Searching catalog",
            }
        )

    monkeypatch.setenv("EWA_AGENTIC_SUBSTRATE_ENABLED", "1")
    monkeypatch.setenv("EWA_AGENTIC_THINK_LLM_ENABLED", "1")

    ctx = _ctx(goal="DVFU digital strategy files")
    v1, loop_out = await invoke_think_llm(ctx, llm_complete=_mock_llm)

    assert v1.decision_type == "continue"
    assert loop_out.act_tool_args.get("user_line") == "DVFU digital strategy files"


@pytest.mark.asyncio
async def test_human_gate_trigger(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _mock_llm(_messages: list[dict[str, str]], _model: str) -> str:
        return json.dumps(
            {
                "reasoning_trace": "Budget is unclear; need operator confirmation before spend.",
                "decision_type": "REQUEST_HUM_INTERV",
                "action_payload": {
                    "gate_json": {
                        "kind": "confirm",
                        "prompt": "I'm unsure about budget — approve up to 5000 RUB?",
                        "options": [{"id": "yes", "label": "Approve"}, {"id": "no", "label": "Cancel"}],
                    }
                },
                "plan_update_summary": "Paused for budget confirmation.",
            }
        )

    monkeypatch.setenv("EWA_AGENTIC_SUBSTRATE_ENABLED", "1")
    monkeypatch.setenv("EWA_AGENTIC_THINK_LLM_ENABLED", "1")

    ctx = _ctx(goal="I'm unsure about budget for this campaign", inbound=[])
    _v1, loop_out = await invoke_think_llm(ctx, llm_complete=_mock_llm)

    assert loop_out.action == "gate"
    assert loop_out.gate is not None
    assert "budget" in (loop_out.gate.gate_prompt or "").lower()


@pytest.mark.asyncio
async def test_plan_mutation(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _mock_llm(_messages: list[dict[str, str]], _model: str) -> str:
        return json.dumps(
            {
                "reasoning_trace": "User asked to add a research step for topic Y.",
                "decision_type": "MUTATE_PLAN",
                "action_payload": {
                    "plan_nodes": [
                        {
                            "node_kind": "subtask",
                            "title": "Research topic Y",
                            "instruction": "Gather sources and summarize findings for Y.",
                        }
                    ],
                    "patch_instructions": "Insert after initial analysis.",
                },
                "plan_update_summary": "Added research step for Y.",
            }
        )

    monkeypatch.setenv("EWA_AGENTIC_SUBSTRATE_ENABLED", "1")
    monkeypatch.setenv("EWA_AGENTIC_THINK_LLM_ENABLED", "1")

    ctx = _ctx(goal="Actually, add a step for Y", status="planning")
    _v1, loop_out = await invoke_think_llm(ctx, llm_complete=_mock_llm)

    assert loop_out.action == "plan"
    assert len(loop_out.plan_nodes) == 1
    assert loop_out.plan_nodes[0].title == "Research topic Y"
    assert "Y" in (loop_out.plan_summary_patch or "")


@pytest.mark.asyncio
async def test_malformed_json_raises_schema_error(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _mock_llm(_messages: list[dict[str, str]], _model: str) -> str:
        return "Sure, I will help you { not valid json"

    monkeypatch.setenv("EWA_AGENTIC_SUBSTRATE_ENABLED", "1")
    monkeypatch.setenv("EWA_AGENTIC_THINK_LLM_ENABLED", "1")

    ctx = _ctx()
    with pytest.raises(ThinkSchemaError, match="no_json"):
        await invoke_think_llm(ctx, llm_complete=_mock_llm)


@pytest.mark.asyncio
async def test_unregistered_tool_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _mock_llm(_messages: list[dict[str, str]], _model: str) -> str:
        return json.dumps(
            {
                "reasoning_trace": "Try search tool",
                "decision_type": "CONTINUE_EXECUTION",
                "action_payload": {"tool_name": "search", "tool_args": {"q": "x"}},
                "plan_update_summary": "",
            }
        )

    monkeypatch.setenv("EWA_AGENTIC_SUBSTRATE_ENABLED", "1")
    monkeypatch.setenv("EWA_AGENTIC_THINK_LLM_ENABLED", "1")

    ctx = _ctx()
    with pytest.raises(ThinkSchemaError, match="not registered"):
        await invoke_think_llm(ctx, llm_complete=_mock_llm)


def test_think_output_rehydrates_in_checkpoint_summary() -> None:
    v1 = AgenticThinkOutputV1.from_llm_blob(
        {
            "reasoning_trace": "done",
            "decision_type": "TERMINATE_SESSION",
            "action_payload": {},
            "plan_update_summary": "Mission complete.",
        }
    )
    blob = v1.model_dump()
    ctx = _ctx(
        checkpoints=[
            {
                "kind": "think",
                "payload_json": blob,
            }
        ]
    )
    messages = assemble_think_messages(ctx)
    user_content = messages[-1]["content"]
    assert "Mission complete" in user_content or "terminate" in user_content


class _FakeTransaction:
    async def __aenter__(self) -> _FakeTransaction:
        return self

    async def __aexit__(self, *_args: object) -> None:
        return None


class _FakeConn:
    def __init__(self) -> None:
        self.revision = 2
        self.status = "executing"
        self.plan_summary = "base plan"
        self.working_memory: dict[str, Any] = {}

    def transaction(self) -> _FakeTransaction:
        return _FakeTransaction()

    async def fetchrow(self, query: str, *args: Any) -> dict[str, Any] | None:
        q = query.strip().lower()
        if "for update" in q and "ewa_agentic_sessions" in q:
            return {
                "session_revision": self.revision,
                "status": self.status,
                "plan_summary": self.plan_summary,
                "working_memory_json": self.working_memory,
            }
        if "insert into ewa_agentic_checkpoint_logs" in q:
            if len(args) == 4:
                return {
                    "id": 100,
                    "session_id": args[0],
                    "node_id": None,
                    "seq": int(args[1]),
                    "kind": "state_transition",
                    "payload_json": {},
                    "payload_bytes": int(args[3]),
                    "llm_model": None,
                    "token_estimate": None,
                    "created_at": None,
                }
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
            return None
        if "update ewa_agentic_sessions" in q:
            self.revision += 1
            for arg in args[3:]:
                if isinstance(arg, str) and arg.startswith("{"):
                    try:
                        parsed = json.loads(arg)
                    except json.JSONDecodeError:
                        continue
                    if isinstance(parsed, dict) and "gate_id" in parsed:
                        continue
                    self.working_memory = parsed
                elif isinstance(arg, str) and arg in agentic_pg.TERMINAL_SESSION_STATUSES | {
                    "replanning",
                    "executing",
                    "planning",
                    "awaiting_human",
                }:
                    self.status = arg
                elif isinstance(arg, str) and (arg.startswith("base plan") or "[think_error]" in arg):
                    self.plan_summary = arg
            return {
                "id": "sess-brain-1",
                "principal_id": "p-1",
                "status": self.status,
                "session_revision": self.revision,
                "goal_json": {},
                "plan_summary": self.plan_summary,
                "active_node_id": None,
                "policy_json": {},
                "working_memory_json": self.working_memory,
                "gate_json": {},
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


class _FakePool:
    def __init__(self, conn: _FakeConn) -> None:
        self._conn = conn

    def acquire(self) -> _FakeAcquire:
        return _FakeAcquire(self._conn)


class _FakeAcquire:
    def __init__(self, conn: _FakeConn) -> None:
        self._conn = conn

    async def __aenter__(self) -> _FakeConn:
        return self._conn

    async def __aexit__(self, *_args: object) -> None:
        return None


@pytest.mark.asyncio
async def test_parse_error_moves_session_to_replanning() -> None:
    conn = _FakeConn()
    pool = _FakePool(conn)
    _cp, session, err = await agentic_pg.agentic_persist_think_phase_atomic(
        pool,  # type: ignore[arg-type]
        session_id="sess-brain-1",
        principal_id="p-1",
        expect_revision=2,
        parse_error="schema_validation_failed",
        max_parse_retries=1,
    )
    assert err == "schema_validation_failed"
    assert session is not None
    assert session["status"] == "replanning"
    assert conn.working_memory.get("think_parse_fail_count") == 1


@pytest.mark.asyncio
async def test_parse_error_second_failure_increments_replanning_circuit(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_AGENTIC_MAX_REPLANNING_ATTEMPTS", "5")
    conn = _FakeConn()
    conn.working_memory = {"think_parse_fail_count": 1}
    pool = _FakePool(conn)
    _cp, session, _err = await agentic_pg.agentic_persist_think_phase_atomic(
        pool,  # type: ignore[arg-type]
        session_id="sess-brain-1",
        principal_id="p-1",
        expect_revision=2,
        parse_error="schema_validation_failed",
        max_parse_retries=1,
    )
    assert session is not None
    assert session["status"] == "replanning"
    assert conn.working_memory.get("think_parse_fail_count") == 2
    assert conn.working_memory.get("replanning_count") == 1


@pytest.mark.asyncio
async def test_parse_error_user_line_does_not_increment_replanning_circuit() -> None:
    conn = _FakeConn()
    pool = _FakePool(conn)
    _cp, session, _err = await agentic_pg.agentic_persist_think_phase_atomic(
        pool,  # type: ignore[arg-type]
        session_id="sess-brain-1",
        principal_id="p-1",
        expect_revision=2,
        parse_error="tool_args.user_line: Field required",
        max_parse_retries=1,
    )
    assert session is not None
    assert session["status"] == "executing"
    assert conn.working_memory.get("think_parse_fail_count") == 1
    assert conn.working_memory.get("replanning_count") in (None, 0)


@pytest.mark.asyncio
async def test_parse_error_opens_circuit_when_replanning_cap_exceeded(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_AGENTIC_MAX_REPLANNING_ATTEMPTS", "2")
    monkeypatch.setattr(
        agentic_pg,
        "agentic_max_replanning_attempts",
        lambda: 2,
    )
    conn = _FakeConn()
    conn.working_memory = {"think_parse_fail_count": 1, "replanning_count": 2}
    pool = _FakePool(conn)
    _cp, session, _err = await agentic_pg.agentic_persist_think_phase_atomic(
        pool,  # type: ignore[arg-type]
        session_id="sess-brain-1",
        principal_id="p-1",
        expect_revision=2,
        parse_error="schema_validation_failed",
        max_parse_retries=1,
    )
    assert session is not None
    assert session["status"] == "awaiting_human"
    assert session["working_memory_json"].get("terminate_reason") == "Reasoning_Loop_Detected"


def test_parse_think_v1_from_text_strips_markdown_fence() -> None:
    raw = """```json
{"reasoning_trace":"x","decision_type":"TERMINATE_SESSION","action_payload":{},"plan_update_summary":""}
```"""
    v1 = parse_think_v1_from_text(raw)
    assert v1.decision_type == "terminate"
