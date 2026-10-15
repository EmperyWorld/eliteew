#!/usr/bin/env python3
# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   Legacy TTS compatibility router for AI Avatar Studio.
# Invariants:
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
# Related:
#   - shared/api/main.py (регистрация роутеров); см. затронутые services/models.
# ------------------------------------------------------------------------------
"""
Legacy TTS compatibility router for AI Avatar Studio.

Keeps the historical `/tts/kokoro/*` API surface alive while the canonical
stack9 voice runtime remains Silero. Russian requests use Silero; English
requests still use the local Kokoro library for compatibility.
"""

import logging
from io import BytesIO
from typing import Any

from fastapi import APIRouter, Depends, HTTPException  # type: ignore[import-untyped]
from fastapi.responses import StreamingResponse  # type: ignore[import-untyped]
from pydantic import BaseModel, Field  # type: ignore[import-untyped]# type: ignore[import-untyped]

from api.core.auth import User
from api.core.oauth2_auth import require_oauth2_user
from api.services.qwen3_tts_voices import (
    qwen3_tts_default_profile,
    qwen3_tts_voice_aliases,
    resolve_qwen3_tts_profile_id,
)
from api.services.unified_audio_service import get_kokoro_service, get_silero_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["TTS - Legacy Compatibility"])


class KokoroTTSRequest(BaseModel):
    """Legacy TTS request: English via Kokoro, Russian via Silero."""

    text: str = Field(..., description="Text to synthesize", min_length=1, max_length=5000)
    voice: str | None = Field(
        "af_sarah",
        description="Voice name (English: af_sarah, am_adam, etc. or Russian: xenia, baya, eugene, etc.)",
    )
    language: str | None = Field("auto", description="Language code (auto, en, ru)")


class KokoroTTSResponse(BaseModel):
    """Legacy TTS synthesis response."""

    audio_url: str = Field(..., description="Direct audio URL (for compatibility)")
    duration: float = Field(..., description="Estimated audio duration in seconds")


# English voices available in Kokoro
ENGLISH_VOICES = [
    "af_sarah",  # Sarah - American female, neutral
    "af_sky",  # Sky - American female
    "am_michael",  # Michael - American male
    "am_adam",  # Adam - American male
    "bf_emma",  # Emma - British female
    "bm_james",  # James - British male
]


@router.post("/kokoro/synthesize", response_class=StreamingResponse)
async def synthesize_kokoro_tts(
    request: KokoroTTSRequest, user: User = Depends(require_oauth2_user)
) -> StreamingResponse:
    """
    Generate TTS audio directly from Kokoro service.

    Returns audio/wav binary data for immediate playback in avatar studio.

    Args:
        request: TTS synthesis parameters
        user: Authenticated user

    Returns:
        StreamingResponse: WAV audio data

    Raises:
        HTTPException 400: Invalid voice
        HTTPException 503: Kokoro service unavailable
    """
    try:
        logger.info(
            f"🎙️ Kokoro TTS request from user {user.email}: text='{request.text[:50]}...', voice={request.voice}, language={request.language}"
        )

        # Determine language if auto
        language = request.language or "auto"
        if language == "auto":
            # Simple language detection
            if any(
                char in request.text for char in "абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ"
            ):
                language = "ru"
            else:
                language = "en"

        # Russian: Qwen3-TTS via legacy Silero HTTP client (all contract aliases + companion_*).
        russian_aliases = set(qwen3_tts_voice_aliases().keys())

        # Determine which service to use based on language or voice
        use_silero = False

        if language in {"ru", "ru-RU"}:
            use_silero = True
        elif request.voice and (request.voice in russian_aliases or resolve_qwen3_tts_profile_id(request.voice)):
            use_silero = True
            language = "ru"  # Override language if Russian voice is specified

        # Use Silero for Russian
        if use_silero:
            try:
                silero_service = get_silero_service()

                default_voice = qwen3_tts_default_profile()
                voice = resolve_qwen3_tts_profile_id(request.voice or default_voice)

                audio_data = await silero_service.synthesize(text=request.text, voice=voice, speed=1.0)

                logger.info(f"Silero TTS generated: {len(audio_data)} bytes")
            except Exception as e:
                logger.exception("Silero TTS failed")
                raise HTTPException(status_code=500, detail=f"Silero TTS synthesis failed: {e!s}") from e

        # Use Kokoro for English
        else:
            # Validate voice for English
            if request.voice and request.voice not in ENGLISH_VOICES:
                ru_hint = ", ".join(sorted(russian_aliases))
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid voice. Available voices: English ({', '.join(ENGLISH_VOICES)}) or Russian/Qwen3 aliases ({ru_hint}, companion_*)",
                )

            # Use Kokoro service directly (Python library)
            kokoro_service = get_kokoro_service()
            audio_data = await kokoro_service.synthesize(
                text=request.text, voice=request.voice or "af_sarah", speed=1.0
            )

            logger.info(f"Kokoro TTS generated: {len(audio_data)} bytes")

        # Return audio as streaming response
        audio_buffer = BytesIO(audio_data)

        return StreamingResponse(
            audio_buffer,
            media_type="audio/wav",
            headers={
                "Content-Disposition": "inline; filename=speech.wav",
                "Cache-Control": "no-cache",
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Kokoro TTS synthesis failed")
        raise HTTPException(status_code=500, detail=f"TTS synthesis failed: {e!s}") from e


@router.get("/kokoro/voices")
async def get_kokoro_voices() -> dict[str, Any]:
    """
    Get available English voices for Kokoro TTS.

    Returns:
        dict: Available voices with metadata
    """
    try:
        kokoro_service = get_kokoro_service()
        voices_info = await kokoro_service.get_available_voices()
        return {"voices": voices_info}
    except Exception:
        logger.exception("Failed to get voices")
        # Fallback to default voices
        return {
            "voices": [
                {
                    "id": "af_sarah",
                    "name": "Sarah",
                    "language": "en-US",
                    "gender": "female",
                    "description": "American female voice, neutral tone",
                }
            ]
        }


@router.get("/kokoro/health")
async def kokoro_health_check() -> dict[str, Any]:
    """
    Check Kokoro TTS service health.

    Returns:
        dict: Health status
    """
    try:
        kokoro_service = get_kokoro_service()
        is_healthy = await kokoro_service.health_check()

        if is_healthy:
            return {
                "status": "healthy",
                "kokoro": {"available": True, "device": getattr(kokoro_service, "_device", None)},
            }
        raise HTTPException(status_code=503, detail="Kokoro service is not healthy")

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Kokoro health check failed")
        raise HTTPException(status_code=503, detail=f"Kokoro service unavailable: {e!s}") from e
