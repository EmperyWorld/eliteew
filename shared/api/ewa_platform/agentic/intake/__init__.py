# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Companion chat intake authority — single classifier before deterministic routing.
# Invariants:
# - agentic_mandatory blocks file-surface deterministic short-circuits at turn entry.
# Related:
# - api/ewa_platform/agentic/intake/gate.py
# ---

from api.ewa_platform.agentic.intake.gate import (
    ALL_FILE_SURFACE_DETERMINISTIC_BRANCHES,
    IntakeLane,
    IntakeVerdict,
    agentic_intake_gate_enabled,
    classify_companion_intake,
    intake_verdict_log_fields,
)
from api.ewa_platform.agentic.intake.turn_resolver import resolve_agentic_intake_turn

__all__ = (
    "ALL_FILE_SURFACE_DETERMINISTIC_BRANCHES",
    "IntakeLane",
    "IntakeVerdict",
    "agentic_intake_gate_enabled",
    "classify_companion_intake",
    "intake_verdict_log_fields",
    "resolve_agentic_intake_turn",
)
