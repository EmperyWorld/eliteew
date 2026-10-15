# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Package root for deterministic proactive review (structured questions without LLM sidecar).
# Related:
# - api/ewa_platform/companion/proactive/review_engine.py
# ---

from __future__ import annotations

from api.ewa_platform.companion.proactive.review_engine import (
    build_proactive_suggestion,
    merge_observation_hints,
    proactive_state_key,
)

__all__ = (
    "build_proactive_suggestion",
    "merge_observation_hints",
    "proactive_state_key",
)
