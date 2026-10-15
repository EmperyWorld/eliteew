# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Re-export orchestration routing constants for ``from api.ewa_platform.companion.orchestration import …``.
# Invariants:
# - Thin barrel; routing policy and ``task_orchestrator`` live in this package.
# Related:
# - api/ewa_platform/companion/orchestration/routing_policy.py
# ---
"""Companion orchestration subpackage (routing policy)."""

from __future__ import annotations

from api.ewa_platform.companion.orchestration.routing_policy import (
    ORCHESTRATION_PIPELINE_ORDER,
    OrchestrationBranch,
    orchestration_pipeline_order,
)

__all__ = (
    "ORCHESTRATION_PIPELINE_ORDER",
    "OrchestrationBranch",
    "orchestration_pipeline_order",
)
