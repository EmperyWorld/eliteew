# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Delay-audit locks — empty-plan Think contract, persist failure cause surfacing.
# Invariants:
# - No live Postgres for unit paths.
# Related:
# - api/ewa_platform/agentic/kernel/engine.py
# - api/ewa_platform/agentic/kernel/loop.py
# ---

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from api.ewa_platform.agentic.kernel import loop as loop_mod
from api.ewa_platform.agentic.kernel.circuit_breaker import REASONING_LOOP_DETECTED
from api.ewa_platform.agentic.kernel.engine import validate_think_v1
from api.ewa_platform.agentic.kernel.think_command_v1 import AgenticStructuredThinkOutput
from api.ewa_platform.agentic.kernel.think_outcome import ThinkPhaseResult
from api.ewa_platform.agentic.kernel.think_schema import AgenticThinkOutput
from api.ewa_platform.agentic.kernel.think_schema_v1 import ThinkSchemaError
from api.ewa_platform.agentic.kernel.types import AgenticContext, LoopTickResult


def test_validate_think_v1_rejects_empty_mutate_on_empty_tree_replanning() -> None:
    """Empty mutate on replanning with no task tree must fail at Think contract, not loop churn."""

    v1 = AgenticStructuredThinkOutput.model_validate(
        {
            "reasoning_trace": "retry plan",
            "decision_type": "mutate",
            "payload": {
                "decision_type": "mutate",
                "plan_nodes": [
                    {
                        "node_kind": "subtask",
                        "title": "Analyze only",
                        "instruction": "think more",
                        "tool_name": None,
                        "tool_args": {},
                    }
                ],
            },
            "plan_update_summary": "перестраиваю",
        }
    )
    ctx = AgenticContext(
        session={"id": "s1", "status": "replanning", "goal_json": {"text": "goal"}, "policy_json": {}},
        active_nodes=[],
        tree_summary={},
        checkpoints=[],
        inbound_messages=[],
        llm_messages=[],
    )
    with pytest.raises(ThinkSchemaError, match="empty_plan_mutate_requires_executable_nodes"):
        validate_think_v1(v1, ctx)


def test_validate_think_v1_allows_subtask_only_mutate_when_tree_has_nodes() -> None:
    """Structural-only mutate is allowed when executable work already exists in the tree."""

    v1 = AgenticStructuredThinkOutput.model_validate(
        {
            "reasoning_trace": "patch",
            "decision_type": "mutate",
            "payload": {
                "decision_type": "mutate",
                "plan_nodes": [
                    {
                        "node_kind": "subtask",
                        "title": "Container",
                        "instruction": "group",
                        "tool_name": None,
                        "tool_args": {},
                    }
                ],
            },
            "plan_update_summary": "дополнение",
        }
    )
    ctx = AgenticContext(
        session={"id": "s1", "status": "replanning", "goal_json": {"text": "goal"}, "policy_json": {}},
        active_nodes=[{"id": "n1", "status": "pending", "tool_name": "catalog_list"}],
        tree_summary={"pending": 1},
        checkpoints=[],
        inbound_messages=[],
        llm_messages=[],
    )
    out = validate_think_v1(v1, ctx)
    assert out.decision_type == "mutate"


@pytest.mark.asyncio
async def test_handle_missing_think_output_surfaces_revision_conflict() -> None:
    session = {
        "id": "sess-persist",
        "principal_id": "p-1",
        "status": "planning",
        "session_revision": 4,
    }

    async def _fake_abort(*_a: object, **kwargs: object) -> LoopTickResult:
        return LoopTickResult(
            ok=True,
            session=session,
            continue_loop=False,
            reason=str(kwargs.get("reason")),
            iterations_ran=2,
        )

    with patch.object(loop_mod, "_abort_tick", _fake_abort):
        out = await loop_mod._handle_missing_think_output(
            pool=object(),  # type: ignore[arg-type]
            session=session,
            session_id="sess-persist",
            principal_id="p-1",
            think_ok=False,
            persist_error="revision_conflict",
            iterations=2,
        )

    assert out.reason == "think_persist_revision_conflict"


@pytest.mark.asyncio
async def test_persist_think_and_get_output_returns_revision_conflict(monkeypatch: pytest.MonkeyPatch) -> None:
    ctx = AgenticContext(
        session={"id": "sess-persist", "status": "planning", "session_revision": 7, "goal_json": {}, "policy_json": {}},
        active_nodes=[],
        tree_summary={},
        checkpoints=[],
        inbound_messages=[],
        llm_messages=[],
    )
    think_out = AgenticThinkOutput(action="plan", rationale="ok", plan_nodes=[])

    async def _fake_think(_ctx: AgenticContext) -> AgenticThinkOutput:
        return think_out

    persist_mock = AsyncMock(return_value=(None, None, "revision_conflict"))
    monkeypatch.setattr(loop_mod.agentic_pg, "agentic_persist_think_phase_atomic", persist_mock)

    phase = await loop_mod._persist_think_and_get_output(
        pool=object(),  # type: ignore[arg-type]
        session=ctx.session,
        session_id="sess-persist",
        principal_id="p-1",
        ctx=ctx,
        think_fn=_fake_think,
    )

    assert phase.kind == "persist_conflict"
    assert phase.think_out is None
    assert phase.persist_error == "revision_conflict"
    assert int(phase.session["session_revision"]) == 7


@pytest.mark.asyncio
async def test_parse_awaiting_human_does_not_fatal_abort() -> None:
    """Circuit-open HITL must surface Reasoning_Loop_Detected — never think_persist_failed."""

    session = {
        "id": "sess-circuit",
        "principal_id": "p-1",
        "status": "awaiting_human",
        "session_revision": 18,
        "gate_json": {"kind": "confirm", "prompt": "loop"},
        "working_memory_json": {"terminate_reason": REASONING_LOOP_DETECTED},
    }
    phase = ThinkPhaseResult(kind="parse_awaiting_human", session=session)
    abort = AsyncMock()

    with (
        patch.object(loop_mod, "_abort_tick", abort),
        patch.object(loop_mod, "safe_sync_and_publish_task_run_from_session", AsyncMock()),
        patch.object(loop_mod, "publish_agentic_session_lifecycle_sync"),
    ):
        out = await loop_mod._handle_think_phase_without_output(
            pool=object(),  # type: ignore[arg-type]
            phase=phase,
            session_id="sess-circuit",
            principal_id="p-1",
            iterations=3,
        )

    assert out.reason == REASONING_LOOP_DETECTED
    assert out.continue_loop is False
    assert out.session is not None
    assert str(out.session.get("status")) == "awaiting_human"
    abort.assert_not_awaited()
