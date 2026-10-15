# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Server-side **mood → ambient preset** mapping for the EWA companion (project «Mela's Ascension»,
# Module B3). Translates an affective ``mood`` label (or an ambient key produced by
# ``affective_router``) into a concrete ``AmbientPreset`` — desktop config patch (theme, wallpaper) plus
# optional ``MusicPlayer`` preset. The companion ambient driver expands a single
# ``ambient_adjust`` action into the existing wire-compatible actions (``patch_desktop_config`` +
# ``open_app MusicPlayer``) so the SPA does not need a new action type.
# Invariants:
# - **Pure** mapping; no I/O.
# - Falls back to the **neutral** preset when an unknown mood is supplied — never raises.
# - Theme / wallpaper values are taken from the well-known desktop tokens used by
#   ``patch_desktop_config`` in ``shared/api/ewa_platform/contracts/desktop_config_patch_wire.py``.
# Related:
# - api/ewa_platform/companion/affective/affective_router.py
# - api/ewa_platform/companion/actions/ambient.py
# - api/ewa_platform/contracts/desktop_config_patch_wire.py
# ---

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Final


@dataclass(frozen=True)
class AmbientPreset:
    """Resolved ambient preset for one mood. All fields optional except ``mood``."""

    mood: str
    theme_id: str | None = None
    wallpaper_id: str | None = None
    music_preset: str | None = None
    rationale: str = ""
    extras: dict[str, str] = field(default_factory=dict)


_NEUTRAL: Final[AmbientPreset] = AmbientPreset(
    mood="neutral",
    theme_id=None,
    wallpaper_id=None,
    music_preset=None,
    rationale="no ambient change suggested",
)

_PRESETS: Final[dict[str, AmbientPreset]] = {
    "warm": AmbientPreset(
        mood="warm",
        theme_id="light",
        wallpaper_id="ewa://wallpaper/warm-sunset.jpg",
        music_preset="warm_evening",
        rationale="user signalled warmth/gratitude — settle into a warm ambience",
    ),
    "grief": AmbientPreset(
        mood="grief",
        theme_id="dark",
        wallpaper_id="ewa://wallpaper/low-candle.jpg",
        music_preset="low_calm",
        rationale="user signalled fatigue/sadness — lower-contrast palette, no upbeat audio",
    ),
    "tense": AmbientPreset(
        mood="tense",
        theme_id="dark",
        wallpaper_id="ewa://wallpaper/cool-steel.jpg",
        music_preset=None,
        rationale="user signalled hostility/irritation — neutral cool palette, no music auto-start",
    ),
    "playful": AmbientPreset(
        mood="playful",
        theme_id="light",
        wallpaper_id="ewa://wallpaper/playful-confetti.jpg",
        music_preset="playful_pop",
        rationale="user joking around — bright theme, light playlist",
    ),
    "focus": AmbientPreset(
        mood="focus",
        theme_id="auto",
        wallpaper_id="ewa://wallpaper/focus-grid.jpg",
        music_preset="focus_minimal",
        rationale="user signalled task focus — minimal palette, focus music",
    ),
    "neutral": _NEUTRAL,
}

_ALIASES: Final[dict[str, str]] = {
    "ambient_warm_soft": "warm",
    "ambient_low_warm": "grief",
    "ambient_cool_low": "tense",
    "ambient_playful_bright": "playful",
    "ambient_focus_neutral": "focus",
}


def resolve_ambient_preset(mood_or_ambient: str | None) -> AmbientPreset:
    """Return the ``AmbientPreset`` for an arbitrary mood / ambient key. Unknown → neutral."""

    if not mood_or_ambient:
        return _NEUTRAL
    key = mood_or_ambient.strip().lower()
    key = _ALIASES.get(key, key)
    return _PRESETS.get(key, _NEUTRAL)


def known_moods() -> tuple[str, ...]:
    """Exposed for testing and documentation generators."""

    return tuple(_PRESETS.keys())
