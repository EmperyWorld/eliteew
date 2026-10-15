# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Companion presence mode helpers — ``chat`` vs ``contemplation`` (Right to Silence / W2).
# Stored in ``learned_preferences.companion_presence_v1``; gated by
# ``EWA_COMPANION_CONTEMPLATION_ENABLED`` (default off).
# Invariants:
# - Pure helpers except getenv for the feature flag (PG shim).
# - Contemplation never invents chat transcript lines; it only suppresses hints.
# Related:
# - documentation/product/ewa/EWA-COMPANION-CONTINUITY-PRESENCE-CAUSE-ROADMAP.md (W2)
# - api/ewa_platform/gateways/routers/companion_chat.py (observation suppress)
# ---
"""EWA companion presence mode (chat vs contemplation)."""

from __future__ import annotations

import os
from collections.abc import Mapping
from typing import Any, Literal

PRESENCE_NS: str = "companion_presence_v1"
PresenceMode = Literal["chat", "contemplation"]
PRESENCE_MODES: frozenset[str] = frozenset({"chat", "contemplation"})


def companion_contemplation_enabled() -> bool:
    return str(os.getenv("EWA_COMPANION_CONTEMPLATION_ENABLED", "0")).strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def normalize_presence_mode(raw: Any) -> PresenceMode:
    mode = str(raw or "chat").strip().lower()
    if mode in PRESENCE_MODES:
        return mode  # type: ignore[return-value]
    return "chat"


def get_presence_mode(profile: Mapping[str, Any] | None) -> PresenceMode:
    if not isinstance(profile, Mapping):
        return "chat"
    lp = profile.get("learned_preferences")
    if not isinstance(lp, Mapping):
        return "chat"
    block = lp.get(PRESENCE_NS)
    if isinstance(block, Mapping):
        return normalize_presence_mode(block.get("mode"))
    if isinstance(block, str):
        return normalize_presence_mode(block)
    return "chat"


def is_contemplation_active(profile: Mapping[str, Any] | None) -> bool:
    """True when feature flag on and profile mode is contemplation."""

    if not companion_contemplation_enabled():
        return False
    return get_presence_mode(profile) == "contemplation"


def merge_presence_mode_into_learned_preferences(
    lp: Mapping[str, Any] | None,
    mode: PresenceMode | str,
) -> dict[str, Any]:
    out = dict(lp) if isinstance(lp, Mapping) else {}
    prev = out.get(PRESENCE_NS)
    prev_obj = dict(prev) if isinstance(prev, Mapping) else {}
    out[PRESENCE_NS] = {
        **prev_obj,
        "mode": normalize_presence_mode(mode),
        "schema": PRESENCE_NS,
    }
    return out


__all__ = (
    "PRESENCE_MODES",
    "PRESENCE_NS",
    "PresenceMode",
    "companion_contemplation_enabled",
    "get_presence_mode",
    "is_contemplation_active",
    "merge_presence_mode_into_learned_preferences",
    "normalize_presence_mode",
)
