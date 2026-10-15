# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Single intake authority for companion chat — classifies turns before deterministic routing.
# Invariants:
# - agentic_mandatory blocks ALL file-surface deterministic branches at turn entry.
# - Mandatory lane never falls through to file_rewrite short-circuit.
# Related:
# - api/ewa_platform/companion/turn/phases/turn_entry.py
# - api/ewa_platform/companion/orchestration/deterministic_router.py
# ---

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Literal, TypedDict

from api.ewa_platform.agentic.intake.strategic_classifier import (
    is_agentic_mandatory_by_score,
    is_single_file_micro_intent,
    score_strategic_intent,
    user_line_has_explicit_agent_prefix,
)
from api.ewa_platform.settings.access import ewa_getenv

logger = logging.getLogger(__name__)

IntakeLane = Literal["agentic_mandatory", "agentic_active_steering", "deterministic", "chat"]


class IntakeVerdictLogFields(TypedDict):
    """Structured fields emitted by ``log_companion_intake_verdict``."""

    lane: IntakeLane
    reason: str
    strategic: bool
    structure_score: int
    strategic_score: int
    explicit_agent: bool
    blocked: list[str]

ALL_FILE_SURFACE_DETERMINISTIC_BRANCHES: frozenset[str] = frozenset(
    {
        "file_rewrite",
        "file_create",
        "file_rename",
        "file_delete",
        "doc_insert",
        "catalog_discuss",
        "compound_file_chain",
        "file_study_compose",
        "file_focus_chat",
    }
)


@dataclass(frozen=True, slots=True)
class IntakeVerdict:
    lane: IntakeLane
    reason: str
    strategic_intent: bool
    task_structure_score: int
    strategic_intent_score: int
    explicit_agent_prefix: bool
    block_deterministic_branches: frozenset[str]


def agentic_intake_gate_enabled() -> bool:
    raw = ewa_getenv("EWA_AGENTIC_INTAKE_GATE", "1").strip().lower()
    return raw not in {"0", "false", "no", "off"}


def classify_companion_intake(
    user_line: str,
    *,
    has_active_agentic_session: bool = False,
) -> IntakeVerdict:
    line = str(user_line or "").strip()
    score = score_strategic_intent(line)
    mandatory = is_agentic_mandatory_by_score(score)
    strategic = mandatory or score.total_strategic_weight >= 4

    if mandatory:
        return IntakeVerdict(
            lane="agentic_mandatory",
            reason="explicit_agent_prefix"
            if score.explicit_agent_prefix
            else ("task_structure_score" if score.task_structure_score >= 6 else "strategic_intent_score"),
            strategic_intent=True,
            task_structure_score=score.task_structure_score,
            strategic_intent_score=score.strategic_intent_score,
            explicit_agent_prefix=score.explicit_agent_prefix,
            block_deterministic_branches=ALL_FILE_SURFACE_DETERMINISTIC_BRANCHES,
        )

    if has_active_agentic_session and (user_line_has_explicit_agent_prefix(line) or score.total_strategic_weight >= 4):
        return IntakeVerdict(
            lane="agentic_active_steering",
            reason="active_session_steering",
            strategic_intent=strategic,
            task_structure_score=score.task_structure_score,
            strategic_intent_score=score.strategic_intent_score,
            explicit_agent_prefix=score.explicit_agent_prefix,
            block_deterministic_branches=ALL_FILE_SURFACE_DETERMINISTIC_BRANCHES,
        )

    if is_single_file_micro_intent(line):
        return IntakeVerdict(
            lane="deterministic",
            reason="single_file_micro_intent",
            strategic_intent=False,
            task_structure_score=score.task_structure_score,
            strategic_intent_score=score.strategic_intent_score,
            explicit_agent_prefix=False,
            block_deterministic_branches=frozenset(),
        )

    return IntakeVerdict(
        lane="chat",
        reason="default_chat_path",
        strategic_intent=strategic,
        task_structure_score=score.task_structure_score,
        strategic_intent_score=score.strategic_intent_score,
        explicit_agent_prefix=score.explicit_agent_prefix,
        block_deterministic_branches=frozenset(),
    )


def intake_verdict_log_fields(verdict: IntakeVerdict) -> IntakeVerdictLogFields:
    blocked = sorted(verdict.block_deterministic_branches)
    return {
        "lane": verdict.lane,
        "reason": verdict.reason,
        "strategic": verdict.strategic_intent,
        "structure_score": verdict.task_structure_score,
        "strategic_score": verdict.strategic_intent_score,
        "explicit_agent": verdict.explicit_agent_prefix,
        "blocked": blocked,
    }


def log_companion_intake_verdict(user_line: str, verdict: IntakeVerdict) -> None:
    fields = intake_verdict_log_fields(verdict)
    logger.info(
        "[STEP] companion_intake_verdict lane=%s reason=%s strategic=%s "
        "structure_score=%s strategic_score=%s explicit_agent=%s blocked=%s",
        fields["lane"],
        fields["reason"],
        fields["strategic"],
        fields["structure_score"],
        fields["strategic_score"],
        fields["explicit_agent"],
        fields["blocked"],
    )


__all__ = (
    "ALL_FILE_SURFACE_DETERMINISTIC_BRANCHES",
    "IntakeLane",
    "IntakeVerdict",
    "IntakeVerdictLogFields",
    "agentic_intake_gate_enabled",
    "classify_companion_intake",
    "intake_verdict_log_fields",
    "log_companion_intake_verdict",
)
