# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Hard caps for ensemble action packs (count, diversity, inject size).
# Invariants:
# - Caps are deterministic; runners must not exceed MAX_ACTIONS_PER_PACK.
# Related:
# - documentation/product/DESKTOP-ENSEMBLE-ACTIONS.md
# ---
"""Budget constants for ensemble action packs."""

from __future__ import annotations

MAX_ACTIONS_PER_PACK = 4
MAX_WEB_ACTIONS = 2
MAX_RAG_ACTIONS = 2  # chat_rag + project_vault combined
MAX_KBSEW_ACTIONS = 1
MAX_FINDINGS_CHARS = 6_000
MAX_RESULT_DETAIL_CHARS = 2_400
ACTION_TIMEOUT_SEC = 45.0
