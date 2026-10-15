# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Tick preamble / pause-abort-busy / replanning / FSM-port helpers extracted from loop (K4 LOC).
# Invariants:
# - Abort and circuit-open paths always best-effort Operations mirror (Gate G3).
# - Rehydrate busy returns continue_loop=False without mutating lease.
# Related:
# - api/ewa_platform/agentic/kernel/loop.py
# - documentation/product/ewa/EWA-AGENTIC-KERNEL-REDESIGN.md §K4
# ---

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable, Mapping
from typing import Any

import asyncpg

from api.ewa_platform.agentic.adapters.task_run_events import (
    publish_agentic_session_lifecycle_sync,
    sync_and_publish_task_run_from_session,
)
from api.ewa_platform.agentic.budget import session_budget_exceeded, with_budget_wall_anchor
from api.ewa_platform.agentic.config import agentic_step_scheduler_enabled
from api.ewa_platform.agentic.driver.tick_integration import persist_driver_read_snapshot
from api.ewa_platform.agentic.gate_contract import build_gate_json, gate_is_expired
from api.ewa_platform.agentic.jobs.reliability import safe_sync_and_publish_task_run_from_session
from api.ewa_platform.agentic.kernel import state_machine as fsm
from api.ewa_platform.agentic.kernel.circuit_breaker import REASONING_LOOP_DETECTED, circuit_is_open
from api.ewa_platform.agentic.kernel.fsm_port import (
    build_apply_transition,
    handle_apply_transition,
)
from api.ewa_platform.agentic.kernel.rehydrate import rehydrate_agentic_context
from api.ewa_platform.agentic.kernel.think_outcome import ThinkPhaseResult
from api.ewa_platform.agentic.kernel.think_phase import handle_think_phase_without_output
from api.ewa_platform.agentic.kernel.types import (
    AgenticContext,
    AgenticLoopError,
    LoopTickResult,
    TransitionResult,
)
from api.ewa_platform.persistence_pg import agentic_asyncpg as agentic_pg

logger = logging.getLogger(__name__)

AbortTickFn = Callable[..., Awaitable[LoopTickResult]]


def think_action_to_decision_type(action: str) -> str:
    mapping = {
        "plan": "mutate",
        "act": "continue",
        "clarify": "intervene",
        "gate": "intervene",
        "complete": "terminate",
    }
    return mapping.get(str(action or "").strip().lower(), "")


async def fsm_port_apply(
    pool: asyncpg.Pool,
    *,
    session_id: str,
    principal_id: str,
    expected_revision: int,
    correlation_id: str,
    event: str,
    gate_json: Mapping[str, Any] | None = None,
    plan_summary: str | None = None,
) -> TransitionResult:
    """Thin relay to fsm_port.handle_apply_transition (no transition table logic here)."""

    cmd = build_apply_transition(
        session_id=session_id,
        principal_id=principal_id,
        expected_revision=expected_revision,
        correlation_id=correlation_id,
        event=event,
        gate_json=gate_json,
        plan_summary=plan_summary,
    )
    ev = await handle_apply_transition(cmd, pool)
    if ev.kind != "transition_applied":
        return TransitionResult(ok=False, reason=ev.error_code or "transition_rejected")
    session_payload = ev.payload.get("session")
    session_dict = dict(session_payload) if isinstance(session_payload, Mapping) else None
    checkpoint_id = ev.payload.get("checkpoint_id")
    return TransitionResult(
        ok=True,
        session=session_dict,
        checkpoint_id=int(checkpoint_id) if checkpoint_id is not None else None,
    )


def gate_expired(gate_json: Mapping[str, Any]) -> bool:
    return gate_is_expired(gate_json)


async def pause_on_budget(
    pool: asyncpg.Pool,
    *,
    session: Mapping[str, Any],
    session_id: str,
    principal_id: str,
    budget_reason: str,
    iterations: int,
) -> LoopTickResult:
    tr = await fsm.apply_session_transition(
        pool,
        session_id=session_id,
        principal_id=principal_id,
        event="budget_exceeded",
        expect_revision=int(session["session_revision"]),
    )
    session_out = tr.session or dict(session)
    if tr.ok and tr.session is not None:
        await sync_and_publish_task_run_from_session(pool, session=tr.session)
    return LoopTickResult(
        ok=tr.ok,
        session=session_out,
        continue_loop=False,
        reason=budget_reason,
        iterations_ran=iterations,
    )


ApplyTransitionFn = Callable[..., Awaitable[TransitionResult]]
SafeSyncFn = Callable[..., Awaitable[bool]]
PublishLifecycleFn = Callable[..., None]


async def abort_tick(
    pool: asyncpg.Pool,
    *,
    session: Mapping[str, Any],
    session_id: str,
    principal_id: str,
    reason: str,
    iterations: int,
    apply_transition: ApplyTransitionFn | None = None,
    safe_sync: SafeSyncFn | None = None,
    publish_lifecycle: PublishLifecycleFn | None = None,
) -> LoopTickResult:
    """Best-effort fatal transition when loop invariants break mid-tick.

    Gate G3: always best-effort Operations mirror sync so UI cannot stay Running.
    Optional injectables keep monkeypatches on loop.py working.
    """

    apply_fn = apply_transition or fsm.apply_session_transition
    sync_fn = safe_sync or safe_sync_and_publish_task_run_from_session
    publish_fn = publish_lifecycle or publish_agentic_session_lifecycle_sync

    logger.warning(
        "[STEP] agentic_loop_abort session_id=%s reason=%s iterations=%s",
        session_id,
        reason,
        iterations,
    )
    sid = str(session.get("id") or session_id)
    if sid and session.get("session_revision") is not None:
        tr = await apply_fn(
            pool,
            session_id=sid,
            principal_id=principal_id,
            event="fatal_error",
            expect_revision=int(session["session_revision"]),
            clear_lease=True,
        )
        session_out = tr.session or dict(session)
        if tr.ok:
            await sync_fn(pool, session=session_out)
            publish_fn(session_out, extra={"reason": reason})
            return LoopTickResult(
                ok=True,
                session=session_out,
                continue_loop=False,
                reason=reason,
                iterations_ran=iterations,
            )
    await sync_fn(pool, session=dict(session))
    return LoopTickResult(
        ok=False, session=dict(session), continue_loop=False, reason=reason, iterations_ran=iterations
    )


def rehydrate_busy_result(
    ctx: AgenticContext,
    *,
    session: Mapping[str, Any],
    iterations: int,
) -> LoopTickResult | None:
    if not ctx.busy:
        return None
    reason = str(ctx.busy_reason or "rehydrate_busy")
    logger.warning(
        "[STEP] agentic_rehydrate_blocked session_id=%s reason=%s iterations=%s",
        session.get("id"),
        reason,
        iterations,
    )
    if reason == "session_not_found":
        return LoopTickResult(
            ok=False,
            session=dict(session) if session.get("id") else None,
            continue_loop=False,
            reason=reason,
            iterations_ran=iterations,
        )
    return LoopTickResult(
        ok=True,
        session=dict(session) if session.get("id") else None,
        continue_loop=False,
        reason=reason,
        iterations_ran=iterations,
    )


async def handle_think_phase_without_output_tick(
    pool: asyncpg.Pool,
    *,
    phase: ThinkPhaseResult,
    session_id: str,
    principal_id: str,
    iterations: int,
    abort_tick_fn: AbortTickFn,
) -> LoopTickResult:
    return await handle_think_phase_without_output(
        pool,
        phase=phase,
        session_id=session_id,
        principal_id=principal_id,
        iterations=iterations,
        abort_tick=abort_tick_fn,
    )


async def handle_missing_think_output(
    pool: asyncpg.Pool,
    *,
    session: Mapping[str, Any],
    session_id: str,
    principal_id: str,
    think_ok: bool = False,
    persist_error: str | None = None,
    iterations: int = 0,
    phase: ThinkPhaseResult | None = None,
    abort_tick_fn: AbortTickFn,
) -> LoopTickResult:
    """Backward-compatible helper for tests that still call the pre-K4 name."""

    if phase is None:
        if persist_error:
            phase = ThinkPhaseResult(
                kind="persist_conflict",
                session=dict(session),
                persist_error=persist_error,
            )
        elif str(session.get("status") or "") == fsm.STATUS_AWAITING_HUMAN:
            phase = ThinkPhaseResult(kind="parse_awaiting_human", session=dict(session))
        elif str(session.get("status") or "") == fsm.STATUS_REPLANNING:
            phase = ThinkPhaseResult(kind="parse_replanning", session=dict(session))
        elif str(session.get("status") or "") == fsm.STATUS_FAILED:
            phase = ThinkPhaseResult(kind="parse_failed", session=dict(session))
        elif str(session.get("status") or "") in agentic_pg.TERMINAL_SESSION_STATUSES:
            phase = ThinkPhaseResult(kind="terminal", session=dict(session))
        else:
            phase = ThinkPhaseResult(
                kind="persist_conflict" if not think_ok else "terminal",
                session=dict(session),
                persist_error="unknown" if not think_ok else None,
            )
    return await handle_think_phase_without_output_tick(
        pool,
        phase=phase,
        session_id=session_id,
        principal_id=principal_id,
        iterations=iterations,
        abort_tick_fn=abort_tick_fn,
    )


def loop_result_after_replanning_record(
    session_after: dict[str, Any] | None,
    *,
    iterations: int,
) -> LoopTickResult | None:
    if session_after is None:
        return LoopTickResult(ok=False, reason="revision_conflict", iterations_ran=iterations)
    if str(session_after.get("status")) == fsm.STATUS_AWAITING_HUMAN:
        return LoopTickResult(
            ok=True,
            session=session_after,
            continue_loop=False,
            reason=REASONING_LOOP_DETECTED,
            iterations_ran=iterations,
        )
    return None


RecordReplanningAtomicFn = Callable[..., Awaitable[tuple[Any, dict[str, Any] | None]]]


async def record_replanning_guard(
    pool: asyncpg.Pool,
    *,
    session: Mapping[str, Any],
    session_id: str,
    principal_id: str,
    reason: str,
    iterations: int,
    record_replanning_atomic: RecordReplanningAtomicFn | None = None,
    safe_sync: SafeSyncFn | None = None,
    publish_lifecycle: PublishLifecycleFn | None = None,
) -> LoopTickResult | None:
    record_fn = record_replanning_atomic or agentic_pg.agentic_record_replanning_atomic
    sync_fn = safe_sync or safe_sync_and_publish_task_run_from_session
    publish_fn = publish_lifecycle or publish_agentic_session_lifecycle_sync
    _, session_after = await record_fn(
        pool,
        session_id=session_id,
        principal_id=principal_id,
        expect_revision=int(session["session_revision"]),
        reason=reason,
    )
    tick = loop_result_after_replanning_record(session_after, iterations=iterations)
    # Gate G3: circuit-open → awaiting_human must mirror so UI is not stuck on Running.
    if tick is not None and tick.session is not None and str(tick.session.get("status")) == fsm.STATUS_AWAITING_HUMAN:
        await sync_fn(pool, session=tick.session)
        publish_fn(tick.session)
    return tick


async def resolve_awaiting_human_tick(
    pool: asyncpg.Pool,
    *,
    session: Mapping[str, Any],
    session_id: str,
    principal_id: str,
    rev: int,
) -> LoopTickResult:
    """Gate-timeout abandon/pause or soft stop while awaiting_human."""

    gate = session.get("gate_json")
    if isinstance(gate, Mapping) and gate_expired(gate):
        policy = session.get("policy_json")
        on_timeout = "pause"
        if isinstance(policy, Mapping):
            on_timeout = str(policy.get("gate_on_timeout") or "pause")
        event = "gate_timeout_abandon" if on_timeout == "abandon" else "gate_timeout_pause"
        tr = await fsm.apply_session_transition(
            pool,
            session_id=session_id,
            principal_id=principal_id,
            event=event,
            expect_revision=rev,
        )
        return LoopTickResult(ok=tr.ok, session=tr.session, continue_loop=False, reason=event)
    return LoopTickResult(ok=True, session=session, continue_loop=False, reason="awaiting_human")


async def maybe_scheduler_replanning_handoff(
    pool: asyncpg.Pool,
    *,
    session: Mapping[str, Any],
    session_id: str,
    principal_id: str,
    rev: int,
    status: str,
) -> LoopTickResult | None:
    """When scheduler ON and replanning has runnable pending nodes → hand off."""

    if status != fsm.STATUS_REPLANNING or not agentic_step_scheduler_enabled():
        return None
    counts = await agentic_pg.agentic_task_tree_status_counts(pool, session_id=session_id)
    runnable_pending = int(counts.get("pending") or 0) + int(counts.get("retry_wait") or 0)
    if runnable_pending <= 0:
        return None
    tr = await fsm.apply_session_transition(
        pool,
        session_id=session_id,
        principal_id=principal_id,
        event="plan_patch_applied",
        expect_revision=rev,
        plan_summary=str(session.get("plan_summary") or "").strip() or None,
    )
    if tr.ok and tr.session is not None:
        publish_agentic_session_lifecycle_sync(tr.session)
        return LoopTickResult(
            ok=True,
            session=tr.session,
            continue_loop=True,
            reason="scheduler_handoff",
            iterations_ran=0,
        )
    return None


async def ensure_init_started(
    pool: asyncpg.Pool,
    *,
    session: Mapping[str, Any],
    session_id: str,
    principal_id: str,
    rev: int,
    status: str,
) -> tuple[Mapping[str, Any], int, str] | LoopTickResult:
    """INIT → start (+ budget wall anchor). Returns session tuple or failure tick."""

    if status != fsm.STATUS_INIT:
        return session, rev, status
    tr = await fsm.apply_session_transition(
        pool,
        session_id=session_id,
        principal_id=principal_id,
        event="start",
        expect_revision=rev,
    )
    if not tr.ok or tr.session is None:
        return LoopTickResult(ok=False, reason=tr.reason)
    session = tr.session
    rev = int(session["session_revision"])
    status = str(session["status"])
    wm_raw = session.get("working_memory_json")
    wm = dict(wm_raw) if isinstance(wm_raw, Mapping) else {}
    if "budget_wall_anchor_at" not in wm:
        patched = await agentic_pg.agentic_session_update(
            pool,
            session_id=session_id,
            principal_id=principal_id,
            working_memory_json=with_budget_wall_anchor(wm),
            expect_revision=rev,
        )
        if patched is not None:
            session = patched
            rev = int(session["session_revision"])
            status = str(session["status"])
    return session, rev, status


async def open_circuit_breaker_hitl(
    pool: asyncpg.Pool,
    *,
    session: Mapping[str, Any],
    session_id: str,
    principal_id: str,
    iterations: int,
) -> LoopTickResult:
    """Circuit open → awaiting_human gate + Operations mirror (Gate G3)."""

    rev = int(session["session_revision"])
    gate_payload = build_gate_json(
        kind="circuit_break",
        title="Требуется участие",
        prompt=(
            "Агент несколько раз подряд не смог выполнить шаг. "
            "Проверьте задачу и ответьте, чтобы продолжить, или отмените сценарий."
        ),
        session_revision=rev,
        ttl_hours=48.0,
    )
    updated = await agentic_pg.agentic_session_update(
        pool,
        session_id=session_id,
        principal_id=principal_id,
        status=fsm.STATUS_AWAITING_HUMAN,
        gate_json=gate_payload,
        expect_revision=rev,
        clear_lease=True,
    )
    session_out = updated or session
    await safe_sync_and_publish_task_run_from_session(pool, session=session_out)
    publish_agentic_session_lifecycle_sync(session_out)
    return LoopTickResult(
        ok=True,
        session=session_out,
        continue_loop=False,
        reason=REASONING_LOOP_DETECTED,
        iterations_ran=iterations,
    )


PersistThinkFn = Callable[..., Awaitable[ThinkPhaseResult]]
HandleThinkWithoutOutputFn = Callable[..., Awaitable[LoopTickResult]]
ProcessThinkOutputFn = Callable[..., Awaitable[LoopTickResult | None]]
PauseOnBudgetFn = Callable[..., Awaitable[LoopTickResult]]


async def run_leased_tick_body(
    pool: asyncpg.Pool,
    *,
    session: Mapping[str, Any],
    session_id: str,
    principal_id: str,
    worker_id: str,
    think_fn: Callable[..., Awaitable[Any]] | None,
    tool_ctx: Any,
    max_iter: int,
    status: str,
    rev: int,
    persist_think_fn: PersistThinkFn,
    handle_think_without_output_fn: HandleThinkWithoutOutputFn,
    process_think_output_fn: ProcessThinkOutputFn,
    abort_tick_fn: AbortTickFn,
    pause_on_budget_fn: PauseOnBudgetFn,
) -> LoopTickResult:
    """Inner leased tick: replanning handoff → INIT → Observe/Think/dispatch loop."""

    handoff = await maybe_scheduler_replanning_handoff(
        pool,
        session=session,
        session_id=session_id,
        principal_id=principal_id,
        rev=rev,
        status=status,
    )
    if handoff is not None:
        return handoff

    started = await ensure_init_started(
        pool,
        session=session,
        session_id=session_id,
        principal_id=principal_id,
        rev=rev,
        status=status,
    )
    if isinstance(started, LoopTickResult):
        return started
    session, rev, status = started

    iterations = 0
    while iterations < max_iter and str(session.get("status")) in agentic_pg.ACTIVE_SESSION_STATUSES:
        iterations += 1
        ctx = await rehydrate_agentic_context(
            pool,
            session_id=session_id,
            principal_id=principal_id,
            worker_id=worker_id,
        )
        busy_result = rehydrate_busy_result(ctx, session=session, iterations=iterations)
        if busy_result is not None:
            return busy_result

        if circuit_is_open(session):
            return await open_circuit_breaker_hitl(
                pool,
                session=session,
                session_id=session_id,
                principal_id=principal_id,
                iterations=iterations,
            )

        policy_raw = session.get("policy_json")
        exceeded, budget_reason = session_budget_exceeded(
            session,
            policy_json=policy_raw if isinstance(policy_raw, Mapping) else None,
        )
        if exceeded:
            return await pause_on_budget_fn(
                pool,
                session=session,
                session_id=session_id,
                principal_id=principal_id,
                budget_reason=budget_reason,
                iterations=iterations,
            )

        _, session = await persist_driver_read_snapshot(
            pool,
            session=session,
            ctx=ctx,
            principal_id=principal_id,
        )

        await agentic_pg.agentic_checkpoint_append(
            pool,
            session_id=session_id,
            kind="observe",
            payload_json={"summary": f"tick iter={iterations}", "tree": ctx.tree_summary},
        )

        if ctx.inbound_messages:
            await agentic_pg.agentic_inbound_consume_all(pool, session_id=session_id)

        phase = await persist_think_fn(
            pool,
            session=session,
            session_id=session_id,
            principal_id=principal_id,
            ctx=ctx,
            think_fn=think_fn,
        )
        session = phase.session

        if not phase.has_think_output:
            tick = await handle_think_without_output_fn(
                pool,
                phase=phase,
                session_id=session_id,
                principal_id=principal_id,
                iterations=iterations,
            )
            if tick.continue_loop:
                status = str(session.get("status") or "")
                continue
            return tick

        think_out = phase.think_out
        assert think_out is not None
        try:
            tick = await process_think_output_fn(
                pool,
                think_out=think_out,
                session=session,
                session_id=session_id,
                principal_id=principal_id,
                tool_ctx=tool_ctx,
                iterations=iterations,
                ctx=ctx,
                active_nodes=ctx.active_nodes,
            )
        except AgenticLoopError as exc:
            return await abort_tick_fn(
                pool,
                session=session,
                session_id=session_id,
                principal_id=principal_id,
                reason=str(exc.reason),
                iterations=iterations,
            )

        if tick is not None:
            return tick

        session_row = await agentic_pg.agentic_session_fetch_for_principal(
            pool,
            session_id=session_id,
            principal_id=principal_id,
        )
        if session_row is None:
            return LoopTickResult(
                ok=False,
                session=dict(session),
                continue_loop=False,
                reason="session_not_found",
                iterations_ran=iterations,
            )
        session = session_row
        status = str(session.get("status") or "")

    continue_loop = str(session.get("status")) in {
        fsm.STATUS_PLANNING,
        fsm.STATUS_EXECUTING,
        fsm.STATUS_REPLANNING,
    }
    return LoopTickResult(
        ok=True,
        session=session,
        continue_loop=continue_loop,
        iterations_ran=iterations,
    )
