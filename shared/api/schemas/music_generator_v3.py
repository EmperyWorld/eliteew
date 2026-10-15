"""Pydantic contracts for the independent Music Generator V3 flow."""

from __future__ import annotations

import math
from typing import Literal

from pydantic import BaseModel, ConfigDict, field_validator

V3Vocal = Literal["male", "female", "duet"]
V3Timesignature = Literal["2", "3", "4", "6"]
V3Mode = Literal["auto", "manual"]
V3SamplerName = Literal["euler", "er_sde", "heun", "ddim", "dpmpp_2m", "dpmpp_sde", "uni_pc"]
V3SchedulerName = Literal["simple", "linear_quadratic", "normal", "karras", "sgm_uniform", "ddim_uniform"]


def _coerce_optional_int(v: object) -> int | None:
    if v is None:
        return None
    if isinstance(v, bool):
        msg = "expected integer, got boolean"
        raise ValueError(msg)
    if isinstance(v, int):
        return v
    if isinstance(v, float):
        if not math.isfinite(v):
            msg = "invalid number"
            raise ValueError(msg)
        return int(round(v))
    if isinstance(v, str):
        t = v.strip()
        if not t:
            return None
        try:
            return int(round(float(t)))
        except ValueError as e:
            msg = "expected integer"
            raise ValueError(msg) from e
    msg = "invalid type for integer field"
    raise ValueError(msg)


class MusicGeneratorV3LyricsRequest(BaseModel):
    theme: str
    style: str = "cinematic_pop"
    language: str = "ru"
    vocal: V3Vocal = "female"
    soloist: str | None = None
    generation_mode: V3Mode = "auto"
    temperature: float | None = None
    cfg_scale: float | None = None
    top_p: float | None = None

    @field_validator("theme", mode="after")
    @classmethod
    def _trim_theme(cls, v: str) -> str:
        t = (v or "").strip()
        if not t:
            msg = "theme is required"
            raise ValueError(msg)
        return t[:160]


class MusicGeneratorV3StyleRequest(BaseModel):
    lyrics: str
    style: str = "cinematic_pop"
    vocal: V3Vocal = "female"
    soloist: str | None = None
    language: str = "ru"
    generation_mode: V3Mode = "auto"
    bpm: int | None = None
    temperature: float | None = None
    cfg_scale: float | None = None
    top_p: float | None = None

    @field_validator("bpm", mode="before")
    @classmethod
    def _validate_bpm(cls, v: object) -> int | None:
        n = _coerce_optional_int(v)
        return None if n is None else max(10, min(300, n))


class MusicGeneratorV3SuggestRequest(BaseModel):
    lyrics: str
    style: str = "cinematic_pop"
    vocal: V3Vocal = "female"
    soloist: str | None = None
    language: str = "ru"
    generation_mode: V3Mode = "auto"
    temperature: float | None = None
    cfg_scale: float | None = None
    top_p: float | None = None


class MusicGeneratorV3SuggestResponse(BaseModel):
    vocal: V3Vocal = "female"
    bpm: int = 120
    duration_seconds: int = 160
    language: str = "ru"
    timesignature: V3Timesignature = "4"
    keyscale: str = "C major"


class MusicGeneratorV3GenerateRequest(BaseModel):
    """Body for POST /api/v1/music-generator/v3/generate."""

    model_config = ConfigDict(protected_namespaces=())

    lyrics: str
    tags: str | None = None
    style: str = "cinematic_pop"
    vocal: V3Vocal = "female"
    soloist: str | None = None
    generation_mode: V3Mode = "auto"
    bpm: int | None = None
    duration_seconds: int | None = None
    language: str = "ru"
    keyscale: str = "C major"
    timesignature: V3Timesignature = "4"
    temperature: float | None = None
    cfg_scale: float | None = None
    top_p: float | None = None
    top_k: int | None = None
    min_p: float | None = None
    steps: int | None = None
    cfg: float | None = None
    sampler_name: V3SamplerName | None = None
    scheduler: V3SchedulerName | None = None
    denoise: float | None = None
    batch_size: int | None = None
    shift: float | None = None
    generate_audio_codes: bool | None = None
    generate_title: bool = True
    name: str | None = None
    skip_lyrics_validation: bool = False

    @field_validator("bpm", "duration_seconds", "top_k", "steps", "batch_size", mode="before")
    @classmethod
    def _validate_ints(cls, v: object) -> int | None:
        return _coerce_optional_int(v)

    @field_validator("bpm", mode="after")
    @classmethod
    def _clamp_bpm(cls, v: int | None) -> int | None:
        return None if v is None else max(10, min(300, v))

    @field_validator("duration_seconds", mode="after")
    @classmethod
    def _clamp_duration(cls, v: int | None) -> int | None:
        return None if v is None else max(30, min(300, v))

    @field_validator("top_k", mode="after")
    @classmethod
    def _clamp_top_k(cls, v: int | None) -> int | None:
        return None if v is None else max(0, min(100, v))

    @field_validator("steps", mode="after")
    @classmethod
    def _clamp_steps(cls, v: int | None) -> int | None:
        return None if v is None else max(1, min(100, v))

    @field_validator("batch_size", mode="after")
    @classmethod
    def _clamp_batch_size(cls, v: int | None) -> int | None:
        return None if v is None else max(1, min(16, v))

    @field_validator("top_p", mode="after")
    @classmethod
    def _clamp_top_p(cls, v: float | None) -> float | None:
        return None if v is None else max(0.0, min(2000.0, float(v)))

    @field_validator("min_p", mode="after")
    @classmethod
    def _clamp_min_p(cls, v: float | None) -> float | None:
        return None if v is None else max(0.0, min(1.0, float(v)))

    @field_validator("cfg", mode="after")
    @classmethod
    def _clamp_cfg(cls, v: float | None) -> float | None:
        return None if v is None else max(0.0, min(100.0, float(v)))

    @field_validator("denoise", mode="after")
    @classmethod
    def _clamp_denoise(cls, v: float | None) -> float | None:
        return None if v is None else max(0.0, min(1.0, float(v)))

    @field_validator("shift", mode="after")
    @classmethod
    def _clamp_shift(cls, v: float | None) -> float | None:
        return None if v is None else max(0.0, min(12.0, float(v)))
