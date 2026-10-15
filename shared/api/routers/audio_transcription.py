#!/usr/bin/env python3
# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   Audio Transcription Router - FastAPI endpoint for WhisperX STT service
# Invariants:
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
# Related:
#   - shared/api/main.py (регистрация роутеров); см. затронутые services/models.
# ------------------------------------------------------------------------------
"""
Audio Transcription Router - FastAPI endpoint for WhisperX STT service

Provides RESTful API for audio transcription using existing STTService.
Supports multiple audio formats with automatic conversion via ffmpeg.

Features:
- Multi-format audio support (mp3, wav, webm, ogg, m4a, flac)
- Automatic language detection
- Segment-level timestamps
- OAuth2 authentication
- Comprehensive error handling
- Health check endpoint

Architecture:
- Uses existing STTService (api.services.voice.stt_service)
- WhisperX API integration (http://localhost:9999 or WHISPERX_URL)
- GPU-accelerated inference (configured in unified_config.py)
- FFmpeg audio conversion pipeline

Created: 2025-10-23
"""

import logging
import time
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any, cast

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile  # type: ignore[import-untyped]
from pydantic import BaseModel, Field  # type: ignore[import-untyped]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.core.auth import User
from api.core.database_manager import get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.repositories.transcription_repository import TranscriptionRepository
from api.schemas.transcription import TranscriptionCreate
from api.services.voice.stt_service import STTService

if TYPE_CHECKING:
    from uuid import UUID

# Logger
logger = logging.getLogger(__name__)

# Router configuration
router = APIRouter(tags=["Audio Transcription - WhisperX STT"])


# === HELPER FUNCTIONS ===


def _raise_invalid_audio_file(error_msg: str) -> None:
    """Raise HTTPException for invalid audio file."""
    raise HTTPException(status_code=400, detail=error_msg)


def _raise_unsupported_language() -> None:
    """Raise HTTPException for unsupported language."""
    raise HTTPException(
        status_code=400,
        detail=f"Unsupported language. Supported: {', '.join(ALLOWED_LANGUAGES)}",
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
    confidence: float | None = Field(None, description="Confidence score (0-1)")


class TranscriptionResponse(BaseModel):
    """Complete transcription response with metadata"""

    text: str = Field(..., description="Full transcribed text")
    language: str = Field(..., description="Detected or specified language code")
    duration_ms: int = Field(..., description="Processing duration in milliseconds")
    confidence: float = Field(..., description="Average confidence score (0-1)")
    segments: list[TranscriptionSegment] = Field(
        default_factory=list, description="Segment-level transcriptions with timestamps"
    )
    audio_duration_sec: float | None = Field(None, description="Audio file duration in seconds")
    file_size_bytes: int = Field(..., description="Original audio file size")
    format: str = Field(..., description="Original audio format")
    timestamp: str = Field(..., description="ISO timestamp of transcription")


class TranscriptionError(BaseModel):
    """Error response model"""

    error: str = Field(..., description="Error message")
    detail: str | None = Field(None, description="Detailed error information")
    status_code: int = Field(..., description="HTTP status code")
    timestamp: str = Field(..., description="ISO timestamp")


class HealthCheckResponse(BaseModel):
    """Health check response"""

    status: str = Field(..., description="Service health status")
    service: str = Field(default="audio-transcription", description="Service name")
    whisperx_status: str = Field(..., description="WhisperX backend status")
    whisperx_latency_ms: float | None = Field(None, description="WhisperX latency")
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
ALLOWED_LANGUAGES = [
    "auto",  # Auto-detect language
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
    # Check content type; if unknown, try to infer from filename
    if file.content_type not in SUPPORTED_FORMATS and (
        file.filename is None
        or not any(file.filename.lower().endswith(ext) for exts in SUPPORTED_FORMATS.values() for ext in exts)
    ):
        return (
            False,
            f"Unsupported audio format. Supported: {', '.join(SUPPORTED_FORMATS.keys())}",
        )

    # Note: file.size is not available in UploadFile, need to read and check
    # Size validation will be done during reading

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

    if file.content_type is None:
        return "unknown"
    return content_type_map.get(file.content_type, "unknown")


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
    summary="Transcribe audio file",
    description="Upload an audio file for transcription using WhisperX STT service",
)
async def transcribe_audio(
    file: UploadFile = File(..., description="Audio file to transcribe"),
    language: str | None = Form(None, description="Language code (e.g., 'en', 'ru'). Auto-detect if not specified"),
    model: str | None = Form(
        "large-v3", description="Whisper model: tiny, base, small, medium, large, large-v3, turbo"
    ),
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> TranscriptionResponse:
    """
    Transcribe uploaded audio file to text.

    This endpoint accepts audio files in various formats and returns transcribed text
    with segment-level timestamps and metadata.

    Args:
        file: Audio file (multipart/form-data)
        language: Optional language code (e.g., 'en', 'ru')
        user: Authenticated user from OAuth2

    Returns:
        TranscriptionResponse with text, segments, and metadata

    Raises:
        HTTPException: 400 (invalid file), 413 (too large), 500 (processing error)
    """
    start_time = time.time()

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
            _raise_unsupported_language()

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
            logger.warning("Empty file uploaded by user %s", user.id)
            _raise_empty_audio_file()

        # Get audio format
        audio_format = get_audio_format(file)
        logger.info(f"Processing {audio_format} file ({file_size} bytes) for user {user.id}")

        logger.info(
            "Trying whisper-fast (stack9) with language=%s",
            language or "auto",
        )
        try:
            transcription_result = await STTService.transcribe(audio_data=audio_bytes, language=language)
        except Exception as e:
            logger.error("whisper-fast (stack9) transcription failed: %s", e)
            raise HTTPException(
                status_code=500,
                detail=f"Transcription failed: whisper-fast (stack9) unavailable. {e!s}",
            ) from e

        segments: list[TranscriptionSegment] = []

        # Extract segments if available
        if "segments" in transcription_result and isinstance(transcription_result["segments"], list):
            segments = [
                TranscriptionSegment(
                    text=seg.get("text", ""),
                    start=seg.get("start", 0.0),
                    end=seg.get("end", 0.0),
                    confidence=seg.get("confidence"),
                )
                for seg in transcription_result["segments"]
            ]

        # Calculate processing time
        processing_time_ms = int((time.time() - start_time) * 1000)

        audio_duration_sec: float | None = transcription_result.get("audio_duration_sec")
        if audio_duration_sec is None and segments:
            ends = [s.end for s in segments if isinstance(s.end, (int, float))]
            if ends:
                audio_duration_sec = float(max(ends))

        response = TranscriptionResponse(
            text=transcription_result["text"],
            language=transcription_result.get("language", language or "auto"),
            duration_ms=processing_time_ms,
            confidence=transcription_result.get("confidence", 0.95),
            segments=segments,
            audio_duration_sec=audio_duration_sec,
            file_size_bytes=file_size,
            format=audio_format,
            timestamp=datetime.now(UTC).isoformat(),
        )

        logger.info(f"Transcription completed in {processing_time_ms}ms: '{response.text[:100]}...' (user={user.id})")

        # Save transcription to database
        try:
            # Save as .txt file
            import os

            txt_dir = "/app/api/storage/transcriptions"
            os.makedirs(txt_dir, exist_ok=True)

            filename_str = file.filename or "unknown_audio"
            txt_filename = f"{user.id}_{datetime.now(UTC).strftime('%Y%m%d_%H%M%S')}_{filename_str}.txt"
            txt_file_path = os.path.join(txt_dir, txt_filename)

            with open(txt_file_path, "w", encoding="utf-8") as f:
                f.write(response.text)

            # Create DB record
            transcription_data = TranscriptionCreate(
                user_id=cast("UUID", user.id),
                filename=filename_str,
                file_size_bytes=file_size,
                audio_format=audio_format,
                duration_seconds=audio_duration_sec,
                whisper_model=model or "large-v3",
                language=response.language,
                transcription_text=response.text,
                confidence_score=response.confidence,
                segments=None,  # Segments not yet implemented
                processing_time_ms=processing_time_ms,
                txt_file_path=txt_file_path,
                error_message=None,
                metadata=None,
                tags=None,
            )

            db_transcription = await TranscriptionRepository.create(db, transcription_data)
            logger.info(f"Saved transcription to DB: {db_transcription.id}")

        except Exception:
            logger.exception("Failed to save transcription to DB")
            # Don't fail the request if DB save fails

        # Save transcription result to unified_content automatically
        unified_content_id = None
        try:
            from uuid import uuid4

            from api.routers.unified_content import get_content_service
            from api.schemas.unified_content import ContentCreate, ContentType, Visibility

            # Get content service using proper dependency
            content_service = await get_content_service()

            transcription_filename = f"transcription_{datetime.now(UTC).strftime('%Y%m%d_%H%M%S')}.txt"
            transcription_bytes = response.text.encode("utf-8")

            transcription_content_data = ContentCreate(
                user_id=str(user.id),
                name=f"Транскрипция: {file.filename or 'audio'}",
                description=f"Автоматическая транскрипция аудио (модель: {model}, язык: {response.language}, точность: {response.confidence:.0%})",
                content_type=ContentType.AI_RESULT,
                mime_type="text/plain",
                sub_type="transcription_result",
                original_filename=transcription_filename,
                tags=["transcription", "audio", "whisper", response.language],
                visibility=Visibility.PRIVATE,
                source_service="audio-transcription",
                source_id=str(uuid4()),
                company_id=None,
                project_id=None,
                related_content=[],
                title=None,
                word_count=len(response.text.split()),
                character_count=len(response.text),
                access_level=None,
                is_public=None,
                metadata={
                    "original_filename": file.filename,
                    "audio_format": audio_format,
                    "file_size_bytes": file_size,
                    "whisper_model": model or "large-v3",
                    "language": response.language,
                    "confidence": response.confidence,
                    "processing_time_ms": processing_time_ms,
                },
                folder_item_id=None,
                apply_project_desktop_folder=True,
            )

            unified_content = await content_service.create_content(
                content_data=transcription_content_data,
                file_data=transcription_bytes,
                user_id=str(user.id),
            )
            unified_content_id = unified_content.id
            logger.info(f"Saved transcription to unified_content: {unified_content_id}")

        except Exception as e:
            logger.warning(f"Failed to save transcription to unified_content: {e}")
            # Don't fail the request if unified_content save fails

        return response

    except HTTPException:
        raise

    except Exception as e:
        logger.exception("Transcription error for user %s", user.id)
        raise HTTPException(status_code=500, detail=f"Transcription failed: {e!s}") from e


@router.get(
    "/health",
    response_model=HealthCheckResponse,
    summary="Health check",
    description="Check audio transcription service health and WhisperX backend status",
)
async def health_check() -> HealthCheckResponse:
    """
    Check service health.

    Returns health status of the audio transcription service and WhisperX backend.

    Returns:
        HealthCheckResponse with service status
    """
    try:
        whisper_fast_health = await STTService.health_check()
        whisperx_status = whisper_fast_health.get("status", "unknown")
        whisperx_latency = whisper_fast_health.get("latency_ms", None)

        # Determine overall status
        if whisperx_status == "up":
            status = "healthy"
        elif whisperx_status == "degraded":
            status = "degraded"
        else:
            status = "unhealthy"

        return HealthCheckResponse(
            status=status,
            service="audio-transcription",
            whisperx_status=whisperx_status,
            whisperx_latency_ms=whisperx_latency,
            timestamp=datetime.now(UTC).isoformat(),
        )

    except Exception:
        logger.exception("Health check failed")
        return HealthCheckResponse(
            status="unhealthy",
            service="audio-transcription",
            whisperx_status="error",
            whisperx_latency_ms=None,
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
        "whisper_model": "whisper-fast (stack9)",
        "default_language": "auto",
    }


@router.get(
    "/",
    summary="Audio transcription info",
    description="Get information about the audio transcription service",
)
async def service_info() -> dict[str, Any]:
    """
    Get service information.

    Returns:
        Service metadata and capabilities
    """
    return {
        "service": "audio-transcription",
        "version": "1.0.0",
        "description": "WhisperX-powered audio transcription service",
        "endpoints": {
            "transcribe": "/api/audio-transcription/transcribe",
            "health": "/api/audio-transcription/health",
            "formats": "/api/audio-transcription/formats",
        },
        "features": [
            "Multi-format audio support",
            "Automatic language detection",
            "Segment-level timestamps",
            "OAuth2 authentication",
            "GPU-accelerated inference",
        ],
        "backend": {
            "engine": "whisper-fast (stack9)",
            "model": "large-v3",
            "device": "remote",
        },
    }
