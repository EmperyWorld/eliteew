# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioural tests for DAG v2 Celery orchestration (state store, node executor, starter).
# Related:
# - documentation/product/ewa/EWA-COMPANION-WORKFLOW-ENGINE-V2.md
# ---

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

from api.ewa_platform.companion.orchestration.tool_registry import ToolContext
from api.ewa_platform.companion.workflows.dag.context import WorkflowValidationContext
from api.ewa_platform.companion.workflows.dag.dag_node_executor import execute_dag_node_step
from api.ewa_platform.companion.workflows.dag.dag_state_store import (
    build_initial_dag_state,
    load_dag_state,
    merge_dag_state_into_plan,
    next_pending_node_id,
    registry_from_dag_state,
    step_index_for_node_id,
)
from api.ewa_platform.companion.workflows.dag.dag_workflow_starter import start_dag_workflow_v2
from api.ewa_platform.companion.workflows.dag.runner import NodeRunOutcome
from api.ewa_platform.schemas.pydantic.companion_workflow_v2 import CompanionWorkflowDefinitionV2

_FIXTURES = Path(__file__).resolve().parent / "fixtures"


def _load_fixture(name: str) -> CompanionWorkflowDefinitionV2:
    raw = json.loads((_FIXTURES / name).read_text(encoding="utf-8"))
    return CompanionWorkflowDefinitionV2.model_validate(raw)


@pytest.mark.unit
def test_dag_state_store_roundtrip_preserves_registry_and_outcomes() -> None:
    definition = _load_fixture("companion_workflow_v2_linear.json")
    state, errors = build_initial_dag_state(
        definition,
        user_line="dag linear demo",
        content_catalog_user_id="principal-1",
        validation_ctx=WorkflowValidationContext(is_verified_user=True),
    )
    assert errors == []
    assert state is not None
    assert len(state.pending_node_ids) == 3

    first = state.ordered_node_ids[0]
    state.registry_snapshot[first] = {"reply": "hello", "prompt": "hello"}
    state.node_outcomes[first] = NodeRunOutcome(status="ok", attempts=1)
    state.pending_node_ids = state.pending_node_ids[1:]
    state.completed_node_ids.append(first)
    state.current_node_id = state.pending_node_ids[0]

    plan = merge_dag_state_into_plan({"kind": "action_workflow_v2"}, state)
    restored = load_dag_state(plan)
    assert restored is not None
    assert restored.registry_snapshot[first]["reply"] == "hello"
    assert restored.node_outcomes[first].status == "ok"
    assert restored.pending_node_ids == state.pending_node_ids
    assert next_pending_node_id(restored) == state.current_node_id

    registry = registry_from_dag_state(restored, principal_id="principal-1")
    node_outputs = registry.get_node_outputs(first)
    assert node_outputs is not None
    assert node_outputs["reply"] == "hello"


@pytest.mark.unit
def test_step_index_for_node_id_maps_topo_steps() -> None:
    steps = [
        {"step_index": 1, "input_payload": {"node_id": "n1"}},
        {"step_index": 2, "input_payload": {"node_id": "n2"}},
    ]
    assert step_index_for_node_id(steps, "n2") == 2


@pytest.mark.unit
def test_start_dag_workflow_v2_creates_run_steps_and_enqueues(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_WF_ENGINE_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_DAG_CELERY_ORCHESTRATION_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_WORKFLOW_ENGINE_V2_ENABLED", "1")

    definition = _load_fixture("companion_workflow_v2_linear.json")
    tool_ctx = ToolContext(
        principal_id="p1",
        user_line="dag linear demo",
        content_catalog_user_id="p1",
        oauth2_sub_for_content_alternate=None,
        main_pool=MagicMock(),
        companion_pool=MagicMock(),
        bearer_token="token",
        auth_user=MagicMock(id="oauth-1", is_verified=True),
    )

    created_steps: list[dict[str, object]] = []
    run_row: dict[str, object] = {"id": "run-dag-1", "principal_id": "p1", "status": "running"}

    async def fake_run_create(*args: object, **kwargs: object) -> dict[str, object]:
        return run_row

    async def fake_step_create(*args: object, **kwargs: object) -> dict[str, object]:
        created_steps.append(dict(kwargs))
        return {"id": f"step-{len(created_steps)}"}

    monkeypatch.setattr(
        "api.ewa_platform.companion.workflows.dag.dag_workflow_starter.companion_pg.companion_task_run_create",
        fake_run_create,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.workflows.dag.dag_workflow_starter.companion_pg.companion_task_step_create",
        fake_step_create,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.workflows.dag.dag_workflow_starter.store_workflow_auth_snapshot_sync",
        lambda *args, **kwargs: None,
    )

    enqueue_calls: list[dict[str, object]] = []

    def fake_enqueue(**kwargs: object) -> str:
        enqueue_calls.append(dict(kwargs))
        return "celery-1"

    monkeypatch.setattr(
        "api.ewa_platform.companion.workflows.dag.dag_workflow_starter.enqueue_companion_run",
        fake_enqueue,
    )

    out = asyncio.run(
        start_dag_workflow_v2(
            MagicMock(),
            user_line="dag linear demo",
            tool_ctx=tool_ctx,
            definition=definition,
            user_workflow_row_id="wf-row-1",
        ),
    )
    assert out is not None
    assert out.get("task_run") == run_row
    assert len(created_steps) == 3
    assert all(step.get("step_kind") == "dag_node" for step in created_steps)
    assert enqueue_calls
    assert enqueue_calls[0]["run_id"] == "run-dag-1"
    assert enqueue_calls[0]["step_index"] == 1


@pytest.mark.unit
def test_execute_dag_node_step_completes_linear_chain(monkeypatch: pytest.MonkeyPatch) -> None:
    definition = _load_fixture("companion_workflow_v2_linear.json")
    state, _ = build_initial_dag_state(
        definition,
        user_line="dag linear demo",
        content_catalog_user_id="p1",
        validation_ctx=WorkflowValidationContext(is_verified_user=True),
    )
    assert state is not None
    first_node = state.ordered_node_ids[0]
    plan = merge_dag_state_into_plan(
        {
            "kind": "action_workflow_v2",
            "definition_json": definition.model_dump(mode="json"),
        },
        state,
    )
    run = {
        "id": "run-dag-1",
        "principal_id": "p1",
        "intent_kind": "action_workflow_v2",
        "workflow_id": definition.workflow_id,
        "user_message": "dag linear demo",
        "plan_payload": plan,
        "run_revision": 1,
    }
    step = {
        "id": "step-1",
        "step_index": 1,
        "step_kind": "dag_node",
        "input_payload": {"node_id": first_node, "node_type": "prompt_gen"},
    }
    steps = [
        {
            "id": "step-1",
            "step_index": 1,
            "step_kind": "dag_node",
            "status": "in_progress",
            "input_payload": step["input_payload"],
        },
        {
            "id": "step-2",
            "step_index": 2,
            "step_kind": "dag_node",
            "status": "pending",
            "input_payload": {"node_id": state.ordered_node_ids[1]},
        },
        {
            "id": "step-3",
            "step_index": 3,
            "step_kind": "dag_node",
            "status": "pending",
            "input_payload": {"node_id": state.ordered_node_ids[2]},
        },
    ]

    monkeypatch.setattr(
        "api.ewa_platform.companion.workflows.dag.dag_node_executor.companion_pg.companion_task_steps_list",
        AsyncMock(return_value=steps),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.workflows.dag.dag_node_executor.companion_task_step_update",
        AsyncMock(),
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

    run_updates: list[dict[str, object]] = []

    async def fake_run_update(*args: object, **kwargs: object) -> dict[str, object]:
        run_updates.append(dict(kwargs))
        return {**run, "run_revision": 2, "plan_payload": kwargs.get("plan_payload", plan)}

    monkeypatch.setattr(
        "api.ewa_platform.companion.workflows.dag.dag_node_executor.companion_pg.companion_task_run_update",
        fake_run_update,
    )

    enqueue_calls: list[dict[str, object]] = []

    def fake_enqueue(**kwargs: object) -> str:
        enqueue_calls.append(dict(kwargs))
        return "celery-next"

    monkeypatch.setattr(
        "api.ewa_platform.companion.jobs.enqueue.enqueue_companion_run",
        fake_enqueue,
    )

    asyncio.run(
        execute_dag_node_step(
            MagicMock(),
            run=run,
            step=step,
            job_payload={"user_line": "dag linear demo", "principal_id": "p1"},
        ),
    )

    assert enqueue_calls
    assert enqueue_calls[0]["step_index"] == 2
    assert run_updates
    saved_plan = run_updates[0].get("plan_payload")
    assert isinstance(saved_plan, dict)
    restored = load_dag_state(saved_plan)
    assert restored is not None
    assert first_node in restored.completed_node_ids
    assert first_node in restored.registry_snapshot


@pytest.mark.unit
def test_execute_dag_node_step_failure_finalizes_run(monkeypatch: pytest.MonkeyPatch) -> None:
    definition = _load_fixture("companion_workflow_v2_linear.json")
    state, _ = build_initial_dag_state(
        definition,
        user_line="dag linear demo",
        content_catalog_user_id="p1",
        validation_ctx=WorkflowValidationContext(is_verified_user=True),
    )
    assert state is not None
    first_node = state.ordered_node_ids[0]
    plan = merge_dag_state_into_plan(
        {"kind": "action_workflow_v2", "definition_json": definition.model_dump(mode="json")},
        state,
    )
    run = {
        "id": "run-dag-fail",
        "principal_id": "p1",
        "intent_kind": "action_workflow_v2",
        "workflow_id": definition.workflow_id,
        "user_message": "dag linear demo",
        "plan_payload": plan,
        "run_revision": 1,
    }
    step = {
        "id": "step-1",
        "step_index": 1,
        "step_kind": "dag_node",
        "input_payload": {"node_id": first_node},
    }
    steps = [
        {
            "id": "step-1",
            "step_index": 1,
            "step_kind": "dag_node",
            "status": "in_progress",
            "input_payload": step["input_payload"],
        },
        {
            "id": "step-2",
            "step_index": 2,
            "step_kind": "dag_node",
            "status": "pending",
            "input_payload": {"node_id": state.ordered_node_ids[1]},
        },
        {
            "id": "step-3",
            "step_index": 3,
            "step_kind": "dag_node",
            "status": "pending",
            "input_payload": {"node_id": state.ordered_node_ids[2]},
        },
    ]

    async def fake_failed_execution(**kwargs: object) -> tuple[object, int, NodeRunOutcome]:
        return (
            MagicMock(status="failed", outputs={}),
            1,
            NodeRunOutcome(status="failed", attempts=1, error="forced failure"),
        )

    monkeypatch.setattr(
        "api.ewa_platform.companion.workflows.dag.dag_node_executor._execute_node_with_policy",
        fake_failed_execution,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.workflows.dag.dag_node_executor.companion_pg.companion_task_steps_list",
        AsyncMock(return_value=steps),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.workflows.dag.dag_node_executor.companion_task_step_update",
        AsyncMock(),
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

    terminal_updates: list[str] = []

    async def fake_run_update(*args: object, **kwargs: object) -> dict[str, object]:
        terminal_updates.append(str(kwargs.get("status") or ""))
        return {**run, "run_revision": 2}

    monkeypatch.setattr(
        "api.ewa_platform.companion.workflows.dag.dag_node_executor.companion_pg.companion_task_run_update",
        fake_run_update,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.jobs.enqueue.enqueue_companion_run",
        MagicMock(),
    )

    asyncio.run(
        execute_dag_node_step(
            MagicMock(),
            run=run,
            step=step,
            job_payload={"user_line": "dag linear demo", "principal_id": "p1"},
        ),
    )

    assert "failed" in terminal_updates or "completed" in terminal_updates
