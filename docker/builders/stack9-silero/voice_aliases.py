# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Pure voice-id aliases for Silero MIT CIS (no torch). Unit-testable without GPU.
# Invariants:
# - Legacy CC-NC ids (xenia/…) map to MIT ru_* speakers.
# Related:
# - docker/builders/stack9-silero/silero_service.py
# ---

"""Voice aliases for stack9 Silero MIT CIS package."""

from __future__ import annotations

DEFAULT_VOICE = "ru_ekaterina"

# CC-NC v5_*_ru / Live Voice legacy ids → MIT CIS ru_* speakers.
VOICE_ALIASES: dict[str, str] = {
    "xenia": "ru_ekaterina",
    "baya": "ru_zhazira",
    "kseniya": "ru_albina",
    "aidar": "ru_marat",
    "eugene": "ru_dmitriy",
    "ru_natalia": "ru_ekaterina",
    "ru_dmitry": "ru_dmitriy",
    "ru_anna": "ru_zhazira",
    "ru_alexey": "ru_marat",
    "auto": "ru_ekaterina",
}


def resolve_ru_voice(voice: str | None, known: set[str] | None = None) -> str:
    """Map legacy/alias voice id to a CIS ru_* speaker."""
    raw = (voice or "").strip() or DEFAULT_VOICE
    mapped = VOICE_ALIASES.get(raw, raw)
    if known is None:
        return mapped if mapped else DEFAULT_VOICE
    if mapped in known:
        return mapped
    if raw in known:
        return raw
    return DEFAULT_VOICE
