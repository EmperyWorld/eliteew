#!/usr/bin/env python3
# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   Voice Center API - Public TTS endpoint for Voice Assistant
# Invariants:
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
# Related:
#   - shared/api/main.py (регистрация роутеров); см. затронутые services/models.
# ------------------------------------------------------------------------------
"""
Voice Center API - Public TTS endpoint for Voice Assistant

Provides text-to-speech synthesis using stack9 Silero as the canonical runtime.
Legacy provider aliases are normalized to Silero for compatibility.

Accessible from any module: Marketing Cabinet, Elite Chat, Dashboard, etc.
"""

import base64
import hashlib
import logging
from datetime import UTC, datetime
from typing import Any, Literal

from fastapi import APIRouter, HTTPException  # type: ignore[import-untyped]
from pydantic import BaseModel, Field  # type: ignore[import-untyped]

# Services - Stack9 policy: only silero in active path
from api.core.voice_provider_contract import (
    ALLOWED_TTS_PROVIDERS,
    is_allowed_tts_provider,
    normalize_tts_provider,
)
from api.services.unified_audio_service import get_silero_service
from api.services.voice.tts_endpoint_resolver import bind_silero_service_url

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/voice-center", tags=["voice-center"])


class VoiceTTSRequest(BaseModel):
    """TTS request for Voice Center"""

    text: str | None = Field(None, description="Text to synthesize", min_length=1, max_length=5000)
    voice: str = Field(default="auto", description="Voice name (auto, af_sarah, xenia, etc.)")
    provider: Literal["auto", "silero", "kokoro", "piper", "xtts", "openvoice"] = Field(
        default="auto",
        description="TTS provider selector. MVP/runtime policy: only silero is active; legacy aliases normalize to silero.",
    )
    speed: float = Field(default=1.0, description="Speech speed (0.5-2.0)", ge=0.5, le=2.0)
    language: str = Field(default="auto", description="Language (auto, en, ru)")


class VoiceTTSResponse(BaseModel):
    """TTS response with audio data"""

    success: bool
    audio_url: str | None = None
    duration: float | None = None
    text_hash: str | None = None
    message: str | None = None
    provider: str | None = None


class VoiceInfo(BaseModel):
    """Voice information"""

    id: str
    name: str
    provider: str
    language: str
    gender: str
    description: str | None = None


@router.post("/synthesize", response_model=VoiceTTSResponse)
async def synthesize_speech(request: VoiceTTSRequest) -> VoiceTTSResponse:
    """
    Synthesize text to speech using selected provider.

    Providers:
    - **auto**: Canonical selection (normalized to `silero`)
    - **silero**: Active stack9 runtime
    - **kokoro/piper/xtts/openvoice**: Legacy aliases normalized to `silero`
    """
    try:
        # Validate text field
        if request.text is None or (isinstance(request.text, str) and not request.text.strip()):
            return VoiceTTSResponse(
                success=False,
                message="Field 'text' is required for speech synthesis",
            )

        logger.info(
            f"🎙️ Voice Center TTS: text='{request.text[:50]}...', provider={request.provider}, voice={request.voice}, language={request.language}"
        )

        # Determine language if auto
        language = request.language
        if language == "auto":
            # Simple language detection
            if any(
                char in request.text for char in "абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ"
            ):
                language = "ru"
            else:
                language = "en"

        # Restrict to allowed TTS policy. URL always from generation_providers / env.
        requested_provider = request.provider
        provider = "silero" if requested_provider == "auto" else normalize_tts_provider(requested_provider)
        if not is_allowed_tts_provider(provider):
            provider = "silero"
        if requested_provider != provider and requested_provider not in ALLOWED_TTS_PROVIDERS:
            logger.warning(
                "Voice Center: requested provider %s not in policy, using silero",
                requested_provider,
            )

        audio_data: bytes | None = None
        used_provider = provider

        try:
            if provider in ("silero", "piper", "cosyvoice3", "f5-tts", "qwen3-tts"):
                service = get_silero_service()
                endpoint = await bind_silero_service_url(service)
                used_provider = endpoint.provider_name
                voice = request.voice if request.voice != "auto" else "xenia"
                logger.info(
                    "🎙️ Calling voice TTS HTTP: provider=%s text_len=%s, voice=%s, speed=%s",
                    used_provider,
                    len(request.text),
                    voice,
                    request.speed,
                )
                audio_data = await service.synthesize(text=request.text, voice=voice, speed=request.speed)
            else:
                logger.warning("Voice Center: unsupported provider %s rejected", provider)
                raise HTTPException(
                    status_code=400,
                    detail="Unsupported TTS provider. Use provider=auto|silero|piper. Canonical API: /api/v1/voice-gateway/synthesize",
                )

            if not audio_data:
                logger.error(f"{provider} TTS returned empty audio data")
                raise HTTPException(status_code=500, detail="No audio data generated")

        except HTTPException:
            raise
        except Exception as synthesis_error:
            logger.exception(f"{provider} TTS synthesis error: {synthesis_error}")
            raise HTTPException(
                status_code=500, detail=f"TTS synthesis failed: {str(synthesis_error)}"
            ) from synthesis_error

        # For now, return as base64
        audio_b64 = base64.b64encode(audio_data).decode("utf-8")
        audio_url = f"data:audio/wav;base64,{audio_b64}"

        # Estimate duration (rough: 50ms per character)
        duration = len(request.text) * 0.05

        logger.info(
            f"✅ {used_provider.upper()} TTS generated: {len(audio_data)} bytes, audio_url_len={len(audio_url)}"
        )

        response = VoiceTTSResponse(
            success=True,
            audio_url=audio_url,
            duration=duration,
            text_hash=hashlib.md5(request.text.encode()).hexdigest(),
            provider=used_provider,
        )

        logger.debug(
            f"VoiceTTSResponse: success={response.success}, audio_url={'present' if response.audio_url else 'missing'}, provider={response.provider}"
        )

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(
            f"❌ Voice Center TTS synthesis failed: provider={getattr(request, 'provider', 'unknown')}, error={e!s}"
        )
        raise HTTPException(status_code=500, detail=f"TTS synthesis failed: {e!s}") from e


@router.get("/voices", response_model=list[VoiceInfo])
async def get_available_voices() -> list[VoiceInfo]:
    """
    Get list of available TTS voices from all providers.
    """
    try:
        logger.info("Voice Center: Fetching available voices from all providers")
        all_voices = []

        # Helper to fetch and format voices
        async def fetch_provider_voices(provider_name: str, get_service_func):
            try:
                service = get_service_func()
                voices = await service.get_available_voices()
                return [
                    VoiceInfo(
                        id=v.get("id"),
                        name=v.get("name"),
                        provider=provider_name,
                        language=v.get("language", "unknown"),
                        gender=v.get("gender", "unknown"),
                        description=v.get("description"),
                    )
                    for v in voices
                ]
            except Exception as e:
                logger.warning(f"Failed to fetch {provider_name} voices: {e}")
                return []

        # Fetch concurrently? For now sequential is safer to avoid event loop issues
        # Policy: only silero voices returned (Stack9)
        all_voices.extend(await fetch_provider_voices("silero", get_silero_service))

        logger.info(f"Returning {len(all_voices)} voices total")
        return all_voices

    except Exception as e:
        logger.exception("Failed to get voices")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve voices: {e!s}") from e


@router.get("/health")
async def health_check() -> dict[str, Any]:
    """
    Health check for Voice Center and all TTS providers.
    """
    try:
        results = {}

        async def check_service(name: str, get_service_func):
            try:
                service = get_service_func()
                # BaseHTTPTTSService has a health_check method
                is_healthy = await service.health_check()
                return {"status": "healthy" if is_healthy else "unhealthy"}
            except Exception as e:
                return {"status": "error", "error": str(e)}

        # Policy: only silero is active (Stack9)
        results["silero"] = await check_service("silero", get_silero_service)

        # Determine overall status
        any_healthy = any(r.get("status") == "healthy" for r in results.values())

        return {
            "service": "Voice Center",
            "status": "healthy" if any_healthy else "unhealthy",
            "timestamp": datetime.now(UTC).isoformat(),
            "providers": results,
        }

    except Exception as e:
        logger.exception("Health check failed")
        return {"service": "Voice Center", "status": "unhealthy", "error": str(e)}
