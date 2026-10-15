"""
Faster-Whisper FastAPI Server - STT для русского языка
Модель: large-v3 (MIT лицензия)
"""

import logging
import os

import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from whisper_service import FasterWhisperService

# Настройка логирования
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"), format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Инициализация FastAPI
app = FastAPI(
    title="Faster-Whisper STT Service",
    description="Сервис транскрибации речи на русском языке (faster-whisper large-v3)",
    version="1.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Инициализация сервиса
whisper_service = FasterWhisperService()

# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================


class TranscriptionResponse(BaseModel):
    """Ответ с результатами транскрибации"""

    text: str
    language: str
    language_probability: float
    duration: float
    duration_after_vad: float | None = None
    segments: list[dict]


class HealthResponse(BaseModel):
    """Ответ healthcheck"""

    status: str
    service: str
    model_size: str
    language: str
    device: str
    model_loaded: bool


# ============================================================================
# API ENDPOINTS
# ============================================================================


@app.get("/health", response_model=HealthResponse)
async def health():
    """Healthcheck endpoint"""
    return HealthResponse(
        status="healthy",
        service="faster-whisper-stt",
        model_size=whisper_service.model_size,
        language=whisper_service.language,
        device=whisper_service.device,
        model_loaded=whisper_service.model is not None,
    )


@app.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe(
    file: UploadFile = File(..., description="Аудио файл для транскрибации"),
    language: str | None = Form(None, description="Язык (по умолчанию русский)"),
    beam_size: int = Form(5, description="Размер beam search"),
    vad_filter: bool = Form(True, description="Использовать VAD фильтрацию"),
):
    """
    Транскрибирует аудио файл в текст

    Поддерживаемые форматы: WAV, MP3, FLAC, OGG, M4A
    Язык по умолчанию: русский (ru)
    """
    try:
        # Читаем файл
        audio_data = await file.read()

        if not audio_data:
            raise HTTPException(status_code=400, detail="Пустой файл")

        # Транскрибируем
        result = whisper_service.transcribe(
            audio_data=audio_data,
            language=language,
            beam_size=beam_size,
            vad_filter=vad_filter,
        )

        return TranscriptionResponse(**result)

    except Exception as e:
        logger.error(f"Ошибка транскрибации: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Ошибка транскрибации: {str(e)}") from e


@app.on_event("startup")
async def startup_event():
    """Загружаем модель при старте"""
    logger.info("Запуск Faster-Whisper STT сервиса...")
    try:
        whisper_service.load_model()
        logger.info("✅ Сервис готов к работе")
    except Exception as e:
        logger.error(f"❌ Ошибка инициализации: {e}", exc_info=True)
        raise


if __name__ == "__main__":
    port = int(os.getenv("API_PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
