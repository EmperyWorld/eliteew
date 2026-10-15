# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Think persist + typed ThinkPhaseResult mapping extracted from loop (K4 LOC shrink).
# Invariants:
# - Think goes through Decision Engine (or injected think_fn); persist is atomic.
# - kind=valid is the only success path with think_out (see ThinkPhaseResult.has_think_output).
# Related:
# - api/ewa_platform/agentic/kernel/loop.py
# - documentation/product/ewa/EWA-AGENTIC-KERNEL-REDESIGN.md §K4
# ---

from __future__ import annotations

from collections.abc import Awaitable, Callable, Mapping
from typing import Any

import asyncpg

from api.ewa_platform.agentic.adapters.task_run_events import publish_agentic_session_lifecycle_sync
from api.ewa_platform.agentic.config import agentic_think_http_runtime, agentic_think_max_parse_retries
from api.ewa_platform.agentic.jobs.reliability import safe_sync_and_publish_task_run_from_session
from api.ewa_platform.agentic.kernel import state_machine as fsm
from api.ewa_platform.agentic.kernel.circuit_breaker import REASONING_LOOP_DETECTED
from api.ewa_platform.agentic.kernel.decision_engine import build_think_request, handle_think_request
from api.ewa_platform.agentic.kernel.think_outcome import ThinkPhaseResult
from api.ewa_platform.agentic.kernel.think_schema import AgenticThinkOutput
from api.ewa_platform.agentic.kernel.types import AgenticContext, LoopTickResult
from api.ewa_platform.persistence_pg import agentic_asyncpg as agentic_pg

ThinkFn = Callable[[AgenticContext], Awaitable[AgenticThinkOutput]]
AbortTickFn = Callable[..., Awaitable[LoopTickResult]]


def think_phase_from_parse_session(updated: dict[str, Any]) -> ThinkPhaseResult:
    """Map a successfully persisted parse-error session to a typed Think outcome."""

    st = str(updated.get("status") or "")
    if st in agentic_pg.TERMINAL_SESSION_STATUSES:
        return ThinkPhaseResult(kind="terminal", session=updated)
    if st == fsm.STATUS_REPLANNING:
        return ThinkPhaseResult(kind="parse_replanning", session=updated)
    if st == fsm.STATUS_AWAITING_HUMAN:
        return ThinkPhaseResult(kind="parse_awaiting_human", session=updated)
    if st == fsm.STATUS_FAILED:
        return ThinkPhaseResult(kind="parse_failed", session=updated)
    return ThinkPhaseResult(kind="parse_failed", session=updated)


async def persist_think_and_get_output(
    pool: asyncpg.Pool,
    *,
    session: Mapping[str, Any],
    session_id: str,
    principal_id: str,
    ctx: AgenticContext,
    think_fn: ThinkFn | None,
) -> ThinkPhaseResult:
    """Run Think via Decision Engine (or injected think_fn) and persist atomically."""

    rev = int(session["session_revision"])
    _, model = agentic_think_http_runtime()

    if think_fn is not None:
        think_out = await think_fn(ctx)
        _, updated, persist_error = await agentic_pg.agentic_persist_think_phase_atomic(
            pool,
            session_id=session_id,
            principal_id=principal_id,
            expect_revision=rev,
            think_payload=think_out.model_dump(),
            llm_model=model,
        )
        if updated is None:
            return ThinkPhaseResult(
                kind="persist_conflict",
                session=dict(session),
                persist_error=persist_error or "unknown",
            )
        return ThinkPhaseResult(kind="valid", session=updated, think_out=think_out)

    think_cmd = build_think_request(
        session_id=session_id,
        principal_id=principal_id,
        expected_revision=rev,
        correlation_id=f"tick-{session_id}-{rev}",
        context=ctx,
    )
    think_event = await handle_think_request(think_cmd)

    if think_event.kind in {"think_parse_failed", "think_budget_denied"}:
        _, updated, persist_error = await agentic_pg.agentic_persist_think_phase_atomic(
            pool,
            session_id=session_id,
            principal_id=principal_id,
            expect_revision=rev,
            parse_error=str(think_event.error_code or think_event.kind),
            llm_model=model,
            max_parse_retries=agentic_think_max_parse_retries(),
        )
        if updated is None:
            return ThinkPhaseResult(
                kind="persist_conflict",
                session=dict(session),
                persist_error=persist_error or "unknown",
            )
        return think_phase_from_parse_session(updated)

    loop_raw = think_event.payload.get("loop_output")
    if not isinstance(loop_raw, Mapping):
        return ThinkPhaseResult(
            kind="parse_failed",
            session=dict(session),
            persist_error="think_loop_output_missing",
        )
    think_out = AgenticThinkOutput.model_validate(loop_raw)
    think_v1 = think_event.payload.get("think_v1")
    persist_blob = think_v1 if isinstance(think_v1, Mapping) else think_out.model_dump()
    _, updated, persist_error = await agentic_pg.agentic_persist_think_phase_atomic(
        pool,
        session_id=session_id,
        principal_id=principal_id,
        expect_revision=rev,
        think_payload=dict(persist_blob),
        llm_model=model,
    )
    if updated is None:
        return ThinkPhaseResult(
            kind="persist_conflict",
            session=dict(session),
            persist_error=persist_error or "unknown",
        )
    return ThinkPhaseResult(kind="valid", session=updated, think_out=think_out)


async def handle_think_phase_without_output(
    pool: asyncpg.Pool,
    *,
    phase: ThinkPhaseResult,
    session_id: str,
    principal_id: str,
    iterations: int,
    abort_tick: AbortTickFn,
) -> LoopTickResult:
    """Map typed Think outcomes that have no executable think_out to a LoopTickResult."""

    session = phase.session
    st = str(session.get("status") or "")

    if phase.kind == "parse_awaiting_human" or st == fsm.STATUS_AWAITING_HUMAN:
        await safe_sync_and_publish_task_run_from_session(pool, session=session)
        publish_agentic_session_lifecycle_sync(
            session,
            extra={"reason": REASONING_LOOP_DETECTED},
        )
        return LoopTickResult(
            ok=True,
            session=session,
            continue_loop=False,
            reason=REASONING_LOOP_DETECTED,
            iterations_ran=iterations,
        )

    if phase.kind == "parse_replanning" or st == fsm.STATUS_REPLANNING:
        return LoopTickResult(
            ok=True,
            session=session,
            continue_loop=True,
            reason="replanning",
            iterations_ran=iterations,
        )

    if phase.kind == "parse_failed" or st == fsm.STATUS_FAILED:
        return LoopTickResult(
            ok=True,
            session=session,
            continue_loop=False,
            reason="think_failed",
            iterations_ran=iterations,
        )

    if phase.kind == "terminal" or st in agentic_pg.TERMINAL_SESSION_STATUSES:
        return LoopTickResult(ok=True, session=session, continue_loop=False, iterations_ran=iterations)

    if phase.kind == "persist_conflict":
        cause = (phase.persist_error or "unknown").strip() or "unknown"
        abort_reason = f"think_persist_{cause}"
        return await abort_tick(
            pool,
            session=session,
            session_id=session_id,
            principal_id=principal_id,
            reason=abort_reason,
            iterations=iterations,
        )

    return await abort_tick(
        pool,
        session=session,
        session_id=session_id,
        principal_id=principal_id,
        reason="think_output_missing",
        iterations=iterations,
    )
