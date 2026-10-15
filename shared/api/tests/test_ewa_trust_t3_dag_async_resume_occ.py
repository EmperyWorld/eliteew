# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Trust T3 / V-M3 lock: DAG async resume retries OCC revision conflicts and schedules
# delayed reconcile instead of silent-dropping parent advance.
# Invariants:
# - No live Postgres/Celery; persistence and enqueue are mocked at the boundary.
# Related:
# - api/ewa_platform/companion/workflows/dag/dag_async_resume.py
# - documentation/product/ewa/EWA-TRUST-RESTORATION-PROGRAM-2026-07-09.md
# ---

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from api.ewa_platform.companion.workflows.dag import dag_async_resume as resume_mod
from api.ewa_platform.companion.workflows.dag.context import WorkflowValidationContext
from api.ewa_platform.companion.workflows.dag.dag_state_store import (
    build_initial_dag_state,
    load_dag_state,
    merge_dag_state_into_plan,
)
from api.ewa_platform.schemas.pydantic.companion_workflow_v2 import CompanionWorkflowDefinitionV2

_FIXTURES = Path(__file__).resolve().parent / "fixtures"


def _load_async_fixture() -> CompanionWorkflowDefinitionV2:
    raw = json.loads((_FIXTURES / "companion_workflow_v2_async_e2e.json").read_text(encoding="utf-8"))
    return CompanionWorkflowDefinitionV2.model_validate(raw)


def _parent_run_and_steps() -> tuple[dict[str, Any], list[dict[str, Any]], str]:
    definition = _load_async_fixture()
    state, _ = build_initial_dag_state(
        definition,
        user_line="t3",
        content_catalog_user_id="p1",
        validation_ctx=WorkflowValidationContext(is_verified_user=True),
    )
    assert state is not None
    node_id = state.ordered_node_ids[0]
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
        "status": "running",
        "run_revision": 1,
        "plan_payload": plan,
        "user_message": "t3",
    }
    steps_store = [
        {
            "id": "step-1",
            "step_index": 1,
            "status": "running",
            "input_payload": {"node_id": node_id, "node_type": "prompt_gen"},
        }
    ]
    return run_store, steps_store, node_id


@pytest.mark.unit
def test_dag_async_resume_retries_occ_then_advances(monkeypatch: pytest.MonkeyPatch) -> None:
    run_store, steps_store, node_id = _parent_run_and_steps()
    update_calls = 0
    enqueue_next_calls: list[Any] = []

    async def fake_fetch(pool: Any, *, run_id: str) -> dict[str, Any] | None:
        return dict(run_store) if run_id == "run-parent" else None

    async def fake_update(pool: Any, **kwargs: Any) -> dict[str, Any] | None:
        nonlocal update_calls
        update_calls += 1
        expect = kwargs.get("expect_revision")
        if update_calls == 1:
            # Simulate concurrent writer bumping revision before our OCC write.
            run_store["run_revision"] = int(run_store.get("run_revision") or 0) + 1
            return None
        if expect is not None and int(run_store.get("run_revision") or 0) != int(expect):
            return None
        for key, value in kwargs.items():
            if key in {"run_id", "principal_id", "expect_revision"}:
                continue
            if value is not None:
                run_store[key] = value
        run_store["run_revision"] = int(run_store.get("run_revision") or 0) + 1
        return dict(run_store)

    async def fake_enqueue_next(*_a: Any, **_k: Any) -> None:
        enqueue_next_calls.append(True)

    monkeypatch.setattr(resume_mod.companion_pg, "companion_task_run_fetch", fake_fetch)
    monkeypatch.setattr(resume_mod.companion_pg, "companion_task_run_update", fake_update)
    monkeypatch.setattr(
        resume_mod.companion_pg,
        "companion_task_steps_list",
        AsyncMock(return_value=steps_store),
    )
    monkeypatch.setattr(resume_mod, "companion_task_step_update", AsyncMock())
    monkeypatch.setattr(
        "api.ewa_platform.companion.jobs.step_handlers.publish_executor_step_event",
        AsyncMock(),
    )
    monkeypatch.setattr(resume_mod, "enqueue_next_dag_node", fake_enqueue_next)

    out = asyncio.run(
        resume_mod.advance_dag_workflow_after_async_node(
            MagicMock(),
            parent_run_id="run-parent",
            parent_step_index=1,
            node_outputs={"reply": "ok"},
            child_run_id="run-child",
        ),
    )
    assert out is True
    assert update_calls >= 2
    assert len(enqueue_next_calls) == 1
    restored = load_dag_state(run_store["plan_payload"])
    assert restored is not None
    assert node_id in restored.completed_node_ids


@pytest.mark.unit
def test_dag_async_resume_occ_exhausted_schedules_reconcile(monkeypatch: pytest.MonkeyPatch) -> None:
    run_store, steps_store, _node_id = _parent_run_and_steps()
    run_store["run_revision"] = 5
    reconcile_calls: list[dict[str, Any]] = []

    async def always_conflict(pool: Any, **_kwargs: Any) -> None:
        return None

    def fake_enqueue(**kwargs: Any) -> str:
        reconcile_calls.append(dict(kwargs))
        return "celery-reconcile-1"

    monkeypatch.setattr(
        resume_mod.companion_pg,
        "companion_task_run_fetch",
        AsyncMock(return_value=run_store),
    )
    monkeypatch.setattr(resume_mod.companion_pg, "companion_task_run_update", always_conflict)
    monkeypatch.setattr(
        resume_mod.companion_pg,
        "companion_task_steps_list",
        AsyncMock(return_value=steps_store),
    )
    monkeypatch.setattr(resume_mod, "companion_task_step_update", AsyncMock())
    monkeypatch.setattr(
        "api.ewa_platform.companion.jobs.step_handlers.publish_executor_step_event",
        AsyncMock(),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.jobs.enqueue.enqueue_companion_run",
        fake_enqueue,
    )

    out = asyncio.run(
        resume_mod.advance_dag_workflow_after_async_node(
            MagicMock(),
            parent_run_id="run-parent",
            parent_step_index=1,
            node_outputs={"reply": "ok"},
            child_run_id="run-child",
        ),
    )
    assert out is False
    assert len(reconcile_calls) == 1
    assert reconcile_calls[0]["run_id"] == "run-parent"
    assert reconcile_calls[0]["countdown_sec"] == 2
    assert reconcile_calls[0]["job_payload"]["dag_async_resume_reconcile"] is True
