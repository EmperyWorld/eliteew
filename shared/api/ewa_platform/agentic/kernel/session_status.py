# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Session status string constants shared by Decision Engine and FSM without
# importing transition/DB APIs (K0 isolation).
# Invariants:
# - No apply_session_transition / pool / tool dispatch here.
# Related:
# - documentation/product/ewa/EWA-AGENTIC-KERNEL-REDESIGN.md §K0
# - api/ewa_platform/agentic/kernel/state_machine.py
# ---

from __future__ import annotations

from typing import Final

STATUS_INIT: Final = "init"
STATUS_PLANNING: Final = "planning"
STATUS_EXECUTING: Final = "executing"
STATUS_AWAITING_HUMAN: Final = "awaiting_human"
STATUS_PAUSED: Final = "paused"
STATUS_REPLANNING: Final = "replanning"
STATUS_COMPLETED: Final = "completed"
STATUS_FAILED: Final = "failed"
STATUS_CANCELLED: Final = "cancelled"
STATUS_ABANDONED: Final = "abandoned"

__all__ = (
    "STATUS_ABANDONED",
    "STATUS_AWAITING_HUMAN",
    "STATUS_CANCELLED",
    "STATUS_COMPLETED",
    "STATUS_EXECUTING",
    "STATUS_FAILED",
    "STATUS_INIT",
    "STATUS_PAUSED",
    "STATUS_PLANNING",
    "STATUS_REPLANNING",
)
