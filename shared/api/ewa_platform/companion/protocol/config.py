# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Feature flags for companion proactive protocol (execution reports, truth guards, deterministic review).
# Invariants:
# - All flags default OFF until operator enables via env or ``ewa_platform_setting``.
# Related:
# - documentation/product/ewa/EWA-COMPANION-PROACTIVE-PROTOCOL.md
# ---

from __future__ import annotations

import os


def _env_truthy(name: str, default: str = "0") -> bool:
    return os.getenv(name, default).strip().lower() in ("1", "true", "yes", "on")


def _env_int(name: str, default: int, *, lo: int, hi: int) -> int:
    raw = os.getenv(name, str(default)).strip()
    try:
        value = int(raw or str(default))
    except ValueError:
        value = default
    return max(lo, min(value, hi))


def companion_execution_report_enabled() -> bool:
    return _env_truthy("EWA_COMPANION_EXECUTION_REPORT_ENABLED", "0")


def companion_truth_guard_strict() -> bool:
    return _env_truthy("EWA_COMPANION_TRUTH_GUARD_STRICT", "0")


def companion_proactive_review_enabled() -> bool:
    return _env_truthy("EWA_COMPANION_PROACTIVE_REVIEW_ENABLED", "0")


def companion_proactive_review_every_n_turns() -> int:
    return _env_int("EWA_COMPANION_PROACTIVE_REVIEW_EVERY_N_TURNS", 3, lo=2, hi=10)


def companion_proactive_review_on_subtask() -> bool:
    return _env_truthy("EWA_COMPANION_PROACTIVE_REVIEW_ON_SUBTASK", "1")


__all__ = (
    "companion_execution_report_enabled",
    "companion_proactive_review_every_n_turns",
    "companion_proactive_review_enabled",
    "companion_proactive_review_on_subtask",
    "companion_truth_guard_strict",
)
