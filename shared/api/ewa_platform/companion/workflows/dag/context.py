# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Validation and execution context for DAG workflow v2 (tier quota, auth flags).
# Invariants:
# - ``is_verified_user`` maps to ``User.is_verified`` from OAuth auth.
# Related:
# - api/ewa_platform/companion/workflows/dag/validation.py
# ---

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class WorkflowValidationContext:
    """Caller-provided flags for DAG validation and runner preflight."""

    is_verified_user: bool = False


__all__ = ("WorkflowValidationContext",)
