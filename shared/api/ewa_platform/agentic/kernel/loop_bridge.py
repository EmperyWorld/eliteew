# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# K1/K2 coordinator bridge: Decision → FSM → Act → Action Feedback → next Think.
# Thin relay only — no Think/FSM/Act business logic inside Decision or Act modules.
# Invariants:
# - Act runs only after FSM TransitionApplied (Execution Guard); never on bare Think.
# - Act must not call Decision; feedback Think is owned exclusively by this bridge.
# - Transition event names come only from fsm_port.think_to_transition_event.
# Related:
# - documentation/product/ewa/EWA-AGENTIC-KERNEL-REDESIGN.md §K1 / §K2
# - api/ewa_platform/agentic/kernel/decision_engine.py
# - api/ewa_platform/agentic/kernel/fsm_port.py
# - api/ewa_platform/agentic/kernel/loop.py
# ---

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable, Mapping
from dataclasses import dataclass, field, replace
from typing import Any, Literal

from api.ewa_platform.agentic.kernel.decision_engine import (
    build_think_request,
    handle_think_request,
)
from api.ewa_platform.agentic.kernel.engine import LlmCompleteFn
from api.ewa_platform.agentic.kernel.fsm_port import (
    build_apply_transition,
    preview_apply_transition,
    think_to_transition_event,
)
from api.ewa_platform.agentic.kernel.types import AgenticContext, KernelCommand, KernelEvent

logger = logging.getLogger(__name__)

ACT_FEEDBACK_CHECKPOINT_KIND = "act_feedback"

# Transitions that authorize a subsequent Act dispatch under Execution Guard.
_ACT_AUTHORIZING_TRANSITIONS = frozenset(
    {
        "act_authorized",
        "plan_ready",
        "plan_patch_applied",
    }
)

BridgeOutcome = Literal[
    "parse_failed",
    "budget_denied",
    "hitl",
    "transition_rejected",
    "completed",
    "plan_ready",
    "act_done",
    "execution_guard_blocked",
    "noop",
]

ApplyTransitionFn = Callable[[KernelCommand], Awaitable[KernelEvent]]
DispatchActFn = Callable[[str, dict[str, Any], str | None], Awaitable[Mapping[str, Any]]]
PersistPlanFn = Callable[[list[dict[str, Any]]], Awaitable[None]]


@dataclass
class DecisionToActionResult:
    """Observable result of one Context → Think → Transition → Act (+ optional feedback Think)."""

    outcome: BridgeOutcome
    think_event: KernelEvent
    transition_name: str | None = None
    transition_event: KernelEvent | None = None
    act_called: bool = False
    act_tool_name: str | None = None
    act_node_id: str | None = None
    act_result: Mapping[str, Any] | None = None
    session: dict[str, Any] | None = None
    error_code: str | None = None
    notes: list[str] = field(default_factory=list)
    feedback_context: AgenticContext | None = None
    feedback_think_event: KernelEvent | None = None


def _loop_output(think_event: KernelEvent) -> dict[str, Any]:
    raw = think_event.payload.get("loop_output")
    return dict(raw) if isinstance(raw, Mapping) else {}


def _has_plan_nodes(think_event: KernelEvent) -> bool:
    proposal = think_event.payload.get("plan_mutation_proposal")
    if isinstance(proposal, Mapping):
        nodes = proposal.get("plan_nodes")
        return isinstance(nodes, list) and len(nodes) > 0
    loop_out = _loop_output(think_event)
    return int(loop_out.get("plan_nodes_count") or 0) > 0 or bool(loop_out.get("plan_nodes"))


def _gate_json_from_think(think_event: KernelEvent) -> dict[str, Any] | None:
    think_v1 = think_event.payload.get("think_v1")
    if isinstance(think_v1, Mapping):
        payload = think_v1.get("payload")
        if isinstance(payload, Mapping):
            gate = payload.get("gate_json")
            if isinstance(gate, Mapping):
                return dict(gate)
    return None


def assert_execution_guard(
    *,
    transition_event: KernelEvent | None,
    transition_name: str | None,
) -> str | None:
    """
    Execution Guard: Act is allowed only after an authorizing TransitionApplied.

    Returns None when Act may proceed; otherwise an error_code string.
    """

    if not transition_name:
        return "execution_guard_no_transition"
    if transition_name not in _ACT_AUTHORIZING_TRANSITIONS:
        return "execution_guard_transition_does_not_authorize_act"
    if transition_event is None:
        return "execution_guard_no_transition_event"
    if transition_event.kind != "transition_applied":
        return "execution_guard_transition_not_applied"
    return None


def classify_act_feedback_status(act_result: Mapping[str, Any]) -> Literal["success", "error"]:
    raw = str(act_result.get("status") or "").strip().lower()
    if raw in {"ok", "success", "done", "completed"}:
        return "success"
    return "error"


def build_context_with_act_feedback(
    context: AgenticContext,
    *,
    session: Mapping[str, Any] | None,
    act_tool_name: str,
    act_result: Mapping[str, Any],
    act_node_id: str | None = None,
) -> AgenticContext:
    """
    Action Feedback: fold Act Success/Error into a new AgenticContext for the next Think.

    Shape matches prod act checkpoints (`kind` + `payload_json`) and inbound steering
    (`message_json.text`) so `prompt_builder` / Decision Engine see the outcome.
    Owned by the bridge — Act modules must not call Decision Engine.
    """

    feedback_status = classify_act_feedback_status(act_result)
    act_status = "ok" if feedback_status == "success" else "error"
    summary = str(act_result.get("summary") or act_result.get("error") or act_result.get("detail") or "").strip()[:500]
    next_seq = 1
    for cp in context.checkpoints:
        if isinstance(cp, Mapping) and cp.get("seq") is not None:
            try:
                next_seq = max(next_seq, int(cp["seq"]) + 1)
            except TypeError, ValueError:
                continue
    # Same envelope as loop.py agentic_checkpoint_append(kind="act", …).
    checkpoint = {
        "kind": "act",
        "seq": next_seq,
        "payload_json": {
            "summary": summary,
            "status": act_status,
            "tool": act_tool_name,
            "tool_name": act_tool_name,
            "node_id": act_node_id,
            "feedback_status": feedback_status,
            "source": ACT_FEEDBACK_CHECKPOINT_KIND,
        },
    }
    llm_line = f"[Action Feedback] tool={act_tool_name} status={feedback_status}." + (f" {summary}" if summary else "")
    inbound = {
        "kind": ACT_FEEDBACK_CHECKPOINT_KIND,
        "message_json": {"text": llm_line},
    }
    session_merged = dict(session) if isinstance(session, Mapping) else dict(context.session)
    return AgenticContext(
        session=session_merged,
        active_nodes=list(context.active_nodes),
        tree_summary=dict(context.tree_summary),
        checkpoints=[*list(context.checkpoints), checkpoint],
        inbound_messages=[*list(context.inbound_messages), inbound],
        llm_messages=[*list(context.llm_messages), {"role": "user", "content": llm_line}],
        worker_id=context.worker_id,
        busy=context.busy,
        busy_reason=context.busy_reason,
        scheduled_node=context.scheduled_node,
    )


async def _default_preview_apply(command: KernelCommand) -> KernelEvent:
    """In-memory ApplyTransition for tests / dry-run (no Postgres)."""

    current = str(command.payload.get("current_status") or "planning")
    event = str(command.payload.get("event") or "")
    return preview_apply_transition(
        session_id=command.session_id,
        correlation_id=command.correlation_id,
        current_status=current,
        event=event,
    )


async def _dispatch_act_guarded(
    *,
    session_id: str,
    think_event: KernelEvent,
    transition_name: str | None,
    transition_event: KernelEvent | None,
    session_out: dict[str, Any] | None,
    dispatch_act: DispatchActFn,
    note: str,
) -> DecisionToActionResult:
    """Single Act entry: Execution Guard then dispatcher. Never calls Decision."""

    guard_err = assert_execution_guard(
        transition_event=transition_event,
        transition_name=transition_name,
    )
    if guard_err is not None:
        logger.info(
            "[STEP] loop_bridge_execution_guard_block session_id=%s code=%s transition=%s",
            session_id,
            guard_err,
            transition_name,
        )
        return DecisionToActionResult(
            outcome="execution_guard_blocked",
            think_event=think_event,
            transition_name=transition_name,
            transition_event=transition_event,
            error_code=guard_err,
            session=session_out,
            notes=[note, "execution_guard_blocked"],
        )

    loop_out = _loop_output(think_event)
    tool = str(loop_out.get("act_tool_name") or "").strip()
    if not tool:
        return DecisionToActionResult(
            outcome="noop",
            think_event=think_event,
            transition_name=transition_name,
            transition_event=transition_event,
            error_code="act_tool_name_missing",
            session=session_out,
            notes=[note],
        )

    node_id = str(loop_out.get("act_node_id") or "").strip() or None
    args = dict(loop_out.get("act_tool_args") or {})
    act_result = await dispatch_act(tool, args, node_id)
    logger.info(
        "[STEP] loop_bridge_act session_id=%s tool=%s transition=%s",
        session_id,
        tool,
        transition_name,
    )
    return DecisionToActionResult(
        outcome="act_done",
        think_event=think_event,
        transition_name=transition_name,
        transition_event=transition_event,
        act_called=True,
        act_tool_name=tool,
        act_node_id=node_id,
        act_result=act_result,
        session=session_out,
        notes=[note],
    )


async def run_decision_to_action_cycle(
    *,
    context: AgenticContext,
    session_id: str,
    principal_id: str,
    expected_revision: int,
    correlation_id: str,
    llm_complete: LlmCompleteFn | None = None,
    apply_transition: ApplyTransitionFn | None = None,
    dispatch_act: DispatchActFn | None = None,
    persist_plan: PersistPlanFn | None = None,
) -> DecisionToActionResult:
    """
    Thin relay (one tick):
      1) Decision Engine ← ThinkRequest
      2) FSM Port ← think_to_transition_event + ApplyTransition
      3) Act ← only after Execution Guard (TransitionApplied + authorizing event)
    """

    current_status = str(context.session.get("status") or "")
    think_cmd = build_think_request(
        session_id=session_id,
        principal_id=principal_id,
        expected_revision=expected_revision,
        correlation_id=correlation_id,
        context=context,
    )
    think_event = await handle_think_request(think_cmd, llm_complete=llm_complete)

    if think_event.kind == "think_parse_failed":
        return DecisionToActionResult(
            outcome="parse_failed",
            think_event=think_event,
            error_code=think_event.error_code,
        )
    if think_event.kind == "think_budget_denied":
        return DecisionToActionResult(
            outcome="budget_denied",
            think_event=think_event,
            error_code=think_event.error_code,
        )

    decision_type = str(think_event.payload.get("decision_type") or "")
    loop_action = str(think_event.payload.get("loop_action") or "")
    has_nodes = _has_plan_nodes(think_event)

    transition_name = think_to_transition_event(
        current_status=current_status,
        decision_type=decision_type,
        loop_action=loop_action,
        has_plan_nodes=has_nodes,
    )

    apply_fn = apply_transition or _default_preview_apply
    transition_event: KernelEvent | None = None
    session_out: dict[str, Any] | None = dict(context.session)

    if transition_name in {"plan_ready", "plan_patch_applied"} and persist_plan is not None and has_nodes:
        proposal = think_event.payload.get("plan_mutation_proposal")
        nodes = list(proposal.get("plan_nodes") or []) if isinstance(proposal, Mapping) else []
        if nodes:
            await persist_plan(nodes)

    if transition_name:
        plan_summary = str(think_event.payload.get("plan_update_summary") or "") or None
        gate_json = None
        if transition_name in {"needs_clarification", "gate_required"}:
            gate_json = _gate_json_from_think(think_event)
        tr_cmd = build_apply_transition(
            session_id=session_id,
            principal_id=principal_id,
            expected_revision=expected_revision,
            correlation_id=correlation_id,
            event=transition_name,
            gate_json=gate_json,
            plan_summary=plan_summary,
        )
        if apply_transition is None:
            tr_cmd = KernelCommand(
                session_id=tr_cmd.session_id,
                principal_id=tr_cmd.principal_id,
                expected_revision=tr_cmd.expected_revision,
                correlation_id=tr_cmd.correlation_id,
                kind=tr_cmd.kind,
                payload={**dict(tr_cmd.payload), "current_status": current_status},
            )
        transition_event = await apply_fn(tr_cmd)
        if transition_event.kind == "transition_rejected":
            logger.info(
                "[STEP] loop_bridge_transition_rejected session_id=%s event=%s code=%s",
                session_id,
                transition_name,
                transition_event.error_code,
            )
            return DecisionToActionResult(
                outcome="transition_rejected",
                think_event=think_event,
                transition_name=transition_name,
                transition_event=transition_event,
                error_code=transition_event.error_code,
                session=session_out,
            )
        sess_payload = transition_event.payload.get("session")
        if isinstance(sess_payload, dict):
            session_out = sess_payload
        elif transition_event.payload.get("to"):
            session_out = {
                **(session_out or {}),
                "status": transition_event.payload.get("to"),
            }

        if transition_name in {"needs_clarification", "gate_required"}:
            return DecisionToActionResult(
                outcome="hitl",
                think_event=think_event,
                transition_name=transition_name,
                transition_event=transition_event,
                session=session_out,
            )
        if transition_name == "step_ok_done":
            return DecisionToActionResult(
                outcome="completed",
                think_event=think_event,
                transition_name=transition_name,
                transition_event=transition_event,
                session=session_out,
            )
        if transition_name in {"plan_ready", "plan_patch_applied"}:
            loop_out = _loop_output(think_event)
            tool = str(loop_out.get("act_tool_name") or "").strip()
            if tool and dispatch_act is not None:
                return await _dispatch_act_guarded(
                    session_id=session_id,
                    think_event=think_event,
                    transition_name=transition_name,
                    transition_event=transition_event,
                    session_out=session_out,
                    dispatch_act=dispatch_act,
                    note="act_after_plan_transition",
                )
            return DecisionToActionResult(
                outcome="plan_ready",
                think_event=think_event,
                transition_name=transition_name,
                transition_event=transition_event,
                session=session_out,
            )
        if transition_name == "act_authorized":
            if dispatch_act is None:
                return DecisionToActionResult(
                    outcome="noop",
                    think_event=think_event,
                    transition_name=transition_name,
                    transition_event=transition_event,
                    error_code="act_dispatcher_missing",
                    session=session_out,
                    notes=["think_requested_act_but_no_dispatcher"],
                )
            return await _dispatch_act_guarded(
                session_id=session_id,
                think_event=think_event,
                transition_name=transition_name,
                transition_event=transition_event,
                session_out=session_out,
                dispatch_act=dispatch_act,
                note="act_after_act_authorized",
            )

    # continue/act without TransitionApplied must not reach Act (Execution Guard).
    if loop_action == "act" or decision_type == "continue":
        logger.info(
            "[STEP] loop_bridge_execution_guard_block session_id=%s code=execution_guard_no_transition",
            session_id,
        )
        return DecisionToActionResult(
            outcome="execution_guard_blocked",
            think_event=think_event,
            transition_name=transition_name,
            transition_event=transition_event,
            error_code="execution_guard_no_transition",
            session=session_out,
            notes=["act_denied_without_transition_applied"],
        )

    return DecisionToActionResult(
        outcome="noop",
        think_event=think_event,
        transition_name=transition_name,
        transition_event=transition_event,
        session=session_out,
    )


async def run_think_transition_act_feedback_cycle(
    *,
    context: AgenticContext,
    session_id: str,
    principal_id: str,
    expected_revision: int,
    correlation_id: str,
    llm_complete: LlmCompleteFn | None = None,
    apply_transition: ApplyTransitionFn | None = None,
    dispatch_act: DispatchActFn | None = None,
    persist_plan: PersistPlanFn | None = None,
    run_feedback_think: bool = True,
) -> DecisionToActionResult:
    """
    Full K2 cycle:
      Context → Think → Transition → Act → Action Feedback → Next Think

    Next Think is invoked only here (bridge), never from Act.
    """

    first = await run_decision_to_action_cycle(
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
    if (
        not run_feedback_think
        or first.outcome != "act_done"
        or not first.act_called
        or first.act_result is None
        or not first.act_tool_name
    ):
        return first

    feedback_ctx = build_context_with_act_feedback(
        context,
        session=first.session,
        act_tool_name=first.act_tool_name,
        act_result=first.act_result,
        act_node_id=first.act_node_id,
    )
    rev = expected_revision
    if first.transition_event is not None and first.transition_event.revision_after is not None:
        rev = int(first.transition_event.revision_after)
    elif isinstance(first.session, Mapping) and first.session.get("session_revision") is not None:
        try:
            rev = int(first.session["session_revision"])
        except TypeError, ValueError:
            rev = expected_revision

    feedback_cmd = build_think_request(
        session_id=session_id,
        principal_id=principal_id,
        expected_revision=rev,
        correlation_id=f"{correlation_id}:feedback",
        context=feedback_ctx,
    )
    feedback_think = await handle_think_request(feedback_cmd, llm_complete=llm_complete)
    logger.info(
        "[STEP] loop_bridge_action_feedback_next_think session_id=%s tool=%s feedback_kind=%s",
        session_id,
        first.act_tool_name,
        feedback_think.kind,
    )
    return replace(
        first,
        feedback_context=feedback_ctx,
        feedback_think_event=feedback_think,
        notes=[*list(first.notes), "action_feedback_next_think"],
    )


__all__ = (
    "ACT_FEEDBACK_CHECKPOINT_KIND",
    "DecisionToActionResult",
    "assert_execution_guard",
    "build_context_with_act_feedback",
    "classify_act_feedback_status",
    "run_decision_to_action_cycle",
    "run_think_transition_act_feedback_cycle",
)
