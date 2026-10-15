# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Pydantic contracts for the separate MusicForge backend-first song generation app.
# Invariants:
# - Public create requests expose only creative intent (+ optional mode_key), never raw ACE/Comfy controls.
# - Run/step responses are backend-owned snapshots used by the thin desktop UI.
# Related:
# - api/routers/music_forge.py
# - api/services/music_forge/pipeline.py
# ---
"""Pydantic contracts for MusicForge."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, RootModel, field_validator

MusicForgeLanguage = Literal["auto", "ru", "en"]
MusicForgeResolvedLanguage = Literal["ru", "en"]
MusicForgeRunStatus = Literal["queued", "running", "completed", "failed", "cancelled"]
MusicForgeStepStatus = Literal["pending", "running", "completed", "failed", "cancelled", "skipped"]
MusicForgeFeedbackRating = Literal["like", "dislike"]


class MusicForgeRunCreate(BaseModel):
    """Create one quality-first MusicForge MVP run."""

    idea: str = Field(..., min_length=3, max_length=280)
    language: MusicForgeLanguage = Field(default="auto")
    style_hint: str | None = Field(default=None, max_length=220)
    constraints: str | None = Field(default=None, max_length=1200)
    duration_seconds: int = Field(default=220, ge=60, le=240)
    mode_key: str | None = Field(default=None, max_length=64)
    idempotency_key: str | None = Field(default=None, max_length=220)

    @field_validator("idea", "style_hint", "constraints", "idempotency_key", "mode_key", mode="before")
    @classmethod
    def _strip_text(cls, value: object) -> object:
        if value is None:
            return None
        if isinstance(value, str):
            return value.strip() or None
        return value


class MusicForgeRunCreateOut(BaseModel):
    run_id: UUID
    status: MusicForgeRunStatus


class MusicForgeLyricsRewriteOut(BaseModel):
    """New run seeded from a completed run; lyrics draft → audio only."""

    run_id: UUID
    status: MusicForgeRunStatus
    source_run_id: UUID


class MusicForgeStepOut(BaseModel):
    id: UUID | None = None
    step_index: int
    step_kind: str
    title: str
    status: MusicForgeStepStatus
    input_payload: dict[str, Any] = Field(default_factory=dict)
    output_payload: dict[str, Any] = Field(default_factory=dict)
    error_payload: dict[str, Any] = Field(default_factory=dict)
    started_at: datetime | None = None
    completed_at: datetime | None = None
    duration_ms: int | None = None


class MusicForgeRunOut(BaseModel):
    id: UUID
    status: MusicForgeRunStatus
    idea: str
    language: MusicForgeResolvedLanguage
    style_hint: str | None = None
    constraints: str | None = None
    duration_seconds: int
    progress_current: int
    progress_total: int
    normalized_input: dict[str, Any] = Field(default_factory=dict)
    song_blueprint: dict[str, Any] = Field(default_factory=dict)
    lyrics_payload: dict[str, Any] = Field(default_factory=dict)
    style_capsule: dict[str, Any] = Field(default_factory=dict)
    render_payload: dict[str, Any] = Field(default_factory=dict)
    result_payload: dict[str, Any] = Field(default_factory=dict)
    error_payload: dict[str, Any] = Field(default_factory=dict)
    content_id: UUID | None = None
    ugs_request_id: UUID | None = None
    config_revision_id: UUID | None = None
    config_version: str | None = None
    config_generation: int | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    cancelled_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    steps: list[MusicForgeStepOut] = Field(default_factory=list)


class MusicForgeFeedbackIn(BaseModel):
    rating: MusicForgeFeedbackRating
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


class MusicForgeFeedbackOut(BaseModel):
    ok: bool = True
    rating: MusicForgeFeedbackRating


class MusicForgeModeCapability(BaseModel):
    """Public Mode option for the thin client picker (Wave D)."""

    mode_key: str
    label_ru: str
    label_en: str
    is_default: bool = False
    lane_key: str


class MusicForgeLanguageOption(BaseModel):
    """Public language picker row (stable keys; not an open dict)."""

    value: MusicForgeLanguage
    label_ru: str


class MusicForgeCapabilitiesOut(BaseModel):
    default_language: MusicForgeLanguage = "auto"
    languages: list[MusicForgeLanguageOption] = Field(
        default_factory=lambda: [
            MusicForgeLanguageOption(value="auto", label_ru="Авто"),
            MusicForgeLanguageOption(value="ru", label_ru="Русский"),
            MusicForgeLanguageOption(value="en", label_ru="English"),
        ]
    )
    duration_seconds_default: int = 220
    duration_seconds_min: int = 60
    duration_seconds_max: int = 240
    mvp_lane: str = "SFT XL (default) | BASE XL | TURBO XL"
    frontend_role: Literal["thin_client"] = "thin_client"
    config_version: str | None = None
    modes: list[MusicForgeModeCapability] = Field(default_factory=list)
    default_mode_key: str | None = None
    taste_profile_like_count: int = Field(
        default=0,
        ge=0,
        description="Authenticated user's Forge like count for honest taste UI (0 when anonymous).",
    )
    taste_profile_dislike_count: int = Field(
        default=0,
        ge=0,
        description="Authenticated user's Forge dislike count for honest taste UI (0 when anonymous).",
    )


class MusicForgeRunEventsErrorOut(BaseModel):
    """SSE snapshot when ``fetch_run`` fails mid-stream (HTTPException detail)."""

    error: Any
    status_code: int | None = None


class MusicForgeRunEventsSsePayloadDoc(RootModel[MusicForgeRunOut | MusicForgeRunEventsErrorOut]):
    """SSE ``snapshot`` ``data:`` JSON for ``GET /music-forge/runs/{id}/events``."""
