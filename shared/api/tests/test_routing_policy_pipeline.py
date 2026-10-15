# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for canonical orchestration phase ordering in ``routing_policy``.
# Invariants:
# - No live HTTP/Postgres; phase hooks are stubs.
# Related:
# - api/ewa_platform/companion/orchestration/routing_policy.py
# ---

from __future__ import annotations

import asyncio

import pytest

from api.ewa_platform.companion.orchestration.routing_policy import (
    DeferMemoryPhaseHandlers,
    OrchestrationBranch,
    PreToolPhaseHandlers,
    run_defer_memory_phase,
    run_pre_tool_phase,
)


@pytest.mark.unit
def test_pre_tool_phase_stops_at_first_handler() -> None:
    calls: list[str] = []

    async def _noop() -> None:
        return None

    async def _hit() -> dict[str, str]:
        calls.append("resume_pending")
        return {"reply": "ok"}

    handlers = PreToolPhaseHandlers(
        resume_pending_task=_hit,
        agentic_session=_noop,
        resume_completed_music_generation=_noop,
        resume_completed_presentation=_noop,
        output_surface=_noop,
        check_task_status=_noop,
        active_operations_status=_noop,
        turn_plan_resume=_noop,
        action_workflow=_noop,
        workflow=_noop,
        workflow_reflect_week=_noop,
    )

    out, branch = asyncio.run(run_pre_tool_phase(handlers))
    assert out == {"reply": "ok"}
    assert branch == OrchestrationBranch.RESUME_PENDING_TASK.value
    assert calls == ["resume_pending"]


@pytest.mark.unit
def test_defer_memory_phase_order() -> None:
    order: list[str] = []

    def _mk(name: str):
        async def _fn() -> dict[str, str] | None:
            order.append(name)
            return None

        return _fn

    handlers = DeferMemoryPhaseHandlers(
        compound_file_chain=_mk("compound"),
        file_study_compose=_mk("study"),
        file_focus_chat=_mk("focus"),
    )
    asyncio.run(run_defer_memory_phase(handlers))
    assert order == ["compound", "study", "focus"]
