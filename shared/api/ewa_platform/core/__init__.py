# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Public exports for EWA desktop orchestration core (state machine transitions + orchestrator entrypoint).
# Invariants:
# - Core logic must consume drivers and persistence only through Protocol ports.
# Related:
# - api/ewa_platform/drivers/desktop_shell.py
# - api/ewa_platform/persistence/orchestration_ports.py
# ---
"""EWA orchestration core: ``OrchestrationContext``, ``DesktopOrchestrator``, phase transitions."""

from __future__ import annotations

from api.ewa_platform.core.orchestration_context import OrchestrationContext
from api.ewa_platform.core.orchestrator import DesktopOrchestrator, run_orchestration_turn
from api.ewa_platform.core.state_machine import VALID_TRANSITIONS, can_transition
from api.ewa_platform.core.transitions import assert_transition, is_terminal

__all__ = [
    "DesktopOrchestrator",
    "OrchestrationContext",
    "VALID_TRANSITIONS",
    "assert_transition",
    "can_transition",
    "is_terminal",
    "run_orchestration_turn",
]
