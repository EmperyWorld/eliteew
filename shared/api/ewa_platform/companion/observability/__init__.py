# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Companion observability helpers (degrade-path debug logging).
# Invariants:
# - Best-effort only; must not raise into request/workflow paths.
# Related:
# - api/ewa_platform/companion/observability/degrade_log.py
# ---

from api.ewa_platform.companion.observability.degrade_log import (
    companion_degrade_debug,
    companion_degrade_debug_enabled,
)

__all__ = (
    "companion_degrade_debug",
    "companion_degrade_debug_enabled",
)
