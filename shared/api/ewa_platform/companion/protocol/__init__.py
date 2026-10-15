# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Package root for EWA companion proactive protocol (execution reports, truth guards, review engine config).
# Invariants:
# - Feature flags default OFF; see ``protocol.config``.
# Related:
# - documentation/product/ewa/EWA-COMPANION-PROACTIVE-PROTOCOL.md
# ---

from __future__ import annotations

from api.ewa_platform.companion.protocol.config import (
    companion_execution_report_enabled,
    companion_proactive_review_enabled,
    companion_proactive_review_every_n_turns,
    companion_proactive_review_on_subtask,
    companion_truth_guard_strict,
)

__all__ = (
    "companion_execution_report_enabled",
    "companion_proactive_review_enabled",
    "companion_proactive_review_every_n_turns",
    "companion_proactive_review_on_subtask",
    "companion_truth_guard_strict",
)
