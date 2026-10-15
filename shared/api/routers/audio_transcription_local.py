#!/usr/bin/env python3
# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   Audio Transcription Router - Legacy local endpoint (backed by whisper-fast stack9).
# Invariants:
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
# Related:
#   - shared/api/main.py (регистрация роутеров); см. затронутые services/models.
# ------------------------------------------------------------------------------
"""
Audio Transcription Router - Legacy local endpoint (backed by whisper-fast stack9).

Provides RESTful API for audio transcription using STTService (whisper-fast stack9).
Same contract as before; backend is stack9 only.
"""

import logging
import time
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile  # type: ignore[import-untyped]
from pydantic import BaseModel, Field  # type: ignore[import-untyped]

from api.core.auth import User
from api.core.oauth2_auth import require_oauth2_user
from api.services.voice.stt_service import STTService

# Logger
logger = logging.getLogger(__name__)

# Router configuration
router = APIRouter(tags=["Audio Transcription - Local (whisper-fast stack9)"])

# Languages allowed for validation (whisper-fast supports many; list for API consistency)
ALLOWED_LANGUAGES = [
    "auto",
    "en",
    "ru",
    "de",
    "fr",
    "es",
    "it",
    "pt",
    "pl",
    "uk",
    "zh",
    "ja",
    "ko",
    "ar",
    "hi",
    "tr",
    "nl",
    "sv",
    "no",
    "da",
    "fi",
    "cs",
    "hu",
    "ro",
    "bg",
]


# === HELPER FUNCTIONS ===


def _raise_invalid_audio_file(error_msg: str) -> None:
    """Raise HTTPException for invalid audio file."""
    raise HTTPException(status_code=400, detail=error_msg)


def _raise_unsupported_language(supported_languages: list[str]) -> None:
    """Raise HTTPException for unsupported language."""
    raise HTTPException(
        status_code=400,
        detail=f"Unsupported language. Supported: {', '.join(supported_languages[:20])}...",
    )


def _raise_file_too_large(max_size_mb: float) -> None:
    """Raise HTTPException for file too large."""
    raise HTTPException(
        status_code=413,
        detail=f"File too large. Maximum size: {max_size_mb:.0f}MB",
    )


def _raise_empty_audio_file() -> None:
    """Raise HTTPException for empty audio file."""
    raise HTTPException(status_code=400, detail="Empty audio file")


# ============================================================================
# PYDANTIC MODELS
# ============================================================================


class TranscriptionSegment(BaseModel):
    """Single transcription segment with timestamps"""

    text: str = Field(..., description="Transcribed text segment")
    start: float = Field(..., description="Start time in seconds")
    end: float = Field(..., description="End time in seconds")
    confidence: float = Field(..., description="Confidence score (0-1)")


class TranscriptionResponse(BaseModel):
    """Complete transcription response with metadata"""

    text: str = Field(..., description="Full transcribed text")
    language: str = Field(..., description="Detected or specified language code")
    duration_ms: int = Field(..., description="Processing duration in milliseconds")
    confidence: float = Field(..., description="Average confidence score (0-1)")
    segments: list[TranscriptionSegment] = Field(
        default_factory=list, description="Segment-level transcriptions with timestamps"
    )
    file_size_bytes: int = Field(..., description="Original audio file size")
    format: str = Field(..., description="Original audio format")
    backend: str = Field(default="local-whisper", description="Transcription backend")
    timestamp: str = Field(..., description="ISO timestamp of transcription")


class TranscriptionError(BaseModel):
    """Error response model"""

    error: str = Field(..., description="Error message")
    detail: str | None = Field(None, description="Detailed error information")
    status_code: int = Field(..., description="HTTP status code")
    timestamp: str = Field(..., description="ISO timestamp")


class HealthCheckResponse(BaseModel):
    """Health check response"""

    model_config = {"protected_namespaces": ()}

    status: str = Field(..., description="Service health status")
    service: str = Field(default="audio-transcription-local", description="Service name")
    backend: str = Field(default="faster-whisper", description="Backend engine")
    model_loaded: bool = Field(..., description="True if model is loaded")
    model_size: str = Field(..., description="Whisper model size")
    device: str = Field(..., description="Compute device (cuda/cpu)")
    latency_ms: float | None = Field(None, description="Model load latency")
    timestamp: str = Field(..., description="ISO timestamp")


# ============================================================================
# CONSTANTS
# ============================================================================

SUPPORTED_FORMATS = {
    "audio/mpeg": [".mp3"],
    "audio/wav": [".wav"],
    "audio/webm": [".webm"],
    "audio/ogg": [".ogg"],
    "audio/mp4": [".m4a"],
    "audio/flac": [".flac"],
    "audio/x-flac": [".flac"],
    "audio/aac": [".aac"],
}

MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================


def validate_audio_file(file: UploadFile) -> tuple[bool, str | None]:
    """
    Validate uploaded audio file.

    Args:
        file: Uploaded file from FastAPI

    Returns:
        Tuple of (is_valid, error_message)
    """
    # Check content type
    if file.content_type not in SUPPORTED_FORMATS:
        # Try to infer from filename
        if file.filename is None:
            return (
                False,
                f"Unsupported audio format. Supported: {', '.join(SUPPORTED_FORMATS.keys())}",
            )
        if not any(file.filename.lower().endswith(ext) for exts in SUPPORTED_FORMATS.values() for ext in exts):
            return (
                False,
                f"Unsupported audio format. Supported: {', '.join(SUPPORTED_FORMATS.keys())}",
            )

    return True, None


def get_audio_format(file: UploadFile) -> str:
    """
    Extract audio format from file.

    Args:
        file: Uploaded file

    Returns:
        Audio format string (e.g., "mp3", "wav")
    """
    if file.filename:
        for exts in SUPPORTED_FORMATS.values():
            for ext in exts:
                if file.filename.lower().endswith(ext):
                    return ext.lstrip(".")

    # Fallback to content type
    content_type_map = {
        "audio/mpeg": "mp3",
        "audio/wav": "wav",
        "audio/webm": "webm",
        "audio/ogg": "ogg",
        "audio/mp4": "m4a",
        "audio/flac": "flac",
        "audio/x-flac": "flac",
        "audio/aac": "aac",
    }

    if file.content_type is not None:
        return content_type_map.get(file.content_type, "unknown")
    return "unknown"


# ============================================================================
# API ENDPOINTS
# ============================================================================


@router.post(
    "/transcribe",
    response_model=TranscriptionResponse,
    responses={
        200: {"description": "Transcription successful"},
        400: {"model": TranscriptionError, "description": "Invalid request"},
        401: {"model": TranscriptionError, "description": "Unauthorized"},
        413: {"model": TranscriptionError, "description": "File too large"},
        500: {"model": TranscriptionError, "description": "Server error"},
    },
    summary="Transcribe audio file (local)",
    description="Upload an audio file for transcription using local faster-whisper model",
)
async def transcribe_audio(
    file: UploadFile = File(..., description="Audio file to transcribe"),
    language: str | None = Form(None, description="Language code (e.g., 'en', 'ru'). Auto-detect if not specified"),
    user: User = Depends(require_oauth2_user),
) -> TranscriptionResponse:
    """
    Transcribe uploaded audio file to text using local Whisper model.

    This endpoint accepts audio files in various formats and returns transcribed text
    with segment-level timestamps and metadata. Runs entirely locally without external APIs.

    Args:
        file: Audio file (multipart/form-data)
        language: Optional language code (e.g., 'en', 'ru')
        user: Authenticated user from OAuth2

    Returns:
        TranscriptionResponse with text, segments, and metadata

    Raises:
        HTTPException: 400 (invalid file), 413 (too large), 500 (processing error)
    """
    time.time()

    try:
        # Validate file
        is_valid, error_msg = validate_audio_file(file)
        if not is_valid:
            if error_msg is None:
                error_msg = "Invalid audio file"
            logger.warning("Invalid audio file from user %s: %s", user.id, error_msg)
            _raise_invalid_audio_file(error_msg)

        # Validate language
        if language and language not in ALLOWED_LANGUAGES:
            logger.warning("Invalid language '%s' from user %s", language, user.id)
            _raise_unsupported_language(ALLOWED_LANGUAGES)

        # Read audio file
        logger.info("Reading audio file: %s from user %s", file.filename, user.id)
        audio_bytes = await file.read()
        file_size = len(audio_bytes)

        # Check file size
        if file_size > MAX_FILE_SIZE:
            logger.warning("File too large: %s bytes from user %s", file_size, user.id)
            max_size_mb = MAX_FILE_SIZE / (1024 * 1024)
            _raise_file_too_large(max_size_mb)

        if file_size == 0:
            logger.warning(f"Empty file uploaded by user {user.id}")
            _raise_empty_audio_file()

        # Get audio format
        audio_format = get_audio_format(file)
        logger.info(f"Processing {audio_format} file ({file_size} bytes) for user {user.id}")

        logger.info("Calling STTService.transcribe (whisper-fast stack9) with language=%s", language or "auto")
        transcription_result = await STTService.transcribe(audio_data=audio_bytes, language=language)

        raw_segments = transcription_result.get("segments", [])
        segments = []
        for seg in raw_segments:
            if isinstance(seg, dict):
                segments.append(
                    TranscriptionSegment(
                        text=seg.get("text", ""),
                        start=float(seg.get("start", 0)),
                        end=float(seg.get("end", 0)),
                        confidence=seg.get("confidence", 0.0) if seg.get("confidence") is not None else 0.95,
                    )
                )

        response = TranscriptionResponse(
            text=transcription_result.get("text", ""),
            language=transcription_result.get("language", language or "auto"),
            duration_ms=transcription_result.get("duration_ms", 0),
            confidence=transcription_result.get("confidence", 0.95),
            segments=segments,
            file_size_bytes=file_size,
            format=audio_format,
            backend="whisper-fast (stack9)",
            timestamp=datetime.now(UTC).isoformat(),
        )

        logger.info(
            "Transcription completed in %sms: '%s...' (user=%s)",
            response.duration_ms,
            response.text[:100],
            user.id,
        )

        return response

    except HTTPException:
        raise

    except ValueError as e:
        # Validation errors (e.g., unsupported language)
        logger.warning("Validation error for user %s: %s", user.id, e)
        raise HTTPException(status_code=400, detail=str(e)) from e

    except Exception as e:
        logger.exception("Transcription error for user %s", user.id)
        raise HTTPException(status_code=500, detail=f"Transcription failed: {e!s}") from e


@router.get(
    "/health",
    response_model=HealthCheckResponse,
    summary="Health check",
    description="Check local Whisper service health and model status",
)
async def health_check() -> HealthCheckResponse:
    """
    Check service health.

    Returns health status of the local Whisper service and model.

    Returns:
        HealthCheckResponse with service status
    """
    try:
        health = await STTService.health_check()
        status = health.get("status", "unknown")
        latency_ms = health.get("latency_ms")
        return HealthCheckResponse(
            status="healthy" if status == "up" else ("degraded" if status == "degraded" else "unhealthy"),
            service="audio-transcription-local",
            backend="whisper-fast",
            model_loaded=(status == "up"),
            model_size="whisper-fast (stack9)",
            device="remote",
            latency_ms=float(latency_ms) if latency_ms is not None else None,
            timestamp=datetime.now(UTC).isoformat(),
        )
    except Exception:
        logger.exception("Health check failed")
        return HealthCheckResponse(
            status="unhealthy",
            service="audio-transcription-local",
            backend="whisper-fast",
            model_loaded=False,
            model_size="whisper-fast (stack9)",
            device="remote",
            latency_ms=None,
            timestamp=datetime.now(UTC).isoformat(),
        )


@router.get(
    "/formats",
    summary="List supported formats",
    description="Get list of supported audio formats and configurations",
)
async def list_supported_formats() -> dict[str, Any]:
    """
    List supported audio formats.

    Returns:
        (dict[str, Any])ionary of supported formats, languages, and limitations
    """
    return {
        "formats": {content_type: {"extensions": exts} for content_type, exts in SUPPORTED_FORMATS.items()},
        "languages": ALLOWED_LANGUAGES,
        "max_file_size_mb": MAX_FILE_SIZE / (1024 * 1024),
        "backend": "whisper-fast (stack9)",
        "model_size": "large-v3",
        "device": "remote",
        "compute_type": "remote",
    }


@router.get("/config", summary="Get configuration", description="Get current Whisper model configuration")
async def get_configuration() -> dict[str, Any]:
    """
    Get service configuration (whisper-fast stack9).
    """
    return {
        "model_size": "large-v3",
        "device": "remote",
        "compute_type": "remote",
        "backend": "whisper-fast (stack9)",
    }


@router.get(
    "/",
    summary="Audio transcription info",
    description="Get information about the local audio transcription service",
)
async def service_info() -> dict[str, Any]:
    """
    Get service information.

    Returns:
        Service metadata and capabilities
    """
    return {
        "service": "audio-transcription-local",
        "version": "1.0.0",
        "description": "Audio transcription via whisper-fast (stack9)",
        "endpoints": {
            "transcribe": "/api/audio-transcription-local/transcribe",
            "health": "/api/audio-transcription-local/health",
            "formats": "/api/audio-transcription-local/formats",
            "config": "/api/audio-transcription-local/config",
        },
        "features": [
            "whisper-fast (stack9) STT",
            "Multi-format audio support",
            "Automatic language detection",
            "Segment-level timestamps",
            "OAuth2 authentication",
        ],
        "backend": {
            "engine": "whisper-fast (stack9)",
            "model_size": "large-v3",
            "device": "remote",
        },
    }
