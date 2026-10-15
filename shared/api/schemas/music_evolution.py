# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Pydantic contracts for the Music Evolution backend-first XL Base desktop app.
# Invariants:
# - Public requests expose only creative slots; no Turbo/V3/DiffRhythm/raw sampler controls.
# - `meaning_tags`, `mood`, `vocal`, and `language` must survive normalization into the backend pipeline.
# Related:
# - api/routers/music_evolution.py
# - api/services/music_evolution_pipeline.py
# ---
"""Pydantic contracts for Music Evolution."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

MusicEvolutionVocal = Literal["auto", "female", "male", "duet"]
MusicEvolutionLanguage = Literal["ru", "en"]
MusicEvolutionMood = Literal["warm", "sad", "energetic", "dark", "ironic", "romantic", "epic", "calm", "custom"]
MusicEvolutionMeaningTag = Literal[
    "love",
    "life",
    "road",
    "family",
    "victory",
    "loss",
    "city",
    "work",
    "friendship",
    "irony",
    "faith",
    "custom",
]
MusicEvolutionRunStatus = Literal["queued", "running", "completed", "failed", "cancelled"]
MusicEvolutionStepStatus = Literal["pending", "running", "completed", "failed", "cancelled", "skipped"]
MusicEvolutionFeedbackRating = Literal["like", "dislike"]


class MusicEvolutionRunCreate(BaseModel):
    """Create one backend-first XL Base run."""

    theme: str = Field(..., min_length=3, max_length=240)
    soloist: str = Field(default="ray", min_length=1, max_length=40)
    vocal: MusicEvolutionVocal = "auto"
    genre: str = Field(default="pop", min_length=1, max_length=80)
    language: MusicEvolutionLanguage = "ru"
    mood: MusicEvolutionMood = "warm"
    meaning_tags: list[MusicEvolutionMeaningTag] = Field(default_factory=lambda: ["life"], max_length=8)
    extra_context: str | None = Field(default=None, max_length=1000)
    duration_seconds: int = Field(default=195, ge=30, le=300)
    idempotency_key: str | None = Field(default=None, max_length=220)

    @field_validator("theme", "genre", "extra_context", "idempotency_key", "soloist", mode="before")
    @classmethod
    def _strip_optional_text(cls, value: object) -> object:
        if value is None:
            return None
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("meaning_tags", mode="after")
    @classmethod
    def _dedupe_meaning_tags(cls, value: list[MusicEvolutionMeaningTag]) -> list[MusicEvolutionMeaningTag]:
        out: list[MusicEvolutionMeaningTag] = []
        for item in value or []:
            if item not in out:
                out.append(item)
        return out


class MusicEvolutionRunCreateOut(BaseModel):
    run_id: UUID
    status: MusicEvolutionRunStatus


class MusicEvolutionStepOut(BaseModel):
    id: UUID | None = None
    step_index: int
    step_kind: str
    title: str
    status: MusicEvolutionStepStatus
    input_payload: dict[str, Any] = Field(default_factory=dict)
    output_payload: dict[str, Any] = Field(default_factory=dict)
    error_payload: dict[str, Any] = Field(default_factory=dict)
    started_at: datetime | None = None
    completed_at: datetime | None = None
    duration_ms: int | None = None


class MusicEvolutionRunOut(BaseModel):
    id: UUID
    status: MusicEvolutionRunStatus
    theme: str
    soloist: str | None = None
    vocal: str
    genre: str
    language: str
    mood: str
    meaning_tags: list[str] = Field(default_factory=list)
    extra_context: str | None = None
    duration_seconds: int
    progress_current: int
    progress_total: int
    normalized_input: dict[str, Any] = Field(default_factory=dict)
    corpus_snapshot: dict[str, Any] = Field(default_factory=dict)
    creative_brief: dict[str, Any] = Field(default_factory=dict)
    final_params: dict[str, Any] = Field(default_factory=dict)
    result_payload: dict[str, Any] = Field(default_factory=dict)
    error_payload: dict[str, Any] = Field(default_factory=dict)
    content_id: UUID | None = None
    ugs_request_id: UUID | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    cancelled_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    steps: list[MusicEvolutionStepOut] = Field(default_factory=list)


class MusicEvolutionFeedbackIn(BaseModel):
    rating: MusicEvolutionFeedbackRating
    reason_code: str | None = Field(None, max_length=80)
    reason_custom: str | None = Field(None, max_length=2000)

    @field_validator("reason_code", "reason_custom", mode="before")
    @classmethod
    def _strip_reason_text(cls, value: object) -> object:
        if value is None:
            return None
        if isinstance(value, str):
            return value.strip() or None
        return value


class MusicEvolutionFeedbackOut(BaseModel):
    ok: bool = True
    rating: MusicEvolutionFeedbackRating


class MusicEvolutionOption(BaseModel):
    value: str
    label_ru: str
    label_en: str


class MusicEvolutionSoloistOption(MusicEvolutionOption):
    description_ru: str
    vocal: str
    language: str
    genre: str
    genre_label_ru: str
    freeform: bool = False


class MusicEvolutionCapabilitiesOut(BaseModel):
    soloists: list[MusicEvolutionSoloistOption]
    default_soloist: str = "ray"
    vocals: list[MusicEvolutionOption]
    genres: list[MusicEvolutionOption]
    languages: list[MusicEvolutionOption]
    moods: list[MusicEvolutionOption]
    meaning_tags: list[MusicEvolutionOption]
    duration_seconds_default: int = 195
    duration_seconds_min: int = 30
    duration_seconds_max: int = 300
    ugs_workflow: Literal["golden_by_soloist"] = "golden_by_soloist"
