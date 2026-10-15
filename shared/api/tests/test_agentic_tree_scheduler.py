# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Phase 4.1.2 — tree scheduler selection and act binding tests.
# ---

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock

import pytest

from api.ewa_platform.agentic.kernel.think_schema import AgenticThinkOutput
from api.ewa_platform.agentic.kernel.tree_scheduler import (
    resolve_act_binding,
    scheduler_hint_line,
    select_next_runnable_node,
)
from api.ewa_platform.agentic.kernel.types import AgenticContext
from api.ewa_platform.agentic.tools.profiles import require_hitl_for_tool, resolve_tools_allowlist


def _node(node_id: str, status: str, sort_order: int = 0, tool: str = "catalog_list") -> dict[str, Any]:
    return {
        "id": node_id,
        "status": status,
        "sort_order": sort_order,
        "title": f"Step {node_id}",
        "tool_name": tool,
        "tool_args_json": {"user_line": "go", "mode": "search"},
        "materialized_path": f"/{sort_order}/",
    }


def test_select_next_runnable_prefers_running() -> None:
    nodes = [_node("n1", "pending", 0), _node("n2", "running", 1)]
    picked = select_next_runnable_node(nodes)
    assert picked is not None
    assert picked["id"] == "n2"


def test_select_next_runnable_picks_lowest_pending() -> None:
    nodes = [_node("n2", "pending", 2), _node("n1", "pending", 1)]
    picked = select_next_runnable_node(nodes)
    assert picked is not None
    assert picked["id"] == "n1"


def test_resolve_act_binding_uses_scheduler_when_think_omits_node() -> None:
    scheduled = _node("sched-1", "pending", 0, tool="recall_memory")
    node_id, tool, args = resolve_act_binding(None, None, {}, scheduled)
    assert node_id == "sched-1"
    assert tool == "recall_memory"
    assert args["user_line"] == "go"


def test_scheduler_hint_line_includes_node_id() -> None:
    line = scheduler_hint_line(_node("abc", "pending"))
    assert "abc" in line


def test_research_profile_allowlist() -> None:
    allow = resolve_tools_allowlist({"tools_profile": "research"})
    assert allow is not None
    assert "paperless_import" in allow
    assert "file_delete" not in allow


def test_destructive_tool_requires_hitl_by_default() -> None:
    assert require_hitl_for_tool({}, "file_delete") is True
    assert require_hitl_for_tool({"require_hitl_destructive": False}, "file_delete") is False


@pytest.mark.asyncio
async def test_process_act_uses_scheduler_binding(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.ewa_platform.agentic.kernel import act_executor as act_mod
    from api.ewa_platform.agentic.kernel import loop as loop_mod

    dispatched: list[tuple[str, dict[str, Any]]] = []

    async def _fake_dispatch(tool_name: str, args: dict[str, Any], _ctx: object, **_: object) -> object:
        dispatched.append((tool_name, args))
        from api.ewa_platform.agentic.kernel.types import AgenticActResult

        return AgenticActResult(status="ok", summary="done", tool_name=tool_name)

    async def _noop_mark(*_a: object, **_k: object) -> None:
        return None

    async def _fake_append(*_a: object, **_k: object) -> dict[str, Any]:
        return {"id": "cp-1", "seq": 7}

    async def _fake_transition(*_a: object, **_k: object) -> object:
        from api.ewa_platform.agentic.kernel.state_machine import TransitionResult

        return TransitionResult(
            ok=True,
            session={
                "id": "sess-ts",
                "status": "executing",
                "session_revision": 2,
                "iteration_count": 1,
            },
        )

    async def _noop_tree_update(*_a: object, **_k: object) -> None:
        return None

    monkeypatch.setattr(loop_mod, "agentic_step_scheduler_enabled", lambda: False)
    monkeypatch.setattr(act_mod, "agentic_dispatch_tool", _fake_dispatch)
    monkeypatch.setattr(act_mod, "mark_node_running", _noop_mark)
    monkeypatch.setattr(act_mod.agentic_pg, "agentic_checkpoint_append", _fake_append)
    monkeypatch.setattr(act_mod.agentic_pg, "agentic_task_tree_update", _noop_tree_update)
    monkeypatch.setattr(act_mod.fsm, "apply_session_transition", _fake_transition)
    monkeypatch.setattr(act_mod, "observe_after_act", AsyncMock(side_effect=lambda *_a, **kw: kw.get("session")))
    monkeypatch.setattr(
        act_mod,
        "policy_gate_before_act",
        AsyncMock(return_value=(True, None)),
    )

    class _Drv:
        async def read(self, **_k: object) -> object:
            return object()

    monkeypatch.setattr(act_mod, "EwaAgenticDriver", lambda _pool: _Drv())
    monkeypatch.setattr(act_mod, "resolve_auto_accept_hitl", AsyncMock(return_value=False))
    monkeypatch.setattr(act_mod, "validate_tool_args_for_registry", lambda *_a, **_k: {"user_line": "hi"})
    monkeypatch.setattr(act_mod, "require_hitl_for_tool", lambda *_a, **_k: False)

    session = {
        "id": "sess-ts",
        "principal_id": "p-1",
        "status": "executing",
        "session_revision": 1,
        "goal_json": {"text": "test"},
        "policy_json": {"require_hitl_destructive": False},
        "iteration_count": 0,
    }
    scheduled = _node("node-sched", "pending", tool="catalog_list")
    ctx = AgenticContext(
        session=session,
        active_nodes=[scheduled],
        tree_summary={},
        checkpoints=[],
        inbound_messages=[],
        llm_messages=[],
        scheduled_node=scheduled,
    )
    think_out = AgenticThinkOutput(action="act", act_tool_name="catalog_list", act_tool_args={"user_line": "hi"})
    result = await loop_mod._process_think_output(
        pool=object(),  # type: ignore[arg-type]
        think_out=think_out,
        session=session,
        session_id="sess-ts",
        principal_id="p-1",
        tool_ctx=object(),
        iterations=1,
        ctx=ctx,
    )
    assert result is None
    assert dispatched
    assert dispatched[0][0] == "catalog_list"


@pytest.mark.asyncio
async def test_process_act_needs_confirm_keeps_bound_node_awaiting_human(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from api.ewa_platform.agentic.kernel import act_executor as act_mod
    from api.ewa_platform.agentic.kernel import loop as loop_mod

    tree_updates: list[dict[str, Any]] = []
    transitions: list[dict[str, Any]] = []

    async def _fake_dispatch(tool_name: str, args: dict[str, Any], _ctx: object, **_: object) -> object:
        from api.ewa_platform.agentic.kernel.types import AgenticActResult

        return AgenticActResult(status="needs_confirm", summary="confirm tool action", tool_name=tool_name)

    async def _noop_mark(*_a: object, **_k: object) -> None:
        return None

    async def _fake_append(*_a: object, **_k: object) -> dict[str, Any]:
        return {"id": "cp-confirm", "seq": 9}

    async def _fake_tree_update(*_a: object, **kwargs: object) -> None:
        tree_updates.append(dict(kwargs))
        return None

    async def _fake_transition(*_a: object, **kwargs: object) -> object:
        from api.ewa_platform.agentic.kernel.state_machine import TransitionResult

        transitions.append(dict(kwargs))
        return TransitionResult(
            ok=True,
            session={
                "id": "sess-confirm",
                "status": "awaiting_human",
                "session_revision": 2,
                "iteration_count": 1,
                "gate_json": kwargs.get("gate_json"),
            },
        )

    monkeypatch.setattr(loop_mod, "agentic_step_scheduler_enabled", lambda: False)
    monkeypatch.setattr(act_mod, "agentic_dispatch_tool", _fake_dispatch)
    monkeypatch.setattr(act_mod, "mark_node_running", _noop_mark)
    monkeypatch.setattr(act_mod.agentic_pg, "agentic_checkpoint_append", _fake_append)
    monkeypatch.setattr(act_mod.agentic_pg, "agentic_task_tree_update", _fake_tree_update)
    monkeypatch.setattr(act_mod.fsm, "apply_session_transition", _fake_transition)
    monkeypatch.setattr(act_mod, "publish_agentic_session_lifecycle_sync", lambda *_a, **_k: None)
    monkeypatch.setattr(act_mod, "policy_gate_before_act", AsyncMock(return_value=(True, None)))
    monkeypatch.setattr(act_mod, "resolve_auto_accept_hitl", AsyncMock(return_value=False))
    monkeypatch.setattr(act_mod, "validate_tool_args_for_registry", lambda *_a, **_k: {"user_line": "hi"})
    monkeypatch.setattr(act_mod, "require_hitl_for_tool", lambda *_a, **_k: False)

    class _Drv:
        async def read(self, **_k: object) -> object:
            return object()

    monkeypatch.setattr(act_mod, "EwaAgenticDriver", lambda _pool: _Drv())
    monkeypatch.setattr(
        "api.ewa_platform.agentic.auto_accept_hitl.try_auto_finalize_needs_confirm",
        AsyncMock(return_value=None),
    )

    session = {
        "id": "sess-confirm",
        "principal_id": "p-1",
        "status": "executing",
        "session_revision": 1,
        "goal_json": {"text": "test"},
        "policy_json": {"require_hitl_destructive": False},
        "iteration_count": 0,
    }
    scheduled = _node("node-confirm", "pending", tool="catalog_list")
    ctx = AgenticContext(
        session=session,
        active_nodes=[scheduled],
        tree_summary={},
        checkpoints=[],
        inbound_messages=[],
        llm_messages=[],
        scheduled_node=scheduled,
    )
    think_out = AgenticThinkOutput(action="act", act_tool_name="catalog_list", act_tool_args={"user_line": "hi"})

    result = await loop_mod._process_think_output(
        pool=object(),  # type: ignore[arg-type]
        think_out=think_out,
        session=session,
        session_id="sess-confirm",
        principal_id="p-1",
        tool_ctx=object(),
        iterations=1,
        ctx=ctx,
    )

    assert result is not None
    assert result.ok is True
    assert tree_updates
    assert tree_updates[-1]["node_id"] == "node-confirm"
    assert tree_updates[-1]["status"] == "awaiting_human"
    assert tree_updates[-1]["gate_json"]["bound_node_id"] == "node-confirm"
    assert not any(update.get("status") == "failed" for update in tree_updates)
    assert transitions[-1]["gate_json"]["bound_node_id"] == "node-confirm"
