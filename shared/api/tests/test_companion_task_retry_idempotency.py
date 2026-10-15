# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression lock for companion_run_task Celery retries — completed steps must not
# re-dispatch handlers when the worker retries after a later step failure.
# Invariants:
# - Mocks only; no live broker/Postgres.
# Related:
# - api/ewa_platform/companion/jobs/executor.py
# - api/ewa_platform/companion/jobs/step_idempotency.py
# ---

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from api.ewa_platform.companion.jobs import executor as job_executor
from api.ewa_platform.companion.jobs import step_idempotency


def _executor_mocks(
    monkeypatch: pytest.MonkeyPatch,
    *,
    run_row: dict[str, Any],
    steps: list[dict[str, Any]],
) -> tuple[MagicMock, AsyncMock, AsyncMock]:
    fake_pool = MagicMock(name="pool")
    fake_pool.close = AsyncMock()

    mark_mock = AsyncMock()
    dispatch_mock = AsyncMock(return_value=True)

    monkeypatch.setenv("EWA_DATABASE_URL", "postgresql://u:p@127.0.0.1:30433/ewa")
    monkeypatch.setattr(job_executor, "open_initialized_ewa_worker_pool", AsyncMock(return_value=fake_pool))
    monkeypatch.setattr(job_executor, "init_ewa_orchestration_schema", AsyncMock())
    monkeypatch.setattr(job_executor, "init_ewa_companion_schema", AsyncMock())
    monkeypatch.setattr(job_executor, "init_ewa_companion_plans_schema", AsyncMock())
    monkeypatch.setattr(job_executor, "companion_task_run_fetch", AsyncMock(return_value=run_row))
    monkeypatch.setattr(
        job_executor,
        "companion_task_run_update",
        AsyncMock(return_value={**run_row, "status": "running"}),
    )
    monkeypatch.setattr(job_executor, "companion_task_steps_list", AsyncMock(return_value=steps))
    monkeypatch.setattr(job_executor.step_handlers, "mark_step_in_progress", mark_mock)
    monkeypatch.setattr(job_executor.step_handlers, "dispatch_step", dispatch_mock)
    return fake_pool, mark_mock, dispatch_mock


@pytest.mark.unit
def test_evaluate_step_dispatch_skips_completed() -> None:
    step = {"id": "s1", "status": "completed", "output_payload": {"ok": True}}
    decision = step_idempotency.evaluate_step_dispatch(step)
    assert decision.should_execute is False
    assert decision.reason == "step_already_completed"


@pytest.mark.unit
def test_evaluate_step_dispatch_skips_fresh_in_progress() -> None:
    now = datetime(2026, 7, 4, 12, 0, tzinfo=UTC)
    step = {
        "id": "s2",
        "status": "in_progress",
        "output_payload": {},
        "updated_at": (now - timedelta(seconds=30)).isoformat(),
    }
    decision = step_idempotency.evaluate_step_dispatch(step, now=now, fresh_seconds=120)
    assert decision.should_execute is False
    assert decision.reason == "step_in_progress_active"


@pytest.mark.unit
def test_evaluate_step_dispatch_allows_stale_in_progress_retry() -> None:
    now = datetime(2026, 7, 4, 12, 0, tzinfo=UTC)
    step = {
        "id": "s2",
        "status": "in_progress",
        "output_payload": {},
        "updated_at": (now - timedelta(seconds=600)).isoformat(),
    }
    decision = step_idempotency.evaluate_step_dispatch(step, now=now, fresh_seconds=120)
    assert decision.should_execute is True


@pytest.mark.unit
def test_resolve_target_step_picks_first_incomplete_when_index_omitted() -> None:
    steps = [
        {"id": "s1", "step_index": 1, "status": "completed"},
        {"id": "s2", "step_index": 2, "status": "pending"},
    ]
    picked = step_idempotency.resolve_target_step(steps, step_index=None)
    assert picked is not None
    assert picked["id"] == "s2"


@pytest.mark.asyncio
async def test_celery_retry_does_not_redispatch_completed_step1(monkeypatch: pytest.MonkeyPatch) -> None:
    """Simulate Celery retry after step-2 failure: step-1 handler runs exactly once."""

    run_row = {
        "id": "run-retry",
        "principal_id": "p1",
        "intent_kind": "action_workflow",
        "status": "running",
        "run_revision": 1,
    }

    steps_state: list[dict[str, Any]] = [
        {
            "id": "step-1",
            "step_index": 1,
            "step_kind": "app_open",
            "status": "pending",
            "input_payload": {"tool_name": "app_open"},
        },
        {
            "id": "step-2",
            "step_index": 2,
            "step_kind": "app_open",
            "status": "pending",
            "input_payload": {"tool_name": "app_open"},
        },
    ]

    dispatch_counts = {"step-1": 0, "step-2": 0}

    async def fake_dispatch(_pool: Any, *, run: Any, step: Any, job_payload: Any) -> bool:
        sid = str(step.get("id"))
        dispatch_counts[sid] = dispatch_counts.get(sid, 0) + 1
        for row in steps_state:
            if row["id"] == sid:
                row["status"] = "completed"
                row["output_payload"] = {"ok": True}
        return True

    fake_pool = MagicMock(name="pool")
    fake_pool.close = AsyncMock()
    mark_mock = AsyncMock()

    async def fake_steps_list(_pool: Any, *, run_id: str) -> list[dict[str, Any]]:
        return [dict(row) for row in steps_state]

    monkeypatch.setenv("EWA_DATABASE_URL", "postgresql://u:p@127.0.0.1:30433/ewa")
    monkeypatch.setattr(job_executor, "open_initialized_ewa_worker_pool", AsyncMock(return_value=fake_pool))
    monkeypatch.setattr(job_executor, "init_ewa_orchestration_schema", AsyncMock())
    monkeypatch.setattr(job_executor, "init_ewa_companion_schema", AsyncMock())
    monkeypatch.setattr(job_executor, "init_ewa_companion_plans_schema", AsyncMock())
    monkeypatch.setattr(job_executor, "companion_task_run_fetch", AsyncMock(return_value=run_row))
    monkeypatch.setattr(
        job_executor,
        "companion_task_run_update",
        AsyncMock(return_value={**run_row, "status": "running"}),
    )
    monkeypatch.setattr(job_executor, "companion_task_steps_list", fake_steps_list)
    monkeypatch.setattr(job_executor.step_handlers, "mark_step_in_progress", mark_mock)
    monkeypatch.setattr(job_executor.step_handlers, "dispatch_step", fake_dispatch)

    out_first = await job_executor.execute_companion_run(run_id="run-retry", step_index=1, job_payload={})
    assert out_first.get("ok") is True
    assert dispatch_counts["step-1"] == 1

    out_retry_step1 = await job_executor.execute_companion_run(run_id="run-retry", step_index=1, job_payload={})
    assert out_retry_step1.get("skipped") is True
    assert out_retry_step1.get("reason") == "step_already_completed"
    assert dispatch_counts["step-1"] == 1

    out_retry_auto = await job_executor.execute_companion_run(run_id="run-retry", step_index=None, job_payload={})
    assert out_retry_auto.get("ok") is True
    assert dispatch_counts["step-1"] == 1
    assert dispatch_counts["step-2"] == 1


@pytest.mark.asyncio
async def test_completed_step_short_circuit_skips_mark_and_dispatch(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    run_row = {
        "id": "run-done",
        "principal_id": "p1",
        "intent_kind": "music_generation_background",
        "status": "running",
        "run_revision": 3,
    }
    steps = [
        {
            "id": "step-1",
            "step_index": 1,
            "step_kind": "music_generation_pipeline_v2",
            "status": "completed",
            "output_payload": {"ugs_job_id": "job-1"},
        },
    ]
    _pool, mark_mock, dispatch_mock = _executor_mocks(monkeypatch, run_row=run_row, steps=steps)

    out = await job_executor.execute_companion_run(run_id="run-done", step_index=1, job_payload={})

    assert out.get("skipped") is True
    assert out.get("reason") == "step_already_completed"
    mark_mock.assert_not_awaited()
    dispatch_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_fresh_step_still_executes_for_pending(monkeypatch: pytest.MonkeyPatch) -> None:
    run_row = {
        "id": "run-fresh",
        "principal_id": "p1",
        "intent_kind": "music_generation_background",
        "status": "running",
        "run_revision": 1,
    }
    steps = [
        {
            "id": "step-1",
            "step_index": 1,
            "step_kind": "music_generation_pipeline_v2",
            "status": "pending",
        },
    ]
    _pool, mark_mock, dispatch_mock = _executor_mocks(monkeypatch, run_row=run_row, steps=steps)

    out = await job_executor.execute_companion_run(run_id="run-fresh", step_index=1, job_payload={})

    assert out.get("ok") is True
    assert out.get("skipped") is not True
    mark_mock.assert_awaited_once()
    dispatch_mock.assert_awaited_once()
