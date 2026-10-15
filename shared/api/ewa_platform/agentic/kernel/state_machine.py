# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Agentic session FSM: guarded transitions with revision bump contract + AMKA-style lifecycle labels.
# Invariants:
# - Illegal transitions return TransitionResult.ok=False without mutating DB.
# - Lifecycle phases are a semantic view over DB status (does not replace status values).
# Related:
# - documentation/product/ewa/EWA-AGENTIC-SUBSTRATE-MASTER-PLAN.md §1.1
# - documentation/product/ewa/EWA-AGENTIC-KERNEL-REDESIGN.md §K4
# ---

from __future__ import annotations

from collections.abc import Awaitable, Callable, Mapping
from enum import StrEnum
from typing import Any

import asyncpg

from api.ewa_platform.agentic.kernel.session_status import (
    STATUS_ABANDONED,
    STATUS_AWAITING_HUMAN,
    STATUS_CANCELLED,
    STATUS_COMPLETED,
    STATUS_EXECUTING,
    STATUS_FAILED,
    STATUS_INIT,
    STATUS_PAUSED,
    STATUS_PLANNING,
    STATUS_REPLANNING,
)
from api.ewa_platform.agentic.kernel.types import TransitionResult
from api.ewa_platform.persistence_pg import agentic_asyncpg as agentic_pg

SessionStatus = str
TransitionEvent = str

_EXPERT_GATE_KINDS = frozenset({"expert_consultation", "expert_chat"})


class AgenticLifecyclePhase(StrEnum):
    SNAPSHOT = "snapshot"
    PLANNING = "planning"
    AWAITING_EXPERT_CONSULTATION = "awaiting_expert_consultation"
    EXECUTING = "executing"
    FINALIZING = "finalizing"


def lifecycle_phase_from_session(session: Mapping[str, Any]) -> AgenticLifecyclePhase:
    status = str(session.get("status") or "")
    if status in {STATUS_COMPLETED, STATUS_FAILED, STATUS_CANCELLED, STATUS_ABANDONED}:
        return AgenticLifecyclePhase.FINALIZING
    if status == STATUS_INIT:
        return AgenticLifecyclePhase.SNAPSHOT
    if status in {STATUS_PLANNING, STATUS_REPLANNING}:
        return AgenticLifecyclePhase.PLANNING
    if status == STATUS_AWAITING_HUMAN:
        gate = session.get("gate_json")
        if isinstance(gate, Mapping) and str(gate.get("kind") or "") in _EXPERT_GATE_KINDS:
            return AgenticLifecyclePhase.AWAITING_EXPERT_CONSULTATION
        wm = session.get("working_memory_json")
        if isinstance(wm, Mapping) and wm.get("awaiting_expert_consultation"):
            return AgenticLifecyclePhase.AWAITING_EXPERT_CONSULTATION
        return AgenticLifecyclePhase.PLANNING
    if status == STATUS_EXECUTING:
        return AgenticLifecyclePhase.EXECUTING
    if status == STATUS_PAUSED:
        return AgenticLifecyclePhase.PLANNING
    return AgenticLifecyclePhase.SNAPSHOT


def is_expert_consultation_gate(session: Mapping[str, Any]) -> bool:
    return lifecycle_phase_from_session(session) == AgenticLifecyclePhase.AWAITING_EXPERT_CONSULTATION


def expert_consultation_gate_json(*, session_revision: int, prompt: str) -> dict[str, Any]:
    from api.ewa_platform.agentic.gate_contract import build_gate_json

    return build_gate_json(
        kind="expert_consultation",
        title="Консультация экспертов",
        prompt=prompt[:2000],
        session_revision=session_revision,
        ttl_hours=48.0,
    )


_TRANSITIONS: dict[tuple[SessionStatus, TransitionEvent], SessionStatus] = {
    (STATUS_INIT, "start"): STATUS_PLANNING,
    (STATUS_PLANNING, "plan_ready"): STATUS_EXECUTING,
    (STATUS_PLANNING, "step_ok_more"): STATUS_PLANNING,
    (STATUS_PLANNING, "needs_clarification"): STATUS_AWAITING_HUMAN,
    (STATUS_EXECUTING, "expert_consultation_required"): STATUS_AWAITING_HUMAN,
    (STATUS_PLANNING, "expert_consultation_required"): STATUS_AWAITING_HUMAN,
    (STATUS_REPLANNING, "expert_consultation_required"): STATUS_AWAITING_HUMAN,
    (STATUS_EXECUTING, "gate_required"): STATUS_AWAITING_HUMAN,
    (STATUS_REPLANNING, "gate_required"): STATUS_AWAITING_HUMAN,
    (STATUS_EXECUTING, "step_ok_more"): STATUS_EXECUTING,
    (STATUS_EXECUTING, "act_authorized"): STATUS_EXECUTING,
    (STATUS_PLANNING, "act_authorized"): STATUS_PLANNING,
    (STATUS_EXECUTING, "step_ok_done"): STATUS_COMPLETED,
    (STATUS_EXECUTING, "need_replan"): STATUS_REPLANNING,
    (STATUS_EXECUTING, "tool_error_retryable"): STATUS_REPLANNING,
    (STATUS_EXECUTING, "budget_exceeded"): STATUS_PAUSED,
    (STATUS_PLANNING, "budget_exceeded"): STATUS_PAUSED,
    (STATUS_REPLANNING, "budget_exceeded"): STATUS_PAUSED,
    (STATUS_REPLANNING, "plan_patch_applied"): STATUS_EXECUTING,
    (STATUS_AWAITING_HUMAN, "human_respond"): STATUS_EXECUTING,
    (STATUS_AWAITING_HUMAN, "gate_timeout_pause"): STATUS_PAUSED,
    (STATUS_AWAITING_HUMAN, "gate_timeout_abandon"): STATUS_ABANDONED,
    (STATUS_AWAITING_HUMAN, "human_cancel"): STATUS_CANCELLED,
    (STATUS_PAUSED, "resume"): STATUS_EXECUTING,
}

_GLOBAL_CANCEL: frozenset[SessionStatus] = frozenset(
    {STATUS_INIT, STATUS_PLANNING, STATUS_EXECUTING, STATUS_AWAITING_HUMAN, STATUS_PAUSED, STATUS_REPLANNING},
)
_GLOBAL_FATAL: frozenset[SessionStatus] = frozenset(
    {STATUS_INIT, STATUS_PLANNING, STATUS_EXECUTING, STATUS_AWAITING_HUMAN, STATUS_PAUSED, STATUS_REPLANNING},
)


def resolve_next_status(current: SessionStatus, event: TransitionEvent) -> SessionStatus | None:
    if event == "cancel" and current in _GLOBAL_CANCEL:
        return STATUS_CANCELLED
    if event == "fatal_error" and current in _GLOBAL_FATAL:
        return STATUS_FAILED
    return _TRANSITIONS.get((current, event))


async def apply_session_transition(
    pool: asyncpg.Pool,
    *,
    session_id: str,
    principal_id: str,
    event: TransitionEvent,
    expect_revision: int | None = None,
    gate_json: Mapping[str, Any] | None = None,
    plan_summary: str | None = None,
    clear_lease: bool = False,
    checkpoint_append: Callable[..., Awaitable[dict[str, Any] | None]] | None = None,
    extra_fields: Mapping[str, Any] | None = None,
) -> TransitionResult:
    session = await agentic_pg.agentic_session_fetch_for_principal(
        pool,
        session_id=session_id,
        principal_id=principal_id,
    )
    if session is None:
        return TransitionResult(ok=False, reason="session_not_found")

    current = str(session.get("status") or "")
    next_status = resolve_next_status(current, event)
    if next_status is None:
        return TransitionResult(ok=False, reason=f"illegal_transition:{current}:{event}")

    terminal = next_status in agentic_pg.TERMINAL_SESSION_STATUSES
    updated = await agentic_pg.agentic_session_update(
        pool,
        session_id=session_id,
        principal_id=principal_id,
        status=next_status,
        expect_revision=expect_revision if expect_revision is not None else int(session["session_revision"]),
        gate_json=gate_json if gate_json is not None else None,
        plan_summary=plan_summary,
        terminal=terminal,
        clear_lease=clear_lease or next_status == STATUS_AWAITING_HUMAN,
        iteration_count=int(extra_fields.get("iteration_count"))
        if extra_fields and "iteration_count" in extra_fields
        else None,
        working_memory_json=extra_fields.get("working_memory_json")
        if extra_fields and "working_memory_json" in extra_fields
        else None,
    )
    if updated is None:
        return TransitionResult(ok=False, reason="revision_conflict")

    checkpoint_id: int | None = None
    append_fn = checkpoint_append or agentic_pg.agentic_checkpoint_append
    cp = await append_fn(
        pool,
        session_id=session_id,
        kind="state_transition",
        payload_json={
            "from": current,
            "to": next_status,
            "event": event,
            "session_revision": updated["session_revision"],
        },
    )
    if cp is not None:
        checkpoint_id = int(cp["id"])

    return TransitionResult(ok=True, session=updated, checkpoint_id=checkpoint_id)
