"""POST /music-generator/suggest-production-params — подсказка вокала/BPM/длительности для мастера «Основной»."""

from __future__ import annotations

from typing import Literal

from api.routers.music_generator_constants import MAX_EWA_COMPANION_CONTEXT_CHARS
from pydantic import BaseModel, Field


class SuggestProductionParamsRequest(BaseModel):
    lyrics: str = Field(min_length=1, max_length=8000)
    style: str = Field(default="pop", max_length=64)
    ewa_companion_context: str | None = Field(default=None, max_length=MAX_EWA_COMPANION_CONTEXT_CHARS)
    temperature: float | None = Field(default=None, ge=0.0, le=1.0)
    cfg_scale: float | None = Field(default=None, ge=1.0, le=4.0)
    top_p: float | None = Field(default=None, ge=0.8, le=0.98)


class SuggestProductionParamsResponse(BaseModel):
    vocal: Literal["male", "female", "duet"]
    bpm: int = Field(ge=40, le=300)
    duration_seconds: int = Field(ge=30, le=300)
    language: str = Field(default="ru", max_length=16)
    timesignature: Literal["3", "4", "6"] = "4"
    keyscale: str = Field(default="C major", max_length=32)
