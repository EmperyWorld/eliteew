# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Feature flags for companion plans, workflows, and meta evolution (default OFF).
# Related:
# - documentation/product/ewa/EWA-COMPANION-SERVER-PLANS-ADR.md
# ---

from __future__ import annotations

import os

_META_KEY = "companion_meta_v1"


def _env_truthy(name: str, default: str = "0") -> bool:
    return os.getenv(name, default).strip().lower() in ("1", "true", "yes", "on")


def companion_plan_enabled() -> bool:
    return _env_truthy("EWA_COMPANION_PLAN_ENABLED", "0")


def companion_plan_llm_enabled() -> bool:
    return _env_truthy("EWA_COMPANION_PLAN_LLM_ENABLED", "0")


def companion_meta_evolution_enabled() -> bool:
    return _env_truthy("EWA_COMPANION_META_EVOLUTION_ENABLED", "0")


def companion_meta_evolution_beat_enabled() -> bool:
    """Hourly beat sweep over active plans (requires meta evolution master flag)."""

    if not companion_meta_evolution_enabled():
        return False
    return _env_truthy("EWA_COMPANION_META_EVOLUTION_BEAT_ENABLED", "1")


def companion_meta_evolution_beat_interval_minutes() -> int:
    raw = os.getenv("EWA_COMPANION_META_EVOLUTION_BEAT_INTERVAL_MIN", "60").strip()
    try:
        minutes = int(raw or "60")
    except ValueError:
        minutes = 60
    return max(15, min(minutes, 24 * 60))


def companion_workflow_enabled(workflow_id: str) -> bool:
    key = f"EWA_COMPANION_WORKFLOW_{workflow_id.upper()}_ENABLED"
    return _env_truthy(key, "0")


def companion_meta_preferences_key() -> str:
    return _META_KEY


__all__ = (
    "companion_meta_evolution_beat_enabled",
    "companion_meta_evolution_beat_interval_minutes",
    "companion_meta_evolution_enabled",
    "companion_meta_preferences_key",
    "companion_plan_enabled",
    "companion_plan_llm_enabled",
    "companion_workflow_enabled",
)
