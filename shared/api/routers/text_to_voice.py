# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   Text to Voice Router - API endpoints для текстового ввода с голосовым ответом
# Invariants:
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
# Related:
#   - shared/api/main.py (регистрация роутеров); см. затронутые services/models.
# ------------------------------------------------------------------------------
"""
Text to Voice Router - API endpoints для текстового ввода с голосовым ответом

Endpoints для обработки текстовых сообщений и генерации голосовых ответов
"""

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException  # type: ignore[import-untyped]
from pydantic import BaseModel, Field  # type: ignore[import-untyped]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.core.auth import User
from api.core.database_manager import get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.services import voice_gateway_service as vg

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/text-to-voice", tags=["Text to Voice - Текстовый ввод с голосовым ответом"])


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================


class ProcessTextRequest(BaseModel):
    text: str = Field(..., description="Текст пользователя", min_length=1, max_length=5000)
    llama_model: str | None = Field(None, description="Модель Llama")
    tts_voice: str | None = Field(None, description="Голос TTS (auto, xenia, baya, eugene, aidar, af_sarah, etc.)")
    language: str | None = Field(None, description="Язык (auto, ru, en)")
    speed: float = Field(1.0, description="Скорость речи (0.5-2.0)", ge=0.5, le=2.0)
    volume: float = Field(1.0, description="Громкость (0.0-1.0)", ge=0.0, le=1.0)
    temperature: float = Field(0.7, description="Температура для LLM (0.0-2.0)", ge=0.0, le=2.0)
    max_tokens: int = Field(500, description="Максимальное количество токенов", ge=50, le=2000)


class ProcessTextResponse(BaseModel):
    success: bool
    user_text: str
    ai_response: str
    audio_url: str
    audio_base64: str
    duration_ms: int
    stages: dict[str, Any]
    language: str
    voice: str


# ============================================================================
# API ENDPOINTS
# ============================================================================


@router.post("/process", response_model=ProcessTextResponse)
async def process_text(
    request: ProcessTextRequest,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> ProcessTextResponse:
    """
    Обработать текст и вернуть голосовой ответ.

    Pipeline: Text → Llama → TTS (Silero, unified voice gateway).
    """
    try:
        logger.info("💬 Processing text from user %s: %s...", user.id, request.text[:100])

        settings: dict[str, Any] = {
            "llama_model": request.llama_model,
            "tts_voice": request.tts_voice,
            "language": request.language,
            "tts_speed": request.speed,
            "speed": request.speed,
            "volume": request.volume,
            "temperature": request.temperature,
            "max_tokens": request.max_tokens,
        }
        settings = {k: v for k, v in settings.items() if v is not None}

        result = await vg.process_text_to_speech(
            user_id=str(user.id), text=request.text, settings=settings or None, db_session=db
        )

        return ProcessTextResponse(**result)

    except ValueError as e:
        logger.exception("Validation error")
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.exception("Process text failed")
        raise HTTPException(status_code=500, detail=f"Ошибка обработки текста: {e!s}") from e
