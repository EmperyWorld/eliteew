# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# R-02 Phase 0 evidence: Celery retry must not re-run completed companion steps (DB is SSOT).
# Invariants:
# - Without step_idempotency guard, completed step-1 handler runs twice on retry (bug proof).
# - With guard, step-1 runs once even after step-2 Network Timeout + retry.
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
from api.ewa_platform.companion.jobs.step_idempotency import StepDispatchDecision, evaluate_step_dispatch


def _run_row() -> dict[str, Any]:
    return {
        "id": "run-three-step",
        "principal_id": "p-risk",
        "intent_kind": "action_workflow",
        "status": "running",
        "run_revision": 1,
    }


def _three_steps() -> list[dict[str, Any]]:
    return [
        {
            "id": "step-1",
            "step_index": 1,
            "step_kind": "app_open",
            "status": "pending",
            "input_payload": {},
        },
        {
            "id": "step-2",
            "step_index": 2,
            "step_kind": "app_open",
            "status": "pending",
            "input_payload": {},
        },
        {
            "id": "step-3",
            "step_index": 3,
            "step_kind": "app_open",
            "status": "pending",
            "input_payload": {},
        },
    ]


def _install_executor_mocks(
    monkeypatch: pytest.MonkeyPatch,
    *,
    steps_state: list[dict[str, Any]],
    dispatch_fn: Any,
) -> None:
    fake_pool = MagicMock(name="pool")
    fake_pool.close = AsyncMock()
    run_row = _run_row()

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
    monkeypatch.setattr(job_executor.step_handlers, "mark_step_in_progress", AsyncMock())
    monkeypatch.setattr(job_executor.step_retry, "maybe_retry_failed_step", AsyncMock(return_value=False))
    monkeypatch.setattr(job_executor.step_handlers, "dispatch_step", dispatch_fn)


@pytest.mark.asyncio
async def test_task_retry_idempotency_risk_without_guard_double_executes_step1(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Phase 0 failure mode: no idempotency guard → step-1 handler invoked twice on retry."""

    steps_state = _three_steps()
    handler_calls = {"step-1": 0, "step-2": 0, "step-3": 0}

    async def naive_dispatch(_pool: Any, *, run: Any, step: Any, job_payload: Any) -> bool:
        sid = str(step.get("id"))
        handler_calls[sid] = handler_calls.get(sid, 0) + 1
        for row in steps_state:
            if row["id"] == sid:
                row["status"] = "completed"
                row["output_payload"] = {"ok": True}
        return True

    _install_executor_mocks(monkeypatch, steps_state=steps_state, dispatch_fn=naive_dispatch)

    def always_execute(step: Any, **kwargs: Any) -> StepDispatchDecision:
        return StepDispatchDecision(True, "")

    monkeypatch.setattr(job_executor.step_idempotency, "evaluate_step_dispatch", always_execute)

    await job_executor.execute_companion_run(run_id="run-three-step", step_index=1, job_payload={})
    assert handler_calls["step-1"] == 1

    await job_executor.execute_companion_run(run_id="run-three-step", step_index=1, job_payload={})
    assert handler_calls["step-1"] == 2


@pytest.mark.asyncio
async def test_task_retry_idempotency_risk_with_guard_step1_runs_once(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """R-02 fix proof: DB-backed guard skips completed step-1 on Celery retry."""

    steps_state = _three_steps()
    handler_calls = {"step-1": 0, "step-2": 0, "step-3": 0}

    async def tracking_dispatch(_pool: Any, *, run: Any, step: Any, job_payload: Any) -> bool:
        sid = str(step.get("id"))
        handler_calls[sid] = handler_calls.get(sid, 0) + 1
        for row in steps_state:
            if row["id"] == sid:
                row["status"] = "completed"
                row["output_payload"] = {"ok": True}
        return True

    _install_executor_mocks(monkeypatch, steps_state=steps_state, dispatch_fn=tracking_dispatch)

    out_first = await job_executor.execute_companion_run(
        run_id="run-three-step",
        step_index=1,
        job_payload={},
    )
    assert out_first.get("ok") is True
    assert handler_calls["step-1"] == 1

    out_retry = await job_executor.execute_companion_run(
        run_id="run-three-step",
        step_index=1,
        job_payload={},
    )
    assert out_retry.get("skipped") is True
    assert out_retry.get("reason") == "step_already_completed"
    assert handler_calls["step-1"] == 1


@pytest.mark.asyncio
async def test_task_retry_idempotency_step2_timeout_does_not_redispatch_step1(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """3-step task: step-2 Network Timeout on first try; retry skips completed step-1."""

    steps_state = _three_steps()
    handler_calls = {"step-1": 0, "step-2": 0, "step-3": 0}
    now = datetime(2026, 7, 4, 12, 0, tzinfo=UTC)

    async def failing_step2_dispatch(_pool: Any, *, run: Any, step: Any, job_payload: Any) -> bool:
        sid = str(step.get("id"))
        handler_calls[sid] = handler_calls.get(sid, 0) + 1
        if sid == "step-2":
            for row in steps_state:
                if row["id"] == sid:
                    row["status"] = "failed"
                    row["error_payload"] = {"message": "Network Timeout"}
            msg = "Network Timeout"
            raise RuntimeError(msg)
        for row in steps_state:
            if row["id"] == sid:
                row["status"] = "completed"
                row["output_payload"] = {"ok": True}
                row["updated_at"] = now.isoformat()
        return True

    _install_executor_mocks(monkeypatch, steps_state=steps_state, dispatch_fn=failing_step2_dispatch)

    out1 = await job_executor.execute_companion_run(run_id="run-three-step", step_index=1, job_payload={})
    assert out1.get("ok") is True
    assert handler_calls["step-1"] == 1

    with pytest.raises(RuntimeError, match="Network Timeout"):
        await job_executor.execute_companion_run(run_id="run-three-step", step_index=2, job_payload={})
    assert handler_calls["step-2"] == 1

    out_retry_step1 = await job_executor.execute_companion_run(
        run_id="run-three-step",
        step_index=1,
        job_payload={},
    )
    assert out_retry_step1.get("skipped") is True
    assert handler_calls["step-1"] == 1

    with pytest.raises(RuntimeError, match="Network Timeout"):
        await job_executor.execute_companion_run(run_id="run-three-step", step_index=2, job_payload={})
    assert handler_calls["step-2"] == 2
    assert handler_calls["step-3"] == 0


@pytest.mark.unit
def test_task_retry_idempotency_skips_fresh_in_progress_without_output() -> None:
    """in_progress within 120s window is skipped (concurrent / in-flight lease)."""

    now = datetime(2026, 7, 4, 12, 0, tzinfo=UTC)
    step = {
        "id": "s-in-flight",
        "status": "in_progress",
        "output_payload": {},
        "updated_at": (now - timedelta(seconds=45)).isoformat(),
    }
    decision = evaluate_step_dispatch(step, now=now, fresh_seconds=120)
    assert decision.should_execute is False
    assert decision.reason == "step_in_progress_active"
