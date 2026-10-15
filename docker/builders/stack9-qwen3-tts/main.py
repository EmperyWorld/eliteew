"""
Qwen3-TTS HTTP service — stack9.

POST /synthesize returns raw audio/wav bytes (no base64).
GET /health, GET /voices — JSON.
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from qwen3_tts_service import Qwen3TTSService

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

tts_service = Qwen3TTSService()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    logger.info("Preloading Qwen3-TTS Base model on GPU…")
    try:
        await tts_service.ensure_model_loaded()
    except Exception:
        logger.exception("Model preload failed — fix VRAM or use a smaller co-resident model")
    yield


app = FastAPI(
    title="Qwen3-TTS Service",
    description="Stack9 TTS via Qwen3-TTS Base voice clone",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SynthesizeRequest(BaseModel):
    text: str
    voice: str | None = "woman_2"
    speed: float | None = 1.0
    sample_rate: int | None = 48000
    language: str | None = "ru"


@app.get("/health")
async def health():
    loaded = tts_service.is_model_loaded()
    profiles_ok = bool(tts_service.get_available_voices())
    status = "healthy" if loaded and profiles_ok else "starting"
    return {
        "status": status,
        "service": "qwen3-tts",
        "model_loaded": loaded,
        "device": tts_service.device,
        "checkpoint": tts_service.checkpoint,
        "available_voices": list(tts_service.get_available_voices().keys()),
    }


@app.post("/synthesize")
async def synthesize(request: SynthesizeRequest):
    try:
        if not request.text or not request.text.strip():
            raise HTTPException(status_code=400, detail="Empty text")

        voice = request.voice if request.voice is not None else "woman_1"
        speed = request.speed if request.speed is not None else 1.0
        sample_rate = request.sample_rate if request.sample_rate is not None else 48000
        language = request.language if request.language is not None else "ru"

        audio_data = await tts_service.synthesize(
            text=request.text,
            voice=voice,
            speed=speed,
            sample_rate=sample_rate,
            language=language,
        )
        return Response(
            content=audio_data,
            media_type="audio/wav",
            headers={
                "X-Voice": voice,
                "X-Audio-Format": "wav",
                "Content-Disposition": 'inline; filename="synthesis.wav"',
            },
        )
    except ValueError as e:
        logger.warning("Validation error: %s", e)
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.error("Synthesis error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.get("/voices")
async def get_voices():
    return {"available_voices": tts_service.get_available_voices()}


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("API_HOST", "0.0.0.0")
    port = int(os.getenv("API_PORT", "8000"))
    uvicorn.run(app, host=host, port=port)
