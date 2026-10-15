# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# FastAPI/OpenAPI schemas for **`/api/v1/ewa/companion-profile`** (per-user companion record in EWA Postgres).
# Invariants:
# - Profile JSONB maps use JsonValue; character_state and context anchor are typed (B9b).
# - Only JSON-mergeable blobs in patch bodies; optimistic ``expect_revision`` optional.
# - ``arlika`` / ``arlika_v2`` are runtime-only seeds (transformation / friendly dual-mode); neither in ``CompanionInitializeIn``.
# Related:
# - api/ewa_platform/gateways/routers/companion_profile.py
# - api/ewa_platform/persistence_pg/companion_asyncpg.py
# ---
"""EWA companion profile HTTP schemas."""

from __future__ import annotations

from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, Field, JsonValue, field_validator

from api.ewa_platform.schemas.pydantic.companion_chat import (
    CompanionTaskRunOut as _CanonicalCompanionTaskRunOut,
)

CompanionTaskRunOut = _CanonicalCompanionTaskRunOut

# JSONB profile blobs (baseline / learned_preferences / style_parameters) — JsonValue avoids bare OpenAPI bags.
CompanionProfileJsonMap = dict[str, JsonValue]


class CompanionCharacterMoodOut(BaseModel):
    """Display-safe mood scalars from ``character_display_state``."""

    model_config = ConfigDict(extra="ignore")

    valence: float
    energy: float
    tension: float
    confidence: float


class CompanionCharacterBondOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    trust: float
    familiarity: float
    repair_need: float


class CompanionCharacterInteractionStyleOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    answer_length: float
    initiative: float
    reassurance: float


class CompanionCharacterDisplayStateOut(BaseModel):
    """Small display-safe companion character/mood summary (server-derived)."""

    model_config = ConfigDict(extra="ignore")

    seed_persona_id: str | None = None
    mood: CompanionCharacterMoodOut
    bond: CompanionCharacterBondOut
    interaction_style: CompanionCharacterInteractionStyleOut


class CompanionContextAnchorTurnRangeOut(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    from_: int = Field(alias="from")
    to: int


class CompanionContextAnchorOut(BaseModel):
    """Context anchor v1 blob (``learned_preferences.companion_context_anchor_v1``)."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    schema_version: int = 1
    project_name: str = ""
    status: str = "active"
    updated_at_iso: str = ""
    core_truths: list[str] = Field(default_factory=list)
    decisions: list[str] = Field(default_factory=list)
    active_tasks: list[str] = Field(default_factory=list)
    uncertainties: list[str] = Field(default_factory=list)
    attached_resources: list[str] = Field(default_factory=list)
    tech_constraints: list[str] = Field(default_factory=list)
    interaction_rules: list[str] = Field(default_factory=list)
    changelog_short: list[str] = Field(default_factory=list)
    source_turn_range: CompanionContextAnchorTurnRangeOut | None = None


# First-meet / ``initialize`` only — excludes transformation persona ``arlika``.
COMPANION_INITIALIZABLE_SEEDS = frozenset({"parent", "mela", "zera", "kora", "tala", "feni"})
# Full runtime catalogue (server may set ``arlika`` / ``arlika_v2`` after trust/abuse or chat switch).
COMPANION_ALL_SEEDS = frozenset({"parent", "mela", "zera", "kora", "tala", "feni", "arlika", "arlika_v2"})


def validate_seed_for_initialize(seed: str) -> str:
    t = seed.strip().lower()
    if t not in COMPANION_INITIALIZABLE_SEEDS:
        allowed = ", ".join(sorted(COMPANION_INITIALIZABLE_SEEDS))
        raise ValueError(f"seed_persona_id must be one of: {allowed}")
    return t


def validate_seed(seed: str) -> str:
    """Catalog ids after server normalization (includes post-transform ``arlika`` / ``arlika_v2``)."""

    t = seed.strip().lower()
    if t not in COMPANION_ALL_SEEDS:
        allowed = ", ".join(sorted(COMPANION_ALL_SEEDS))
        raise ValueError(f"seed_persona_id must be one of: {allowed}")
    return t


class CompanionProfileOut(BaseModel):
    principal_id: str
    schema_version: str = Field(description="Companion profile blob schema revision.")
    seed_persona_id: str
    baseline: CompanionProfileJsonMap = Field(default_factory=dict)
    learned_preferences: CompanionProfileJsonMap = Field(default_factory=dict)
    style_parameters: CompanionProfileJsonMap = Field(default_factory=dict)
    memory_display: list[str] = Field(
        default_factory=list,
        description="Server-derived short lines for the 'Remembers about you' UI strip (up to 32 lines).",
    )
    character_state: CompanionCharacterDisplayStateOut = Field(
        description="Small display-safe companion character/mood summary.",
    )
    companion_revision: int = Field(ge=1)
    updated_at: str | None
    voice_enabled: bool = Field(
        default=False,
        description="When true, companion chat may use stack9 voice-gateway (Whisper STT + Qwen3-TTS).",
    )
    reactive_chrome_enabled: bool = Field(
        default=True,
        description="When true, companion chat window shifts aura/glow with mood and active operations.",
    )


class CompanionInitializeIn(BaseModel):
    seed_persona_id: Annotated[str, Field(min_length=1, max_length=64)]
    baseline: CompanionProfileJsonMap | None = Field(
        default=None,
        description="Optional extra baseline keys merged onto empty default baseline on first insert only.",
    )

    @field_validator("seed_persona_id")
    @classmethod
    def _seed_ok(cls, v: str) -> str:
        return validate_seed_for_initialize(v)

    model_config = {"json_schema_extra": {"examples": [{"seed_persona_id": "mela"}]}}


class CompanionPatchIn(BaseModel):
    baseline: CompanionProfileJsonMap | None = None
    learned_preferences: CompanionProfileJsonMap | None = None
    style_parameters: CompanionProfileJsonMap | None = None
    expect_revision: Annotated[int | None, Field(ge=1)] = Field(
        default=None,
        description="When set and mismatch → 409 Conflict (stale profile).",
    )


class CompanionArlikaV2ModeToggleOut(CompanionProfileOut):
    switched: bool = True
    transform_event_kind: str | None = Field(
        default=None,
        description="SSE transform kind when mode changed: ewa_to_arly | arly_to_ewa.",
    )


class CompanionUnavailableOut(BaseModel):
    detail: str = (
        "EWA companion requires a configured EWA Postgres pool; see HTTP 503 detail.code in EWA-POSTGRES-RUNBOOK.md."
    )


class CompanionQuickPresetOut(BaseModel):
    id: str
    principal_id: str
    label: str
    prompt_text: str
    sort_order: int = 100
    created_at: str | None = None
    updated_at: str | None = None


class CompanionQuickPresetCreateIn(BaseModel):
    label: Annotated[str, Field(min_length=1, max_length=80)]
    prompt_text: Annotated[str, Field(min_length=1, max_length=4000)]
    sort_order: int = Field(default=100, ge=0, le=10_000)


class CompanionQuickPresetPatchIn(BaseModel):
    label: Annotated[str | None, Field(min_length=1, max_length=80)] = None
    prompt_text: Annotated[str | None, Field(min_length=1, max_length=4000)] = None
    sort_order: Annotated[int | None, Field(ge=0, le=10_000)] = None


class CompanionStoryAddIn(BaseModel):
    """Append one ``story`` row to ``companion_memory_v1`` (HCM Module A — pinned identity anchors).

    Story rows are short chronological landmarks the user wants the companion to remember as identity
    ("first time we …", "the day Arlika forgave …"). They render in the same memory block as facts.
    """

    content: Annotated[str, Field(min_length=2, max_length=280)]
    importance: Annotated[float, Field(ge=0.0, le=1.0)] = 0.9
    valence: Annotated[float, Field(ge=0.0, le=1.0)] = 0.6


class CompanionStoryRowOut(BaseModel):
    content: str
    importance: float
    valence: float
    since_ts: str
    last_used_ts: str
    content_hash: str


class CompanionContextAnchorRefreshIn(BaseModel):
    user_line: str = Field(default="", max_length=4096, description="Optional last user line to bias refresh.")


class CompanionContextAnchorPatchIn(BaseModel):
    patch: dict[str, Any] = Field(default_factory=dict, description="Shallow-merge into companion_context_anchor_v1.")


class CompanionContextDiagnoseIn(BaseModel):
    system_prompt_sample: str = Field(
        default="",
        max_length=120_000,
        description="Optional recent system prompt tail for combined risk heuristics.",
    )


class CompanionContextAnchorGetOut(BaseModel):
    """GET /companion-profile/context-anchor (Wave B4)."""

    model_config = ConfigDict(extra="ignore")

    anchor: CompanionContextAnchorOut | None = None
    companion_revision: int = Field(ge=1)


class CompanionContextAnchorRefreshTelemetryOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    ok: bool = False
    chars_before: int | None = None
    chars_after: int | None = None
    reason: str | None = None
    normalized: bool | None = None


class CompanionContextAnchorRefreshOut(BaseModel):
    """POST /companion-profile/context-anchor/refresh (Wave B4)."""

    profile: CompanionProfileOut
    telemetry: CompanionContextAnchorRefreshTelemetryOut


class CompanionContextRiskFlagsOut(BaseModel):
    noise_risk: bool = False
    drift_risk: bool = False
    prompt_bloat_risk: bool = False
    action_execution_risk: bool = False


class CompanionContextDiagnoseOut(BaseModel):
    """POST /companion-profile/context-anchor/diagnose (Wave B4)."""

    flags: CompanionContextRiskFlagsOut
    anchor_present: bool = False
    condensed_chars: int = 0
    memory_section_chars: int = 0


class CompanionOkOut(BaseModel):
    """Tiny success shell (e.g. DELETE quick-action)."""

    ok: bool = True


class CompanionDeletedOut(BaseModel):
    """Tiny delete shell (e.g. DELETE user-workflow)."""

    deleted: bool = True


class EwaDriverCatalogEntryOut(BaseModel):
    """Static EWA/AMKA driver catalog row (GET /driver-catalog)."""

    model_config = ConfigDict(extra="ignore")

    driver_key: str
    domain_profile: str
    title: str
    status: str
    entrypoint: str
    supports_write_actions: bool = False
    risk_posture: str = "unknown"
    capabilities: list[str] = Field(default_factory=list)
    notes: str = ""
