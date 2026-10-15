"""Contracts for Music Generator batch tests ("approaches")."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

MusicBatchWorkflowKey = Literal["v2", "v2_base", "v2_sft", "v3"]
MusicBatchDemoBlockType = Literal[
    "verse_chorus",
    "drop",
    "hook",
    "instrumental_motif",
    "custom_short_block",
]
MusicBatchApproachStatus = Literal[
    "draft",
    "queued",
    "running",
    "completed",
    "partial_failed",
    "failed",
    "cancelled",
]
MusicBatchGenerationStatus = Literal[
    "pending",
    "queued",
    "running",
    "succeeded",
    "failed",
    "cancelled",
    "retrying",
]

MusicBatchSampleFeedback = Literal["positive", "negative", "neutral", "tagged"]

# Единый справочник аспектов для «Меченый» (ключ → подпись в UI / capabilities).
MUSIC_BATCH_FEEDBACK_HIGHLIGHT_DEFS: tuple[tuple[str, str], ...] = (
    ("vocal", "Вокал"),
    ("transition", "Переход"),
    ("hook", "Хук"),
    ("arrangement", "Аранжировка"),
    ("mix", "Микс"),
    ("lyrics", "Текст"),
    ("rhythm", "Ритм"),
    ("melody", "Мелодия"),
    ("energy", "Энергетика"),
    ("mood", "Настроение"),
    ("timbre", "Тембр"),
    ("groove", "Грув"),
    ("structure", "Структура"),
    ("dynamics", "Динамика"),
)

MUSIC_BATCH_FEEDBACK_HIGHLIGHT_KEYS: frozenset[str] = frozenset(k for k, _ in MUSIC_BATCH_FEEDBACK_HIGHLIGHT_DEFS)


def music_batch_feedback_highlight_catalog() -> list[dict[str, str]]:
    return [{"key": key, "label": label} for key, label in MUSIC_BATCH_FEEDBACK_HIGHLIGHT_DEFS]


class MusicBatchBasePrompt(BaseModel):
    lyrics: str = Field(..., min_length=1, max_length=8000)
    tags: str | None = Field(default=None, max_length=2000)
    language: str = Field(default="ru", max_length=16)

    @field_validator("lyrics", "tags", "language", mode="after")
    @classmethod
    def _strip_strings(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip()


class MusicBatchLikedRecipesCreateRequest(BaseModel):
    """Batch approach из лайкнутых рецептов — только XL Base (v2_base)."""

    content_ids: list[UUID] = Field(..., min_length=1, max_length=50)
    name: str | None = Field(default=None, max_length=200)
    workflow_key: Literal["v2_base"] = "v2_base"
    duration_seconds: int = Field(default=30, ge=1, le=30)
    genre_label: str | None = Field(default=None, max_length=160)
    demo_block_type: MusicBatchDemoBlockType = "verse_chorus"
    ksampler_use_comfy_template: bool = True

    @field_validator("name", "genre_label", mode="after")
    @classmethod
    def _strip_optional_strings(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip()


class MusicBatchCreateRequest(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    workflow_key: MusicBatchWorkflowKey = "v2"
    style: str = Field(default="pop", max_length=120)
    genre_label: str | None = Field(default=None, max_length=160)
    demo_block_type: MusicBatchDemoBlockType = "verse_chorus"
    count: int = Field(default=5, ge=1, le=50)
    duration_seconds: int = Field(default=30, ge=1, le=30)
    base_prompt: MusicBatchBasePrompt
    fixed_params: dict[str, Any] = Field(default_factory=dict)
    random_params: dict[str, Any] = Field(default_factory=dict)

    @field_validator("name", "style", "genre_label", mode="after")
    @classmethod
    def _strip_optional_strings(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip()


class MusicBatchGenerationFeedbackRequest(BaseModel):
    rating: MusicBatchSampleFeedback
    comment: str | None = Field(default=None, max_length=2000)
    highlights: list[str] | None = Field(
        default=None,
        description="Для rating=tagged: какие аспекты удачны (ключи из capabilities.feedback_highlights).",
    )

    @field_validator("comment", mode="after")
    @classmethod
    def _strip_comment(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None

    @model_validator(mode="after")
    def _validate_tagged_highlights(self) -> Self:
        if self.rating == "tagged":
            raw = [str(x).strip() for x in (self.highlights or []) if str(x).strip()]
            if not raw:
                raise ValueError("Для оценки «Меченый» выберите хотя бы один аспект.")
            unknown = sorted({x for x in raw if x not in MUSIC_BATCH_FEEDBACK_HIGHLIGHT_KEYS})
            if unknown:
                raise ValueError(f"Неизвестные аспекты: {', '.join(unknown)}")
            self.highlights = sorted(set(raw))
        else:
            self.highlights = None
        return self


class MusicBatchRenameRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)

    @field_validator("name", mode="after")
    @classmethod
    def _strip_name(cls, value: str) -> str:
        return value.strip()


class MusicBatchProgress(BaseModel):
    total: int
    done: int
    failed: int
    cancelled: int


class MusicBatchGenerationSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    approach_id: UUID
    row_index: int
    status: MusicBatchGenerationStatus
    content_id: UUID | None = None
    content_name: str | None = None
    seed_used: int | None = None
    effective_params: dict[str, Any] = Field(default_factory=dict)
    error_code: str | None = None
    error_message: str | None = None
    attempt_count: int = 0
    duration_ms: int | None = None
    cost_credits: float | None = None
    sample_feedback: MusicBatchSampleFeedback | None = None
    sample_feedback_comment: str | None = None
    sample_feedback_highlights: list[str] = Field(default_factory=list)
    sample_feedback_at: datetime | None = None
    created_at: datetime | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None


class MusicBatchApproachSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    status: MusicBatchApproachStatus
    workflow_key: MusicBatchWorkflowKey
    style: str
    genre_label: str | None = None
    demo_block_type: MusicBatchDemoBlockType
    requested_count: int
    duration_seconds: int
    progress: MusicBatchProgress
    cost_estimate: dict[str, Any] = Field(default_factory=dict)
    limits_snapshot: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime | None = None
    updated_at: datetime | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None


class MusicBatchApproachDetail(MusicBatchApproachSummary):
    fixed_params: dict[str, Any] = Field(default_factory=dict)
    random_params_spec: dict[str, Any] = Field(default_factory=dict)
    base_payload: dict[str, Any] = Field(default_factory=dict)
    generations: list[MusicBatchGenerationSummary] = Field(default_factory=list)


class MusicBatchApproachListResponse(BaseModel):
    items: list[MusicBatchApproachSummary]
    total: int
    limit: int
    offset: int


class MusicBatchCreateResponse(BaseModel):
    approach_id: UUID
    status: MusicBatchApproachStatus
    progress: MusicBatchProgress
    limits_snapshot: dict[str, Any]
    message: str


class MusicBatchGenerationPayloadResponse(BaseModel):
    generation_id: UUID
    approach_id: UUID
    row_index: int
    status: MusicBatchGenerationStatus
    configured: dict[str, Any]
    effective_params: dict[str, Any]
    request_payload: dict[str, Any]
    ugs_input_data: dict[str, Any]
    provider_meta: dict[str, Any]
    content_metadata_snapshot: dict[str, Any] = Field(default_factory=dict)


class MusicBatchXlStudioApplyResponse(BaseModel):
    """Снимок ugs_input_data + style для копирования в вкладку XL Base/SFT / generate."""

    generation_id: UUID
    approach_id: UUID
    workflow_key: MusicBatchWorkflowKey
    style: str
    ugs_input_data: dict[str, Any] = Field(default_factory=dict)
    effective_params: dict[str, Any] = Field(default_factory=dict)
    #: Поля, которые фронт передаст в POST /music-generator/generate (плюс метаданные).
    music_generate: dict[str, Any] = Field(default_factory=dict)
