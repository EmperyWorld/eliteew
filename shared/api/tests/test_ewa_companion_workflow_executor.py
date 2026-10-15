# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Behavioural tests for WF-1 generic executor, step_handlers map, and action workflow builtins.
# Invariants:
# - No live broker/Postgres/Redis — mocks only.
# Related:
# - api/ewa_platform/companion/jobs/step_handlers.py
# - api/ewa_platform/companion/workflows/action/registry.py
# ---

from __future__ import annotations

import asyncio
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from api.ewa_platform.companion.jobs import executor as job_executor
from api.ewa_platform.companion.jobs import step_handlers
from api.ewa_platform.companion.workflows.action import registry as action_registry
from api.ewa_platform.companion.workflows.config import companion_workflow_music_full_v1_enabled


@pytest.mark.unit
def test_builtin_music_full_cycle_registered() -> None:
    wf = action_registry.get_builtin_workflow("music_full_cycle_v1")
    assert wf is not None
    assert wf.workflow_id == "music_full_cycle_v1"
    assert wf.enabled is False
    assert wf.env_gate == "EWA_COMPANION_WF_MUSIC_FULL_V1"
    assert len(wf.steps) == 2
    assert wf.steps[0].step_kind == "music_generation_pipeline_v2"


@pytest.mark.unit
def test_music_full_cycle_disabled_without_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EWA_COMPANION_WF_ENGINE_ENABLED", raising=False)
    monkeypatch.delenv("EWA_COMPANION_WF_MUSIC_FULL_V1", raising=False)
    wf = action_registry.get_builtin_workflow("music_full_cycle_v1")
    assert wf is not None
    assert action_registry.effective_workflow_enabled(wf) is False
    assert companion_workflow_music_full_v1_enabled() is False


@pytest.mark.unit
def test_known_step_kinds_includes_music_pipeline() -> None:
    kinds = step_handlers.known_step_kinds()
    assert step_handlers.MUSIC_STEP_KIND in kinds
    assert step_handlers.TOOL_DISPATCH_STEP_KIND in kinds


@pytest.mark.unit
def test_dispatch_step_unknown_returns_false() -> None:
    fake_pool = MagicMock()
    run = {"id": "run-1", "principal_id": "p1", "intent_kind": "x"}
    step = {"id": "s1", "step_kind": "confirm_gate_only_not_implemented", "step_index": 1}
    handled = asyncio.run(
        step_handlers.dispatch_step(fake_pool, run=run, step=step, job_payload={}),
    )
    assert handled is False


@pytest.mark.unit
def test_dispatch_step_known_tool_uses_generic_dispatch(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_pool = MagicMock()
    run = {"id": "run-2", "principal_id": "p2", "intent_kind": "action_workflow"}
    step = {
        "id": "s2",
        "step_kind": "app_open",
        "step_index": 2,
        "input_payload": {"tool_name": "app_open"},
    }
    fake_handler = AsyncMock()
    monkeypatch.setattr(step_handlers, "execute_tool_dispatch_step", fake_handler)
    handled = asyncio.run(
        step_handlers.dispatch_step(fake_pool, run=run, step=step, job_payload={}),
    )
    assert handled is True
    assert fake_handler.await_count == 1


@pytest.mark.unit
def test_publish_executor_step_event(monkeypatch: pytest.MonkeyPatch) -> None:
    published: list[dict[str, Any]] = []

    def fake_publish(**kwargs: Any) -> None:
        published.append(dict(kwargs))

    async def fake_publish_async(**kwargs: Any) -> None:
        fake_publish(**kwargs)

    monkeypatch.setattr(step_handlers, "publish_task_event_async", fake_publish_async)
    asyncio.run(
        step_handlers.publish_executor_step_event(
            principal_id="p1",
            run={"id": "run-1", "workflow_id": "music_full_cycle_v1", "workflow_version": 1},
            step={"id": "step-1", "step_index": 1, "step_kind": "music_generation_pipeline_v2", "title": "Gen"},
            status="in_progress",
        )
    )
    assert len(published) == 1
    assert published[0]["event_name"] == "task_step"
    payload = published[0]["payload"]
    assert payload["run_id"] == "run-1"
    assert payload["status"] == "in_progress"
    assert payload["workflow_id"] == "music_full_cycle_v1"


@pytest.mark.unit
def test_executor_publishes_in_progress_before_dispatch(monkeypatch: pytest.MonkeyPatch) -> None:
    events: list[str] = []
    mark_calls: list[str] = []

    async def fake_mark(_pool: Any, **kwargs: Any) -> None:
        mark_calls.append(str(kwargs.get("step", {}).get("id")))

    async def fake_dispatch(_pool: Any, **kwargs: Any) -> bool:
        events.append("dispatch")
        return True

    fake_pool = MagicMock(name="pool")
    fake_pool.close = AsyncMock()

    async def fake_open_pool(*, min_size: int = 1, max_size: int = 4) -> MagicMock:
        return fake_pool

    run_row = {"id": "run-1", "principal_id": "p1", "intent_kind": "music_generation_background", "status": "running"}
    step_row = {"id": "step-1", "step_index": 1, "step_kind": "music_generation_pipeline_v2", "title": "Music"}

    monkeypatch.setenv("EWA_DATABASE_URL", "postgresql://u:p@127.0.0.1:30433/ewa")
    monkeypatch.setattr(job_executor, "open_initialized_ewa_worker_pool", fake_open_pool)
    monkeypatch.setattr(job_executor, "init_ewa_orchestration_schema", AsyncMock())
    monkeypatch.setattr(job_executor, "init_ewa_companion_schema", AsyncMock())
    monkeypatch.setattr(job_executor, "init_ewa_companion_plans_schema", AsyncMock())
    monkeypatch.setattr(job_executor, "companion_task_run_fetch", AsyncMock(return_value=run_row))
    monkeypatch.setattr(
        job_executor, "companion_task_run_update", AsyncMock(return_value={**run_row, "status": "running"})
    )
    monkeypatch.setattr(job_executor, "companion_task_steps_list", AsyncMock(return_value=[step_row]))
    monkeypatch.setattr(job_executor.step_handlers, "mark_step_in_progress", fake_mark)
    monkeypatch.setattr(job_executor.step_handlers, "dispatch_step", fake_dispatch)

    out = asyncio.run(job_executor.execute_companion_run(run_id="run-1", step_index=1, job_payload={}))
    assert out.get("ok") is True
    assert mark_calls == ["step-1"]
    assert events == ["dispatch"]


@pytest.mark.unit
def test_known_step_kinds_includes_confirm_gate() -> None:
    kinds = step_handlers.known_step_kinds()
    assert step_handlers.CONFIRM_GATE_STEP_KIND in kinds


@pytest.mark.unit
def test_dispatch_step_confirm_gate_handler(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_pool = MagicMock()
    fake_handler = AsyncMock()
    monkeypatch.setitem(step_handlers._STEP_HANDLERS, step_handlers.CONFIRM_GATE_STEP_KIND, fake_handler)
    run = {"id": "run-wf", "principal_id": "p1", "intent_kind": "action_workflow"}
    step = {"id": "s2", "step_kind": "confirm_gate", "step_index": 2}
    handled = asyncio.run(
        step_handlers.dispatch_step(fake_pool, run=run, step=step, job_payload={}),
    )
    assert handled is True
    assert fake_handler.await_count == 1


@pytest.mark.unit
def test_confirm_gate_step_pauses_executor(monkeypatch: pytest.MonkeyPatch) -> None:
    published: list[dict[str, Any]] = []
    step_statuses: list[str] = []

    async def fake_mark(*_a: Any, **_k: Any) -> None:
        return None

    fake_pool = MagicMock(name="pool")
    fake_pool.close = AsyncMock()

    async def fake_open_pool(*, min_size: int = 1, max_size: int = 4) -> MagicMock:
        return fake_pool

    run_row = {
        "id": "run-wf",
        "principal_id": "p1",
        "intent_kind": "action_workflow",
        "workflow_id": "music_full_cycle_v1",
        "status": "running",
        "plan_payload": {"kind": "action_workflow"},
    }
    step_row = {
        "id": "step-c",
        "step_index": 2,
        "step_kind": "confirm_gate",
        "title": "Confirm",
        "input_payload": {"step_key": "confirm_play"},
    }

    async def track_step_update(_pool: Any, *, step_id: str, status: str, **kwargs: Any) -> None:
        step_statuses.append(status)

    async def fake_publish(**kwargs: Any) -> None:
        published.append(dict(kwargs))

    from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg

    monkeypatch.setenv("EWA_DATABASE_URL", "postgresql://u:p@127.0.0.1:30433/ewa")
    monkeypatch.setattr(job_executor, "open_initialized_ewa_worker_pool", fake_open_pool)
    monkeypatch.setattr(job_executor, "init_ewa_orchestration_schema", AsyncMock())
    monkeypatch.setattr(job_executor, "init_ewa_companion_schema", AsyncMock())
    monkeypatch.setattr(job_executor, "init_ewa_companion_plans_schema", AsyncMock())
    monkeypatch.setattr(job_executor, "companion_task_run_fetch", AsyncMock(return_value=run_row))
    monkeypatch.setattr(
        job_executor,
        "companion_task_run_update",
        AsyncMock(return_value={**run_row, "status": "awaiting_confirmation"}),
    )
    monkeypatch.setattr(job_executor, "companion_task_steps_list", AsyncMock(return_value=[step_row]))
    monkeypatch.setattr(job_executor, "_fail_run", AsyncMock())
    monkeypatch.setattr(step_handlers, "mark_step_in_progress", fake_mark)
    monkeypatch.setattr(step_handlers, "companion_task_step_update", track_step_update)
    monkeypatch.setattr(step_handlers, "publish_task_event_async", fake_publish)
    monkeypatch.setattr(
        companion_pg,
        "companion_task_run_update",
        AsyncMock(return_value={**run_row, "status": "awaiting_confirmation"}),
    )

    out = asyncio.run(job_executor.execute_companion_run(run_id="run-wf", step_index=2, job_payload={}))
    assert out.get("ok") is True
    assert "awaiting_confirmation" in step_statuses
    assert any(item.get("event_name") == "task_awaiting_confirmation" for item in published)
