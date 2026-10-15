# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared types for agentic rehydration, loop execution, and K0 KernelCommand/Event envelopes.
# Invariants:
# - AgenticContext is ephemeral per tick; durable state lives in Postgres only.
# - Layers exchange KernelCommand / KernelEvent only across Decision / FSM / Scheduler ports.
# Related:
# - api/ewa_platform/agentic/kernel/rehydrate.py
# - documentation/product/ewa/EWA-AGENTIC-KERNEL-REDESIGN.md §A
# ---

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any, Literal

KernelCommandKind = Literal[
    "think_request",
    "apply_transition",
    "open_hitl_gate",
    "consume_hitl_response",
    "upsert_working_memory",
    "claim_next_step",
    "execute_step",
    "fail_empty_pending",
]

KernelEventKind = Literal[
    "think_succeeded",
    "think_parse_failed",
    "think_budget_denied",
    "think_needs_clarification",
    "transition_applied",
    "transition_rejected",
    "gate_opened",
    "gate_resolved",
    "gate_stale",
    "memory_updated",
    "step_claimed",
    "no_runnable",
    "lease_busy",
    "step_succeeded",
    "step_failed",
    "step_needs_hitl",
    "pending_cleaned",
]


@dataclass
class AgenticContext:
    session: dict[str, Any]
    active_nodes: list[dict[str, Any]]
    tree_summary: dict[str, int]
    checkpoints: list[dict[str, Any]]
    inbound_messages: list[dict[str, Any]]
    llm_messages: list[dict[str, str]]
    worker_id: str | None = None
    busy: bool = False
    busy_reason: str | None = None
    scheduled_node: dict[str, Any] | None = None


@dataclass(frozen=True, slots=True)
class KernelCommand:
    """Typed command envelope (Decision / FSM / Scheduler ports)."""

    session_id: str
    principal_id: str
    expected_revision: int
    correlation_id: str
    kind: KernelCommandKind
    payload: Mapping[str, Any] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class KernelEvent:
    """Typed event envelope returned by kernel ports."""

    session_id: str
    correlation_id: str
    kind: KernelEventKind
    payload: Mapping[str, Any] = field(default_factory=dict)
    revision_after: int | None = None
    error_code: str | None = None


@dataclass
class TransitionResult:
    ok: bool
    session: dict[str, Any] | None = None
    reason: str | None = None
    checkpoint_id: int | None = None


@dataclass
class LoopTickResult:
    ok: bool
    session: dict[str, Any] | None = None
    continue_loop: bool = False
    reason: str | None = None
    iterations_ran: int = 0


@dataclass
class AgenticActResult:
    status: str
    summary: str = ""
    full_ref: str | None = None
    tool_name: str | None = None
    raw: dict[str, Any] = field(default_factory=dict)


class AgenticLoopError(Exception):
    """Unrecoverable loop invariant violation — caller must not dereference optional think output."""

    def __init__(self, reason: str, *, detail: str | None = None) -> None:
        self.reason = reason
        self.detail = detail
        super().__init__(detail or reason)
