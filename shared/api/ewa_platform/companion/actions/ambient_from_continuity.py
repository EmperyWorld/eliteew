# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Map ``companion_continuity_v1.mood_tint`` → optional ``ambient_adjust`` (Continuity W4).
# Contemplation uses weaker presets (no MusicPlayer). Desk-only — no IoT.
# Invariants:
# - Flag ``EWA_COMPANION_AMBIENT_FROM_CONTINUITY`` default off.
# - Requires ``EWA_COMPANION_AMBIENT_ACTIONS_ENABLED`` for expansion to wire actions.
# - Pure helpers; no I/O.
# Related:
# - documentation/product/ewa/EWA-COMPANION-CONTINUITY-PRESENCE-CAUSE-ROADMAP.md (W4)
# - api/ewa_platform/companion/actions/ambient.py
# - api/ewa_platform/companion/turn/turn_action_prelude.py
# ---
"""Continuity → ambient_adjust bridge."""

from __future__ import annotations

import os
from collections.abc import Mapping
from typing import Any

from api.ewa_platform.companion.persona.continuity import get_continuity

# continuity mood_tint → ambient mood_palette key
_TINT_TO_AMBIENT: dict[str, str] = {
    "warm": "warm",
    "focused_warm": "warm",
    "grief": "grief",
    "tense": "tense",
    "playful": "playful",
    "ironic_soft": "playful",
    "focus": "focus",
    "neutral": "neutral",
}


def ambient_from_continuity_enabled() -> bool:
    return str(os.getenv("EWA_COMPANION_AMBIENT_FROM_CONTINUITY", "0")).strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def continuity_tint_to_ambient_mood(mood_tint: str) -> str | None:
    tint = str(mood_tint or "").strip().lower()
    mood = _TINT_TO_AMBIENT.get(tint)
    if mood is None or mood == "neutral":
        return None
    return mood


def build_ambient_adjust_from_continuity(
    profile: Mapping[str, Any] | None,
    *,
    contemplation: bool = False,
) -> dict[str, Any] | None:
    """One ``ambient_adjust`` row from continuity tint, or ``None``."""

    if not ambient_from_continuity_enabled():
        return None
    block = get_continuity(profile)
    mood = continuity_tint_to_ambient_mood(str(block.get("mood_tint") or ""))
    if mood is None:
        return None
    # Skip near-rest valence — avoid fighting user theme.
    try:
        valence = float(block.get("valence") or 0.0)
    except TypeError, ValueError:
        valence = 0.0
    if abs(valence) < 0.08 and mood not in {"focus", "tense"}:
        return None
    row: dict[str, Any] = {
        "type": "ambient_adjust",
        "mood": mood,
        "rationale": "continuity_micro_state",
    }
    if contemplation:
        # Weaker: expand path still runs, but mark so music can be stripped.
        row["contemplation_weak"] = True
    return row


def strip_music_from_ambient_actions_when_weak(actions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Drop MusicPlayer opens that came from contemplation-weak ambient expansion."""

    # Expansion already drops ambient_adjust; music is open_app MusicPlayer.
    # Callers that set contemplation_weak should expand then filter music.
    out: list[dict[str, Any]] = []
    for row in actions:
        if not isinstance(row, dict):
            continue
        if (
            str(row.get("type") or "").strip().lower() == "open_app"
            and str(row.get("app_component") or "").strip() == "MusicPlayer"
            and row.get("_from_contemplation_weak")
        ):
            continue
        out.append(row)
    return out


__all__ = (
    "ambient_from_continuity_enabled",
    "build_ambient_adjust_from_continuity",
    "continuity_tint_to_ambient_mood",
    "strip_music_from_ambient_actions_when_weak",
)
