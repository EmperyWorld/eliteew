# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# K3 lock: when step scheduler is ON, Think action=act must hand off (scheduler_handoff)
# and must not call agentic_dispatch_tool on the loop / act_executor path.
# Related:
# - api/ewa_platform/agentic/kernel/loop.py
# - api/ewa_platform/agentic/kernel/act_executor.py
# - documentation/product/ewa/EWA-AGENTIC-KERNEL-REDESIGN.md §K3
# ---

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock

import pytest

from api.ewa_platform.agentic.kernel import act_executor as act_mod
from api.ewa_platform.agentic.kernel import loop as loop_mod
from api.ewa_platform.agentic.kernel.think_schema import AgenticThinkOutput
from api.ewa_platform.agentic.kernel.types import AgenticContext, LoopTickResult, TransitionResult


@pytest.mark.asyncio
async def test_k3_scheduler_on_act_handoff_skips_dispatch(monkeypatch: pytest.MonkeyPatch) -> None:
    dispatched: list[str] = []

    async def _spy_dispatch(tool_name: str, *_a: object, **_k: object) -> object:
        dispatched.append(tool_name)
        raise AssertionError("inline Act must not run when scheduler enabled")

    monkeypatch.setattr(loop_mod, "agentic_step_scheduler_enabled", lambda: True)
    monkeypatch.setattr(act_mod, "agentic_dispatch_tool", _spy_dispatch)
    monkeypatch.setattr(loop_mod, "execute_inline_act", AsyncMock(side_effect=AssertionError("no inline act")))

    session = {
        "id": "sess-k3",
        "principal_id": "p-k3",
        "status": "executing",
        "session_revision": 3,
        "goal_json": {"text": "run tools"},
        "policy_json": {},
        "iteration_count": 1,
    }
    ctx = AgenticContext(
        session=session,
        active_nodes=[],
        tree_summary={"pending": 1},
        checkpoints=[],
        inbound_messages=[],
        llm_messages=[],
    )
    think_out = AgenticThinkOutput(
        action="act",
        act_tool_name="catalog_list",
        act_tool_args={"user_line": "x"},
    )

    result = await loop_mod._process_think_output(
        pool=object(),  # type: ignore[arg-type]
        think_out=think_out,
        session=session,
        session_id="sess-k3",
        principal_id="p-k3",
        tool_ctx=object(),
        iterations=1,
        ctx=ctx,
    )

    assert isinstance(result, LoopTickResult)
    assert result.ok is True
    assert result.continue_loop is True
    assert result.reason == "scheduler_handoff"
    assert result.session is not None
    assert result.session["status"] == "executing"
    assert dispatched == []
    cast_mock = loop_mod.execute_inline_act
    cast_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_k3_scheduler_on_act_from_planning_transitions_then_handoff(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    dispatched: list[str] = []

    async def _spy_dispatch(tool_name: str, *_a: object, **_k: object) -> object:
        dispatched.append(tool_name)
        raise AssertionError("inline Act must not run when scheduler enabled")

    executing = {
        "id": "sess-k3p",
        "principal_id": "p-k3",
        "status": "executing",
        "session_revision": 4,
        "goal_json": {"text": "plan then act"},
        "plan_summary": "do stuff",
        "policy_json": {},
        "iteration_count": 0,
    }

    async def _fake_fsm_apply(*_a: object, **_k: object) -> TransitionResult:
        return TransitionResult(ok=True, session=executing)

    monkeypatch.setattr(loop_mod, "agentic_step_scheduler_enabled", lambda: True)
    monkeypatch.setattr(act_mod, "agentic_dispatch_tool", _spy_dispatch)
    monkeypatch.setattr(loop_mod, "_fsm_port_apply", _fake_fsm_apply)
    monkeypatch.setattr(loop_mod, "publish_agentic_session_lifecycle_sync", lambda *_a, **_k: None)
    monkeypatch.setattr(loop_mod, "execute_inline_act", AsyncMock(side_effect=AssertionError("no inline act")))

    session = {
        "id": "sess-k3p",
        "principal_id": "p-k3",
        "status": "planning",
        "session_revision": 3,
        "goal_json": {"text": "plan then act"},
        "plan_summary": "do stuff",
        "policy_json": {},
        "iteration_count": 0,
    }
    think_out = AgenticThinkOutput(action="act", act_tool_name="catalog_list", act_tool_args={"user_line": "x"})

    result = await loop_mod._process_think_output(
        pool=object(),  # type: ignore[arg-type]
        think_out=think_out,
        session=session,
        session_id="sess-k3p",
        principal_id="p-k3",
        tool_ctx=None,
        iterations=1,
        ctx=None,
    )

    assert result is not None
    assert result.reason == "scheduler_handoff"
    assert result.session is not None
    assert result.session["status"] == "executing"
    assert dispatched == []


@pytest.mark.asyncio
async def test_k3_scheduler_off_still_calls_inline_act(monkeypatch: pytest.MonkeyPatch) -> None:
    called: list[str] = []

    async def _fake_inline(*_a: object, **_k: object) -> LoopTickResult | None:
        called.append("inline")
        return None

    monkeypatch.setattr(loop_mod, "agentic_step_scheduler_enabled", lambda: False)
    monkeypatch.setattr(loop_mod, "execute_inline_act", _fake_inline)

    session: dict[str, Any] = {
        "id": "sess-k3off",
        "principal_id": "p-k3",
        "status": "executing",
        "session_revision": 1,
        "goal_json": {"text": "x"},
        "policy_json": {},
        "iteration_count": 0,
    }
    think_out = AgenticThinkOutput(action="act", act_tool_name="catalog_list", act_tool_args={"user_line": "x"})

    result = await loop_mod._process_think_output(
        pool=object(),  # type: ignore[arg-type]
        think_out=think_out,
        session=session,
        session_id="sess-k3off",
        principal_id="p-k3",
        tool_ctx=None,
        iterations=1,
        ctx=None,
    )

    assert result is None
    assert called == ["inline"]
