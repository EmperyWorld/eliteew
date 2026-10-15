# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# State Machine command port (K0/K2): map Think events → ApplyTransition; preview/apply
# transitions without Decision Engine owning DB writes.
# Invariants:
# - Illegal transitions → TransitionRejected with zero DB side effects (preview path).
# - Decision Engine must not call this module; coordinator owns sequencing.
# - continue/act maps to act_authorized so Execution Guard can require TransitionApplied.
# Related:
# - documentation/product/ewa/EWA-AGENTIC-KERNEL-REDESIGN.md §A.3 / §K0–K2
# - api/ewa_platform/agentic/kernel/state_machine.py
# ---

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

import asyncpg

from api.ewa_platform.agentic.kernel import state_machine as fsm
from api.ewa_platform.agentic.kernel.session_status import (
    STATUS_EXECUTING,
    STATUS_PLANNING,
    STATUS_REPLANNING,
)
from api.ewa_platform.agentic.kernel.types import KernelCommand, KernelEvent

logger = logging.getLogger(__name__)

_APPLY_TRANSITION = "apply_transition"
_TRANSITION_APPLIED = "transition_applied"
_TRANSITION_REJECTED = "transition_rejected"


def think_to_transition_event(
    *,
    current_status: str,
    decision_type: str,
    loop_action: str,
    has_plan_nodes: bool = False,
) -> str | None:
    """
    Pure mapping: ThinkSucceeded / ThinkNeedsClarification → FSM TransitionEvent.

    continue/act → act_authorized (Execution Guard prerequisite before Act).
    """

    status = str(current_status or "")
    decision = str(decision_type or "").strip().lower()
    action = str(loop_action or "").strip().lower()

    if decision == "intervene" or action in {"clarify", "gate"}:
        if status == STATUS_PLANNING:
            return "needs_clarification"
        return "gate_required"

    if decision == "mutate" or action == "plan":
        if status == STATUS_PLANNING and has_plan_nodes:
            return "plan_ready"
        if status == STATUS_REPLANNING and has_plan_nodes:
            return "plan_patch_applied"
        return None

    if decision == "terminate" or action == "complete":
        if status == STATUS_EXECUTING:
            return "step_ok_done"
        return None

    if decision == "continue" or action == "act":
        if status in {STATUS_EXECUTING, STATUS_PLANNING}:
            return "act_authorized"
        return None

    return None


def build_apply_transition(
    *,
    session_id: str,
    principal_id: str,
    expected_revision: int,
    correlation_id: str,
    event: str,
    reason: str | None = None,
    gate_json: Mapping[str, Any] | None = None,
    plan_summary: str | None = None,
) -> KernelCommand:
    payload: dict[str, Any] = {"event": event}
    if reason:
        payload["reason"] = reason
    if gate_json is not None:
        payload["gate_json"] = dict(gate_json)
    if plan_summary is not None:
        payload["plan_summary"] = plan_summary
    return KernelCommand(
        session_id=session_id,
        principal_id=principal_id,
        expected_revision=expected_revision,
        correlation_id=correlation_id,
        kind=_APPLY_TRANSITION,  # type: ignore[arg-type]
        payload=payload,
    )


def preview_apply_transition(
    *,
    session_id: str,
    correlation_id: str,
    current_status: str,
    event: str,
) -> KernelEvent:
    """Dry-run ApplyTransition using resolve_next_status only (no DB)."""

    next_status = fsm.resolve_next_status(current_status, event)
    if next_status is None:
        return KernelEvent(
            session_id=session_id,
            correlation_id=correlation_id,
            kind=_TRANSITION_REJECTED,  # type: ignore[arg-type]
            error_code=f"illegal_transition:{current_status}:{event}",
            payload={"from": current_status, "event": event},
            revision_after=None,
        )
    return KernelEvent(
        session_id=session_id,
        correlation_id=correlation_id,
        kind=_TRANSITION_APPLIED,  # type: ignore[arg-type]
        payload={"from": current_status, "to": next_status, "event": event, "preview": True},
        revision_after=None,
    )


async def handle_apply_transition(
    command: KernelCommand,
    pool: asyncpg.Pool,
) -> KernelEvent:
    """ApplyTransition against Postgres via existing FSM apply_session_transition."""

    if command.kind != _APPLY_TRANSITION:
        return KernelEvent(
            session_id=command.session_id,
            correlation_id=command.correlation_id,
            kind=_TRANSITION_REJECTED,  # type: ignore[arg-type]
            error_code=f"unexpected_command_kind:{command.kind}",
            payload={},
        )

    event = str(command.payload.get("event") or "").strip()
    if not event:
        return KernelEvent(
            session_id=command.session_id,
            correlation_id=command.correlation_id,
            kind=_TRANSITION_REJECTED,  # type: ignore[arg-type]
            error_code="missing_transition_event",
            payload={},
        )

    gate_json = command.payload.get("gate_json")
    plan_summary = command.payload.get("plan_summary")
    tr = await fsm.apply_session_transition(
        pool,
        session_id=command.session_id,
        principal_id=command.principal_id,
        event=event,
        expect_revision=command.expected_revision,
        gate_json=gate_json if isinstance(gate_json, Mapping) else None,
        plan_summary=str(plan_summary) if plan_summary is not None else None,
    )
    if not tr.ok or tr.session is None:
        logger.info(
            "[STEP] fsm_port_transition_rejected session_id=%s reason=%s",
            command.session_id,
            tr.reason,
        )
        return KernelEvent(
            session_id=command.session_id,
            correlation_id=command.correlation_id,
            kind=_TRANSITION_REJECTED,  # type: ignore[arg-type]
            error_code=tr.reason or "transition_rejected",
            payload={"event": event},
            revision_after=None,
        )

    rev = int(tr.session.get("session_revision") or 0)
    logger.info(
        "[STEP] fsm_port_transition_applied session_id=%s event=%s revision=%s",
        command.session_id,
        event,
        rev,
    )
    return KernelEvent(
        session_id=command.session_id,
        correlation_id=command.correlation_id,
        kind=_TRANSITION_APPLIED,  # type: ignore[arg-type]
        revision_after=rev,
        payload={
            "event": event,
            "status": tr.session.get("status"),
            "checkpoint_id": tr.checkpoint_id,
            "session": tr.session,
        },
    )


__all__ = (
    "build_apply_transition",
    "handle_apply_transition",
    "preview_apply_transition",
    "think_to_transition_event",
)
