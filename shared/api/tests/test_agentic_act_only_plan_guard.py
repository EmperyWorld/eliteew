# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Locks for act-only replanning without plan nodes — must not run tools or plan_ready empty.
# Related:
# - api/ewa_platform/agentic/kernel/loop.py
# - api/ewa_platform/agentic/respond.py
# ---

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock

import pytest

from api.ewa_platform.agentic.kernel import act_executor as act_mod
from api.ewa_platform.agentic.kernel import loop as loop_mod
from api.ewa_platform.agentic.kernel import state_machine as fsm
from api.ewa_platform.agentic.kernel.circuit_breaker import REASONING_LOOP_DETECTED, WM_REPLANNING_COUNT
from api.ewa_platform.agentic.kernel.think_schema import AgenticThinkOutput
from api.ewa_platform.agentic.kernel.types import AgenticContext
from api.ewa_platform.agentic.respond import apply_agentic_human_response


@pytest.mark.asyncio
async def test_replanning_act_without_tree_skips_tool_and_records_replanning(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    replan_calls: list[str] = []
    dispatched: list[str] = []

    async def _fake_replan(*_a: object, **kwargs: object) -> tuple[None, dict[str, Any]]:
        replan_calls.append(str(kwargs.get("reason")))
        return None, {
            "id": "sess-guard",
            "status": "replanning",
            "session_revision": 9,
            "working_memory_json": {WM_REPLANNING_COUNT: 2},
        }

    async def _fake_dispatch(tool_name: str, *_a: object, **_k: object) -> object:
        dispatched.append(tool_name)
        raise AssertionError("tool must not run when replanning with empty tree")

    async def _fake_append(*_a: object, **_k: object) -> dict[str, Any]:
        return {"id": "cp-1", "seq": 1}

    monkeypatch.setattr(loop_mod, "agentic_step_scheduler_enabled", lambda: False)
    monkeypatch.setattr(loop_mod.agentic_pg, "agentic_record_replanning_atomic", _fake_replan)
    monkeypatch.setattr(act_mod, "agentic_dispatch_tool", _fake_dispatch)
    monkeypatch.setattr(act_mod.agentic_pg, "agentic_checkpoint_append", _fake_append)
    monkeypatch.setattr(act_mod.agentic_pg, "agentic_record_replanning_atomic", _fake_replan)

    session = {
        "id": "sess-guard",
        "principal_id": "p-1",
        "status": "replanning",
        "session_revision": 8,
        "goal_json": {"text": "research"},
        "policy_json": {},
        "iteration_count": 0,
    }
    ctx = AgenticContext(
        session=session,
        active_nodes=[],
        tree_summary={},
        checkpoints=[],
        inbound_messages=[],
        llm_messages=[],
    )
    think_out = AgenticThinkOutput(action="act", act_tool_name="catalog_list", act_tool_args={"user_line": "x"})

    result = await loop_mod._process_think_output(
        pool=object(),  # type: ignore[arg-type]
        think_out=think_out,
        session=session,
        session_id="sess-guard",
        principal_id="p-1",
        tool_ctx=object(),
        iterations=1,
        ctx=ctx,
    )

    assert result is None
    assert replan_calls == ["act_without_plan_tree"]
    assert dispatched == []


@pytest.mark.asyncio
async def test_planning_empty_plan_does_not_plan_ready(monkeypatch: pytest.MonkeyPatch) -> None:
    transitions: list[str] = []
    replan_calls: list[str] = []

    async def _fake_transition(*_a: object, **kwargs: object) -> object:
        transitions.append(str(kwargs.get("event")))
        from api.ewa_platform.agentic.kernel.state_machine import TransitionResult

        return TransitionResult(ok=True, session={"id": "sess-empty", "status": "executing", "session_revision": 2})

    async def _fake_replan(*_a: object, **kwargs: object) -> tuple[None, dict[str, Any]]:
        replan_calls.append(str(kwargs.get("reason")))
        return None, {"id": "sess-empty", "status": "replanning", "session_revision": 2}

    async def _fake_append(*_a: object, **_k: object) -> dict[str, Any]:
        return {"id": "cp-1", "seq": 1}

    monkeypatch.setattr(loop_mod.fsm, "apply_session_transition", _fake_transition)
    monkeypatch.setattr(loop_mod.agentic_pg, "agentic_record_replanning_atomic", _fake_replan)
    monkeypatch.setattr(loop_mod.agentic_pg, "agentic_checkpoint_append", _fake_append)
    from api.ewa_platform.agentic.kernel import plan_applier as plan_mod

    monkeypatch.setattr(plan_mod.agentic_pg, "agentic_record_replanning_atomic", _fake_replan)
    monkeypatch.setattr(plan_mod.agentic_pg, "agentic_checkpoint_append", _fake_append)

    session = {
        "id": "sess-empty",
        "principal_id": "p-1",
        "status": "planning",
        "session_revision": 1,
        "goal_json": {"text": "goal"},
    }
    think_out = AgenticThinkOutput(action="plan", plan_nodes=[], plan_summary_patch="noop")

    result = await loop_mod._process_think_output(
        pool=object(),  # type: ignore[arg-type]
        think_out=think_out,
        session=session,
        session_id="sess-empty",
        principal_id="p-1",
        tool_ctx=None,
        iterations=1,
    )

    assert result is None
    assert replan_calls == ["empty_plan_emitted"]
    assert transitions == []


@pytest.mark.asyncio
async def test_planning_successful_act_persists_working_memory(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, Any] = {}

    async def _fake_dispatch(*_a: object, **_k: object) -> object:
        from api.ewa_platform.agentic.kernel.types import AgenticActResult

        return AgenticActResult(status="ok", summary="listed", tool_name="catalog_list")

    async def _fake_append(*_a: object, **_k: object) -> dict[str, Any]:
        return {"id": "cp-1", "seq": 1}

    async def _fake_transition(
        *_a: object,
        extra_fields: dict[str, Any] | None = None,
        event: object = None,
        **_kwargs: object,
    ) -> object:
        from api.ewa_platform.agentic.kernel.state_machine import TransitionResult

        extra = extra_fields or {}
        captured["event"] = event
        captured["wm"] = extra.get("working_memory_json")
        return TransitionResult(
            ok=True,
            session={
                "id": "sess-plan",
                "status": "planning",
                "session_revision": 2,
                "iteration_count": 1,
                "working_memory_json": extra.get("working_memory_json"),
            },
        )

    async def _fake_observe(*_a: object, **kwargs: object) -> object:
        return kwargs.get("session")

    monkeypatch.setattr(loop_mod, "agentic_step_scheduler_enabled", lambda: False)
    monkeypatch.setattr(act_mod, "agentic_dispatch_tool", _fake_dispatch)
    monkeypatch.setattr(act_mod.agentic_pg, "agentic_checkpoint_append", _fake_append)
    monkeypatch.setattr(act_mod.fsm, "apply_session_transition", _fake_transition)
    monkeypatch.setattr(act_mod, "validate_tool_args_for_registry", lambda *_a, **_k: {"user_line": "x"})
    monkeypatch.setattr(act_mod, "observe_after_act", _fake_observe)
    monkeypatch.setattr(act_mod, "policy_gate_before_act", AsyncMock(return_value=(True, None)))
    monkeypatch.setattr(act_mod, "resolve_auto_accept_hitl", AsyncMock(return_value=False))
    monkeypatch.setattr(act_mod, "require_hitl_for_tool", lambda *_a, **_k: False)

    class _Drv:
        async def read(self, **_k: object) -> object:
            return object()

    monkeypatch.setattr(act_mod, "EwaAgenticDriver", lambda _pool: _Drv())

    session = {
        "id": "sess-plan",
        "principal_id": "p-1",
        "status": "planning",
        "session_revision": 1,
        "goal_json": {"text": "explore"},
        "policy_json": {},
        "working_memory_json": {WM_REPLANNING_COUNT: 1},
        "iteration_count": 0,
    }
    ctx = AgenticContext(
        session=session,
        active_nodes=[],
        tree_summary={},
        checkpoints=[],
        inbound_messages=[],
        llm_messages=[],
    )
    think_out = AgenticThinkOutput(action="act", act_tool_name="catalog_list", act_tool_args={"user_line": "x"})

    result = await loop_mod._process_think_output(
        pool=object(),  # type: ignore[arg-type]
        think_out=think_out,
        session=session,
        session_id="sess-plan",
        principal_id="p-1",
        tool_ctx=object(),
        iterations=1,
        ctx=ctx,
    )

    assert result is None
    assert captured.get("event") == "step_ok_more"
    wm = captured.get("wm") or {}
    assert wm.get(WM_REPLANNING_COUNT) == 0


@pytest.mark.asyncio
async def test_human_respond_resets_replanning_circuit(monkeypatch: pytest.MonkeyPatch) -> None:
    session_row = {
        "id": "sess-hitl",
        "principal_id": "p-1",
        "status": fsm.STATUS_AWAITING_HUMAN,
        "session_revision": 34,
        "working_memory_json": {WM_REPLANNING_COUNT: 8, "terminate_reason": REASONING_LOOP_DETECTED},
        "gate_json": {"kind": "circuit_break"},
    }
    updated_wm: dict[str, Any] | None = None

    async def _fetch(*_a: object, **_k: object) -> dict[str, Any]:
        return dict(session_row)

    async def _list_tree(*_a: object, **_k: object) -> list[dict[str, Any]]:
        return []

    async def _inbound(*_a: object, **_k: object) -> None:
        return None

    async def _transition(*_a: object, **_k: object) -> object:
        from api.ewa_platform.agentic.kernel.state_machine import TransitionResult

        return TransitionResult(
            ok=True,
            session={
                **session_row,
                "status": fsm.STATUS_EXECUTING,
                "session_revision": 35,
                "gate_json": {},
            },
        )

    async def _update(*_a: object, **kwargs: object) -> dict[str, Any]:
        nonlocal updated_wm
        updated_wm = kwargs.get("working_memory_json")  # type: ignore[assignment]
        return {
            **session_row,
            "status": fsm.STATUS_EXECUTING,
            "session_revision": 36,
            "working_memory_json": updated_wm,
            "gate_json": {},
        }

    async def _status_counts(*_a: object, **_k: object) -> dict[str, int]:
        return {}

    monkeypatch.setattr(
        "api.ewa_platform.agentic.respond.agentic_pg.agentic_session_fetch_for_principal",
        _fetch,
    )
    monkeypatch.setattr(
        "api.ewa_platform.agentic.respond.agentic_pg.agentic_task_tree_list",
        _list_tree,
    )
    monkeypatch.setattr(
        "api.ewa_platform.agentic.respond.agentic_pg.agentic_inbound_insert",
        _inbound,
    )
    monkeypatch.setattr(
        "api.ewa_platform.agentic.respond.fsm.apply_session_transition",
        _transition,
    )
    monkeypatch.setattr(
        "api.ewa_platform.agentic.respond.agentic_pg.agentic_session_update",
        _update,
    )
    monkeypatch.setattr(
        "api.ewa_platform.agentic.respond.agentic_pg.agentic_task_tree_status_counts",
        _status_counts,
    )
    monkeypatch.setattr(
        "api.ewa_platform.agentic.respond.enqueue_agentic_loop_tick",
        lambda **_k: None,
    )
    monkeypatch.setattr(
        "api.ewa_platform.agentic.respond.sync_and_publish_task_run_from_session",
        AsyncMock(return_value={"id": "run-1"}),
    )

    out = await apply_agentic_human_response(
        pool=object(),  # type: ignore[arg-type]
        session_id="sess-hitl",
        principal_id="p-1",
        decision="confirm",
        message_text="continue",
    )

    assert out["ok"] is True
    assert updated_wm is not None
    assert updated_wm.get(WM_REPLANNING_COUNT) == 0
    assert "terminate_reason" not in updated_wm
