# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Decision Engine port (K0): ThinkRequest → ThinkSucceeded / parse / budget events.
# LLM Think only — no FSM transitions, no tool Act dispatch.
# Invariants:
# - Must not import state_machine, loop, or agentic_dispatch_tool.
# - Heuristic fallback uses the same KernelEvent contract as LLM Think.
# Related:
# - documentation/product/ewa/EWA-AGENTIC-KERNEL-REDESIGN.md §A.2 / §K0
# - api/ewa_platform/agentic/kernel/engine.py
# ---

from __future__ import annotations

import logging
from typing import Any

from api.ewa_platform.agentic.kernel.engine import LlmCompleteFn, invoke_think_llm
from api.ewa_platform.agentic.kernel.think_schema_v1 import ThinkSchemaError
from api.ewa_platform.agentic.kernel.types import (
    AgenticContext,
    KernelCommand,
    KernelEvent,
)

logger = logging.getLogger(__name__)

_THINK_REQUEST = "think_request"
_THINK_SUCCEEDED = "think_succeeded"
_THINK_PARSE_FAILED = "think_parse_failed"
_THINK_BUDGET_DENIED = "think_budget_denied"
_THINK_NEEDS_CLARIFICATION = "think_needs_clarification"


def _context_from_payload(payload: dict[str, Any] | Any) -> AgenticContext:
    if isinstance(payload, AgenticContext):
        return payload
    if not isinstance(payload, dict):
        raise TypeError("think_request.payload must be AgenticContext or mapping with context")
    raw = payload.get("context", payload)
    if isinstance(raw, AgenticContext):
        return raw
    if not isinstance(raw, dict):
        raise TypeError("think_request.payload.context must be AgenticContext")
    # Allow tests to pass a pre-built context under key only.
    raise TypeError("think_request.payload.context must be an AgenticContext instance")


def build_think_request(
    *,
    session_id: str,
    principal_id: str,
    expected_revision: int,
    correlation_id: str,
    context: AgenticContext,
    policy_flags: dict[str, Any] | None = None,
) -> KernelCommand:
    """Factory for ThinkRequest commands (immutable context snapshot)."""

    return KernelCommand(
        session_id=session_id,
        principal_id=principal_id,
        expected_revision=expected_revision,
        correlation_id=correlation_id,
        kind=_THINK_REQUEST,  # type: ignore[arg-type]
        payload={
            "context": context,
            "policy_flags": dict(policy_flags or {}),
        },
    )


async def handle_think_request(
    command: KernelCommand,
    *,
    llm_complete: LlmCompleteFn | None = None,
) -> KernelEvent:
    """
    Run Decision Engine for one ThinkRequest.

    Returns ThinkSucceeded | ThinkParseFailed | ThinkBudgetDenied | ThinkNeedsClarification.
    Never calls apply_session_transition or tool dispatch.
    """

    if command.kind != _THINK_REQUEST:
        return KernelEvent(
            session_id=command.session_id,
            correlation_id=command.correlation_id,
            kind=_THINK_PARSE_FAILED,  # type: ignore[arg-type]
            error_code=f"unexpected_command_kind:{command.kind}",
            payload={},
        )

    try:
        ctx = _context_from_payload(dict(command.payload))
    except TypeError as exc:
        return KernelEvent(
            session_id=command.session_id,
            correlation_id=command.correlation_id,
            kind=_THINK_PARSE_FAILED,  # type: ignore[arg-type]
            error_code="invalid_think_payload",
            payload={"detail": str(exc)},
        )

    try:
        v1, loop_out = await invoke_think_llm(ctx, llm_complete=llm_complete)
    except ThinkSchemaError as exc:
        logger.info(
            "[STEP] decision_engine_think_parse_failed session_id=%s code=%s",
            command.session_id,
            exc,
        )
        return KernelEvent(
            session_id=command.session_id,
            correlation_id=command.correlation_id,
            kind=_THINK_PARSE_FAILED,  # type: ignore[arg-type]
            error_code=str(exc) or "think_parse_failed",
            payload={},
        )
    except Exception as exc:  # noqa: BLE001 — fail-closed envelope, never silent
        logger.exception(
            "[STEP] decision_engine_think_failed session_id=%s",
            command.session_id,
        )
        code = str(exc)
        if "budget" in code.lower():
            return KernelEvent(
                session_id=command.session_id,
                correlation_id=command.correlation_id,
                kind=_THINK_BUDGET_DENIED,  # type: ignore[arg-type]
                error_code=code or "think_budget_denied",
                payload={},
            )
        return KernelEvent(
            session_id=command.session_id,
            correlation_id=command.correlation_id,
            kind=_THINK_PARSE_FAILED,  # type: ignore[arg-type]
            error_code=code or "think_failed",
            payload={},
        )

    plan_nodes = list(loop_out.plan_nodes or [])
    plan_mutation = None
    if v1.decision_type == "mutate" and plan_nodes:
        plan_mutation = {
            "plan_nodes": [n.model_dump() if hasattr(n, "model_dump") else n for n in plan_nodes],
            "plan_update_summary": v1.plan_update_summary,
        }

    event_kind = _THINK_SUCCEEDED
    if v1.decision_type == "intervene" or loop_out.action in {"clarify", "gate"}:
        # Structured gate draft only — FSM / coordinator apply OpenHitlGate later.
        event_kind = _THINK_NEEDS_CLARIFICATION

    payload: dict[str, Any] = {
        "decision_type": v1.decision_type,
        "reasoning_trace": v1.reasoning_trace,
        "plan_update_summary": v1.plan_update_summary,
        "loop_action": loop_out.action,
        "think_v1": v1.model_dump(),
        "loop_output": loop_out.model_dump(),
        "plan_mutation_proposal": plan_mutation,
    }

    logger.info(
        "[STEP] decision_engine_think_ok session_id=%s decision=%s event=%s",
        command.session_id,
        v1.decision_type,
        event_kind,
    )
    return KernelEvent(
        session_id=command.session_id,
        correlation_id=command.correlation_id,
        kind=event_kind,  # type: ignore[arg-type]
        revision_after=None,  # Decision never bumps revision
        payload=payload,
    )


__all__ = (
    "build_think_request",
    "handle_think_request",
)
