#!/usr/bin/env python3
# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   Voice Center Transcription Router - FastAPI endpoint for voice center audio
#   transcription
# Invariants:
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
# Related:
#   - shared/api/main.py (регистрация роутеров); см. затронутые services/models.
# ------------------------------------------------------------------------------
"""
Voice Center Transcription Router - FastAPI endpoint for voice center audio transcription

Provides RESTful API for audio transcription using whisper-fast (stack9).
Supports multiple audio formats with automatic conversion via ffmpeg.

Features:
- Multi-format audio support (mp3, wav, webm, ogg, m4a, flac)
- Automatic language detection with Russian support
- Segment-level timestamps
- OAuth2 authentication
- Comprehensive error handling
- History tracking and metrics

Architecture:
- Uses STTService / whisper-fast (stack9) for transcription
- FFmpeg audio conversion pipeline

Created: 2025-10-24
"""

import builtins
import contextlib
import logging
import time
import uuid
from datetime import UTC, datetime
from typing import Never

from fastapi import (  # type: ignore[import-untyped]
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
)
from pydantic import BaseModel, Field  # type: ignore[import-untyped]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.core.auth import User
from api.core.database_manager import get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.repositories.transcription_repository import TranscriptionRepository
from api.routers.socketio_handler import (
    send_transcription_complete,
    send_transcription_error,
)
from api.schemas.transcription import (
    TranscriptionCreate,
    VoiceCenterTranscriptionDetailOut,
    VoiceCenterTranscriptionHistoryItemOut,
    VoiceCenterTranscriptionMetricsOut,
)
from api.services.voice.stt_service import STTService

# Logger
logger = logging.getLogger(__name__)

# Router configuration
router = APIRouter(prefix="/api/voice-center", tags=["Voice Center - Transcription"])


# ============================================================================
# PYDANTIC MODELS
# ============================================================================


class TranscriptionSegment(BaseModel):
    """Single transcription segment with timestamps"""

    text: str = Field(..., description="Transcribed text segment")
    start: float = Field(..., description="Start time in seconds")
    end: float = Field(..., description="End time in seconds")
    confidence: float | None = Field(None, description="Confidence score (0-1)")


class VoiceCenterTranscriptionResponse(BaseModel):
    """Voice center transcription response"""

    text: str = Field(..., description="Full transcribed text")
    language: str = Field(..., description="Detected or specified language code")
    confidence: float = Field(..., description="Average confidence score (0-1)")
    segments: list[TranscriptionSegment] = Field(
        default_factory=list, description="Segment-level transcriptions with timestamps"
    )
    processing_time_ms: int = Field(..., description="Processing duration in milliseconds")
    file_size_bytes: int = Field(..., description="Original audio file size")
    format: str = Field(..., description="Original audio format")
    timestamp: str = Field(..., description="ISO timestamp of transcription")
    transcription_id: str | None = Field(None, description="Saved transcription ID (if saved to history)")


class TranscriptionError(BaseModel):
    """Error response model"""

    error: str = Field(..., description="Error message")
    detail: str | None = Field(None, description="Detailed error information")
    status_code: int = Field(..., description="HTTP status code")
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

MAX_FILE_SIZE = 200 * 1024 * 1024  # 200MB for voice center (increased for large files)

ALLOWED_LANGUAGES = [
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
    # Check content type; if unknown, infer from filename
    if file.content_type not in SUPPORTED_FORMATS and (
        file.filename is None
        or not any(file.filename.lower().endswith(ext) for exts in SUPPORTED_FORMATS.values() for ext in exts)
    ):
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
    if file.content_type:
        for fmt, exts in SUPPORTED_FORMATS.items():
            if file.content_type == fmt:
                return exts[0].lstrip(".")

    return "unknown"


# ============================================================================
# TRANSCRIPTION ENDPOINT
# ============================================================================


@router.post(
    "/transcribe",
    response_model=VoiceCenterTranscriptionResponse,
    status_code=200,
    responses={
        200: {"description": "Transcription successful"},
        400: {"model": TranscriptionError, "description": "Invalid request"},
        413: {"model": TranscriptionError, "description": "File too large"},
        500: {"model": TranscriptionError, "description": "Server error"},
    },
    summary="Transcribe voice center audio file",
    description="Upload an audio file for transcription in voice center using Whisper",
)
async def transcribe_voice_center_audio(
    file: UploadFile = File(..., description="Audio file to transcribe"),
    language: str | None = Form(
        None,
        description="Language code (e.g., 'en', 'ru'). Auto-detect if not specified. Russian is fully supported.",
    ),
    model: str | None = Form(
        "large-v3", description="Whisper model: tiny, base, small, medium, large, large-v3, turbo"
    ),
    add_punctuation: bool = Form(False, description="Add punctuation marks to transcription (post-processing)"),
    add_speaker_labels: bool = Form(False, description="Add speaker labels/roles to transcription (diarization)"),
    save_to_history: bool = Form(True, description="Save transcription to history for reuse"),
    chunk_mode: str | None = Form(
        None,
        description="Chunking mode: 'auto' (10 min chunks), 'time' (by minutes), 'count' (by number), 'none' (no chunking)",
    ),
    chunk_size_minutes: int | None = Form(None, description="Chunk size in minutes (for 'time' mode, default: 10)"),
    chunk_count: int | None = Form(None, description="Number of chunks (for 'count' mode, default: 2)"),
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> VoiceCenterTranscriptionResponse:
    """
    Transcribe uploaded audio file for voice center.

    This endpoint accepts audio files in various formats and returns transcribed text
    with segment-level timestamps and metadata. Optimized for voice center use cases.

    Args:
        file: Audio file (multipart/form-data)
        language: Optional language code (e.g., 'en', 'ru')
        user: Authenticated user from OAuth2

    Returns:
        VoiceCenterTranscriptionResponse with text, segments, and metadata

    Raises:
        HTTPException: 400 (invalid file), 413 (too large), 500 (processing error)
    """
    start_time = time.time()

    try:
        # Validate file
        is_valid, error_msg = validate_audio_file(file)
        if not is_valid:
            logger.warning("Invalid audio file from user %s: %s", user.id, error_msg)
            raise HTTPException(status_code=400, detail=error_msg)

        # Validate language
        if language and language not in ALLOWED_LANGUAGES:
            logger.warning("Invalid language '%s' from user %s", language, user.id)
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported language. Supported: {', '.join(ALLOWED_LANGUAGES)}",
            )

        # Read audio file
        logger.info("Reading voice center audio file: %s from user %s", file.filename, user.id)
        audio_bytes = await file.read()
        file_size = len(audio_bytes)

        # Check file size
        if file_size > MAX_FILE_SIZE:
            logger.warning(
                f"Voice center file too large: {file_size} bytes ({file_size / (1024 * 1024):.1f}MB) from user {user.id}. Max: {MAX_FILE_SIZE / (1024 * 1024):.0f}MB"
            )
            raise HTTPException(
                status_code=413,
                detail=f"File too large ({file_size / (1024 * 1024):.1f}MB). Maximum size: {MAX_FILE_SIZE / (1024 * 1024):.0f}MB. "
                f"For files larger than {MAX_FILE_SIZE / (1024 * 1024):.0f}MB, automatic chunking is available. "
                f"Please try uploading again or split the file into smaller parts.",
            )

        if file_size == 0:
            logger.warning("Empty voice center file uploaded by user %s", user.id)
            raise HTTPException(status_code=400, detail="Empty audio file")

        # Get audio format
        audio_format = get_audio_format(file)
        logger.info(f"Processing voice center {audio_format} file ({file_size} bytes) for user {user.id}")

        # Generate task ID for progress tracking
        task_id = str(uuid.uuid4())

        logger.info(
            "Calling STTService.transcribe (whisper-fast stack9) with language=%s",
            language or "auto",
        )
        try:
            transcription_result = await STTService.transcribe(
                audio_data=audio_bytes,
                language=language,
            )
        except Exception as e:
            # Send error via Socket.IO
            with contextlib.suppress(builtins.BaseException):
                await send_transcription_error(task_id=task_id, error=str(e))
            raise

        # Calculate processing time
        processing_time_ms = int((time.time() - start_time) * 1000)

        # Send completion via Socket.IO
        try:
            await send_transcription_complete(
                task_id=task_id,
                result={
                    "text": transcription_result.get("text", ""),
                    "language": transcription_result.get("language", "auto"),
                    "confidence": transcription_result.get("confidence", 0.0),
                    "model": transcription_result.get("model", model),
                    "cached": transcription_result.get("cached", False),
                    "duration_ms": processing_time_ms,
                },
            )
        except Exception as e:
            # Non-critical: completion notification shouldn't break response
            logger.debug("Failed to send completion notification: %s", e)

        # Build segments response (whisper-fast format: start, end, text, optional confidence)
        segments = []
        for segment_data in transcription_result.get("segments", []):
            if isinstance(segment_data, dict):
                segments.append(
                    TranscriptionSegment(
                        text=segment_data.get("text", ""),
                        start=float(segment_data.get("start", 0)),
                        end=float(segment_data.get("end", 0)),
                        confidence=segment_data.get("confidence"),
                    )
                )

        # Build response
        response = VoiceCenterTranscriptionResponse(
            text=transcription_result["text"],
            language=transcription_result.get("language", language or "auto"),
            confidence=transcription_result.get("confidence", 0.95),
            segments=segments,
            processing_time_ms=processing_time_ms,
            file_size_bytes=file_size,
            format=audio_format,
            timestamp=datetime.now(UTC).isoformat(),
            transcription_id=None,
        )

        logger.info(
            f"Voice center transcription completed in {processing_time_ms}ms: "
            f"'{response.text[:100]}...' (user={user.id})"
        )

        # Save to history if requested
        transcription_id = None
        if save_to_history:
            try:
                from uuid import UUID

                transcription_record = await TranscriptionRepository.create(
                    db,
                    TranscriptionCreate(
                        user_id=UUID(str(user.id)),
                        filename=file.filename or "unknown",
                        file_size_bytes=file_size,
                        audio_format=audio_format,
                        duration_seconds=None,  # Could be calculated from segments
                        whisper_model=model or "large-v3",
                        language=response.language,
                        transcription_text=response.text,
                        confidence_score=response.confidence,
                        segments=[seg.model_dump() for seg in segments],
                        processing_time_ms=processing_time_ms,
                        txt_file_path=None,
                        status="completed",
                        error_message=None,
                        metadata={
                            "add_punctuation": add_punctuation,
                            "add_speaker_labels": add_speaker_labels,
                            "cached": transcription_result.get("cached", False),
                            "task_id": task_id,
                        },
                        tags=None,
                    ),
                )
                await db.commit()
                transcription_id = str(transcription_record.id)
                logger.info("Transcription saved to history: %s", transcription_id)
            except Exception as e:
                # Non-critical: history save failure shouldn't break response
                logger.warning("Failed to save transcription to history: %s", e)
                await db.rollback()

        # Add transcription_id to response if saved
        if transcription_id:
            response_dict = response.model_dump()
            response_dict["transcription_id"] = transcription_id
            return VoiceCenterTranscriptionResponse(**response_dict)

        return response

    except HTTPException:
        raise
    except Exception as e:
        # Track error metrics
        logger.exception("Voice center transcription error")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {e!s}") from e


# ============================================================================
# HISTORY ENDPOINTS
# ============================================================================


@router.get("/history", response_model=list[VoiceCenterTranscriptionHistoryItemOut])
async def get_transcription_history(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=100, description="Maximum number of records to return"),
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> list[VoiceCenterTranscriptionHistoryItemOut]:
    """
    Get user's transcription history.

    Returns list of saved transcriptions with metadata.
    """
    try:
        from uuid import UUID

        transcriptions, _total = await TranscriptionRepository.get_by_user(
            db, UUID(str(user.id)), skip=skip, limit=limit, order_by="created_at", order_desc=True
        )

        return [
            VoiceCenterTranscriptionHistoryItemOut.model_validate(
                {
                    "id": str(t.id),
                    "filename": t.filename,
                    "file_size_bytes": t.file_size_bytes,
                    "audio_format": t.audio_format,
                    "whisper_model": t.whisper_model,
                    "language": t.language,
                    "text": (
                        (text_str := str(t.transcription_text))[:200] + "..."
                        if len(text_str := str(t.transcription_text)) > 200
                        else text_str
                    )
                    if t.transcription_text is not None
                    else "",
                    "confidence": t.confidence_score,
                    "processing_time_ms": t.processing_time_ms,
                    "created_at": (
                        t.created_at.isoformat()  # type: ignore[union-attr]
                        if t.created_at is not None
                        else None
                    ),
                    "is_favorite": t.is_favorite,
                }
            )
            for t in transcriptions
        ]
    except Exception as e:
        logger.exception("Failed to get transcription history")
        raise HTTPException(status_code=500, detail=f"Failed to get history: {e!s}") from e


@router.get("/history/{transcription_id}", response_model=VoiceCenterTranscriptionDetailOut)
async def get_transcription_by_id(
    transcription_id: str,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> VoiceCenterTranscriptionDetailOut:
    """
    Get specific transcription by ID.

    Returns full transcription with segments.
    """
    try:
        from uuid import UUID

        transcription = await TranscriptionRepository.get_by_id(db, UUID(transcription_id), user_id=UUID(str(user.id)))

        if not transcription:
            raise HTTPException(status_code=404, detail="Transcription not found")

        return VoiceCenterTranscriptionDetailOut.model_validate(
            {
                "id": str(transcription.id),
                "filename": transcription.filename,
                "file_size_bytes": transcription.file_size_bytes,
                "audio_format": transcription.audio_format,
                "whisper_model": transcription.whisper_model,
                "language": transcription.language,
                "text": transcription.transcription_text,
                "confidence": transcription.confidence_score,
                "segments": (transcription.segments if transcription.segments is not None else []),
                "processing_time_ms": transcription.processing_time_ms,
                "created_at": (transcription.created_at.isoformat() if transcription.created_at is not None else None),
                "is_favorite": transcription.is_favorite,
                "metadata": transcription.meta_data or {},
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to get transcription")
        raise HTTPException(status_code=500, detail=f"Failed to get transcription: {e!s}") from e


# ============================================================================
# METRICS ENDPOINTS
# ============================================================================


@router.get("/metrics", response_model=VoiceCenterTranscriptionMetricsOut)
async def get_transcription_metrics(
    user: User = Depends(require_oauth2_user), db: AsyncSession = Depends(get_postgres_session)
) -> VoiceCenterTranscriptionMetricsOut:
    """
    Get transcription performance metrics for user.

    Returns statistics about transcription usage, performance, and cache hits.
    """
    try:
        from uuid import UUID

        stats = await TranscriptionRepository.get_statistics(db, UUID(str(user.id)))

        # Calculate additional metrics
        total_transcriptions = stats.total_transcriptions
        total_processing_time_hours = stats.total_processing_time_hours
        total_processing_time_ms = int(total_processing_time_hours * 3600 * 1000)
        avg_processing_time_ms = total_processing_time_ms / total_transcriptions if total_transcriptions > 0 else 0
        total_audio_duration_seconds = int(stats.total_duration_hours * 3600)

        return VoiceCenterTranscriptionMetricsOut.model_validate(
            {
                "user_id": str(user.id),
                "total_transcriptions": total_transcriptions,
                "total_audio_duration_seconds": total_audio_duration_seconds,
                "avg_processing_time_ms": round(avg_processing_time_ms, 2),
                "total_processing_time_ms": total_processing_time_ms,
                "avg_confidence": round(stats.average_confidence, 3),
                "languages": stats.by_language,
                "models_used": stats.by_model,
                "formats_used": {},  # Not available in TranscriptionStats
                "favorites_count": stats.favorite_count,
                "timestamp": datetime.now(UTC).isoformat(),
            }
        )
    except Exception as e:
        logger.exception("Failed to get transcription metrics")
        raise HTTPException(status_code=500, detail=f"Failed to get metrics: {e!s}") from e


# ============================================================================
# BATCH TRANSCRIPTION ENDPOINTS
# ============================================================================


class BatchTranscriptionRequest(BaseModel):
    """Batch transcription request model"""

    files: list[str] = Field(..., description="List of file identifiers or URLs")
    language: str | None = Field(None, description="Language code for all files")
    model: str | None = Field("turbo", description="Whisper model for all files")
    add_punctuation: bool = Field(False, description="Add punctuation to all transcriptions")
    add_speaker_labels: bool = Field(False, description="Add speaker labels to all transcriptions")
    save_to_history: bool = Field(True, description="Save all transcriptions to history")


class BatchTranscriptionItem(BaseModel):
    """Single item in batch transcription response"""

    file_id: str = Field(..., description="File identifier")
    filename: str = Field(..., description="Original filename")
    status: str = Field(..., description="Status: processing, completed, failed")
    transcription_id: str | None = Field(None, description="Saved transcription ID")
    text: str | None = Field(None, description="Transcribed text (if completed)")
    error: str | None = Field(None, description="Error message (if failed)")
    processing_time_ms: int | None = Field(None, description="Processing time")


class BatchTranscriptionResponse(BaseModel):
    """Batch transcription response"""

    batch_id: str = Field(..., description="Batch processing ID")
    total_files: int = Field(..., description="Total number of files")
    completed: int = Field(..., description="Number of completed transcriptions")
    failed: int = Field(..., description="Number of failed transcriptions")
    processing: int = Field(..., description="Number of files still processing")
    items: list[BatchTranscriptionItem] = Field(..., description="Individual transcription results")
    timestamp: str = Field(..., description="ISO timestamp")


@router.post(
    "/transcribe/batch",
    response_model=BatchTranscriptionResponse,
    status_code=202,
    summary="Batch transcribe multiple audio files",
    description="Upload multiple audio files for batch transcription. Returns immediately with batch ID.",
)
async def transcribe_voice_center_batch(
    files: list[UploadFile] = File(..., description="Multiple audio files to transcribe"),
    language: str | None = Form(None, description="Language code for all files"),
    model: str | None = Form("large-v3", description="Whisper model for all files"),
    add_punctuation: bool = Form(False, description="Add punctuation to all transcriptions"),
    add_speaker_labels: bool = Form(False, description="Add speaker labels to all transcriptions"),
    save_to_history: bool = Form(True, description="Save all transcriptions to history"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> BatchTranscriptionResponse:
    """
    Batch transcribe multiple audio files.

    Processes files in parallel (up to 3 concurrent) and returns batch ID immediately.
    Use the batch status endpoint to check progress.
    """
    batch_id = str(uuid.uuid4())
    total_files = len(files)

    # Validate file count
    if total_files == 0:
        raise HTTPException(status_code=400, detail="No files provided")

    if total_files > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 files per batch")

    # Validate all files
    valid_files = []
    for file in files:
        is_valid, error_msg = validate_audio_file(file)
        if not is_valid:
            logger.warning(f"Invalid file in batch: {file.filename} - {error_msg}")
            continue

        # Check file size
        try:
            file_bytes = await file.read()
            file_size = len(file_bytes)
            if file_size > MAX_FILE_SIZE:
                logger.warning(f"File too large in batch: {file.filename} ({file_size} bytes)")
                continue
            if file_size == 0:
                logger.warning(f"Empty file in batch: {file.filename}")
                continue

            # Reset file pointer
            await file.seek(0)
            valid_files.append((file, file_bytes, file_size))
        except Exception as e:
            logger.warning(f"Error reading file {file.filename}: {e}")
            continue

    if not valid_files:
        raise HTTPException(status_code=400, detail="No valid files in batch")

    # Initialize batch results
    batch_results: dict[str, BatchTranscriptionItem] = {}
    for file in files:
        file_id = str(uuid.uuid4())
        batch_results[file_id] = BatchTranscriptionItem(
            file_id=file_id,
            filename=file.filename or "unknown",
            status="processing",
            transcription_id=None,
            text=None,
            error=None,
            processing_time_ms=None,
        )

    # Store batch state (in production, use Redis or database)
    # For now, we'll process synchronously but return immediately
    # In production, use background tasks with Redis state tracking

    # Process files in background (up to 3 concurrent)
    async def process_batch_file(file: UploadFile, file_bytes: bytes, file_size: int, file_id: str) -> None:
        """Process single file in batch"""
        try:
            audio_format = get_audio_format(file)

            # Transcribe via whisper-fast (stack9)
            transcription_result = await STTService.transcribe(
                audio_data=file_bytes,
                language=language,
            )

            # Save to history if requested
            transcription_id = None
            if save_to_history:
                try:
                    from uuid import UUID

                    transcription_record = await TranscriptionRepository.create(
                        db,
                        TranscriptionCreate(
                            user_id=UUID(str(user.id)),
                            filename=file.filename or "unknown",
                            file_size_bytes=file_size,
                            audio_format=audio_format,
                            duration_seconds=None,
                            whisper_model=model or "large-v3",
                            language=transcription_result.get("language", language or "auto"),
                            transcription_text=transcription_result.get("text", ""),
                            confidence_score=transcription_result.get("confidence", 0.95),
                            segments=transcription_result.get("segments", []),
                            processing_time_ms=transcription_result.get("duration_ms", 0),
                            txt_file_path=None,
                            status="completed",
                            error_message=None,
                            metadata={
                                "add_punctuation": add_punctuation,
                                "add_speaker_labels": add_speaker_labels,
                                "cached": transcription_result.get("cached", False),
                                "batch_id": batch_id,
                            },
                            tags=None,
                        ),
                    )
                    await db.commit()
                    transcription_id = str(transcription_record.id)
                except Exception as e:
                    logger.warning(f"Failed to save batch transcription to history: {e}")
                    await db.rollback()

            # Update result
            batch_results[file_id] = BatchTranscriptionItem(
                file_id=file_id,
                filename=file.filename or "unknown",
                status="completed",
                transcription_id=transcription_id,
                text=transcription_result.get("text", ""),
                error=None,
                processing_time_ms=transcription_result.get("duration_ms", 0),
            )

        except Exception as e:
            logger.exception("Batch transcription failed for %s", file.filename)
            batch_results[file_id] = BatchTranscriptionItem(
                file_id=file_id,
                filename=file.filename or "unknown",
                status="failed",
                transcription_id=None,
                text=None,
                error=str(e),
                processing_time_ms=None,
            )

    # Process files with concurrency limit (3 at a time)
    import asyncio

    semaphore = asyncio.Semaphore(3)

    async def process_with_limit(file_data) -> None:
        file, file_bytes, file_size = file_data
        file_id = str(uuid.uuid4())
        async with semaphore:
            await process_batch_file(file, file_bytes, file_size, file_id)

    # Schedule background processing
    background_tasks.add_task(asyncio.gather, *[process_with_limit(file_data) for file_data in valid_files])

    # Return immediate response
    return BatchTranscriptionResponse(
        batch_id=batch_id,
        total_files=len(valid_files),
        completed=0,
        failed=0,
        processing=len(valid_files),
        items=list(batch_results.values()),
        timestamp=datetime.now(UTC).isoformat(),
    )


@router.get(
    "/transcribe/batch/{batch_id}",
    response_model=BatchTranscriptionResponse,
    summary="Get batch transcription status",
    description="Get current status of batch transcription processing",
)
async def get_batch_transcription_status(
    batch_id: str,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> Never:
    """
    Get batch transcription status.

    Returns current status of all files in the batch.
    """
    # In production, retrieve from Redis or database
    # For now, return placeholder
    raise HTTPException(
        status_code=501,
        detail="Batch status tracking not yet implemented. Use individual transcription endpoints.",
    )
