# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   Live Voice Router - API endpoints для Live Voice Widget
# Invariants:
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
# Related:
#   - shared/api/main.py (регистрация роутеров); см. затронутые services/models.
# ------------------------------------------------------------------------------
"""
Live Voice Router - API endpoints для Live Voice Widget

Endpoints для голосового взаимодействия с AI  # noqa: RUF002 - Russian text in docstring
"""

import logging
from typing import Any

from fastapi import (  # type: ignore[import-untyped]
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
)
from pydantic import BaseModel, Field, field_validator  # type: ignore[import-untyped]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.core.auth import User
from api.core.database_manager import get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.services.live_voice import LiveVoiceService
from api.services.live_voice_settings_service import (
    DEFAULT_ENABLE_ARLEKINA,
    LiveVoiceSettingsService,
    validate_and_normalize_settings_row,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/live-voice", tags=["Live Voice - Голосовое общение с AI"])


def _normalize_enable_arlekina_input(value: Any) -> bool:
    """Coerce enable_arlekina using the same rules as LiveVoiceSettingsService row validation."""
    base = LiveVoiceSettingsService.get_default_settings()
    return validate_and_normalize_settings_row({**base, "enable_arlekina": value})["enable_arlekina"]


def _parse_enable_arlekina_form(raw: str | bool | None) -> bool | None:
    """Multipart form value: omit or blank means no override; otherwise normalize to bool."""
    if raw is None:
        return None
    if isinstance(raw, str) and raw.strip() == "":
        return None
    return _normalize_enable_arlekina_input(raw)


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================


class StartSessionRequest(BaseModel):
    settings: dict | None = Field(None, description="Настройки обработки")


class ProcessAudioRequest(BaseModel):
    audio_base64: str = Field(..., description="Аудио в base64")
    settings: dict | None = Field(None, description="Настройки обработки")


class ProcessAudioFileRequest(BaseModel):
    session_id: str = Field(..., description="ID сессии")
    language: str | None = Field(None, description="Язык для транскрибации")
    whisper_model: str | None = Field(None, description="Модель Whisper")
    llama_model: str | None = Field(None, description="Модель Llama")
    tts_voice: str | None = Field(None, description="Голос TTS")
    kokoro_voice: str | None = Field(None, description="Legacy alias for tts_voice")


class ProcessAudioResponse(BaseModel):
    success: bool
    task_id: str
    message: str


class ProcessAudioFullResponse(BaseModel):
    transcription: str
    llm_response: str
    audio_url: str | None = None  # None when TTS unavailable (e.g. Silero down)
    duration_ms: int
    stages: dict
    task_id: str
    timestamp: str | None = None


class TaskStatusResponse(BaseModel):
    task_id: str
    status: str
    stage: str
    progress: int
    transcription: str | None = None
    ai_response: str | None = None
    audio_url: str | None = None
    error: str | None = None


class ConversationItem(BaseModel):
    id: str
    task_id: str
    user_text: str
    ai_response: str
    audio_user_url: str | None = None
    audio_ai_url: str | None = None
    duration_ms: int
    created_at: str


class HistoryResponse(BaseModel):
    conversations: list[ConversationItem]
    total: int


class LiveVoiceSettingsRequest(BaseModel):
    llama_model: str | None = None
    whisper_model: str | None = None
    tts_voice: str | None = None
    tts_speed: float | None = None
    tts_volume: float | None = None
    language: str | None = None
    enable_arlekina: bool | None = Field(
        default=None,
        description=(
            "Use the Arlekina persona system prompt for Live Voice (same family as chat arly mode); "
            "false selects a neutral female assistant prompt. "
            "Omit to leave the stored value unchanged. "
            f"Boolean strings and 1/0 are accepted (canonical default for new rows: {DEFAULT_ENABLE_ARLEKINA})."
        ),
    )
    additional_settings: dict | None = None

    @field_validator("enable_arlekina", mode="before")
    @classmethod
    def _coerce_enable_arlekina_json(cls, value: Any) -> bool | None:
        if value is None:
            return None
        return _normalize_enable_arlekina_input(value)


class LiveVoiceSettingsResponse(BaseModel):
    llama_model: str
    whisper_model: str
    tts_voice: str
    tts_speed: float
    tts_volume: float
    language: str
    enable_arlekina: bool = Field(
        description=(
            "Whether the Arlekina persona prompt is used for Live Voice LLM turns "
            f"(storage default when null: {DEFAULT_ENABLE_ARLEKINA}; merged dicts resolve via "
            "live_voice_settings_service.resolve_enable_arlekina)."
        ),
    )
    additional_settings: dict


# ============================================================================
# DEPENDENCIES
# ============================================================================


async def get_live_voice_service(
    db: AsyncSession = Depends(get_postgres_session),
) -> LiveVoiceService:
    """Получить экземпляр LiveVoiceService"""
    return LiveVoiceService(db)


# ============================================================================
# SETTINGS ENDPOINTS
# ============================================================================


@router.get("/settings", response_model=LiveVoiceSettingsResponse)
async def get_settings(
    user: User = Depends(require_oauth2_user), db: AsyncSession = Depends(get_postgres_session)
) -> LiveVoiceSettingsResponse:
    """
    Получить настройки Live Voice для текущего пользователя.

    Поле ``enable_arlekina``: при True используется системный промпт Арлекины (см. ``ARLEKINA_SYSTEM_PROMPT``
    в сервисе настроек), при False — нейтральный ассистент. Дефолт для новой строки в БД совпадает с
    ``DEFAULT_ENABLE_ARLEKINA`` в ``live_voice_settings_service``.
    """
    try:
        settings = await LiveVoiceSettingsService.get_settings(str(user.id), db)
        return LiveVoiceSettingsResponse(**settings)
    except Exception as e:
        logger.exception("Failed to get live voice settings for user %s", user.id)
        raise HTTPException(
            status_code=500,
            detail="Could not load live voice settings. Please try again later.",
        ) from e


@router.put("/settings", response_model=LiveVoiceSettingsResponse)
async def save_settings(
    request: LiveVoiceSettingsRequest,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> LiveVoiceSettingsResponse:
    """
    Сохранить настройки Live Voice для текущего пользователя (частичное обновление).

    ``enable_arlekina`` нормализуется так же, как при записи в БД через ``validate_and_normalize_settings_row``.
    """
    try:
        # Конвертируем Pydantic модель в словарь, исключая None значения
        settings_dict = request.model_dump(exclude_none=True)

        saved_settings = await LiveVoiceSettingsService.save_settings(str(user.id), settings_dict, db)

        return LiveVoiceSettingsResponse(**saved_settings)
    except Exception as e:
        logger.exception("Failed to save live voice settings for user %s", user.id)
        raise HTTPException(
            status_code=500,
            detail="Could not save live voice settings. Please try again later.",
        ) from e


# ============================================================================
# API ENDPOINTS
# ============================================================================


@router.post("/start", response_model=dict)
async def start_session(
    request: StartSessionRequest,
    user: User = Depends(require_oauth2_user),
    service: LiveVoiceService = Depends(get_live_voice_service),
) -> dict[str, Any]:
    """
    Начать сессию Live Voice

    Pre-load моделей для быстрой обработки
    """
    try:
        result = await service.start_session(user_id=str(user.id), settings=request.settings)

        if not result.get("success"):
            raise HTTPException(  # noqa: TRY301 - FastAPI standard pattern
                status_code=500, detail=result.get("error", "Failed to start session")
            )

        return result  # noqa: TRY300 - return after try is intentional

    except Exception as e:
        logger.exception("Start session failed")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/process", response_model=ProcessAudioFullResponse)
async def process_audio(
    file: UploadFile = File(..., description="Аудио файл"),
    session_id: str = Form(...),
    language: str | None = Form(None),
    whisper_model: str | None = Form(None),
    llama_model: str | None = Form(None),
    tts_voice: str | None = Form(None),
    kokoro_voice: str | None = Form(None),
    enable_arlekina: str | bool | None = Form(
        None,
        description=(
            "Optional override for this request only. Form fields are strings; accepted values match "
            "live_voice_settings_service coercion (true/false, 1/0, yes/no, on/off, да/нет). "
            "Omit or send empty to keep saved settings."
        ),
    ),
    background_tasks: BackgroundTasks = BackgroundTasks(),  # noqa: ARG001 - reserved for future use
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
    service: LiveVoiceService = Depends(get_live_voice_service),
) -> ProcessAudioFullResponse:
    """
    Обработать аудио через pipeline

    Pipeline: Audio → Whisper → Llama → TTS → Response

    Настройки: объединение сохранённых в БД с переопределениями из запроса.
    ``enable_arlekina`` в форме переопределяет сохранённое значение только для этого вызова; итог для LLM
    разрешается в пайплайне через ``resolve_enable_arlekina`` (см. ``live_voice_settings_service``).
    Принимает файл через multipart/form-data.
    """
    try:
        # Читаем файл
        audio_data = await file.read()
        audio_size = len(audio_data)

        # Валидация аудио файла
        if audio_size == 0:
            logger.warning("Empty audio file uploaded by user %s", user.id)
            raise HTTPException(status_code=400, detail="Empty audio file")  # noqa: TRY301 - FastAPI standard pattern

        if audio_size > 50 * 1024 * 1024:  # 50MB лимит
            logger.warning("Audio file too large: %s bytes from user %s", audio_size, user.id)
            raise HTTPException(  # noqa: TRY301 - FastAPI standard pattern
                status_code=413,
                detail=f"Audio file too large: {audio_size / (1024 * 1024):.1f}MB. Maximum: 50MB",
            )

        logger.info(
            "📁 Processing audio file: %s, size: %s bytes (%.1fKB) from user %s",
            file.filename,
            audio_size,
            audio_size / 1024,
            user.id,
        )

        # Merge persisted user settings with explicit request overrides
        persisted = await LiveVoiceSettingsService.get_settings(str(user.id), db)
        overrides: dict[str, Any] = {}
        if language is not None and language != "":
            overrides["language"] = language
        if whisper_model is not None and whisper_model != "":
            overrides["whisper_model"] = whisper_model
        if llama_model is not None and llama_model != "":
            overrides["llama_model"] = llama_model
        selected_tts_voice = tts_voice if tts_voice not in (None, "") else kokoro_voice
        if selected_tts_voice is not None and selected_tts_voice != "":
            overrides["tts_voice"] = selected_tts_voice
        arlekina_override = _parse_enable_arlekina_form(enable_arlekina)
        if arlekina_override is not None:
            overrides["enable_arlekina"] = arlekina_override
        settings = {**persisted, **overrides}

        # Запускаем обработку
        result = await service.process_audio(user_id=str(user.id), audio_data=audio_data, settings=settings)

        # Возвращаем полный результат
        return ProcessAudioFullResponse(
            transcription=result.get("transcription", ""),
            llm_response=result.get("ai_response", ""),
            audio_url=result.get("audio_url"),
            duration_ms=result.get("duration_ms", 0),
            stages=result.get("stages", {}),
            task_id=result.get("task_id", ""),
            timestamp=result.get("timestamp"),
        )

    except HTTPException:
        raise
    except ValueError as e:
        # Ошибки уровня пользователя (например, речь не распознана) считаем 400, а не 500
        logger.warning("Process audio validation error: %s", e)
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.exception("Process audio failed")
        raise HTTPException(status_code=500, detail=f"Ошибка обработки аудио: {e!s}") from e


@router.get("/status/{task_id}", response_model=TaskStatusResponse)
async def get_task_status(
    task_id: str,
    user: User = Depends(require_oauth2_user),
    service: LiveVoiceService = Depends(get_live_voice_service),
) -> TaskStatusResponse:
    """
    Получить статус задачи обработки
    """
    try:
        status = await service.get_task_status(task_id)

        if not status:
            raise HTTPException(status_code=404, detail="Task not found")  # noqa: TRY301 - FastAPI standard pattern

        # Проверяем что задача принадлежит пользователю
        if status.get("user_id") != str(user.id):
            raise HTTPException(status_code=403, detail="Access denied")  # noqa: TRY301 - FastAPI standard pattern

        return TaskStatusResponse(
            task_id=task_id,
            status=status.get("status", "unknown"),
            stage=status.get("stage", "idle"),
            progress=_calculate_progress(status),
            transcription=status.get("stages", {}).get("transcription", {}).get("text"),
            ai_response=status.get("stages", {}).get("llm", {}).get("text"),
            audio_url=status.get("stages", {}).get("tts", {}).get("audio_url"),
            error=status.get("error"),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Get task status failed")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/history", response_model=HistoryResponse)
async def get_history(
    limit: int = 20,
    offset: int = 0,
    user: User = Depends(require_oauth2_user),
    service: LiveVoiceService = Depends(get_live_voice_service),
) -> HistoryResponse:
    """
    Получить историю разговоров
    """
    try:
        conversations = await service.get_conversation_history(user_id=str(user.id), limit=limit, offset=offset)

        # Маппим данные: используем task_id как id если id отсутствует
        mapped_conversations = []
        for conv in conversations:
            conv_data = dict(conv)
            # Если нет id, используем task_id
            if "id" not in conv_data and "task_id" in conv_data:
                conv_data["id"] = conv_data["task_id"]
            mapped_conversations.append(ConversationItem(**conv_data))

        return HistoryResponse(
            conversations=mapped_conversations,
            total=len(mapped_conversations),
        )

    except Exception as e:
        logger.exception("Get history failed")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/history/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    user: User = Depends(require_oauth2_user),
    service: LiveVoiceService = Depends(get_live_voice_service),
) -> dict[str, Any]:
    """
    Удалить разговор из истории
    """
    try:
        deleted = await service.conversation_storage.delete_conversation(
            user_id=str(user.id), conversation_id=conversation_id
        )

        if not deleted:
            raise HTTPException(status_code=404, detail="Conversation not found")  # noqa: TRY301 - FastAPI standard pattern

        return {"success": True, "message": "Conversation deleted"}  # noqa: TRY300 - return after try is intentional

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Delete conversation failed")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/history/search", response_model=HistoryResponse)
async def search_history(
    query: str,
    limit: int = 20,
    user: User = Depends(require_oauth2_user),
    service: LiveVoiceService = Depends(get_live_voice_service),
) -> HistoryResponse:
    """
    Поиск по истории разговоров
    """
    try:
        conversations = await service.search_history(user_id=str(user.id), query=query, limit=limit)

        # Маппим данные: используем task_id как id если id отсутствует
        mapped_conversations = []
        for conv in conversations:
            conv_data = dict(conv)
            # Если нет id, используем task_id
            if "id" not in conv_data and "task_id" in conv_data:
                conv_data["id"] = conv_data["task_id"]
            mapped_conversations.append(ConversationItem(**conv_data))

        return HistoryResponse(
            conversations=mapped_conversations,
            total=len(mapped_conversations),
        )

    except Exception as e:
        logger.exception("Search history failed")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/stop")
async def stop_session(
    user: User = Depends(require_oauth2_user),
    service: LiveVoiceService = Depends(get_live_voice_service),
) -> dict[str, Any]:
    """
    Остановить сессию (unload модели)
    """
    try:
        await service.stop_session(str(user.id))

        return {"success": True, "message": "Сессия остановлена"}  # noqa: TRY300 - return after try is intentional

    except Exception as e:
        logger.exception("Stop session failed")
        raise HTTPException(status_code=500, detail=str(e)) from e


class SpeakTextRequest(BaseModel):
    text: str = Field(..., description="Текст для озвучки")
    voice: str | None = Field(None, description="Голос (auto, af_sarah, xenia, etc.)")
    language: str | None = Field(None, description="Язык (auto, en, ru)")
    speed: float = Field(1.0, description="Скорость речи (0.5-2.0)", ge=0.5, le=2.0)


@router.post("/speak-text")
async def speak_text(
    request: SpeakTextRequest,
    user: User = Depends(require_oauth2_user),
    service: LiveVoiceService = Depends(get_live_voice_service),  # noqa: ARG001
) -> dict[str, Any]:
    """
    Озвучить выделенный текст

    Быстрый синтез речи без полного pipeline
    """
    try:
        import base64

        from api.services.unified_audio_service import get_silero_service
        from api.services.voice.tts_endpoint_resolver import bind_silero_service_url

        text = request.text
        voice = request.voice
        language = request.language
        speed = request.speed

        # Определяем язык
        if language == "auto" or not language:
            if any(char in text for char in "абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ"):
                language = "ru"
            else:
                language = "en"

        # Shared Silero-compatible HTTP client; URL from generation_providers / env.
        silero_service = get_silero_service()
        await bind_silero_service_url(silero_service)
        if not voice or voice == "auto":
            voice = "xenia"

        audio_data = await silero_service.synthesize(text=text, voice=voice, speed=speed)

        # Конвертируем в base64
        audio_base64 = base64.b64encode(audio_data).decode("utf-8")
        audio_url = f"data:audio/wav;base64,{audio_base64}"

        return {  # noqa: TRY300 - return after try is intentional
            "success": True,
            "audio_url": audio_url,
            "text": text,
            "voice": voice,
            "language": language,
        }

    except Exception as e:
        logger.exception("Speak text failed")
        raise HTTPException(status_code=500, detail=str(e)) from e


class XTTSCloneRequest(BaseModel):
    """Request for XTTS voice cloning synthesis"""

    text: str = Field(..., description="Text to synthesize", min_length=1, max_length=2000)
    language: str = Field(default="ru", description="Language code (ru, en, etc.)")
    speaker_wav_base64: str = Field(..., description="Reference voice audio in base64")


class XTTSCloneResponse(BaseModel):
    """Response with synthesized audio"""

    success: bool
    audio_base64: str | None = None
    duration_ms: int | None = None
    sample_rate: int | None = None
    error: str | None = None


# XTTS disabled for MVP (stack9 silero only). Endpoint returns 410 so callers get a clear replacement.
XTTS_MVP_DISABLED_MSG = (
    "XTTS voice clone disabled for MVP (stack9 silero only). Use POST /api/v1/voice-gateway/synthesize for TTS."
)


@router.post("/tts/xtts", response_model=XTTSCloneResponse)
async def synthesize_xtts_clone(
    request: XTTSCloneRequest,
    user: User = Depends(require_oauth2_user),
) -> XTTSCloneResponse:
    """
    Synthesize speech using XTTS with voice cloning.

    **MVP:** Disabled. Stack9 uses silero only. Use /api/v1/voice-gateway/synthesize.
    """
    raise HTTPException(
        status_code=410,
        detail=XTTS_MVP_DISABLED_MSG,
    )


def _calculate_progress(status: dict[str, Any]) -> int:
    """Вычислить прогресс обработки"""
    stages = status.get("stages", {})

    if status.get("status") == "completed":
        return 100

    if status.get("status") == "failed":
        return 0

    # Подсчитываем завершенные этапы
    completed = 0
    total = 5  # recording, transcription, llm, tts, playback

    if stages.get("transcription", {}).get("completed"):
        completed += 1
    if stages.get("llm", {}).get("completed"):
        completed += 2
    if stages.get("tts", {}).get("completed"):
        completed += 1
    if stages.get("playback", {}).get("completed"):
        completed += 1

    return int((completed / total) * 100)
