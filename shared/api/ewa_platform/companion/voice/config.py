# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Feature flag: companion mic (Whisper STT) + speaker (Qwen3-TTS) via ``/api/v1/voice-gateway`` (stack9).
# Invariants:
# - Default OFF; UI reads ``voice_enabled`` on companion profile GET.
# Related:
# - api/ewa_platform/gateways/routers/companion_profile.py
# - docker/env_file/.env.stack0.backend (``EWA_COMPANION_VOICE_ENABLED``)
# ---

from __future__ import annotations

import os


def _env_truthy(raw: str | None) -> bool:
    return str(raw or "").strip().lower() in {"1", "true", "yes", "on"}


def companion_voice_enabled() -> bool:
    """When false, companion chat hides/disables mic + TTS playback controls."""

    return _env_truthy(os.getenv("EWA_COMPANION_VOICE_ENABLED"))


__all__ = ("companion_voice_enabled",)
