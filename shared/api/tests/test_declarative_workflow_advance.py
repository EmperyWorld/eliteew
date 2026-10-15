# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for declarative workflow parent/child linkage and plan merge.
# Related:
# - api/ewa_platform/companion/workflows/user/declarative_advance.py
# ---

from __future__ import annotations

from api.ewa_platform.companion.orchestration.tool_result_utils import (
    tool_result_as_mapping,
    tool_result_is_background,
    tool_result_is_workflow_step_success,
)
from api.ewa_platform.companion.workflows.user.workflow_parent_link import (
    inject_workflow_parent_args,
    merge_workflow_parent_plan,
)


def test_merge_workflow_parent_plan_from_tool_args() -> None:
    plan: dict[str, str | int] = {"kind": "image_generation_background"}
    merge_workflow_parent_plan(
        plan,
        {"_workflow_parent_run_id": "parent-run", "_workflow_step_index": 2},
    )
    assert plan["workflow_parent_run_id"] == "parent-run"
    assert plan["workflow_parent_step_index"] == 2


def test_merge_workflow_parent_plan_reads_dag_parent_step_index() -> None:
    plan: dict[str, str | int] = {"kind": "image_generation_background"}
    merge_workflow_parent_plan(
        plan,
        {"_workflow_parent_run_id": "parent-run", "_workflow_parent_step_index": 3},
    )
    assert plan["workflow_parent_step_index"] == 3


def test_inject_workflow_parent_args() -> None:
    args = inject_workflow_parent_args({}, parent_run_id="run-1", step_index=1)
    assert args["_workflow_parent_run_id"] == "run-1"
    assert args["_workflow_step_index"] == 1


def test_tool_result_is_workflow_step_success_includes_memory_append() -> None:
    assert tool_result_is_workflow_step_success("ok") is True
    assert tool_result_is_workflow_step_success("accepted") is True
    assert tool_result_is_workflow_step_success("memory_append") is True
    assert tool_result_is_workflow_step_success("error") is False
    assert tool_result_is_workflow_step_success("needs_confirm") is False


def test_tool_result_as_mapping_accepts_typed_dict_dict() -> None:
    payload = {
        "tool": "image_generation",
        "status": "accepted",
        "reply": "",
        "actions": [],
        "data": {"background": True},
        "task_run": {"id": "run-1"},
    }
    view = tool_result_as_mapping(payload)
    assert view["status"] == "accepted"
    assert tool_result_is_background(payload) is True
