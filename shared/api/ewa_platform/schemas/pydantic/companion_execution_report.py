# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Structured execution reporting for EWA companion turns (tool/step/branch outcomes and proactive suggestions).
# Invariants:
# - ``outcome`` is never ``unknown`` on API boundary; callers must pick a concrete literal.
# Related:
# - api/ewa_platform/companion/orchestration/execution_ledger.py
# - documentation/product/ewa/EWA-COMPANION-PROACTIVE-PROTOCOL.md
# ---

from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field

CompanionExecutionScope = Literal["tool", "step", "branch", "turn", "run", "persist", "sse"]
CompanionExecutionOutcome = Literal[
    "succeeded",
    "failed",
    "partial",
    "not_started",
    "skipped",
    "unavailable",
]
CompanionOrchestrationOutcome = Literal["handled", "deferred_llm", "fell_through", "partial"]
ProactiveSuggestionKind = Literal["gap", "risk", "next_step", "run_complete_followup"]
ProactiveSuggestionSource = Literal[
    "turn_counter",
    "subtask_complete",
    "subtask_failed",
    "observation",
    "turn_plan",
    "active_run",
    "context_gap",
]


class CompanionExecutionReportV1(BaseModel):
    """One structured report for a command, subtask, or orchestration boundary."""

    schema_version: Literal[1] = 1
    scope: CompanionExecutionScope
    outcome: CompanionExecutionOutcome
    reason_code: str = ""
    reason_message_ru: str = ""
    reason_message_en: str = ""
    resume_conditions: list[str] = Field(default_factory=list)
    refs: dict[str, Any] = Field(default_factory=dict)
    attempted: list[dict[str, Any]] = Field(default_factory=list)
    ground_truth: dict[str, Any] = Field(default_factory=dict)


class ProactiveSuggestionV1(BaseModel):
    """Deterministic structured question — not an imperative completion claim."""

    schema_version: Literal[1] = 1
    suggestion_id: str = ""
    kind: ProactiveSuggestionKind
    question_ru: str = ""
    question_en: str = ""
    quick_replies: list[str] = Field(default_factory=list)
    source: ProactiveSuggestionSource
    confidence: Annotated[float, Field(ge=0.0, le=1.0)] = 0.5
    refs: dict[str, Any] = Field(default_factory=dict)


__all__ = (
    "CompanionExecutionOutcome",
    "CompanionExecutionReportV1",
    "CompanionExecutionScope",
    "CompanionOrchestrationOutcome",
    "ProactiveSuggestionKind",
    "ProactiveSuggestionSource",
    "ProactiveSuggestionV1",
)
