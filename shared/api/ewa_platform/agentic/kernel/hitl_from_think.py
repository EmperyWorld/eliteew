# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Think-driven HITL openers (clarify / gate) extracted from loop (K4).
# Invariants:
# - clarify/gate open awaiting_human with gate_json; never dispatch tools.
# Related:
# - api/ewa_platform/agentic/kernel/loop.py
# - documentation/product/ewa/EWA-AGENTIC-KERNEL-REDESIGN.md §K4
# ---

from __future__ import annotations

from collections.abc import Awaitable, Callable, Mapping
from typing import Any

import asyncpg

from api.ewa_platform.agentic.adapters.task_run_events import publish_agentic_session_lifecycle_sync
from api.ewa_platform.agentic.agentic_locale import agentic_clarify_prompt_default
from api.ewa_platform.agentic.gate_contract import build_gate_json
from api.ewa_platform.agentic.kernel import state_machine as fsm
from api.ewa_platform.agentic.kernel.fsm_port import think_to_transition_event
from api.ewa_platform.agentic.kernel.think_schema import AgenticThinkOutput
from api.ewa_platform.agentic.kernel.types import AgenticLoopError, LoopTickResult, TransitionResult

FsmPortApplyFn = Callable[..., Awaitable[TransitionResult]]
ThinkActionToDecisionFn = Callable[[str], str]


async def process_clarify_action(
    pool: asyncpg.Pool,
    *,
    think_out: AgenticThinkOutput,
    session: Mapping[str, Any],
    session_id: str,
    principal_id: str,
    iterations: int,
    fsm_port_apply: FsmPortApplyFn,
    think_action_to_decision_type: ThinkActionToDecisionFn,
) -> LoopTickResult:
    status = str(session.get("status") or "")
    rev = int(session["session_revision"])
    bound_node = str(session.get("active_node_id") or "").strip() or None
    gate_payload = build_gate_json(
        kind="freeform",
        prompt=think_out.user_message or agentic_clarify_prompt_default(session),
        session_revision=rev,
        bound_node_id=bound_node,
        ttl_hours=24.0,
    )
    hitl_event = think_to_transition_event(
        current_status=status,
        decision_type=think_action_to_decision_type("clarify"),
        loop_action="clarify",
    ) or ("needs_clarification" if status == fsm.STATUS_PLANNING else "gate_required")
    tr = await fsm_port_apply(
        pool,
        session_id=session_id,
        principal_id=principal_id,
        expected_revision=rev,
        correlation_id=f"think-clarify-{session_id}-{rev}",
        event=hitl_event,
        gate_json=gate_payload,
    )
    session_out = tr.session or dict(session)
    publish_agentic_session_lifecycle_sync(session_out)
    return LoopTickResult(ok=True, session=session_out, continue_loop=False, iterations_ran=iterations)


async def process_gate_action(
    pool: asyncpg.Pool,
    *,
    think_out: AgenticThinkOutput,
    session: Mapping[str, Any],
    session_id: str,
    principal_id: str,
    iterations: int,
) -> LoopTickResult:
    gate = think_out.gate
    if gate is None:
        raise AgenticLoopError("gate_action_missing_payload")
    rev = int(session["session_revision"])
    bound_node = str(session.get("active_node_id") or "").strip() or None
    gate_payload = build_gate_json(
        kind=gate.gate_kind or "confirm",
        prompt=gate.gate_prompt or gate.title or "Confirm",
        title=gate.title,
        session_revision=rev,
        options=gate.gate_options,
        bound_node_id=bound_node,
        ttl_hours=48.0,
    )
    tr = await fsm.apply_session_transition(
        pool,
        session_id=session_id,
        principal_id=principal_id,
        event="gate_required",
        expect_revision=rev,
        gate_json=gate_payload,
    )
    session_out = tr.session or dict(session)
    publish_agentic_session_lifecycle_sync(session_out)
    return LoopTickResult(ok=True, session=session_out, continue_loop=False, iterations_ran=iterations)
