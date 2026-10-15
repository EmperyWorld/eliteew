# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Tests for routing_policy canonical order and task_orchestrator/executor integration guards.
# Invariants:
# - No live Postgres; phase hooks and executor paths are mocked.
# - ``expect_run_revision`` and prior-step gates must remain on dedicated code paths.
# Related:
# - api/ewa_platform/companion/orchestration/routing_policy.py
# - api/ewa_platform/companion/orchestration/task_orchestrator.py
# - api/ewa_platform/companion/jobs/executor.py
# ---

from __future__ import annotations

import inspect
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from api.ewa_platform.companion.jobs import executor as job_executor
from api.ewa_platform.companion.orchestration import routing_policy
from api.ewa_platform.companion.orchestration import task_orchestrator as orch_mod
from api.ewa_platform.companion.orchestration.routing_policy import (
    DEFER_MEMORY_BRANCHES,
    EARLY_TOOL_BRANCH_ORDER,
    LATE_TOOL_BRANCH_ORDER,
    PRE_TOOL_BRANCHES,
    DeferMemoryPhaseHandlers,
    OrchestrationBranch,
    PreToolPhaseHandlers,
    run_defer_memory_phase,
    run_early_tool_branch_loop,
    run_late_tool_branch_loop,
    run_pre_tool_phase,
)

pytestmark = pytest.mark.unit


@pytest.fixture
def noop_phase() -> Any:
    async def _noop() -> None:
        return None

    return _noop


@pytest.mark.unit
def test_orchestration_pipeline_order_matches_pre_and_defer_segments() -> None:
    order = routing_policy.ORCHESTRATION_PIPELINE_ORDER
    assert order[: len(PRE_TOOL_BRANCHES)] == PRE_TOOL_BRANCHES
    defer_start = len(PRE_TOOL_BRANCHES)
    defer_end = defer_start + len(DEFER_MEMORY_BRANCHES)
    assert order[defer_start:defer_end] == DEFER_MEMORY_BRANCHES
    assert OrchestrationBranch.TOOL_ROUTER_DISPATCH in order
    assert OrchestrationBranch.DOC_EDIT_REQUIRES_OPEN_EDITOR == order[-1]


@pytest.mark.unit
def test_early_and_late_tool_orders_are_stable() -> None:
    assert EARLY_TOOL_BRANCH_ORDER[0] == OrchestrationBranch.CHECK_TASK_STATUS.value
    assert "file_rewrite" in EARLY_TOOL_BRANCH_ORDER
    assert LATE_TOOL_BRANCH_ORDER[0] == "file_create"


@pytest.mark.asyncio
async def test_run_pre_tool_phase_invokes_hooks_in_canonical_sequence(noop_phase: Any) -> None:
    sequence: list[str] = []

    def _mk(name: str):
        async def _fn() -> None:
            sequence.append(name)
            return None

        return _fn

    handlers = PreToolPhaseHandlers(
        resume_pending_task=_mk("resume_pending"),
        agentic_session=_mk("agentic_session"),
        resume_completed_music_generation=_mk("resume_music"),
        resume_completed_presentation=_mk("resume_presentation"),
        output_surface=_mk("output_surface"),
        check_task_status=_mk("check_task"),
        active_operations_status=_mk("active_ops"),
        turn_plan_resume=_mk("turn_plan"),
        action_workflow=_mk("action_workflow"),
        workflow=_mk("workflow"),
        workflow_reflect_week=_mk("reflect_week"),
    )

    out, branch = await run_pre_tool_phase(handlers)

    assert out is None
    assert branch is None
    assert sequence == [
        "resume_pending",
        "agentic_session",
        "resume_music",
        "resume_presentation",
        "output_surface",
        "check_task",
        "active_ops",
        "turn_plan",
        "action_workflow",
        "workflow",
        "reflect_week",
    ]


@pytest.mark.asyncio
async def test_run_pre_tool_phase_short_circuits_on_first_hit(noop_phase: Any) -> None:
    async def _hit() -> dict[str, str]:
        return {"reply": "confirmed"}

    handlers = PreToolPhaseHandlers(
        resume_pending_task=_hit,
        agentic_session=noop_phase,
        resume_completed_music_generation=noop_phase,
        resume_completed_presentation=noop_phase,
        output_surface=noop_phase,
        check_task_status=noop_phase,
        active_operations_status=noop_phase,
        turn_plan_resume=noop_phase,
        action_workflow=noop_phase,
        workflow=noop_phase,
        workflow_reflect_week=noop_phase,
    )

    out, branch = await run_pre_tool_phase(handlers)
    assert out == {"reply": "confirmed"}
    assert branch == OrchestrationBranch.RESUME_PENDING_TASK.value


@pytest.mark.asyncio
async def test_run_pre_tool_phase_accepts_sync_noop_handlers(noop_phase: Any) -> None:
    def _sync_noop() -> None:
        return None

    async def _hit() -> dict[str, str]:
        return {"reply": "after-sync-noop"}

    handlers = PreToolPhaseHandlers(
        resume_pending_task=_sync_noop,
        agentic_session=noop_phase,
        resume_completed_music_generation=_hit,
        resume_completed_presentation=noop_phase,
        output_surface=noop_phase,
        check_task_status=noop_phase,
        active_operations_status=noop_phase,
        turn_plan_resume=noop_phase,
        action_workflow=noop_phase,
        workflow=noop_phase,
        workflow_reflect_week=noop_phase,
    )

    out, branch = await run_pre_tool_phase(handlers)

    assert out == {"reply": "after-sync-noop"}
    assert branch == OrchestrationBranch.RESUME_COMPLETED_MUSIC_GENERATION.value


@pytest.mark.asyncio
async def test_run_defer_memory_phase_order() -> None:
    order: list[str] = []

    def _mk(name: str):
        async def _fn() -> None:
            order.append(name)
            return None

        return _fn

    await run_defer_memory_phase(
        DeferMemoryPhaseHandlers(
            compound_file_chain=_mk("compound"),
            file_study_compose=_mk("study"),
            file_focus_chat=_mk("focus"),
        )
    )
    assert order == ["compound", "study", "focus"]


@pytest.mark.asyncio
async def test_run_early_tool_branch_loop_respects_probe_gate() -> None:
    probed: list[str] = []

    def may_probe(branch: str, _line: str, _profile: Any, _pid: str) -> bool:
        probed.append(branch)
        return branch == OrchestrationBranch.CATALOG_LIST.value

    async def run_tool(branch: str) -> dict[str, str] | None:
        if branch == OrchestrationBranch.CATALOG_LIST.value:
            return {"reply": "files", "orchestration_branch": branch}
        return None

    out, branch = await run_early_tool_branch_loop(
        user_line="show my files",
        profile={},
        principal_id="p1",
        may_probe=may_probe,
        run_tool_branch=run_tool,
    )

    assert out is not None
    assert branch == OrchestrationBranch.CATALOG_LIST.value
    assert OrchestrationBranch.CATALOG_LIST.value in probed


@pytest.mark.asyncio
async def test_run_late_tool_branch_loop_skips_when_gate_false() -> None:
    async def run_tool(_branch: str) -> None:
        raise AssertionError("must not run")

    out, branch = await run_late_tool_branch_loop(
        user_line="hello",
        may_match_late=lambda _line: False,
        run_tool_branch=run_tool,
    )
    assert out is None
    assert branch is None


@pytest.mark.unit
def test_task_orchestrator_wires_routing_policy_phase_runners() -> None:
    src = inspect.getsource(orch_mod.maybe_handle_companion_task_orchestration)
    assert "run_pre_tool_phase" in src
    assert "run_defer_memory_phase" in src
    assert "run_early_tool_branch_loop" in src
    assert "run_late_tool_branch_loop" in src
    assert "expect_run_revision" in inspect.getsource(orch_mod._resume_pending_task)


@pytest.mark.unit
def test_task_orchestrator_confirm_path_passes_expect_run_revision() -> None:
    src = inspect.getsource(orch_mod._resume_pending_task)
    assert "expect_run_revision=rev" in src
    assert "companion_task_find_latest_awaiting_confirmation" in src


@pytest.mark.asyncio
async def test_executor_prior_step_gate_blocks_out_of_order_dispatch(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Prior-step gate in executor must run before mark_step_in_progress / dispatch."""

    fake_pool = MagicMock(name="pool")
    fake_pool.close = AsyncMock()

    run_row = {
        "id": "run-blocked",
        "principal_id": "p1",
        "intent_kind": "music_generation_background",
        "status": "running",
        "run_revision": 2,
    }
    steps = [
        {"id": "s1", "step_index": 1, "step_kind": "music_generation_pipeline_v2", "status": "in_progress"},
        {"id": "s2", "step_index": 2, "step_kind": "confirm_gate", "status": "pending"},
    ]

    mark_mock = AsyncMock()
    dispatch_mock = AsyncMock()

    monkeypatch.setenv("EWA_DATABASE_URL", "postgresql://u:p@127.0.0.1:30433/ewa")
    monkeypatch.setattr(job_executor, "open_initialized_ewa_worker_pool", AsyncMock(return_value=fake_pool))
    monkeypatch.setattr(job_executor, "init_ewa_orchestration_schema", AsyncMock())
    monkeypatch.setattr(job_executor, "init_ewa_companion_schema", AsyncMock())
    monkeypatch.setattr(job_executor, "init_ewa_companion_plans_schema", AsyncMock())
    monkeypatch.setattr(job_executor, "companion_task_run_fetch", AsyncMock(return_value=run_row))
    monkeypatch.setattr(job_executor, "companion_task_steps_list", AsyncMock(return_value=steps))
    monkeypatch.setattr(job_executor.step_handlers, "mark_step_in_progress", mark_mock)
    monkeypatch.setattr(job_executor.step_handlers, "dispatch_step", dispatch_mock)

    out = await job_executor.execute_companion_run(run_id="run-blocked", step_index=2, job_payload={})

    assert out.get("skipped") is True
    assert out.get("reason") == "prior_step_incomplete"
    assert out.get("blocked_by_step_index") == 1
    mark_mock.assert_not_awaited()
    dispatch_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_executor_skips_cancelled_run_before_step_dispatch(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake_pool = MagicMock(name="pool")
    fake_pool.close = AsyncMock()

    run_row = {
        "id": "run-cancelled",
        "principal_id": "p1",
        "intent_kind": "music_generation_background",
        "status": "cancelled",
        "run_revision": 4,
    }
    steps = [
        {"id": "s1", "step_index": 1, "step_kind": "music_generation_pipeline_v2", "status": "completed"},
    ]

    dispatch_mock = AsyncMock()

    monkeypatch.setenv("EWA_DATABASE_URL", "postgresql://u:p@127.0.0.1:30433/ewa")
    monkeypatch.setattr(job_executor, "open_initialized_ewa_worker_pool", AsyncMock(return_value=fake_pool))
    monkeypatch.setattr(job_executor, "init_ewa_orchestration_schema", AsyncMock())
    monkeypatch.setattr(job_executor, "init_ewa_companion_schema", AsyncMock())
    monkeypatch.setattr(job_executor, "init_ewa_companion_plans_schema", AsyncMock())
    monkeypatch.setattr(job_executor, "companion_task_run_fetch", AsyncMock(return_value=run_row))
    monkeypatch.setattr(job_executor, "companion_task_steps_list", AsyncMock(return_value=steps))
    monkeypatch.setattr(job_executor.step_handlers, "dispatch_step", dispatch_mock)

    out = await job_executor.execute_companion_run(run_id="run-cancelled", step_index=1, job_payload={})

    assert out.get("skipped") is True
    assert out.get("reason") == "run_cancelled"
    dispatch_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_executor_claim_revision_conflict_blocks_step_dispatch(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake_pool = MagicMock(name="pool")
    fake_pool.close = AsyncMock()

    run_row = {
        "id": "run-race",
        "principal_id": "p1",
        "intent_kind": "music_generation_background",
        "status": "running",
        "run_revision": 8,
    }
    step_row = {
        "id": "s1",
        "step_index": 1,
        "step_kind": "music_generation_pipeline_v2",
        "status": "pending",
    }
    mark_mock = AsyncMock()
    dispatch_mock = AsyncMock()
    update_mock = AsyncMock(return_value=None)

    monkeypatch.setenv("EWA_DATABASE_URL", "postgresql://u:p@127.0.0.1:30433/ewa")
    monkeypatch.setattr(job_executor, "open_initialized_ewa_worker_pool", AsyncMock(return_value=fake_pool))
    monkeypatch.setattr(job_executor, "init_ewa_orchestration_schema", AsyncMock())
    monkeypatch.setattr(job_executor, "init_ewa_companion_schema", AsyncMock())
    monkeypatch.setattr(job_executor, "init_ewa_companion_plans_schema", AsyncMock())
    monkeypatch.setattr(job_executor, "companion_task_run_fetch", AsyncMock(return_value=run_row))
    monkeypatch.setattr(job_executor, "companion_task_steps_list", AsyncMock(return_value=[step_row]))
    monkeypatch.setattr(job_executor, "companion_task_run_update", update_mock)
    monkeypatch.setattr(job_executor.step_handlers, "mark_step_in_progress", mark_mock)
    monkeypatch.setattr(job_executor.step_handlers, "dispatch_step", dispatch_mock)

    out = await job_executor.execute_companion_run(run_id="run-race", step_index=1, job_payload={})

    assert out.get("skipped") is True
    assert out.get("reason") == "run_revision_conflict"
    update_mock.assert_awaited_once()
    mark_mock.assert_not_awaited()
    dispatch_mock.assert_not_awaited()
