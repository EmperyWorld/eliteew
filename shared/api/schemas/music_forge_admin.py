# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Pydantic contracts for MusicForge operator/admin API (stats, runs, config revisions).
# Invariants:
# - Admin list responses omit full run payloads; detail endpoint returns full run + steps.
# Related:
# - api/routers/music_forge_admin.py
# ---
"""Pydantic contracts for MusicForge admin API."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from api.schemas.music_forge import MusicForgeRunOut, MusicForgeRunStatus
from pydantic import BaseModel, ConfigDict, Field, JsonValue

# Comfy sampler knobs + stage settings JSONB — JsonValue avoids bare OpenAPI bags.
MusicForgeAdminJsonMap = dict[str, JsonValue]
# Section-key → caption/enrich hint (intro, verse, chorus, …). Stored as JSONB on style profiles.
MusicForgeStyleSectionHints = dict[str, str]


class MusicForgeAdminRunListItem(BaseModel):
    id: UUID
    user_id: UUID
    status: MusicForgeRunStatus
    idea: str
    duration_seconds: int
    language: str | None = None
    style_hint: str | None = None
    result_track_name: str | None = None
    progress_current: int | None = None
    progress_total: int | None = None
    model_lane: str | None = None
    mode_key: str | None = None
    created_at: datetime
    updated_at: datetime


class MusicForgeAdminRunListOut(BaseModel):
    items: list[MusicForgeAdminRunListItem] = Field(default_factory=list)
    total: int
    limit: int
    offset: int


class MusicForgeAdminRunDetailOut(MusicForgeRunOut):
    user_id: UUID


class MusicForgeAdminFailStageCount(BaseModel):
    stage: str
    count: int


class MusicForgeAdminOverviewOut(BaseModel):
    window_hours: int
    counts_by_status: dict[str, int] = Field(default_factory=dict)
    fail_by_stage: list[MusicForgeAdminFailStageCount] = Field(default_factory=list)
    feedback_like: int = 0
    feedback_dislike: int = 0
    in_process_counters: dict[str, int] = Field(default_factory=dict)


class MusicForgeAdminFeedbackReasonCount(BaseModel):
    reason_code: str
    count: int


class MusicForgeAdminFeedbackStatsOut(BaseModel):
    rating_histogram: dict[str, int] = Field(default_factory=dict)
    top_reason_codes: list[MusicForgeAdminFeedbackReasonCount] = Field(default_factory=list)


class MusicForgeAdminConfigRevisionOut(BaseModel):
    id: UUID
    version: str
    status: str
    notes: str | None = None
    activated_at: datetime | None = None
    created_by: UUID | None = None
    created_at: datetime
    updated_at: datetime


class MusicForgeAdminConfigRevisionListOut(BaseModel):
    """Envelope-only list contract for admin config revisions (P0 reconstruction)."""

    items: list[MusicForgeAdminConfigRevisionOut] = Field(default_factory=list)
    total: int


class MusicForgeAdminConfigActivateOut(BaseModel):
    id: UUID
    version: str
    status: str
    activated_at: datetime | None = None
    config_generation: int | None = None


class MusicForgeAdminConfigDraftCreate(BaseModel):
    version: str | None = None
    notes: str | None = None


class MusicForgeAdminConfigPurgeRetiredOut(BaseModel):
    deleted: int
    versions: list[str] = Field(default_factory=list)


class MusicForgeAdminConfigVersionPatchIn(BaseModel):
    version: str = Field(min_length=1, max_length=128)
    notes: str | None = None


class MusicForgeAdminConfigRevisionDetailOut(BaseModel):
    revision: MusicForgeAdminConfigRevisionOut
    lanes: dict[str, Any] = Field(default_factory=dict)
    styles: dict[str, Any] = Field(default_factory=dict)
    prompts: dict[str, Any] = Field(default_factory=dict)
    product: dict[str, Any] = Field(default_factory=dict)
    modes: dict[str, Any] = Field(default_factory=dict)
    pipelines: dict[str, Any] = Field(default_factory=dict)


class MusicForgeAdminConfigDiffChange(BaseModel):
    path: str
    before: Any = None
    after: Any = None


class MusicForgeAdminConfigDiffOut(BaseModel):
    base_version: str
    target_version: str
    changes: list[MusicForgeAdminConfigDiffChange] = Field(default_factory=list)


class MusicForgeAdminProductPatchIn(BaseModel):
    duration_min: int | None = None
    duration_max: int | None = None
    duration_default: int | None = None
    mvp_lane_label: str | None = None
    max_completed_runs_per_day: int | None = None
    max_completed_runs_per_month: int | None = None
    audio_type_key: str | None = None


class MusicForgeAdminProductOut(BaseModel):
    """Stable product_settings row returned by PATCH product (and detail product bag)."""

    duration_min: int
    duration_max: int
    duration_default: int
    mvp_lane_label: str
    max_completed_runs_per_day: int | None = None
    max_completed_runs_per_month: int | None = None
    audio_type_key: str


class MusicForgeAdminLanePatchIn(BaseModel):
    ugs_workflow: str | None = None
    ace_workflow: str | None = None
    model_scope: str | None = None
    workflow_file: str | None = None
    billing_mode: str | None = None
    ksampler_use_comfy_template: bool | None = None
    markers: list[str] | None = None
    sampler: MusicForgeAdminJsonMap | None = None
    is_default: bool | None = None
    sort_order: int | None = None


class MusicForgeAdminPromptPatchIn(BaseModel):
    system_prompt: str | None = None
    rules: list[str] | None = None
    extras: MusicForgeAdminJsonMap | None = None


class MusicForgeAdminStylePatchIn(BaseModel):
    keyscale: str | None = None
    default_vocal: str | None = None
    bpm_default: int | None = None
    textures: MusicForgeStyleSectionHints | None = None
    arrangement: MusicForgeStyleSectionHints | None = None
    voice: MusicForgeStyleSectionHints | None = None
    soloist_policy: MusicForgeStyleSectionHints | None = None


class MusicForgeAdminLaneOut(BaseModel):
    """Lane row returned by PATCH lane (Wave B4)."""

    model_config = ConfigDict(extra="ignore")

    lane: str | None = None
    lane_key: str
    ugs_workflow: str | None = None
    ace_workflow: str | None = None
    model_scope: str | None = None
    workflow_file: str | None = None
    billing_mode: str | None = None
    ksampler_use_comfy_template: bool | None = None
    markers: list[str] = Field(default_factory=list)
    sampler: MusicForgeAdminJsonMap = Field(default_factory=dict)
    is_default: bool | None = None
    sort_order: int | None = None


class MusicForgeAdminPromptOut(BaseModel):
    """Prompt template row returned by PATCH prompt (Wave B4)."""

    model_config = ConfigDict(extra="ignore")

    kind: str
    system_prompt: str | None = None
    rules: list[str] = Field(default_factory=list)
    extras: MusicForgeAdminJsonMap = Field(default_factory=dict)


class MusicForgeAdminStyleOut(BaseModel):
    """Style profile row returned by PATCH style (Wave B4)."""

    model_config = ConfigDict(extra="ignore")

    style_key: str
    keyscale: str | None = None
    default_vocal: str | None = None
    bpm_default: int | None = None
    textures: MusicForgeStyleSectionHints = Field(default_factory=dict)
    arrangement: MusicForgeStyleSectionHints = Field(default_factory=dict)
    voice: MusicForgeStyleSectionHints = Field(default_factory=dict)
    soloist_policy: MusicForgeStyleSectionHints = Field(default_factory=dict)


class MusicForgeAdminModeOut(BaseModel):
    """Mode row returned by PATCH mode (Wave B4; not FE ModeRow view)."""

    model_config = ConfigDict(extra="ignore")

    mode_key: str
    label_ru: str | None = None
    label_en: str | None = None
    description: str | None = None
    enabled: bool | None = None
    is_default: bool | None = None
    sort_order: int | None = None
    style_hint_default: str | None = None
    lane_key: str | None = None


class MusicForgeAdminStageOut(BaseModel):
    """Pipeline stage row returned by PATCH/POST stage (Wave B4; not FE StageRow view)."""

    model_config = ConfigDict(extra="ignore")

    stage_key: str
    stage_type: str | None = None
    title_ru: str | None = None
    sort_order: int | None = None
    enabled: bool | None = None
    settings: MusicForgeAdminJsonMap = Field(default_factory=dict)


class MusicForgeAdminStageDeleteOut(BaseModel):
    """DELETE stage result (Wave B4)."""

    deleted: bool
    mode_key: str
    stage_key: str


class MusicForgeAdminModePatchIn(BaseModel):
    label_ru: str | None = None
    label_en: str | None = None
    description: str | None = None
    enabled: bool | None = None
    is_default: bool | None = None
    sort_order: int | None = None
    style_hint_default: str | None = None
    lane_key: str | None = None


class MusicForgeAdminModeCreateIn(BaseModel):
    mode_key: str = Field(..., min_length=2, max_length=64)
    label_ru: str = Field(..., min_length=1, max_length=120)
    label_en: str = Field(..., min_length=1, max_length=120)
    lane_key: str = Field(..., min_length=1, max_length=64)
    description: str | None = Field(default=None, max_length=500)
    enabled: bool = True
    is_default: bool | None = None
    sort_order: int | None = None
    style_hint_default: str | None = Field(default=None, max_length=220)


class MusicForgeAdminModeDeleteOut(BaseModel):
    deleted: bool
    mode_key: str


class MusicForgeAdminStagePatchIn(BaseModel):
    title_ru: str | None = None
    sort_order: int | None = None
    enabled: bool | None = None
    settings: MusicForgeAdminJsonMap | None = None


class MusicForgeAdminStageCreateIn(BaseModel):
    stage_key: str = Field(..., min_length=2, max_length=64)
    stage_type: str = Field(..., min_length=2, max_length=64)
    title_ru: str | None = Field(default=None, max_length=200)
    sort_order: int | None = None
    enabled: bool = True
    settings: MusicForgeAdminJsonMap | None = None


class MusicForgeAdminStageTypesOut(BaseModel):
    stage_types: list[str] = Field(default_factory=list)
    llm_ugs_type_keys: list[str] = Field(default_factory=list)
    defaults: list[dict[str, Any]] = Field(default_factory=list)


class MusicForgeAdminPreviewAudioIn(BaseModel):
    idea: str = Field(default="Admin preview song idea", min_length=3, max_length=280)
    style_hint: str | None = Field(default=None, max_length=220)
    constraints: str | None = Field(default=None, max_length=1200)
    language: str = Field(default="auto")
    duration_seconds: int = Field(default=180, ge=60, le=240)


class MusicForgeAdminPreviewAudioOut(BaseModel):
    revision_id: str
    revision_version: str
    revision_status: str
    lane_key: str
    ugs_workflow: str
    resolved_builder: str
    input_data: dict[str, Any] = Field(default_factory=dict)


class MusicForgeAdminComfyProbeOut(BaseModel):
    provider: str = "comfyui"
    available: bool
    response_time: float | int | None = None
    last_checked: datetime | None = None
    status_code: int | None = None
    error: str | None = None
    details: dict[str, Any] = Field(default_factory=dict)
