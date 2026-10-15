# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   Unified Voice Gateway Router (Stack9 only).
# Invariants:
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
# Related:
#   - shared/api/main.py (регистрация роутеров); см. затронутые services/models.
# ------------------------------------------------------------------------------
"""
Unified Voice Gateway Router (Stack9 only).

Canonical APIs: POST /transcribe, POST /synthesize, GET /voices, GET /health.
All voice features should migrate to this gateway.
"""

import logging
import os
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

try:
    import aiohttp
except ImportError:
    aiohttp = None  # type: ignore[assignment]
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.auth import User
from api.core.database_manager import get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.models.transcription import Transcription
from api.services import voice_gateway_service as vg
from api.services.queue_features import QUEUE_FLAG_VOICE, derive_public_job_status, is_queue_enabled
from api.services.qwen3_tts_voices import qwen3_tts_default_profile
from api.services.rabbitmq_service import get_rabbitmq_service

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/voice-gateway",
    tags=["Voice Gateway - Unified STT/TTS (Stack9)"],
)


# =============================================================================
# Schemas
# =============================================================================


class TranscribeResponse(BaseModel):
    text: str
    language: str
    duration_ms: int = 0
    confidence: float = 0
    segments: list[dict[str, Any]] = Field(default_factory=list)
    timestamp: str = ""


class AsyncTranscribeResponse(BaseModel):
    transcription_id: str
    status: str
    message: str


class AsyncTranscribeStatusResponse(BaseModel):
    transcription_id: str
    status: str
    progress: int = 0
    error: str | None = None
    result: dict[str, Any] | None = None


class SynthesizeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    voice: str | None = Field(
        default_factory=qwen3_tts_default_profile,
        description="Qwen3-TTS profile id or legacy alias",
    )
    speed: float = Field(default=1.0, ge=0.5, le=2.0)
    volume: float = Field(default=1.0, ge=0.0, le=1.0)


class SynthesizeResponse(BaseModel):
    success: bool = True
    audio_url: str = ""
    duration: float | None = None


class ProcessAudioResponse(BaseModel):
    transcription: str
    llm_response: str
    audio_url: str | None = None
    duration_ms: int
    stages: dict
    task_id: str
    timestamp: str | None = None


class MapIntentRequest(BaseModel):
    transcript: str = Field(..., min_length=1, max_length=2000)


class MapIntentResponse(BaseModel):
    command_id: str | None = None


# =============================================================================
# Endpoints
# =============================================================================


@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe(
    file: UploadFile = File(...),
    language: str | None = None,
    model: str | None = None,
    user: User = Depends(require_oauth2_user),
) -> TranscribeResponse:
    """Transcribe audio via canonical STT (whisper-fast)."""
    if not file.content_type or not file.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="Expected audio file")
    data = await file.read()
    if len(data) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file")
    if len(data) > 50 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Audio file too large (max 50MB)")
    try:
        result = await vg.transcribe_audio(data, language=language, model=model)
    except Exception as e:
        logger.exception("Voice gateway transcribe failed")
        raise HTTPException(status_code=500, detail=str(e)) from e
    return TranscribeResponse(
        text=result.get("text", ""),
        language=result.get("language", "unknown"),
        duration_ms=int(result.get("duration_ms", 0)),
        confidence=float(result.get("confidence", 0)),
        segments=result.get("segments", []),
        timestamp=result.get("timestamp", ""),
    )


@router.post("/transcribe/async", response_model=AsyncTranscribeResponse, status_code=202)
async def transcribe_async(
    file: UploadFile = File(...),
    language: str | None = None,
    model: str | None = None,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> AsyncTranscribeResponse:
    """Queue long-running transcription and return durable transcription_id immediately.

    ``model`` query is accepted for backward compatibility but ignored as a weight
    switcher — stack9 STT uses the container-loaded MODEL_SIZE. Metadata stores
    ``WHISPER_MODEL_SIZE`` / unified config.
    """
    from api.core.unified_config import unified_settings

    if not is_queue_enabled(QUEUE_FLAG_VOICE, default=True):
        raise HTTPException(status_code=409, detail="Async transcription queue is disabled")
    if not file.content_type or not file.content_type.startswith(("audio/", "video/", "application/octet-stream")):
        raise HTTPException(status_code=400, detail="Expected audio or video file")

    data = await file.read()
    if len(data) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file")
    if len(data) > 100 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Audio file too large (max 100MB)")

    loaded_model = (unified_settings.whisper_model_size or "large-v3").strip() or "large-v3"
    if model and model.strip() and model.strip() != loaded_model:
        logger.info(
            "[STEP] voice_gateway_async_model_ignored requested=%s loaded=%s",
            model.strip(),
            loaded_model,
        )

    transcription_id = uuid.uuid4()
    base_path = (os.environ.get("GENERATED_FILES_BASE") or "/app").strip()
    safe_name = (file.filename or "transcription").replace("/", "_")
    queue_dir = Path(base_path) / "generated_files" / "transcriptions_queue" / str(transcription_id)
    queue_dir.mkdir(parents=True, exist_ok=True)
    source_path = queue_dir / safe_name
    source_path.write_bytes(data)

    transcription = Transcription(
        id=transcription_id,
        user_id=user.id,
        filename=file.filename or "unknown",
        file_size_bytes=len(data),
        audio_format=(Path(file.filename or "audio.bin").suffix.lstrip(".").lower() or "bin"),
        whisper_model=loaded_model,
        language=language,
        transcription_text="",
        confidence_score=0.0,
        segments=[],
        processing_time_ms=None,
        txt_file_path=None,
        status="processing",
        error_message=None,
        meta_data={
            "queue_status": "queued",
            "source_file_path": str(source_path),
            "source_content_type": file.content_type,
            "stt_model_source": "server_loaded",
        },
    )
    db.add(transcription)
    await db.commit()

    published = await get_rabbitmq_service().publish_document_processing(
        task_type="voice_transcription",
        payload={
            "task_type": "voice_transcription",
            "transcription_id": str(transcription_id),
            "language": language,
            "model": loaded_model,
        },
    )
    if not published:
        raise HTTPException(status_code=503, detail="Queue is unavailable for async transcription")

    return AsyncTranscribeResponse(
        transcription_id=str(transcription_id),
        status="queued",
        message="Transcription queued successfully",
    )


@router.get("/transcribe/status/{transcription_id}", response_model=AsyncTranscribeStatusResponse)
async def transcribe_async_status(
    transcription_id: str,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> AsyncTranscribeStatusResponse:
    try:
        transcription_uuid = uuid.UUID(transcription_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid transcription_id") from exc

    transcription = await db.get(Transcription, transcription_uuid)
    if transcription is None or str(transcription.user_id) != str(user.id):
        raise HTTPException(status_code=404, detail="Transcription not found")

    public_status = derive_public_job_status(transcription.status, transcription.meta_data)
    result = None
    if public_status == "completed":
        result = {
            "text": transcription.transcription_text,
            "language": transcription.language,
            "confidence": transcription.confidence_score,
            "segments": transcription.segments or [],
            "duration_ms": transcription.processing_time_ms or 0,
            "timestamp": (transcription.completed_at or transcription.updated_at).isoformat(),
        }

    return AsyncTranscribeStatusResponse(
        transcription_id=transcription_id,
        status=public_status,
        progress=100 if public_status == "completed" else (50 if public_status == "processing" else 0),
        error=transcription.error_message,
        result=result,
    )


@router.post("/synthesize", response_model=SynthesizeResponse)
async def synthesize(
    body: SynthesizeRequest,
    user: User = Depends(require_oauth2_user),
) -> SynthesizeResponse:
    """Synthesize speech via canonical TTS (silero). Returns base64 data URL in audio_url."""
    import base64

    try:
        audio_bytes = await vg.synthesize_speech(
            body.text,
            voice=body.voice,
            speed=body.speed,
            volume=body.volume,
        )
    except Exception as e:
        logger.exception("Voice gateway synthesize failed")
        raise HTTPException(status_code=500, detail=str(e)) from e
    b64 = base64.b64encode(audio_bytes).decode("ascii")
    audio_url = f"data:audio/wav;base64,{b64}"
    return SynthesizeResponse(success=True, audio_url=audio_url, duration=None)


@router.get("/voices")
async def voices(user: User = Depends(require_oauth2_user)) -> list[dict[str, Any]]:
    """List available TTS voices (silero only for MVP)."""
    return await vg.get_available_voices()


@router.post("/process", response_model=ProcessAudioResponse)
async def process_audio(
    file: UploadFile = File(...),
    tts_voice: str | None = Form(None),
    language: str | None = Form(None),
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> ProcessAudioResponse:
    """Full pipeline: audio -> transcribe -> LLM -> TTS. Reuses live voice pipeline.

    Merges DB live-voice settings with optional Form overrides (``tts_voice``, ``language``).
    """
    from api.services.live_voice_settings_service import LiveVoiceSettingsService

    if not file.content_type or not file.content_type.startswith(("audio/", "application/octet-stream")):
        raise HTTPException(status_code=400, detail="Expected audio file")
    data = await file.read()
    if len(data) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file")
    if len(data) > 50 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Audio file too large (max 50MB)")

    persisted = await LiveVoiceSettingsService.get_settings(str(user.id), db)
    overrides: dict[str, Any] = {}
    if tts_voice is not None and str(tts_voice).strip():
        overrides["tts_voice"] = str(tts_voice).strip()
    if language is not None and str(language).strip():
        overrides["language"] = str(language).strip()
    settings = {**persisted, **overrides}

    try:
        result = await vg.process_audio_session(user_id=str(user.id), audio_data=data, settings=settings, db_session=db)
    except ValueError as e:
        # Пустая транскрипция, ошибка LLM и т.п. — сообщение показываем пользователю
        logger.warning("Voice gateway process validation error: %s", e)
        raise HTTPException(status_code=400, detail=str(e)) from e
    except (ConnectionError, TimeoutError, OSError) as e:
        # STT/LLM сервис недоступен или таймаут
        logger.warning("Voice gateway process connectivity error: %s", e)
        raise HTTPException(
            status_code=503,
            detail="Сервис распознавания или ответа временно недоступен. Попробуйте позже.",
        ) from e
    except Exception as e:
        if aiohttp and isinstance(e, aiohttp.ClientError):
            logger.warning("Voice gateway process HTTP/connection error: %s", e)
            raise HTTPException(
                status_code=503,
                detail="Сервис распознавания или ответа временно недоступен. Попробуйте позже.",
            ) from e
        logger.exception("Voice gateway process failed")
        msg = (str(e) or "Ошибка обработки голоса.")[:500]
        raise HTTPException(status_code=500, detail=msg) from e
    return ProcessAudioResponse(
        transcription=result.get("transcription", ""),
        llm_response=result.get("ai_response", ""),
        audio_url=result.get("audio_url"),
        duration_ms=int(result.get("duration_ms", 0)),
        stages=result.get("stages", {}),
        task_id=result.get("task_id", ""),
        timestamp=result.get("timestamp"),
    )


@router.post("/map-intent", response_model=MapIntentResponse)
async def map_intent(
    body: MapIntentRequest,
    user: User = Depends(require_oauth2_user),
) -> MapIntentResponse:
    """Bounded LLM fallback: map transcript to a known command ID only (no free execution)."""
    try:
        command_id = await vg.map_transcript_to_intent(body.transcript)
        return MapIntentResponse(command_id=command_id)
    except Exception as e:
        logger.warning("Voice map-intent failed: %s", e)
        return MapIntentResponse(command_id=None)


@router.get("/health")
async def health() -> dict[str, Any]:
    """Gateway health (STT + TTS). No auth required for health."""
    return await vg.check_health()
