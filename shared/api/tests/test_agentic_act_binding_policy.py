# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral locks for loop act binding — HITL tools require tree nodes; explore streak guard.
# Related:
# - api/ewa_platform/agentic/kernel/act_binding_policy.py
# - api/ewa_platform/agentic/kernel/loop.py
# ---

from __future__ import annotations

from typing import Any

import pytest

from api.ewa_platform.agentic.kernel import act_executor as act_mod
from api.ewa_platform.agentic.kernel import loop as loop_mod
from api.ewa_platform.agentic.kernel.act_binding_policy import (
    loop_act_binding_verdict,
    replanning_steering_when_scheduler_idle,
)
from api.ewa_platform.agentic.kernel.think_schema import AgenticThinkOutput
from api.ewa_platform.agentic.kernel.types import AgenticContext


def _ctx(**overrides: Any) -> AgenticContext:
    base = {
        "session": {"id": "sess-1", "status": "executing", "policy_json": {}},
        "active_nodes": [],
        "tree_summary": {"completed": 3},
        "checkpoints": [],
        "inbound_messages": [],
        "llm_messages": [],
        "scheduled_node": None,
    }
    base.update(overrides)
    return AgenticContext(**base)


def test_companion_hitl_requires_tree_node() -> None:
    allowed, reason = loop_act_binding_verdict(
        act_node_id=None,
        tool_name="file_save_text",
        ctx=_ctx(),
    )
    assert allowed is False
    assert reason == "companion_hitl_requires_tree_node"


def test_bound_node_on_active_list_allowed() -> None:
    node_id = "node-1"
    allowed, reason = loop_act_binding_verdict(
        act_node_id=node_id,
        tool_name="file_create",
        ctx=_ctx(active_nodes=[{"id": node_id, "status": "pending"}]),
    )
    assert allowed is True
    assert reason == ""


def test_scheduler_tool_mismatch_rejected() -> None:
    scheduled = {
        "id": "node-roadmap",
        "status": "pending",
        "tool_name": "file_create",
        "tool_args_json": {"name": "roadmap.txt"},
    }
    allowed, reason = loop_act_binding_verdict(
        act_node_id="node-roadmap",
        tool_name="file_save_text",
        ctx=_ctx(active_nodes=[scheduled], scheduled_node=scheduled),
        think_act_node_id=None,
    )
    assert allowed is False
    assert reason == "scheduler_tool_mismatch"


def test_scheduler_tool_mismatch_allowed_when_think_sets_node() -> None:
    scheduled = {
        "id": "node-save",
        "status": "pending",
        "tool_name": "file_save_text",
        "tool_args_json": {"name": "rules.txt", "body": "text"},
    }
    allowed, reason = loop_act_binding_verdict(
        act_node_id="node-save",
        tool_name="file_save_text",
        ctx=_ctx(active_nodes=[scheduled], scheduled_node=scheduled),
        think_act_node_id="node-save",
    )
    assert allowed is True
    assert reason == ""


def test_scheduler_file_target_mismatch_rejected() -> None:
    scheduled = {
        "id": "node-roadmap",
        "status": "pending",
        "tool_name": "file_create",
        "tool_args_json": {"name": "roadmap.txt"},
    }
    allowed, reason = loop_act_binding_verdict(
        act_node_id="node-roadmap",
        tool_name="file_create",
        ctx=_ctx(active_nodes=[scheduled], scheduled_node=scheduled),
        think_act_node_id=None,
        tool_args={"name": "правила_работы_коры_и_тани.txt"},
    )
    assert allowed is False
    assert reason == "scheduler_file_target_mismatch"


def test_redundant_catalog_list_streak_rejected() -> None:
    ctx = _ctx(
        session={
            "id": "sess-1",
            "status": "replanning",
            "working_memory_json": {
                "active_slice": {
                    "last_act_summaries": [
                        {"tool": "catalog_list", "status": "ok", "summary": "a"},
                        {"tool": "catalog_list", "status": "ok", "summary": "b"},
                        {"tool": "catalog_list", "status": "ok", "summary": "c"},
                    ]
                }
            },
        },
        tree_summary={"completed": 2},
    )
    allowed, reason = loop_act_binding_verdict(
        act_node_id=None,
        tool_name="catalog_list",
        ctx=ctx,
    )
    assert allowed is False
    assert reason == "redundant_explore_act"


def test_scheduler_idle_steering_when_tree_completed() -> None:
    msg = replanning_steering_when_scheduler_idle(_ctx(tree_summary={"completed": 4}))
    assert msg is not None
    assert "mutate" in msg
    assert "file_create" in msg


@pytest.mark.asyncio
async def test_unbound_file_save_text_rejected_before_dispatch(monkeypatch: pytest.MonkeyPatch) -> None:
    replan_calls: list[str] = []
    dispatched: list[str] = []

    async def _fake_replan(*_a: object, **kwargs: object) -> tuple[None, dict[str, Any]]:
        replan_calls.append(str(kwargs.get("reason")))
        return None, {
            "id": "sess-bind",
            "status": "replanning",
            "session_revision": 9,
            "working_memory_json": {},
        }

    async def _fake_dispatch(tool_name: str, *_a: object, **_k: object) -> object:
        dispatched.append(tool_name)
        raise AssertionError("tool must not run when binding rejected")

    async def _fake_append(*_a: object, **_k: object) -> dict[str, Any]:
        return {"id": "cp-1", "seq": 1}

    monkeypatch.setattr(loop_mod, "agentic_step_scheduler_enabled", lambda: False)
    monkeypatch.setattr(loop_mod.agentic_pg, "agentic_record_replanning_atomic", _fake_replan)
    monkeypatch.setattr(act_mod, "agentic_dispatch_tool", _fake_dispatch)
    monkeypatch.setattr(act_mod.agentic_pg, "agentic_checkpoint_append", _fake_append)
    monkeypatch.setattr(act_mod.agentic_pg, "agentic_record_replanning_atomic", _fake_replan)

    session = {
        "id": "sess-bind",
        "principal_id": "p-1",
        "status": "executing",
        "session_revision": 8,
        "goal_json": {"text": "fill doc"},
        "policy_json": {},
        "iteration_count": 0,
    }
    ctx = AgenticContext(
        session=session,
        active_nodes=[],
        tree_summary={"completed": 2},
        checkpoints=[],
        inbound_messages=[],
        llm_messages=[],
        scheduled_node=None,
    )
    think_out = AgenticThinkOutput(
        action="act",
        act_tool_name="file_save_text",
        act_tool_args={"name": "rules.txt", "text": "body"},
    )

    result = await loop_mod._process_think_output(
        pool=object(),  # type: ignore[arg-type]
        think_out=think_out,
        session=session,
        session_id="sess-bind",
        principal_id="p-1",
        tool_ctx=object(),
        iterations=1,
        ctx=ctx,
    )

    assert result is None
    assert replan_calls == ["companion_hitl_requires_tree_node"]
    assert dispatched == []
