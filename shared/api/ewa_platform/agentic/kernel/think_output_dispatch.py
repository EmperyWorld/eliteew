# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Think-output action dispatch (clarify/plan/gate/act/complete) extracted from loop (K4 LOC).
# Invariants:
# - Scheduler ON (default): action=act → scheduler_handoff only (no inline tool dispatch).
# - Scheduler OFF: inline Act via act_executor.execute_inline_act (K3 dual-flag path).
# Related:
# - api/ewa_platform/agentic/kernel/loop.py
# - api/ewa_platform/agentic/kernel/act_executor.py
# - documentation/product/ewa/EWA-AGENTIC-KERNEL-REDESIGN.md §K3/K4
# ---

from __future__ import annotations

from collections.abc import Awaitable, Callable, Mapping
from typing import Any

import asyncpg

from api.ewa_platform.agentic.config import agentic_step_scheduler_enabled
from api.ewa_platform.agentic.kernel.act_executor import execute_inline_act, scheduler_handoff_for_act
from api.ewa_platform.agentic.kernel.fsm_port import think_to_transition_event
from api.ewa_platform.agentic.kernel.hitl_from_think import process_clarify_action, process_gate_action
from api.ewa_platform.agentic.kernel.loop_tick_support import (
    fsm_port_apply,
    record_replanning_guard,
    think_action_to_decision_type,
)
from api.ewa_platform.agentic.kernel.plan_applier import process_plan_action
from api.ewa_platform.agentic.kernel.think_schema import AgenticThinkOutput
from api.ewa_platform.agentic.kernel.types import (
    AgenticContext,
    AgenticLoopError,
    LoopTickResult,
    TransitionResult,
)
from api.ewa_platform.companion.orchestration.tool_registry import ToolContext

FsmPortApplyFn = Callable[..., Awaitable[TransitionResult]]
RecordReplanningGuardFn = Callable[..., Awaitable[LoopTickResult | None]]
ThinkActionToDecisionFn = Callable[[str], str]
StepSchedulerEnabledFn = Callable[[], bool]
ThinkToTransitionEventFn = Callable[..., str | None]
InlineActFn = Callable[..., Awaitable[LoopTickResult | None]]
SchedulerHandoffFn = Callable[..., Awaitable[LoopTickResult]]


async def process_think_output(
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
    fsm_port_apply_fn: FsmPortApplyFn = fsm_port_apply,
    record_replanning_guard_fn: RecordReplanningGuardFn = record_replanning_guard,
    think_action_to_decision_fn: ThinkActionToDecisionFn = think_action_to_decision_type,
    step_scheduler_enabled_fn: StepSchedulerEnabledFn = agentic_step_scheduler_enabled,
    execute_inline_act_fn: InlineActFn = execute_inline_act,
    scheduler_handoff_fn: SchedulerHandoffFn = scheduler_handoff_for_act,
    think_to_transition_event_fn: ThinkToTransitionEventFn = think_to_transition_event,
) -> LoopTickResult | None:
    """Dispatch a validated think output. Returns None to continue the inner loop."""

    if not isinstance(think_out, AgenticThinkOutput):
        raise AgenticLoopError(f"think_output_invalid_type:{type(think_out).__name__}")

    status = str(session.get("status") or "")
    action = think_out.action
    if not action:
        raise AgenticLoopError("think_action_missing")

    if action == "clarify":
        return await process_clarify_action(
            pool,
            think_out=think_out,
            session=session,
            session_id=session_id,
            principal_id=principal_id,
            iterations=iterations,
            fsm_port_apply=fsm_port_apply_fn,
            think_action_to_decision_type=think_action_to_decision_fn,
        )

    if action == "plan":
        return await process_plan_action(
            pool,
            think_out=think_out,
            session=session,
            session_id=session_id,
            principal_id=principal_id,
            iterations=iterations,
            fsm_port_apply=fsm_port_apply_fn,
            record_replanning_guard=record_replanning_guard_fn,
            think_action_to_decision_type=think_action_to_decision_fn,
        )

    if action == "gate":
        return await process_gate_action(
            pool,
            think_out=think_out,
            session=session,
            session_id=session_id,
            principal_id=principal_id,
            iterations=iterations,
        )

    if action == "act":
        # K3: scheduler-owned Act — never inline agentic_dispatch_tool when flag is ON.
        if step_scheduler_enabled_fn():
            return await scheduler_handoff_fn(
                pool,
                session=session,
                session_id=session_id,
                principal_id=principal_id,
                iterations=iterations,
                action=action,
                fsm_port_apply=fsm_port_apply_fn,
                think_action_to_decision_type=think_action_to_decision_fn,
                think_to_transition_event=think_to_transition_event_fn,
            )
        return await execute_inline_act_fn(
            pool,
            think_out=think_out,
            session=session,
            session_id=session_id,
            principal_id=principal_id,
            tool_ctx=tool_ctx,
            iterations=iterations,
            ctx=ctx,
            active_nodes=active_nodes,
            record_replanning_guard=record_replanning_guard_fn,
        )

    if action == "complete":
        from api.ewa_platform.agentic.kernel.session_status import STATUS_EXECUTING, STATUS_REPLANNING

        if status == STATUS_EXECUTING:
            from api.ewa_platform.agentic.kernel.mid_mission_replan import try_mid_mission_replan_handoff

            handled, replan_session, replan_reason = await try_mid_mission_replan_handoff(
                pool,
                session=session,
            )
            if handled:
                session_out = replan_session or dict(session)
                continue_loop = str(session_out.get("status") or "") == STATUS_REPLANNING
                return LoopTickResult(
                    ok=True,
                    session=session_out,
                    continue_loop=continue_loop,
                    iterations_ran=iterations,
                    reason=f"mid_mission_replan:{replan_reason}",
                )
        done_event = (
            think_to_transition_event_fn(
                current_status=status,
                decision_type=think_action_to_decision_fn(action),
                loop_action=action,
            )
            or "step_ok_done"
        )
        tr = await fsm_port_apply_fn(
            pool,
            session_id=session_id,
            principal_id=principal_id,
            expected_revision=int(session["session_revision"]),
            correlation_id=f"think-done-{session_id}-{int(session['session_revision'])}",
            event=done_event,
        )
        session_out = tr.session or dict(session)
        return LoopTickResult(ok=True, session=session_out, continue_loop=False, iterations_ran=iterations)

    raise AgenticLoopError("unknown_think_action", detail=action)
