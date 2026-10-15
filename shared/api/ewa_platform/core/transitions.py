# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Declares optional transition helpers beyond the minimal table in state_machine.py.
# Invariants:
# - Pure functions only; no imports from gateways or adapters.
# Related:
# - api/ewa_platform/core/state_machine.py
# ---
"""Helpers layering on ``state_machine``: terminal check and guarded transition asserts."""

from __future__ import annotations

from api.ewa_platform.contracts.orchestration import OrchestrationPhase
from api.ewa_platform.core.state_machine import can_transition


def is_terminal(phase: OrchestrationPhase) -> bool:
    """Return True if no further transitions are expected from this phase."""

    return phase in (OrchestrationPhase.COMPLETED, OrchestrationPhase.FAILED)


def assert_transition(current: OrchestrationPhase, target: OrchestrationPhase) -> None:
    """Raise ``ValueError`` when transition is not listed (development guard)."""

    if not can_transition(current, target):
        msg = f"invalid transition {current!s} -> {target!s}"
        raise ValueError(msg)
