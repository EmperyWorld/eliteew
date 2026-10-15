# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Identifiers and phases for a server-side desktop orchestration session (goal + lifecycle).
# Invariants:
# - No asyncio; only strings and dataclasses suitable for JSON snapshots.
# Related:
# - api/ewa_platform/contracts/desktop_intent.py
# - api/ewa_platform/core/state_machine.py
# - api/ewa_platform/core/orchestrator.py
# ---
"""Orchestration session contracts.

Should contain: ``OrchestrationSessionId`` alias, ``OrchestrationPhase`` (StrEnum),
``UserGoal`` / ``OrchestrationGoal`` dataclass with optional ``run_id`` /
``correlation_id`` links. Expand when persistence schema is fixed.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class OrchestrationPhase(StrEnum):
    """High-level lifecycle of an orchestration session."""

    IDLE = "idle"
    PLANNING = "planning"
    AWAITING_USER = "awaiting_user"
    EXECUTING = "executing"
    FAILED = "failed"
    COMPLETED = "completed"


@dataclass(slots=True)
class UserGoal:
    """Natural-language or structured goal the user asked the orchestrator to achieve."""

    summary: str
    detail: str | None = None


@dataclass(slots=True)
class OrchestrationSessionRef:
    """Opaque references tying orchestration to envelope and persistence."""

    session_id: str
    correlation_id: str
    run_id: str | None = None


class OrchestrationSessionSnapshotKey(StrEnum):
    """JSON keys for ``OrchestrationSessionRepository`` snapshot rows (orchestrator-managed)."""

    TURNS = "turns"
    LAST_BRANCH = "last_branch"
    LAST_OBSERVATION_KIND = "last_observation_kind"
    LAST_INTENT_KIND = "last_intent_kind"


class OrchestrationSessionBranch(StrEnum):
    """Values stored under ``OrchestrationSessionSnapshotKey.LAST_BRANCH``."""

    NO_INTENT = "no_intent"
    POLICY_DENIED = "policy_denied"
    INTENT_EXECUTED = "intent_executed"
