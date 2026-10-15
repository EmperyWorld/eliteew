# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for DAG tool_registry_adapter bridge (Phase 2.5).
# Related:
# - api/ewa_platform/companion/workflows/dag/tool_registry_adapter.py
# ---

from __future__ import annotations

from unittest.mock import AsyncMock, patch
from uuid import UUID

import pytest

from api.ewa_platform.companion.orchestration.tool_registry import ToolContext
from api.ewa_platform.companion.workflows.dag.tool_registry_adapter import (
    build_tool_dispatch_args,
    execute_tool_registry_node,
    resolve_tool_name,
    tool_result_to_node_execution_result,
    tool_result_to_node_outputs,
)
from api.ewa_platform.schemas.pydantic.companion_workflow_v2 import (
    CompanionWorkflowNodeConfigV2,
    CompanionWorkflowNodeV2,
    CompanionWorkflowOutputSpecV2,
)


def _image_node(**kwargs: object) -> CompanionWorkflowNodeV2:
    defaults = {
        "id": UUID("11111111-1111-4111-8111-111111111111"),
        "type": "image_gen",
        "inputs": {"prompt": "draw a cat"},
        "outputs": {
            "reply": CompanionWorkflowOutputSpecV2(type="text"),
            "image_url": CompanionWorkflowOutputSpecV2(type="image_url"),
        },
    }
    defaults.update(kwargs)
    return CompanionWorkflowNodeV2.model_validate(defaults)


def test_resolve_tool_name_image_gen_default() -> None:
    node = _image_node()
    assert resolve_tool_name(node) == "image_generation"


def test_resolve_tool_name_api_call_requires_config_tool_name() -> None:
    node = _image_node(type="api_call", config=CompanionWorkflowNodeConfigV2())
    assert resolve_tool_name(node) is None

    node_with_tool = _image_node(
        type="api_call",
        config=CompanionWorkflowNodeConfigV2(tool_name="file_create"),
    )
    assert resolve_tool_name(node_with_tool) == "file_create"


def test_resolve_tool_name_rejects_non_allowlisted_override() -> None:
    node = _image_node(config=CompanionWorkflowNodeConfigV2(tool_name="unknown_tool_xyz"))
    assert resolve_tool_name(node) is None


def test_build_tool_dispatch_args_maps_prompt_and_parent_link() -> None:
    node = _image_node()
    ctx = ToolContext(
        principal_id="p-1",
        user_line="fallback line",
        content_catalog_user_id="cat-1",
        oauth2_sub_for_content_alternate=None,
    )
    args = build_tool_dispatch_args(
        node=node,
        resolved_inputs={"prompt": "draw a cat"},
        tool_name="image_generation",
        ctx=ctx,
        workflow_parent_run_id="run-1",
        workflow_parent_step_index=2,
    )
    assert args["prompt"] == "draw a cat"
    assert args["user_line"] == "draw a cat"
    assert args["_workflow_parent_run_id"] == "run-1"
    assert args["_workflow_parent_step_index"] == 2
    assert args["_tool_router_bypass_line_match"] is True


def test_tool_result_to_node_outputs_maps_reply_and_task_run() -> None:
    node = _image_node()
    outputs = tool_result_to_node_outputs(
        {
            "reply": "Image queued",
            "data": {"image_url": "https://cdn.example/img.png"},
            "task_run": {"id": "child-run-1", "status": "running"},
        },
        node=node,
    )
    assert outputs["reply"] == "Image queued"
    assert outputs["image_url"] == "https://cdn.example/img.png"
    assert outputs["run_id"] == "child-run-1"


@pytest.mark.parametrize(
    ("tool_status", "expected"),
    [
        ("ok", "ok"),
        ("accepted", "accepted"),
        ("needs_confirm", "needs_confirm"),
        ("error", "failed"),
    ],
)
def test_tool_result_to_node_execution_result_status_map(tool_status: str, expected: str) -> None:
    node = _image_node()
    result = tool_result_to_node_execution_result(
        {"status": tool_status, "reply": "x", "data": {}},
        node=node,
        tool_name="image_generation",
    )
    assert result.status == expected


@pytest.mark.asyncio
async def test_execute_tool_registry_node_dispatches_image_generation() -> None:
    node = _image_node()
    ctx = ToolContext(
        principal_id="p-1",
        user_line="draw a cat",
        content_catalog_user_id="cat-1",
        oauth2_sub_for_content_alternate=None,
    )
    mock_result = {
        "tool": "image_generation",
        "status": "accepted",
        "reply": "Working on it",
        "data": {"background": True},
        "task_run": {"id": "run-abc", "status": "running"},
    }
    with patch(
        "api.ewa_platform.companion.workflows.dag.tool_registry_adapter.dispatch_tool_by_name",
        new=AsyncMock(return_value=mock_result),
    ) as dispatch:
        result = await execute_tool_registry_node(node, {"prompt": "draw a cat"}, ctx)
    dispatch.assert_awaited_once()
    assert result.status == "accepted"
    assert result.outputs["run_id"] == "run-abc"
    assert result.outputs["reply"] == "Working on it"


@pytest.mark.asyncio
async def test_execute_tool_registry_node_none_dispatch_is_failed() -> None:
    node = _image_node()
    ctx = ToolContext(
        principal_id="p-1",
        user_line="draw a cat",
        content_catalog_user_id="cat-1",
        oauth2_sub_for_content_alternate=None,
    )
    with patch(
        "api.ewa_platform.companion.workflows.dag.tool_registry_adapter.dispatch_tool_by_name",
        new=AsyncMock(return_value=None),
    ):
        result = await execute_tool_registry_node(node, {"prompt": "draw a cat"}, ctx)
    assert result.status == "failed"
    assert "did not handle" in str(result.error)


def _api_call_node(tool_name: str) -> CompanionWorkflowNodeV2:
    return _image_node(
        id="22222222-2222-4222-8222-222222222222",
        type="api_call",
        config=CompanionWorkflowNodeConfigV2(tool_name=tool_name),
        inputs={"name": "report.txt"},
        outputs={"reply": CompanionWorkflowOutputSpecV2(type="text")},
    )


@pytest.mark.asyncio
async def test_execute_tool_registry_node_dispatches_api_call_tool() -> None:
    node = _api_call_node("file_create")
    ctx = ToolContext(
        principal_id="p-1",
        user_line="create file",
        content_catalog_user_id="cat-1",
        oauth2_sub_for_content_alternate=None,
    )
    mock_result = {
        "tool": "file_create",
        "status": "ok",
        "reply": "File created",
        "data": {},
    }
    with patch(
        "api.ewa_platform.companion.workflows.dag.tool_registry_adapter.dispatch_tool_by_name",
        new=AsyncMock(return_value=mock_result),
    ) as dispatch:
        result = await execute_tool_registry_node(node, {"name": "report.txt"}, ctx)
    dispatch.assert_awaited_once()
    call_args = dispatch.await_args
    assert call_args is not None
    assert call_args.args[0] == "file_create"
    assert result.status == "ok"
    assert result.outputs["reply"] == "File created"


@pytest.mark.asyncio
async def test_execute_tool_backed_node_uses_adapter_when_enabled() -> None:
    from api.ewa_platform.companion.workflows.dag.executors import execute_tool_backed_node

    node = _api_call_node("file_create")
    ctx = ToolContext(
        principal_id="p-1",
        user_line="create file",
        content_catalog_user_id="cat-1",
        oauth2_sub_for_content_alternate=None,
    )
    mock_result = {
        "tool": "file_create",
        "status": "ok",
        "reply": "File created",
        "data": {},
    }
    with (
        patch(
            "api.ewa_platform.companion.workflows.config.companion_dag_tool_registry_adapter_enabled",
            return_value=True,
        ),
        patch(
            "api.ewa_platform.companion.workflows.dag.tool_registry_adapter.dispatch_tool_by_name",
            new=AsyncMock(return_value=mock_result),
        ) as dispatch,
    ):
        result = await execute_tool_backed_node(node, {"name": "report.txt"}, ctx)
    dispatch.assert_awaited_once()
    assert result.status == "ok"
    assert result.outputs["reply"] == "File created"


@pytest.mark.asyncio
async def test_execute_tool_backed_node_stub_when_adapter_disabled() -> None:
    from api.ewa_platform.companion.workflows.dag.executors import execute_tool_backed_node

    node = _api_call_node("file_create")
    ctx = ToolContext(
        principal_id="p-1",
        user_line="create file",
        content_catalog_user_id="cat-1",
        oauth2_sub_for_content_alternate=None,
    )
    with patch(
        "api.ewa_platform.companion.workflows.config.companion_dag_tool_registry_adapter_enabled",
        return_value=False,
    ):
        result = await execute_tool_backed_node(node, {"name": "report.txt"}, ctx)
    assert result.status == "ok"
    assert "[api_call stub]" in str(result.outputs.get("reply"))
    assert "file_create" in str(result.outputs.get("reply"))
