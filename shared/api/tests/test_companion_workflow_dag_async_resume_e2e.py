# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# E2E behavioural test: v2 start → image_gen accepted → child callback → completed.
# Related:
# - documentation/product/ewa/EWA-COMPANION-WORKFLOW-ENGINE-V2.md
# ---

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from api.ewa_platform.companion.orchestration.tool_registry import ToolContext
from api.ewa_platform.companion.workflows.dag.context import WorkflowValidationContext
from api.ewa_platform.companion.workflows.dag.dag_async_resume import maybe_advance_workflow_from_child_run
from api.ewa_platform.companion.workflows.dag.dag_node_executor import execute_dag_node_step
from api.ewa_platform.companion.workflows.dag.dag_state_store import load_dag_state, merge_dag_state_into_plan
from api.ewa_platform.companion.workflows.dag.dag_workflow_starter import start_dag_workflow_v2
from api.ewa_platform.companion.workflows.dag.executors import NodeExecutionResult
from api.ewa_platform.schemas.pydantic.companion_workflow_v2 import CompanionWorkflowDefinitionV2

_FIXTURES = Path(__file__).resolve().parent / "fixtures"


def _load_fixture(name: str) -> CompanionWorkflowDefinitionV2:
    raw = json.loads((_FIXTURES / name).read_text(encoding="utf-8"))
    return CompanionWorkflowDefinitionV2.model_validate(raw)


@pytest.mark.unit
def test_async_resume_e2e_trigger_tool_callback_completion(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_WF_ENGINE_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_DAG_CELERY_ORCHESTRATION_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_WORKFLOW_ENGINE_V2_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_DAG_TOOL_REGISTRY_ADAPTER_ENABLED", "0")

    definition = _load_fixture("companion_workflow_v2_async_e2e.json")
    tool_ctx = ToolContext(
        principal_id="p1",
        user_line="dag async e2e",
        content_catalog_user_id="p1",
        oauth2_sub_for_content_alternate=None,
        main_pool=MagicMock(),
        companion_pool=MagicMock(),
        bearer_token="token",
        auth_user=MagicMock(id="oauth-1", is_verified=True),
    )

    state, _ = __import__(
        "api.ewa_platform.companion.workflows.dag.dag_state_store",
        fromlist=["build_initial_dag_state"],
    ).build_initial_dag_state(
        definition,
        user_line="dag async e2e",
        content_catalog_user_id="p1",
        validation_ctx=WorkflowValidationContext(is_verified_user=True),
    )
    assert state is not None
    node1, node2 = state.ordered_node_ids

    plan = merge_dag_state_into_plan(
        {
            "kind": "action_workflow_v2",
            "definition_json": definition.model_dump(mode="json"),
        },
        state,
    )
    run_store: dict[str, Any] = {
        "id": "run-parent",
        "principal_id": "p1",
        "intent_kind": "action_workflow_v2",
        "workflow_id": definition.workflow_id,
        "user_message": "dag async e2e",
        "plan_payload": plan,
        "status": "running",
        "run_revision": 1,
    }
    steps_store: list[dict[str, Any]] = [
        {
            "id": "step-1",
            "step_index": 1,
            "step_kind": "dag_node",
            "status": "pending",
            "input_payload": {"node_id": node1, "node_type": "prompt_gen"},
        },
        {
            "id": "step-2",
            "step_index": 2,
            "step_kind": "dag_node",
            "status": "pending",
            "input_payload": {"node_id": node2, "node_type": "image_gen"},
        },
    ]
    child_store: dict[str, Any] = {
        "id": "run-child",
        "principal_id": "p1",
        "status": "completed",
        "plan_payload": {
            "workflow_parent_run_id": "run-parent",
            "workflow_parent_step_index": 2,
        },
        "result_payload": {
            "image_url": "https://example.test/image.png",
            "content_id": "content-1",
        },
    }

    enqueue_calls: list[dict[str, Any]] = []

    def fake_enqueue(**kwargs: Any) -> str:
        enqueue_calls.append(dict(kwargs))
        return f"celery-{len(enqueue_calls)}"

    async def fake_run_fetch(pool: Any, *, run_id: str) -> dict[str, Any] | None:
        if run_id == "run-parent":
            return dict(run_store)
        if run_id == "run-child":
            return dict(child_store)
        return None

    async def fake_run_update(pool: Any, **kwargs: Any) -> dict[str, Any] | None:
        if kwargs.get("run_id") != "run-parent":
            return None
        expect = kwargs.get("expect_revision")
        if expect is not None and int(run_store.get("run_revision") or 0) != int(expect):
            return None
        for key, value in kwargs.items():
            if key in {"run_id", "principal_id", "expect_revision"}:
                continue
            if value is not None:
                run_store[key] = value
        run_store["run_revision"] = int(run_store.get("run_revision") or 0) + 1
        return dict(run_store)

    async def fake_steps_list(pool: Any, *, run_id: str) -> list[dict[str, Any]]:
        return [dict(step) for step in steps_store]

    async def fake_step_update(pool: Any, **kwargs: Any) -> dict[str, Any] | None:
        step_id = str(kwargs.get("step_id") or "")
        for step in steps_store:
            if str(step.get("id") or "") != step_id:
                continue
            for key in ("status", "output_payload", "error_payload", "input_payload"):
                if key in kwargs and kwargs[key] is not None:
                    step[key] = kwargs[key]
        return {"id": step_id}

    monkeypatch.setattr(
        "api.ewa_platform.companion.workflows.dag.dag_workflow_starter.companion_pg.companion_task_run_create",
        AsyncMock(return_value=run_store),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.workflows.dag.dag_workflow_starter.companion_pg.companion_task_step_create",
        AsyncMock(
            side_effect=lambda *args, **kwargs: {
                "id": f"step-{kwargs.get('step_index')}",
            },
        ),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.workflows.dag.dag_workflow_starter.store_workflow_auth_snapshot_sync",
        lambda *args, **kwargs: None,
    )
    monkeypatch.setattr("api.ewa_platform.companion.jobs.enqueue.enqueue_companion_run", fake_enqueue)

    for module in (
        "api.ewa_platform.companion.workflows.dag.dag_node_executor",
        "api.ewa_platform.companion.workflows.dag.dag_async_resume",
    ):
        monkeypatch.setattr(f"{module}.companion_pg.companion_task_run_fetch", fake_run_fetch)
        monkeypatch.setattr(f"{module}.companion_pg.companion_task_run_update", fake_run_update)
        monkeypatch.setattr(f"{module}.companion_pg.companion_task_steps_list", fake_steps_list)
    monkeypatch.setattr(
        "api.ewa_platform.companion.workflows.dag.dag_node_executor.companion_task_step_update",
        fake_step_update,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.workflows.dag.dag_async_resume.companion_task_step_update",
        fake_step_update,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.jobs.task_events.publish_task_event_async",
        AsyncMock(),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.jobs.step_handlers.publish_executor_step_event",
        AsyncMock(),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.workflows.dag.dag_node_executor.load_workflow_auth_snapshot_sync",
        lambda run_id: None,
    )

    async def fake_image_gen(*args: Any, **kwargs: Any) -> NodeExecutionResult:
        return NodeExecutionResult(
            status="accepted",
            outputs={"run_id": "run-child", "task_run_id": "run-child", "status": "accepted"},
        )

    from api.ewa_platform.companion.workflows.dag import executors as dag_executors

    dag_executors.DEFAULT_NODE_EXECUTOR_REGISTRY["image_gen"] = fake_image_gen

    started = asyncio.run(
        start_dag_workflow_v2(
            MagicMock(),
            user_line="dag async e2e",
            tool_ctx=tool_ctx,
            definition=definition,
        ),
    )
    assert started is not None

    asyncio.run(
        execute_dag_node_step(
            MagicMock(),
            run=run_store,
            step=steps_store[0],
            job_payload={"user_line": "dag async e2e", "principal_id": "p1"},
        ),
    )
    assert enqueue_calls
    assert enqueue_calls[-1]["step_index"] == 2
    assert run_store["status"] == "running"
    restored = load_dag_state(run_store["plan_payload"])
    assert restored is not None
    assert node1 in restored.completed_node_ids

    asyncio.run(
        execute_dag_node_step(
            MagicMock(),
            run=run_store,
            step=steps_store[1],
            job_payload={"user_line": "dag async e2e", "principal_id": "p1"},
        ),
    )
    assert run_store["status"] == "running"
    restored_mid = load_dag_state(run_store["plan_payload"])
    assert restored_mid is not None
    assert node2 not in restored_mid.completed_node_ids
    assert steps_store[1]["status"] == "in_progress"

    advanced = asyncio.run(
        maybe_advance_workflow_from_child_run(
            MagicMock(),
            child_run_id="run-child",
            result_payload=child_store["result_payload"],
        ),
    )
    assert advanced is True
    assert run_store["status"] == "completed"
    restored_final = load_dag_state(run_store["plan_payload"])
    assert restored_final is not None
    assert node2 in restored_final.completed_node_ids
    assert restored_final.registry_snapshot[node2]["image_url"] == "https://example.test/image.png"
    assert steps_store[1]["status"] == "completed"
