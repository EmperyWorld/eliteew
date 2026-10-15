# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lock: TranscriptionCreate default/pattern accept large-v3 (prod stack9 STT metadata).
# Invariants:
# - Default whisper_model is large-v3; pattern rejects unknown sizes.
# Related:
# - api/schemas/transcription.py
# - documentation/product/ewa/EWA-COMPANION-VOICE-TTS.md
# ---

from __future__ import annotations

from uuid import uuid4

import pytest
from pydantic import ValidationError

from api.schemas.transcription import TranscriptionCreate
from api.services.live_voice_settings_service import LiveVoiceSettingsService


@pytest.mark.unit
def test_transcription_create_defaults_whisper_to_large_v3() -> None:
    row = TranscriptionCreate(
        user_id=uuid4(),
        filename="clip.wav",
        file_size_bytes=1024,
        audio_format="wav",
        transcription_text="hello",
    )
    assert row.whisper_model == "large-v3"


@pytest.mark.unit
def test_transcription_create_accepts_large_v3_explicit() -> None:
    row = TranscriptionCreate(
        user_id=uuid4(),
        filename="clip.wav",
        file_size_bytes=1024,
        audio_format="wav",
        whisper_model="large-v3",
        transcription_text="hello",
    )
    assert row.whisper_model == "large-v3"


@pytest.mark.unit
def test_transcription_create_rejects_unknown_whisper_model() -> None:
    with pytest.raises(ValidationError):
        TranscriptionCreate(
            user_id=uuid4(),
            filename="clip.wav",
            file_size_bytes=1024,
            audio_format="wav",
            whisper_model="huge-v99",
            transcription_text="hello",
        )


@pytest.mark.unit
def test_live_voice_defaults_whisper_large_v3() -> None:
    defaults = LiveVoiceSettingsService.get_default_settings()
    assert defaults["whisper_model"] == "large-v3"
