# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# FastAPI entry for stack9 Silero TTS (MIT v5_cis_base_nostress on CUDA).
# Invariants:
# - /synthesize accepts CIS ru_* voices; legacy xenia/aidar/… mapped in SileroTTSService.
# Related:
# - docker/builders/stack9-silero/silero_service.py
# ---

"""Silero TTS Service - FastAPI server for Russian speech synthesis (MIT CIS)."""

from __future__ import annotations

import base64
import logging
import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from silero_service import SileroTTSService  # type: ignore[import-untyped]

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Silero TTS Service",
    description="Silero TTS MIT v5_cis_base_nostress (GPU)",
    version="5.cis.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

silero_service = SileroTTSService()


class SynthesizeRequest(BaseModel):
    text: str
    voice: str | None = "ru_ekaterina"
    speed: float | None = 1.0
    sample_rate: int | None = 48000
    language: str | None = "ru"


class SynthesizeResponse(BaseModel):
    audio_base64: str
    duration_ms: int
    sample_rate: int
    voice: str


@app.on_event("startup")
async def preload_model() -> None:
    """Warm RU model so first /synthesize is not cold."""
    try:
        await silero_service._load_model()  # noqa: SLF001
        logger.info("Silero model preloaded at startup")
    except Exception:
        logger.exception("Silero preload at startup failed; will retry on first request")


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "silero-tts",
        "model_id": silero_service.get_model_id(),
        "device": silero_service.get_device(),
        "model_loaded": silero_service.is_model_loaded(),
        "available_voices": list(silero_service.get_available_voices().keys()),
    }


@app.post("/synthesize", response_model=SynthesizeResponse)
async def synthesize(request: SynthesizeRequest):
    try:
        if not request.text or len(request.text.strip()) == 0:
            raise HTTPException(status_code=400, detail="Empty text")

        voice = (request.voice or "ru_ekaterina").strip() or "ru_ekaterina"
        speed = request.speed if request.speed is not None else 1.0
        sample_rate = request.sample_rate if request.sample_rate is not None else 48000
        lang = (request.language or "ru").strip().lower()

        audio_data = await silero_service.synthesize(
            text=request.text,
            voice=voice,
            speed=speed,
            sample_rate=sample_rate,
            language=lang,
        )
        audio_base64 = base64.b64encode(audio_data).decode("utf-8")
        duration_ms = int(len(audio_data) / (sample_rate / 1000) / 2)
        return SynthesizeResponse(
            audio_base64=audio_base64,
            duration_ms=duration_ms,
            sample_rate=sample_rate,
            voice=voice,
        )
    except ValueError as e:
        logger.warning("Validation error: %s", e)
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.error("Synthesis error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.get("/voices")
async def get_voices():
    return {"available_voices": silero_service.get_available_voices()}


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("API_HOST", "0.0.0.0")
    port = int(os.getenv("API_PORT", "8000"))
    uvicorn.run(app, host=host, port=port)
