# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Phase 3.5c — condense sidecar LLM + orchestrator + prompt cold-filter tests.
# Related:
# - api/ewa_platform/agentic/context/condense_sidecar.py
# - api/ewa_platform/agentic/context/condense_orchestrator.py
# ---

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

import pytest

from api.ewa_platform.agentic.context.condense_contracts import CONDENSE_KIND, CondenseSidecarInput
from api.ewa_platform.agentic.context.condense_orchestrator import maybe_run_condense
from api.ewa_platform.agentic.context.condense_sidecar import (
    CondenseSidecarError,
    build_condense_messages,
    format_checkpoints_for_condense,
    invoke_condense_sidecar,
    parse_condense_output,
)
from api.ewa_platform.agentic.context.memory_tiers import read_active_slice
from api.ewa_platform.agentic.kernel.prompt_builder import ThinkPromptBuilder
from api.ewa_platform.agentic.kernel.types import AgenticContext


def _cp(*, seq: int, kind: str, payload: dict[str, Any]) -> dict[str, Any]:
    now = datetime(2026, 7, 5, 12, 0, 0, tzinfo=UTC)
    return {
        "id": 100 + seq,
        "session_id": "sess-condense-sidecar",
        "node_id": None,
        "seq": seq,
        "kind": kind,
        "payload_json": payload,
        "payload_bytes": 32,
        "llm_model": None,
        "token_estimate": None,
        "created_at": now,
    }


def test_format_checkpoints_for_condense_renders_think_and_act() -> None:
    rows = [
        _cp(seq=3, kind="think", payload={"decision_type": "continue", "plan_update_summary": "run search"}),
        _cp(seq=4, kind="act", payload={"tool": "catalog_list", "status": "ok", "summary": "found 2 items"}),
    ]
    text = format_checkpoints_for_condense(rows)
    assert "#3 [think]" in text
    assert "decision=continue" in text
    assert "#4 [act]" in text
    assert "catalog_list" in text


def test_parse_condense_output_validates_plan_summary() -> None:
    out = parse_condense_output('{"plan_summary": "Mission progressing; catalog search succeeded."}')
    assert "catalog" in out.plan_summary


def test_parse_condense_output_rejects_empty_summary() -> None:
    with pytest.raises(CondenseSidecarError, match="schema_validation"):
        parse_condense_output('{"plan_summary": ""}')


def test_build_condense_messages_includes_goal() -> None:
    sidecar_input = CondenseSidecarInput(
        goal_text="Research quantum papers",
        current_plan_summary="Started literature review.",
        checkpoints=(_cp(seq=2, kind="act", payload={"tool": "x", "status": "ok", "summary": "done"}),),
        from_seq=0,
        to_seq=2,
    )
    messages = build_condense_messages(sidecar_input)
    user = messages[1]["content"]
    assert "Research quantum papers" in user
    assert "Started literature review" in user
    assert "#2 [act]" in user


@pytest.mark.asyncio
async def test_invoke_condense_sidecar_heuristic_when_llm_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_AGENTIC_CONDENSE_LLM_ENABLED", "0")
    monkeypatch.setenv("EWA_AGENTIC_SUBSTRATE_ENABLED", "1")

    sidecar_input = CondenseSidecarInput(
        goal_text="Build report",
        current_plan_summary="",
        checkpoints=(_cp(seq=1, kind="act", payload={"tool": "notes", "status": "ok", "summary": "draft saved"}),),
        from_seq=0,
        to_seq=1,
    )
    out = await invoke_condense_sidecar(sidecar_input)
    assert "Build report" in out.plan_summary
    assert "notes" in out.plan_summary or "Recent:" in out.plan_summary


@pytest.mark.asyncio
async def test_invoke_condense_sidecar_mock_llm(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_AGENTIC_CONDENSE_LLM_ENABLED", "1")
    monkeypatch.setenv("EWA_AGENTIC_SUBSTRATE_ENABLED", "1")

    async def _fake_llm(_messages: list[dict[str, str]], _model: str) -> str:
        return json.dumps({"plan_summary": "Updated warm summary preserving quantum research goal."})

    sidecar_input = CondenseSidecarInput(
        goal_text="Quantum research",
        current_plan_summary="Old summary",
        checkpoints=(_cp(seq=5, kind="think", payload={"decision_type": "continue", "plan_update_summary": "next"}),),
        from_seq=0,
        to_seq=5,
    )
    out = await invoke_condense_sidecar(sidecar_input, llm_complete=_fake_llm)
    assert "quantum" in out.plan_summary.lower()


def test_prompt_builder_hides_condensed_cold_checkpoints() -> None:
    ctx = AgenticContext(
        session={
            "id": "s1",
            "status": "executing",
            "goal_json": {"text": "Goal X"},
            "plan_summary": "Warm paragraph",
            "working_memory_json": {"active_slice": {"last_condense_seq": 5, "last_act_summaries": []}},
        },
        active_nodes=[],
        tree_summary={},
        checkpoints=[
            _cp(seq=3, kind="act", payload={"tool": "a", "status": "ok", "summary": "old"}),
            _cp(seq=6, kind="act", payload={"tool": "b", "status": "ok", "summary": "fresh"}),
        ],
        inbound_messages=[],
        llm_messages=[],
    )
    blob = ThinkPromptBuilder.build(ctx, system_content="sys").sections.to_user_blob()
    assert "#6 [act]" in blob
    assert "#3 [act]" not in blob


class _FakeTransaction:
    async def __aenter__(self) -> _FakeTransaction:
        return self

    async def __aexit__(self, *_args: object) -> None:
        return None


class _FakeConnContext:
    def __init__(self, conn: _OrchestratorFakeConn) -> None:
        self._conn = conn

    async def __aenter__(self) -> _OrchestratorFakeConn:
        return self._conn

    async def __aexit__(self, *_args: object) -> None:
        return None


class _OrchestratorFakeConn:
    def __init__(self) -> None:
        now = datetime(2026, 7, 5, 12, 0, 0, tzinfo=UTC)
        self.session: dict[str, Any] = {
            "id": "sess-condense-sidecar",
            "principal_id": "principal-1",
            "status": "executing",
            "session_revision": 11,
            "goal_json": {"text": "Mission alpha"},
            "plan_summary": "Before condense",
            "working_memory_json": {"active_slice": {"last_condense_seq": 0}},
            "policy_json": {},
            "gate_json": {},
            "active_node_id": None,
            "linked_task_run_id": None,
            "lease_holder": "w",
            "leased_until": now,
            "last_heartbeat_at": now,
            "iteration_count": 5,
            "created_at": now,
            "updated_at": now,
            "completed_at": None,
        }
        self.checkpoints: list[dict[str, Any]] = [
            _cp(seq=1, kind="think", payload={"decision_type": "continue", "plan_update_summary": "step 1"}),
            _cp(seq=2, kind="act", payload={"tool": "catalog_list", "status": "ok", "summary": "listed"}),
        ]

    def transaction(self) -> _FakeTransaction:
        return _FakeTransaction()

    async def fetch(self, query: str, *args: Any) -> list[dict[str, Any]]:
        q = query.strip().lower()
        if "seq >" in q and "order by seq asc" in q:
            after_seq = int(args[1])
            rows = [cp for cp in self.checkpoints if int(cp["seq"]) > after_seq]
            rows.sort(key=lambda r: int(r["seq"]))
            return rows[: int(args[-1])]
        return []

    async def fetchrow(self, query: str, *args: Any) -> dict[str, Any] | None:
        q = query.strip().lower()
        if "for update" in q and "ewa_agentic_sessions" in q:
            return dict(self.session)
        if "insert into ewa_agentic_checkpoint_logs" in q:
            seq = int(args[1])
            kind = str(args[2])
            payload_json = json.loads(str(args[3]))
            now = datetime(2026, 7, 5, 12, 0, 0, tzinfo=UTC)
            row = {
                "id": 900 + seq,
                "session_id": "sess-condense-sidecar",
                "node_id": None,
                "seq": seq,
                "kind": kind,
                "payload_json": payload_json,
                "payload_bytes": 32,
                "llm_model": None,
                "token_estimate": None,
                "created_at": now,
            }
            self.checkpoints.append(row)
            return row
        if "update ewa_agentic_sessions" in q and "plan_summary" in q:
            self.session["session_revision"] = int(args[2])
            self.session["plan_summary"] = str(args[3])
            self.session["working_memory_json"] = json.loads(str(args[4]))
            return dict(self.session)
        return None

    async def fetchval(self, query: str, *args: Any) -> int:
        if "max(seq)" in query.lower():
            seqs = [int(cp["seq"]) for cp in self.checkpoints]
            return (max(seqs) if seqs else 0) + 1
        return 0


class _OrchestratorFakePool:
    def __init__(self, conn: _OrchestratorFakeConn) -> None:
        self._conn = conn

    def acquire(self) -> _FakeConnContext:
        return _FakeConnContext(self._conn)


@pytest.mark.asyncio
async def test_maybe_run_condense_persists_llm_summary(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_AGENTIC_CONDENSE_LLM_ENABLED", "1")
    monkeypatch.setenv("EWA_AGENTIC_SUBSTRATE_ENABLED", "1")

    conn = _OrchestratorFakeConn()
    pool = _OrchestratorFakePool(conn)

    async def _fake_llm(_messages: list[dict[str, str]], _model: str) -> str:
        return json.dumps({"plan_summary": "Condensed mission alpha with catalog progress."})

    updated = await maybe_run_condense(
        pool,  # type: ignore[arg-type]
        session=conn.session,
        session_id="sess-condense-sidecar",
        principal_id="principal-1",
        trigger="iteration",
        llm_complete=_fake_llm,
    )

    assert updated["session_revision"] == 12
    assert "Condensed mission alpha" in str(updated["plan_summary"])
    assert read_active_slice(updated["working_memory_json"])["last_condense_seq"] == 2
    condense_rows = [cp for cp in conn.checkpoints if cp["kind"] == CONDENSE_KIND]
    assert len(condense_rows) == 1


@pytest.mark.asyncio
async def test_maybe_run_condense_skips_when_no_new_checkpoints() -> None:
    conn = _OrchestratorFakeConn()
    conn.session["working_memory_json"] = {"active_slice": {"last_condense_seq": 99}}
    pool = _OrchestratorFakePool(conn)

    updated = await maybe_run_condense(
        pool,  # type: ignore[arg-type]
        session=conn.session,
        session_id="sess-condense-sidecar",
        principal_id="principal-1",
    )

    assert updated["session_revision"] == 11
    assert str(updated["plan_summary"]) == "Before condense"
    assert not any(cp["kind"] == CONDENSE_KIND for cp in conn.checkpoints)
