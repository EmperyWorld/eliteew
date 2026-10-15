# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Thin Observe→Think→Plan→Act coordinator for one Celery tick or HTTP bootstrap (K4).
# Decision / FSM / Act / tick helpers live in sibling kernel modules — not here.
# Invariants:
# - Max iterations per tick from EWA_AGENTIC_MAX_ITERATIONS_PER_TICK; persists between ticks.
# - Never dereference optional think/rehydrate outputs without explicit guards.
# - Think goes through Decision Engine; Think-driven transitions through fsm_port.
# - Scheduler ON (default): Think action=act → scheduler_handoff only (no inline tool dispatch).
# Related:
# - api/ewa_platform/agentic/kernel/rehydrate.py
# - api/ewa_platform/agentic/kernel/loop_bridge.py
# - api/ewa_platform/agentic/kernel/loop_tick_support.py
# - api/ewa_platform/agentic/kernel/think_output_dispatch.py
# - api/ewa_platform/agentic/kernel/act_executor.py
# - api/ewa_platform/agentic/jobs/executor.py
# - documentation/product/ewa/EWA-AGENTIC-KERNEL-REDESIGN.md §K4
# ---

from __future__ import annotations

from collections.abc import Awaitable, Callable, Mapping
from typing import Any

import asyncpg

from api.ewa_platform.agentic.adapters.task_run_events import publish_agentic_session_lifecycle_sync
from api.ewa_platform.agentic.config import (
    agentic_lease_seconds,
    agentic_max_iterations_per_tick,
    agentic_step_scheduler_enabled,
)
from api.ewa_platform.agentic.jobs.reliability import safe_sync_and_publish_task_run_from_session
from api.ewa_platform.agentic.kernel import state_machine as fsm
from api.ewa_platform.agentic.kernel.act_executor import execute_inline_act, scheduler_handoff_for_act
from api.ewa_platform.agentic.kernel.fsm_port import think_to_transition_event
from api.ewa_platform.agentic.kernel.loop_bridge import (
    DecisionToActionResult,
    run_decision_to_action_cycle,
    run_think_transition_act_feedback_cycle,
)
from api.ewa_platform.agentic.kernel.loop_tick_support import (
    abort_tick as abort_tick_impl,
)
from api.ewa_platform.agentic.kernel.loop_tick_support import (
    fsm_port_apply,
    gate_expired,
    handle_missing_think_output,
    handle_think_phase_without_output_tick,
    pause_on_budget,
    rehydrate_busy_result,
    resolve_awaiting_human_tick,
    run_leased_tick_body,
    think_action_to_decision_type,
)
from api.ewa_platform.agentic.kernel.loop_tick_support import (
    record_replanning_guard as record_replanning_guard_impl,
)
from api.ewa_platform.agentic.kernel.rehydrate import rehydrate_agentic_context
from api.ewa_platform.agentic.kernel.think_outcome import ThinkPhaseResult
from api.ewa_platform.agentic.kernel.think_output_dispatch import process_think_output
from api.ewa_platform.agentic.kernel.think_phase import (
    persist_think_and_get_output,
    think_phase_from_parse_session,
)
from api.ewa_platform.agentic.kernel.think_schema import AgenticThinkOutput
from api.ewa_platform.agentic.kernel.types import AgenticContext, LoopTickResult
from api.ewa_platform.companion.orchestration.tool_registry import ToolContext
from api.ewa_platform.persistence_pg import agentic_asyncpg as agentic_pg

# Re-exports / aliases — tests monkeypatch these names on this module.
_think_action_to_decision_type = think_action_to_decision_type
_fsm_port_apply = fsm_port_apply
_gate_expired = gate_expired
_pause_on_budget = pause_on_budget
_rehydrate_busy_result = rehydrate_busy_result
_think_phase_from_parse_session = think_phase_from_parse_session

ThinkFn = Callable[[AgenticContext], Awaitable[AgenticThinkOutput]]


async def _persist_think_and_get_output(
    pool: asyncpg.Pool,
    *,
    session: Mapping[str, Any],
    session_id: str,
    principal_id: str,
    ctx: AgenticContext,
    think_fn: ThinkFn | None,
) -> ThinkPhaseResult:
    return await persist_think_and_get_output(
        pool,
        session=session,
        session_id=session_id,
        principal_id=principal_id,
        ctx=ctx,
        think_fn=think_fn,
    )


async def _abort_tick(
    pool: asyncpg.Pool,
    *,
    session: Mapping[str, Any],
    session_id: str,
    principal_id: str,
    reason: str,
    iterations: int,
) -> LoopTickResult:
    return await abort_tick_impl(
        pool,
        session=session,
        session_id=session_id,
        principal_id=principal_id,
        reason=reason,
        iterations=iterations,
        apply_transition=fsm.apply_session_transition,
        safe_sync=safe_sync_and_publish_task_run_from_session,
        publish_lifecycle=publish_agentic_session_lifecycle_sync,
    )


async def _record_replanning_guard(
    pool: asyncpg.Pool,
    *,
    session: Mapping[str, Any],
    session_id: str,
    principal_id: str,
    reason: str,
    iterations: int,
) -> LoopTickResult | None:
    return await record_replanning_guard_impl(
        pool,
        session=session,
        session_id=session_id,
        principal_id=principal_id,
        reason=reason,
        iterations=iterations,
        record_replanning_atomic=agentic_pg.agentic_record_replanning_atomic,
        safe_sync=safe_sync_and_publish_task_run_from_session,
        publish_lifecycle=publish_agentic_session_lifecycle_sync,
    )


async def _handle_think_phase_without_output(
    pool: asyncpg.Pool,
    *,
    phase: ThinkPhaseResult,
    session_id: str,
    principal_id: str,
    iterations: int,
) -> LoopTickResult:
    return await handle_think_phase_without_output_tick(
        pool,
        phase=phase,
        session_id=session_id,
        principal_id=principal_id,
        iterations=iterations,
        abort_tick_fn=_abort_tick,
    )


async def _handle_missing_think_output(  # pyright: ignore[reportUnusedFunction]
    pool: asyncpg.Pool,
    *,
    session: Mapping[str, Any],
    session_id: str,
    principal_id: str,
    think_ok: bool = False,
    persist_error: str | None = None,
    iterations: int = 0,
    phase: ThinkPhaseResult | None = None,
) -> LoopTickResult:
    return await handle_missing_think_output(
        pool,
        session=session,
        session_id=session_id,
        principal_id=principal_id,
        think_ok=think_ok,
        persist_error=persist_error,
        iterations=iterations,
        phase=phase,
        abort_tick_fn=_abort_tick,
    )


async def _process_think_output(
    pool: asyncpg.Pool,
    *,
    think_out: AgenticThinkOutput,
    session: Mapping[str, Any],
    session_id: str,
    principal_id: str,
    tool_ctx: ToolContext | None,
    iterations: int,
    ctx: AgenticContext | None = None,
    active_nodes: list[Mapping[str, Any]] | None = None,
) -> LoopTickResult | None:
    """Dispatch relay — injects this module's deps so monkeypatches on loop still apply."""

    return await process_think_output(
        pool,
        think_out=think_out,
        session=session,
        session_id=session_id,
        principal_id=principal_id,
        tool_ctx=tool_ctx,
        iterations=iterations,
        ctx=ctx,
        active_nodes=active_nodes,
        fsm_port_apply_fn=_fsm_port_apply,
        record_replanning_guard_fn=_record_replanning_guard,
        think_action_to_decision_fn=_think_action_to_decision_type,
        step_scheduler_enabled_fn=agentic_step_scheduler_enabled,
        execute_inline_act_fn=execute_inline_act,
        scheduler_handoff_fn=scheduler_handoff_for_act,
        think_to_transition_event_fn=think_to_transition_event,
    )


async def run_decision_to_action_bridge(
    *,
    context: AgenticContext,
    session_id: str,
    principal_id: str,
    expected_revision: int,
    correlation_id: str,
    llm_complete=None,
    apply_transition=None,
    dispatch_act=None,
    persist_plan=None,
    with_action_feedback: bool = False,
) -> DecisionToActionResult:
    """
    Public thin relay entry (K1/K2): Context → Think → Transition → Act
    (+ optional Action Feedback → Next Think when with_action_feedback=True).
    """

    if with_action_feedback:
        return await run_think_transition_act_feedback_cycle(
            context=context,
            session_id=session_id,
            principal_id=principal_id,
            expected_revision=expected_revision,
            correlation_id=correlation_id,
            llm_complete=llm_complete,
            apply_transition=apply_transition,
            dispatch_act=dispatch_act,
            persist_plan=persist_plan,
        )
    return await run_decision_to_action_cycle(
        context=context,
        session_id=session_id,
        principal_id=principal_id,
        expected_revision=expected_revision,
        correlation_id=correlation_id,
        llm_complete=llm_complete,
        apply_transition=apply_transition,
        dispatch_act=dispatch_act,
        persist_plan=persist_plan,
    )


async def run_agentic_loop_tick(
    pool: asyncpg.Pool,
    *,
    session_id: str,
    principal_id: str,
    worker_id: str,
    think_fn: ThinkFn | None = None,
    tool_ctx: ToolContext | None = None,
    expected_revision: int | None = None,
) -> LoopTickResult:
    ctx = await rehydrate_agentic_context(
        pool,
        session_id=session_id,
        principal_id=principal_id,
        worker_id=worker_id,
        for_update=False,
    )
    busy_result = _rehydrate_busy_result(ctx, session=ctx.session, iterations=0)
    if busy_result is not None:
        return busy_result

    session = ctx.session
    rev = int(session.get("session_revision") or 0)
    if expected_revision is not None and expected_revision != rev:
        return LoopTickResult(ok=True, continue_loop=False, reason="stale_revision")

    status = str(session.get("status") or "")
    if status in agentic_pg.TERMINAL_SESSION_STATUSES:
        return LoopTickResult(ok=True, session=session, continue_loop=False, reason="terminal")

    if status == fsm.STATUS_AWAITING_HUMAN:
        return await resolve_awaiting_human_tick(
            pool,
            session=session,
            session_id=session_id,
            principal_id=principal_id,
            rev=rev,
        )

    leased = await agentic_pg.agentic_session_acquire_lease(
        pool,
        session_id=session_id,
        principal_id=principal_id,
        lease_holder=worker_id,
        lease_seconds=agentic_lease_seconds(),
        expect_revision=rev,
    )
    if leased is None:
        return LoopTickResult(ok=True, continue_loop=False, reason="lease_conflict")

    session = leased
    rev = int(session["session_revision"])
    status = str(session.get("status") or "")

    try:
        return await run_leased_tick_body(
            pool,
            session=session,
            session_id=session_id,
            principal_id=principal_id,
            worker_id=worker_id,
            think_fn=think_fn,
            tool_ctx=tool_ctx,
            max_iter=agentic_max_iterations_per_tick(),
            status=status,
            rev=rev,
            persist_think_fn=_persist_think_and_get_output,
            handle_think_without_output_fn=_handle_think_phase_without_output,
            process_think_output_fn=_process_think_output,
            abort_tick_fn=_abort_tick,
            pause_on_budget_fn=_pause_on_budget,
        )
    finally:
        await agentic_pg.agentic_session_release_lease(
            pool,
            session_id=session_id,
            principal_id=principal_id,
            lease_holder=worker_id,
        )
