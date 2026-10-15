# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Feature flag: companion window reactive chrome (mood + work-load aura tint in chat shell).
# Invariants:
# - Default ON; UI reads ``reactive_chrome_enabled`` on companion profile GET.
# Related:
# - api/ewa_platform/gateways/routers/companion_profile.py
# - ewa_platform_setting key ``EWA_COMPANION_REACTIVE_CHROME_ENABLED``
# ---

from __future__ import annotations

import os


def _env_truthy(raw: str | None) -> bool:
    return str(raw or "").strip().lower() in {"1", "true", "yes", "on"}


def companion_reactive_chrome_enabled() -> bool:
    """When false, companion chat keeps static persona palette (no work/mood intensity shift)."""

    return _env_truthy(os.getenv("EWA_COMPANION_REACTIVE_CHROME_ENABLED", "1"))


__all__ = ("companion_reactive_chrome_enabled",)
