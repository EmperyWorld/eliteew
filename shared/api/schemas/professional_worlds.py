# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Pydantic contracts for Professional Worlds runtime, admin registry, realtor workspace,
# and AI/media/intake/playbook streams (Wave B5b named text/event-stream payload docs).
# Invariants:
# - Public API schemas expose only current-user scoped data.
# - Vertical slugs and recipe keys are stable identifiers; UI labels are localized on the frontend.
# Related:
# - api/routers/professional_worlds.py
# - api/routers/professional_worlds_ai_streams.py
# - api/routers/professional_worlds_realtor_media.py
# - api/routers/professional_worlds_playbooks.py
# - documentation/api/BE-FE-CONTRACT-INTEGRITY-REMEDIATION.md (B5b)
# - documentation/product/PROFESSIONAL-WORLDS.md
# ---

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, Literal
from uuid import UUID

from api.schemas.realtor_status import (
    RealtorPublicationChannelStatus,
    RealtorShowingStatus,
    normalize_realtor_publication_channel_status,
    normalize_realtor_showing_status,
)
from pydantic import (  # type: ignore[import-untyped]
    BaseModel,
    ConfigDict,
    Field,
    JsonValue,
    RootModel,
    field_validator,
)

# Pack/import JSON sections — JsonValue avoids bare nested OpenAPI bags (B9b).
ProfessionalWorldsJsonMap = dict[str, JsonValue]
ProfessionalWorldsJsonList = list[JsonValue]

REALTOR_VERTICAL_SLUG = "realtor"


class ProfessionVerticalOut(BaseModel):
    """Profession available to the current user."""

    slug: str
    name: str
    description: str | None = None
    icon_key: str = "briefcase"
    profile_schema: dict[str, Any] = Field(default_factory=dict)
    workspace_template: dict[str, Any] = Field(default_factory=dict)


class SpecialistProfileBase(BaseModel):
    """Editable specialist profile fields."""

    vertical_slug: str = Field(REALTOR_VERTICAL_SLUG, min_length=2, max_length=80)
    display_name: str | None = Field(None, max_length=180)
    headline: str | None = Field(None, max_length=240)
    city: str | None = Field(None, max_length=120)
    agency_name: str | None = Field(None, max_length=180)
    specialization: list[str] = Field(default_factory=list)
    profile_data: dict[str, Any] = Field(default_factory=dict)
    is_public_ready: bool = False

    @field_validator("vertical_slug")
    @classmethod
    def normalize_vertical_slug(cls, value: str) -> str:
        """Normalize vertical slugs to registry identifiers."""
        return value.strip().lower().replace("_", "-")


class SpecialistProfileUpsert(SpecialistProfileBase):
    """Create or update the current user's specialist profile."""


class SpecialistProfileOut(SpecialistProfileBase):
    """Persisted specialist profile."""

    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RealtorJtbdContext(BaseModel):
    """JTBD frame used by realtor copy generation."""

    trigger_context: str | None = Field(default=None, max_length=1200)
    expected_result: str | None = Field(default=None, max_length=1200)
    emotional_transformation: str | None = Field(default=None, max_length=1200)
    audience_segment: str | None = Field(default=None, max_length=160)


class RealtorPropertyBase(BaseModel):
    """Editable real-estate object fields."""

    title: str = Field(..., min_length=1, max_length=220)
    property_type: str = Field(default="apartment", max_length=80)
    deal_type: str = Field(default="sale", max_length=80)
    city: str = Field(default="Владивосток", max_length=120)
    district: str | None = Field(default=None, max_length=160)
    address: str | None = Field(default=None, max_length=240)
    price: Decimal | None = None
    area_m2: Decimal | None = None
    rooms: int | None = Field(default=None, ge=0, le=100)
    floor: int | None = Field(default=None, ge=-10, le=300)
    total_floors: int | None = Field(default=None, ge=0, le=300)
    view: str | None = Field(default=None, max_length=220)
    infrastructure: list[str] = Field(default_factory=list)
    jtbd_context: RealtorJtbdContext = Field(default_factory=RealtorJtbdContext)
    facts: dict[str, Any] = Field(default_factory=dict)
    status: str = Field(default="draft", max_length=80)


class RealtorPropertyCreate(RealtorPropertyBase):
    """Create realtor property."""


class RealtorPropertyUpdate(BaseModel):
    """Patch realtor property."""

    title: str | None = Field(None, min_length=1, max_length=220)
    property_type: str | None = Field(None, max_length=80)
    deal_type: str | None = Field(None, max_length=80)
    city: str | None = Field(None, max_length=120)
    district: str | None = Field(None, max_length=160)
    address: str | None = Field(None, max_length=240)
    price: Decimal | None = None
    area_m2: Decimal | None = None
    rooms: int | None = Field(None, ge=0, le=100)
    floor: int | None = Field(None, ge=-10, le=300)
    total_floors: int | None = Field(None, ge=0, le=300)
    view: str | None = Field(None, max_length=220)
    infrastructure: list[str] | None = None
    jtbd_context: RealtorJtbdContext | None = None
    facts: dict[str, Any] | None = None
    status: str | None = Field(None, max_length=80)


class RealtorPropertyOut(RealtorPropertyBase):
    """Persisted realtor property."""

    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RealtorPropertyMediaCreate(BaseModel):
    """Attach Unified Content media to a property."""

    unified_content_id: UUID
    caption: str | None = Field(None, max_length=240)
    sort_order: int = 0


class RealtorPropertyMediaOut(RealtorPropertyMediaCreate):
    """Persisted property media row."""

    id: UUID
    property_id: UUID
    created_at: datetime


class ProfessionalClientBase(BaseModel):
    """CRM-lite client fields."""

    vertical_slug: str = REALTOR_VERTICAL_SLUG
    name: str = Field(..., min_length=1, max_length=180)
    contact: str | None = Field(None, max_length=240)
    need_summary: str | None = None
    budget_from: Decimal | None = None
    budget_to: Decimal | None = None
    preferred_areas: list[str] = Field(default_factory=list)
    emotional_motive: str | None = None
    next_action: str | None = None
    status: str = Field("lead", max_length=80)


class ProfessionalClientCreate(ProfessionalClientBase):
    """Create CRM-lite client."""


class ProfessionalClientUpdate(BaseModel):
    """Patch CRM-lite client."""

    name: str | None = Field(None, min_length=1, max_length=180)
    contact: str | None = Field(None, max_length=240)
    need_summary: str | None = None
    budget_from: Decimal | None = None
    budget_to: Decimal | None = None
    preferred_areas: list[str] | None = None
    emotional_motive: str | None = None
    next_action: str | None = None
    status: str | None = Field(None, max_length=80)


class ProfessionalClientOut(ProfessionalClientBase):
    """Persisted CRM-lite client."""

    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime


class ProfessionalDealBase(BaseModel):
    """CRM-lite deal fields."""

    vertical_slug: str = REALTOR_VERTICAL_SLUG
    client_id: UUID | None = None
    title: str = Field(..., min_length=1, max_length=220)
    stage: str = Field("new", max_length=80)
    amount: Decimal | None = None
    next_action: str | None = None
    deal_data: dict[str, Any] = Field(default_factory=dict)


class ProfessionalDealCreate(ProfessionalDealBase):
    """Create deal."""


class ProfessionalDealUpdate(BaseModel):
    """Patch deal."""

    client_id: UUID | None = None
    title: str | None = Field(None, min_length=1, max_length=220)
    stage: str | None = Field(None, max_length=80)
    amount: Decimal | None = None
    next_action: str | None = None
    deal_data: dict[str, Any] | None = None


class ProfessionalDealOut(ProfessionalDealBase):
    """Persisted deal."""

    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime


class ProfessionalDealPropertyLinkBackfillOut(BaseModel):
    """Result of idempotent legacy deal→listing FK backfill."""

    updated: int = Field(ge=0)
    skipped: int = Field(ge=0)


class ProfessionalLearningLessonOut(BaseModel):
    """Lesson with current-user completion state."""

    id: UUID
    lesson_key: str
    title: str
    summary: str | None = None
    content_md: str
    exercise: dict[str, Any] = Field(default_factory=dict)
    sort_order: int = 0
    completed: bool = False


class ProfessionalLearningCourseOut(BaseModel):
    """Course with nested lessons."""

    id: UUID
    course_key: str
    vertical_slug: str
    title: str
    description: str | None = None
    level: str
    sort_order: int = 0
    lessons: list[ProfessionalLearningLessonOut] = Field(default_factory=list)


class LessonCompleteBody(BaseModel):
    """Mark lesson complete."""

    score: int | None = Field(None, ge=0, le=100)
    notes: str | None = Field(None, max_length=2000)


class ProfessionalArtifactOut(BaseModel):
    """Generated or saved artifact."""

    id: UUID
    vertical_slug: str
    source_type: str
    source_id: UUID | None = None
    recipe_key: str | None = None
    title: str
    content: str | None = None
    artifact_data: dict[str, Any] = Field(default_factory=dict)
    unified_content_id: UUID | None = None
    ugs_request_id: UUID | None = None
    module_key: str | None = None
    artifact_kind: str = "text"
    parent_artifact_id: UUID | None = None
    source_media_id: UUID | None = None
    export_metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class RealtorGenerationBody(BaseModel):
    """Generation request from the realtor workspace."""

    tone: Literal["jtbd", "investor", "family", "rental", "premium", "concise"] = "jtbd"
    channel: str | None = Field(None, max_length=80)
    instruction: str | None = Field(None, max_length=2000)
    idempotency_key: str | None = Field(None, min_length=8, max_length=120)


class CoachSimulationBody(BaseModel):
    """Role-play generation request for training."""

    scenario: str = Field(..., min_length=1, max_length=160)
    user_message: str = Field(..., min_length=1, max_length=4000)
    idempotency_key: str | None = Field(None, min_length=8, max_length=120)


class ProfessionalWorldsAiSseStartedOut(BaseModel):
    """SSE ``event: started`` after UGS accepts a PW text AI generation."""

    request_id: str
    status: str = "processing"


class ProfessionalWorldsAiSseResultOut(BaseModel):
    """SSE ``event: result`` with persisted professional artifact."""

    text: str
    artifact: ProfessionalArtifactOut


class ProfessionalWorldsAiSseErrorOut(BaseModel):
    """SSE ``event: error`` envelope for PW text AI streams."""

    error: Any


class ProfessionalWorldsAiTextStreamSsePayloadDoc(
    RootModel[ProfessionalWorldsAiSseStartedOut | ProfessionalWorldsAiSseResultOut | ProfessionalWorldsAiSseErrorOut]
):
    """OpenAPI doc for PW realtor/coach text AI ``text/event-stream`` ``data:`` JSON.

    Wire also forwards UGS ``progress`` / ``queued`` (and keep-alive comments); those
    remain outside this named union until a dedicated progress Out lands.
    """


class ProfessionalModuleFields(BaseModel):
    """Shared module catalog fields; `module_key` is returned exactly as stored in DB."""

    module_key: str = Field(..., min_length=2, max_length=120)
    name: str = Field(..., min_length=1, max_length=180)
    description: str | None = None
    category: str = Field("workspace", max_length=80)
    icon_key: str = Field("squares", max_length=80)
    default_config: dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True


class ProfessionalModuleCreate(ProfessionalModuleFields):
    """Create a professional module."""

    @field_validator("module_key")
    @classmethod
    def normalize_module_key(cls, value: str) -> str:
        """Normalize operator input on create only (do not rewrite keys on read)."""
        return value.strip().lower().replace("_", "-")


class ProfessionalModuleUpdate(BaseModel):
    """Patch a professional module."""

    name: str | None = Field(None, min_length=1, max_length=180)
    description: str | None = None
    category: str | None = Field(None, max_length=80)
    icon_key: str | None = Field(None, max_length=80)
    default_config: dict[str, Any] | None = None
    is_active: bool | None = None


class ProfessionalModuleOut(ProfessionalModuleFields):
    """Persisted module."""

    id: UUID
    created_at: datetime
    updated_at: datetime


class AdminProfessionVerticalCreate(BaseModel):
    """Create a profession vertical from admin."""

    slug: str = Field(..., min_length=2, max_length=80)
    name: str = Field(..., min_length=1, max_length=160)
    description: str | None = None
    icon_key: str = Field("briefcase", max_length=80)
    is_active: bool = True
    profile_schema: dict[str, Any] = Field(default_factory=dict)
    workspace_template: dict[str, Any] = Field(default_factory=dict)

    @field_validator("slug")
    @classmethod
    def normalize_slug(cls, value: str) -> str:
        """Normalize vertical slugs."""
        return value.strip().lower().replace("_", "-")


class AdminProfessionVerticalUpdate(BaseModel):
    """Patch profession vertical metadata."""

    name: str | None = Field(None, min_length=1, max_length=160)
    description: str | None = None
    icon_key: str | None = Field(None, max_length=80)
    is_active: bool | None = None
    profile_schema: dict[str, Any] | None = None
    workspace_template: dict[str, Any] | None = None


class AdminProfessionVerticalOut(AdminProfessionVerticalCreate):
    """Admin view of a profession vertical."""

    id: UUID
    created_at: datetime
    updated_at: datetime


class ProfessionalVerticalModuleUpsert(BaseModel):
    """Assign or update a module for a vertical."""

    config: dict[str, Any] = Field(default_factory=dict)
    sort_order: int = 0
    is_enabled: bool = True


class ProfessionalVerticalModuleOut(ProfessionalVerticalModuleUpsert):
    """Resolved module assignment."""

    id: UUID
    vertical_slug: str
    module_key: str
    module_name: str | None = None
    module_description: str | None = None
    module_category: str | None = None
    icon_key: str | None = None
    created_at: datetime
    updated_at: datetime


class ProfessionalVerticalSchemaCreate(BaseModel):
    """Create schema version for a vertical.

    Wire JSON key stays ``schema_json``; Python attr is ``schema_body`` so it does not
    shadow Pydantic ``BaseModel.schema_json`` (UserWarning on class definition).
    """

    model_config = ConfigDict(populate_by_name=True)

    schema_key: str = Field(..., min_length=2, max_length=120)
    version: int = Field(1, ge=1)
    title: str = Field(..., min_length=1, max_length=180)
    schema_body: dict[str, Any] = Field(
        default_factory=dict,
        validation_alias="schema_json",
        serialization_alias="schema_json",
    )
    ui_schema: dict[str, Any] = Field(default_factory=dict)
    is_active: bool = False


class ProfessionalVerticalSchemaUpdate(BaseModel):
    """Patch schema version."""

    model_config = ConfigDict(populate_by_name=True)

    title: str | None = Field(None, min_length=1, max_length=180)
    schema_body: dict[str, Any] | None = Field(
        default=None,
        validation_alias="schema_json",
        serialization_alias="schema_json",
    )
    ui_schema: dict[str, Any] | None = None
    is_active: bool | None = None


class ProfessionalVerticalSchemaOut(ProfessionalVerticalSchemaCreate):
    """Persisted vertical schema version."""

    id: UUID
    vertical_slug: str
    created_at: datetime
    updated_at: datetime


class ProfessionalAiActionBase(BaseModel):
    """Admin AI action payload."""

    vertical_slug: str = REALTOR_VERTICAL_SLUG
    module_key: str = Field(..., min_length=2, max_length=120)
    action_key: str = Field(..., min_length=2, max_length=160)
    display_name: str = Field(..., min_length=1, max_length=180)
    description: str | None = None
    ugs_type_key: str = Field("text_chat", max_length=120)
    workflow_slug: str | None = Field(None, max_length=160)
    prompt_template: str = Field(..., min_length=1)
    input_schema: dict[str, Any] = Field(default_factory=dict)
    output_schema: dict[str, Any] = Field(default_factory=dict)
    safety_rules: list[str] = Field(default_factory=list)
    artifact_kind: str = Field("text", max_length=80)
    billing_hint: dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True
    sort_order: int = 0


class ProfessionalAiActionCreate(ProfessionalAiActionBase):
    """Create AI action."""


class ProfessionalAiActionUpdate(BaseModel):
    """Patch AI action."""

    module_key: str | None = Field(None, max_length=120)
    display_name: str | None = Field(None, min_length=1, max_length=180)
    description: str | None = None
    ugs_type_key: str | None = Field(None, max_length=120)
    workflow_slug: str | None = Field(None, max_length=160)
    prompt_template: str | None = Field(None, min_length=1)
    input_schema: dict[str, Any] | None = None
    output_schema: dict[str, Any] | None = None
    safety_rules: list[str] | None = None
    artifact_kind: str | None = Field(None, max_length=80)
    billing_hint: dict[str, Any] | None = None
    is_active: bool | None = None
    sort_order: int | None = None


class ProfessionalAiActionOut(ProfessionalAiActionBase):
    """Persisted AI action."""

    id: UUID
    created_at: datetime
    updated_at: datetime


class ProfessionalAiActionRuntimeOut(BaseModel):
    """Safe runtime AI action descriptor without private prompts."""

    module_key: str
    action_key: str
    display_name: str
    description: str | None = None
    input_schema: dict[str, Any] = Field(default_factory=dict)
    artifact_kind: str
    sort_order: int = 0


class ProfessionalPhotoPresetBase(BaseModel):
    """Admin photo preset payload."""

    vertical_slug: str = REALTOR_VERTICAL_SLUG
    preset_key: str = Field(..., min_length=2, max_length=140)
    display_name: str = Field(..., min_length=1, max_length=180)
    description: str | None = None
    category: str = Field("enhance", max_length=80)
    action_type: str = Field("image_edit", max_length=80)
    ugs_type_key: str = Field("image_studio_image_edit", max_length=120)
    prompt_template: str = Field(..., min_length=1)
    parameters: dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True
    sort_order: int = 0


class ProfessionalPhotoPresetCreate(ProfessionalPhotoPresetBase):
    """Create photo preset."""


class ProfessionalPhotoPresetUpdate(BaseModel):
    """Patch photo preset."""

    display_name: str | None = Field(None, min_length=1, max_length=180)
    description: str | None = None
    category: str | None = Field(None, max_length=80)
    action_type: str | None = Field(None, max_length=80)
    ugs_type_key: str | None = Field(None, max_length=120)
    prompt_template: str | None = Field(None, min_length=1)
    parameters: dict[str, Any] | None = None
    is_active: bool | None = None
    sort_order: int | None = None


class ProfessionalPhotoPresetOut(ProfessionalPhotoPresetBase):
    """Persisted photo preset."""

    id: UUID
    created_at: datetime
    updated_at: datetime


class ProfessionalIntegrationBindingUpdate(BaseModel):
    """Patch integration binding."""

    display_name: str | None = Field(None, min_length=1, max_length=180)
    config: dict[str, Any] | None = None
    is_enabled: bool | None = None


class ProfessionalIntegrationBindingOut(BaseModel):
    """Integration binding visible to admin/runtime."""

    id: UUID
    vertical_slug: str
    integration_key: str
    display_name: str
    config: dict[str, Any] = Field(default_factory=dict)
    is_enabled: bool = True
    created_at: datetime
    updated_at: datetime


class ProfessionalAdminAuditLogOut(BaseModel):
    """Admin audit row."""

    id: UUID
    admin_user_id: UUID | None = None
    action: str
    entity_type: str
    entity_key: str
    risk_level: str | None = None
    before_data: dict[str, Any] = Field(default_factory=dict)
    after_data: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class ProfessionalWorldsRuntimeOverview(BaseModel):
    """24h runtime counters for admin dashboard."""

    playbook_runs_24h: int = 0
    playbook_runs_failed_24h: int = 0
    failed_playbook_runs_24h: int = 0
    artifacts_24h: int = 0
    credits_used_24h: float = 0.0
    media_job_errors_24h: int = 0
    api_error_rate_24h: float = 0.0


class ProfessionalWorldsAdminOverview(BaseModel):
    """Admin dashboard overview."""

    verticals_count: int = 0
    modules_count: int = 0
    ai_actions_count: int = 0
    photo_presets_count: int = 0
    enabled_integrations_count: int = 0
    pack_versions_count: int = 0
    pack_releases_count: int = 0
    published_releases_count: int = 0
    active_rollouts_count: int = 0
    broken_bindings: list[str] = Field(default_factory=list)
    runtime: ProfessionalWorldsRuntimeOverview | None = None


class ProfessionalWorldsOpsProbeRow(BaseModel):
    """Single ops probe result."""

    id: str
    ok: bool
    latency_ms: int = 0
    message: str = ""


class ProfessionalWorldsOpsMetricsOut(BaseModel):
    """Ops dashboard payload for Professional Worlds admin."""

    probes: list[ProfessionalWorldsOpsProbeRow] = Field(default_factory=list)
    runtime: ProfessionalWorldsRuntimeOverview = Field(default_factory=ProfessionalWorldsRuntimeOverview)
    by_vertical: list[dict[str, Any]] = Field(default_factory=list)


class ProfessionalPhotoPresetRuntimeOut(BaseModel):
    """Photo preset exposed to specialist runtime without prompt templates."""

    id: UUID
    vertical_slug: str
    preset_key: str
    display_name: str
    description: str | None = None
    category: str
    action_type: str
    ugs_type_key: str
    parameters: dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True
    sort_order: int = 0
    created_at: datetime
    updated_at: datetime


class ProfessionalPlaybookRuntimeOut(BaseModel):
    """Safe playbook descriptor for runtime launchers."""

    playbook_key: str
    display_name: str
    description: str | None = None
    sort_order: int = 0


class ProfessionalPlaybookLaunchBody(BaseModel):
    """Start a multi-step playbook run with template variables."""

    variables: dict[str, Any] = Field(default_factory=dict)
    idempotency_key: str | None = Field(default=None, max_length=160)


class ProfessionalPlaybookRunArtifactOut(BaseModel):
    """Artifact recorded for one playbook step."""

    step_order: int
    artifact_id: UUID | None = None
    artifact_kind: str | None = None
    meta: dict[str, Any] = Field(default_factory=dict)


class ProfessionalPlaybookRunOut(BaseModel):
    """Playbook execution record returned to the runtime client."""

    id: UUID
    vertical_slug: str
    playbook_key: str
    status: str
    idempotency_key: str | None = None
    step_logs: list[Any] = Field(default_factory=list)
    error: str | None = None
    created_at: datetime
    updated_at: datetime
    artifacts: list[ProfessionalPlaybookRunArtifactOut] = Field(default_factory=list)


class ProfessionalWorldsPlaybookSseRunStartedOut(BaseModel):
    """SSE ``event: run_started`` when a playbook run row is created."""

    run_id: str
    playbook_key: str


class ProfessionalWorldsPlaybookSseStepStartOut(BaseModel):
    """SSE ``event: step_start`` before a playbook step executes."""

    run_id: str
    step: int
    action_key: str


class ProfessionalWorldsPlaybookSseStepResultOut(BaseModel):
    """SSE ``event: step_result`` after a step artifact is saved."""

    run_id: str
    step: int
    artifact_id: str
    preview: str | None = None


class ProfessionalWorldsPlaybookSseStepSkippedOut(BaseModel):
    """SSE ``event: step_skipped`` when a prior successful step is reused."""

    run_id: str
    step: int
    artifact_id: str | None = None
    reason: str | None = None


class ProfessionalWorldsPlaybookSseWarningOut(BaseModel):
    """SSE ``event: warning`` (e.g. safety-rules hint)."""

    run_id: str
    step: int | None = None
    message: str


class ProfessionalWorldsPlaybookSseDoneOut(BaseModel):
    """SSE ``event: done`` for completed or idempotent-replayed runs."""

    run_id: str
    status: str
    replayed: bool | None = None


class ProfessionalWorldsPlaybookSseErrorOut(BaseModel):
    """SSE ``event: error`` for playbook stream failures."""

    error: Any
    run_id: str | None = None
    step: int | None = None


class ProfessionalWorldsPlaybookStreamSsePayloadDoc(
    RootModel[
        ProfessionalWorldsPlaybookSseRunStartedOut
        | ProfessionalWorldsPlaybookSseStepStartOut
        | ProfessionalWorldsPlaybookSseStepResultOut
        | ProfessionalWorldsPlaybookSseStepSkippedOut
        | ProfessionalWorldsPlaybookSseWarningOut
        | ProfessionalWorldsPlaybookSseDoneOut
        | ProfessionalWorldsPlaybookSseErrorOut
    ]
):
    """OpenAPI doc for PW playbook launch/resume ``text/event-stream`` ``data:`` JSON."""


class AdminProfessionalPlaybookStepOut(BaseModel):
    """Admin view of a playbook step."""

    step_order: int
    action_key: str
    input_mapping: dict[str, Any] = Field(default_factory=dict)
    stop_on_error: bool = True


class AdminProfessionalPlaybookOut(BaseModel):
    """Admin playbook header + steps."""

    playbook_key: str
    vertical_slug: str
    display_name: str
    description: str | None = None
    is_active: bool = True
    sort_order: int = 0
    steps: list[AdminProfessionalPlaybookStepOut] = Field(default_factory=list)


class AdminProfessionalPlaybookStepUpsert(BaseModel):
    """Mutable step row for admin create/update of a playbook."""

    step_order: int
    action_key: str = Field(max_length=160)
    input_mapping: dict[str, Any] = Field(default_factory=dict)
    stop_on_error: bool = True


class AdminProfessionalPlaybookCreate(BaseModel):
    """Create a playbook with ordered steps."""

    playbook_key: str = Field(max_length=160)
    display_name: str = Field(max_length=180)
    description: str | None = None
    sort_order: int = 0
    is_active: bool = True
    steps: list[AdminProfessionalPlaybookStepUpsert] = Field(default_factory=list)


class AdminProfessionalPlaybookUpdate(BaseModel):
    """Patch playbook metadata and optionally replace all steps."""

    display_name: str | None = Field(default=None, max_length=180)
    description: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None
    steps: list[AdminProfessionalPlaybookStepUpsert] | None = None


class ProfessionalPlaybookDryRunRequest(BaseModel):
    """Optional step list for dry-run preview without persisting."""

    steps: list[AdminProfessionalPlaybookStepUpsert] | None = None


class ProfessionalPlaybookDryRunOut(BaseModel):
    """Resolved step plan without invoking UGS."""

    playbook_key: str
    vertical_slug: str
    steps: list[dict[str, Any]] = Field(default_factory=list)


class ProfessionalWorldsRuntimeConfig(BaseModel):
    """Runtime config for the current user's professional workspace."""

    vertical_slug: str
    modules: list[ProfessionalVerticalModuleOut] = Field(default_factory=list)
    schemas: list[ProfessionalVerticalSchemaOut] = Field(default_factory=list)
    ai_actions: list[ProfessionalAiActionRuntimeOut] = Field(default_factory=list)
    photo_presets: list[ProfessionalPhotoPresetRuntimeOut] = Field(default_factory=list)
    integrations: list[ProfessionalIntegrationBindingOut] = Field(default_factory=list)
    playbooks: list[ProfessionalPlaybookRuntimeOut] = Field(default_factory=list)
    config_version_hash: str = ""
    runtime_epoch: int = 0
    active_release_id: UUID | None = None


class ProfessionalWorldsMultiRuntimeConfig(BaseModel):
    """Batch of runtime configs for all active verticals."""

    configs: list[ProfessionalWorldsRuntimeConfig] = Field(default_factory=list)


class ProfessionalWorldsProviderHealthOut(BaseModel):
    """Lightweight UGS degrade signal for desktop workspace banners."""

    ugs_ok: bool = True
    degraded: bool = False
    message: str = ""


class ProfessionalWorldsSnapshotOut(BaseModel):
    """Aggregated Desktop bootstrap payload for one active vertical."""

    verticals: list[ProfessionVerticalOut] = Field(default_factory=list)
    runtime_config: ProfessionalWorldsRuntimeConfig | None = None
    runtime_configs: list[ProfessionalWorldsRuntimeConfig] = Field(default_factory=list)
    vertical_activations: list[ProfessionalUserVerticalActivationOut] = Field(default_factory=list)
    profile: SpecialistProfileOut | None = None
    properties: list[RealtorPropertyOut] = Field(default_factory=list)
    clients: list[ProfessionalClientOut] = Field(default_factory=list)
    deals: list[ProfessionalDealOut] = Field(default_factory=list)
    courses: list[ProfessionalLearningCourseOut] = Field(default_factory=list)
    artifacts: list[ProfessionalArtifactOut] = Field(default_factory=list)
    provider_health: ProfessionalWorldsProviderHealthOut | None = None


class ProfessionalUserVerticalActivationOut(BaseModel):
    """Per-user activation of a profession vertical."""

    vertical_slug: str
    is_active: bool = True
    onboarding: dict[str, Any] = Field(default_factory=dict)
    entitlements: dict[str, Any] = Field(default_factory=dict)


class ProfessionalUserVerticalActivationUpsert(BaseModel):
    """Activate a vertical for the current user."""

    is_active: bool = True


class ProfessionalUserVerticalOnboardingPatch(BaseModel):
    """Patch onboarding JSON blob."""

    onboarding: dict[str, Any] = Field(default_factory=dict)


class ProfessionalVerticalPackVersionOut(BaseModel):
    """Saved pack version row."""

    id: UUID
    vertical_slug: str
    version_label: str
    changelog_md: str | None = None
    created_by_admin_id: UUID | None = None
    created_at: datetime


class ProfessionalPackImportJobOut(BaseModel):
    """Import job status (GET …/packs/import/jobs/{id})."""

    model_config = ConfigDict(extra="ignore")

    id: UUID
    admin_user_id: UUID | None = None
    vertical_slug: str
    status: str
    dry_run: bool
    manifest: ProfessionalWorldsJsonMap = Field(default_factory=dict)
    validation_messages: list[str] = Field(default_factory=list)
    diff_summary: ProfessionalWorldsJsonMap = Field(default_factory=dict)
    error: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ProfessionalPackImportJobSummaryOut(BaseModel):
    """Nested job stub from POST …/packs/import/jobs RETURNING."""

    model_config = ConfigDict(extra="ignore")

    id: UUID
    status: str
    dry_run: bool
    created_at: datetime | None = None


class ProfessionalPackImportJobCreateOut(BaseModel):
    """Create import job (dry-run) envelope."""

    job: ProfessionalPackImportJobSummaryOut
    messages: list[str] = Field(default_factory=list)
    diff: ProfessionalWorldsJsonMap = Field(default_factory=dict)
    valid: bool


class ProfessionalPackImportConfirmOut(BaseModel):
    """Confirm import job result."""

    model_config = ConfigDict(extra="ignore")

    ok: bool
    epoch: int | None = None
    error: str | None = None
    messages: list[str] | None = None


class ProfessionalPackReleaseOut(BaseModel):
    """Pack release create / approve / publish / rollback shell."""

    model_config = ConfigDict(extra="ignore")

    id: UUID
    vertical_slug: str | None = None
    status: str | None = None
    created_at: datetime | None = None
    published_at: datetime | None = None
    epoch: int | None = None


class ProfessionalVerticalRolloutOut(BaseModel):
    """Rollout row (GET list)."""

    model_config = ConfigDict(extra="ignore")

    id: UUID
    vertical_slug: str
    release_id: UUID
    mode: str
    percentage: int
    is_paused: bool
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ProfessionalVerticalRolloutMutateOut(BaseModel):
    """Rollout create / patch / pause / resume (sparse fields + optional epoch)."""

    model_config = ConfigDict(extra="ignore")

    id: UUID
    vertical_slug: str
    release_id: UUID | None = None
    mode: str | None = None
    percentage: int | None = None
    is_paused: bool | None = None
    created_at: datetime | None = None
    epoch: int | None = None


class ProfessionalAiActionTestOut(BaseModel):
    """Dry-run AI action validation (admin)."""

    ok: bool
    action_key: str
    vertical_slug: str
    ugs_type_key: str | None = None
    requires_prompt: bool = False
    output_schema_keys: list[str] = Field(default_factory=list)


class ProfessionalPhotoPresetTestOut(BaseModel):
    """Dry-run photo preset resolution (admin)."""

    model_config = ConfigDict(extra="ignore")

    ok: bool
    preset_key: str
    vertical_slug: str
    sample_content_id: UUID | None = None
    ugs_type_key: str | None = None
    action_type: str | None = None
    parameters: ProfessionalWorldsJsonMap = Field(default_factory=dict)


class ProfessionalAiActionPromptInspectOut(BaseModel):
    """Admin-only AI action prompt inspect."""

    vertical_slug: str
    action_key: str
    prompt_template: str | None = None
    workflow_slug: str | None = None
    ugs_type_key: str | None = None


class ProfessionalPhotoPresetPromptInspectOut(BaseModel):
    """Admin-only photo preset prompt inspect."""

    vertical_slug: str
    preset_key: str
    prompt_template: str | None = None
    ugs_type_key: str | None = None


class ProfessionalVerticalPackExportOut(BaseModel):
    """Vertical pack JSON export shell (nested sections stay bags)."""

    model_config = ConfigDict(extra="ignore")

    vertical: ProfessionalWorldsJsonMap | None = None
    module_catalog: ProfessionalWorldsJsonList = Field(default_factory=list)
    modules: ProfessionalWorldsJsonList = Field(default_factory=list)
    schemas: ProfessionalWorldsJsonList = Field(default_factory=list)
    ai_actions: ProfessionalWorldsJsonList = Field(default_factory=list)
    photo_presets: ProfessionalWorldsJsonList = Field(default_factory=list)
    integrations: ProfessionalWorldsJsonList = Field(default_factory=list)


class ProfessionalPackManifestSnapshotBody(BaseModel):
    """Vertical pack manifest snapshot (export round-trip, import, diff, version create).

    ADR (B9c): OpenAPI uses typed section fields + ``extra="allow"`` so forward-compatible
    manifest keys remain valid while FE codegen avoids bare ``additionalProperties: true``.
    """

    model_config = ConfigDict(extra="allow")

    schema_version: str | None = None
    vertical: ProfessionalWorldsJsonMap | None = None
    module_catalog: ProfessionalWorldsJsonList = Field(default_factory=list)
    modules: ProfessionalWorldsJsonList = Field(default_factory=list)
    schemas: ProfessionalWorldsJsonList = Field(default_factory=list)
    ai_actions: ProfessionalWorldsJsonList = Field(default_factory=list)
    photo_presets: ProfessionalWorldsJsonList = Field(default_factory=list)
    integrations: ProfessionalWorldsJsonList = Field(default_factory=list)


class ProfessionalPackVersionCreateBody(BaseModel):
    """Create a named pack version from a manifest snapshot."""

    version_label: str = Field(..., min_length=1, max_length=80)
    manifest: ProfessionalPackManifestSnapshotBody = Field(default_factory=ProfessionalPackManifestSnapshotBody)
    changelog_md: str | None = None


class ProfessionalPackReleaseCreateBody(BaseModel):
    """Create a draft release."""

    pack_version_id: UUID | None = None
    notes: str | None = None


class ProfessionalRolloutCreateBody(BaseModel):
    """Start a rollout for a published release."""

    release_id: UUID
    mode: str = Field("all", max_length=40)
    percentage: int = Field(100, ge=0, le=100)


class ProfessionalRolloutPatchBody(BaseModel):
    """Patch rollout targeting parameters."""

    mode: str | None = Field(None, max_length=40)
    percentage: int | None = Field(None, ge=0, le=100)


class VerticalPackImportRequest(BaseModel):
    """Import/export payload for a vertical pack."""

    pack: ProfessionalPackManifestSnapshotBody = Field(default_factory=ProfessionalPackManifestSnapshotBody)
    confirm: bool = False
    job_id: UUID | None = None


class VerticalPackImportResult(BaseModel):
    """Dry-run or committed import summary."""

    dry_run: bool = True
    valid: bool = True
    messages: list[str] = Field(default_factory=list)
    pack: ProfessionalPackManifestSnapshotBody = Field(default_factory=ProfessionalPackManifestSnapshotBody)
    job_id: UUID | None = None


class ProfessionalPackDiffSectionStats(BaseModel):
    """Live vs incoming list sizes for one pack section."""

    live_count: int = 0
    incoming_count: int = 0


class ProfessionalPackDiffOut(BaseModel):
    """Structured diff summary (admin pack compare)."""

    sections: dict[str, ProfessionalPackDiffSectionStats] = Field(default_factory=dict)
    risks: list[str] = Field(default_factory=list)


class ProfessionalPackReleaseApproveBody(BaseModel):
    """Optional operator comment when approving a draft release."""

    comment: str | None = Field(None, max_length=2000)


class ProfessionalAnalyticsEventIn(BaseModel):
    """Ingest payload for professional analytics (future public route)."""

    vertical_slug: str = Field(..., min_length=2, max_length=80)
    event_type: str = Field(..., min_length=1, max_length=120)
    payload: dict[str, Any] = Field(default_factory=dict)


class ProfessionalAnalyticsRollupBucket(BaseModel):
    """One time bucket inside a rollup response."""

    period_start: datetime
    event_count: int = 0
    unique_users_estimate: int | None = None


class ProfessionalAnalyticsRollupOut(BaseModel):
    """Pre-aggregated analytics for Professional Worlds dashboards (future admin API)."""

    vertical_slug: str = Field(..., min_length=2, max_length=80)
    event_type: str = Field(..., min_length=1, max_length=120)
    buckets: list[ProfessionalAnalyticsRollupBucket] = Field(default_factory=list)
    totals: dict[str, int] = Field(default_factory=dict)


class ObjectIntakeParseRequest(BaseModel):
    """Raw realtor object text intake request."""

    source_text: str = Field(..., min_length=20, max_length=12000)
    target_property_id: UUID | None = None
    idempotency_key: str | None = Field(None, min_length=8, max_length=120)


class ObjectIntakePreview(BaseModel):
    """Structured parse preview before user commits a property."""

    job_id: UUID | None = None
    property: RealtorPropertyCreate
    confidence: dict[str, float] = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)
    source_text: str


class ProfessionalWorldsIntakeSseStartedOut(BaseModel):
    """SSE ``event: started`` after UGS accepts object-intake extraction."""

    request_id: str
    status: str = "processing"


class ProfessionalWorldsIntakeSseResultOut(BaseModel):
    """SSE ``event: result`` with saved intake preview (+ optional diagnostics)."""

    job_id: UUID | None = None
    property: dict[str, Any]
    confidence: dict[str, float] = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)
    source_text: str
    intake_diagnostics: dict[str, Any] | None = None


class ProfessionalWorldsIntakeStreamSsePayloadDoc(
    RootModel[
        ProfessionalWorldsIntakeSseStartedOut | ProfessionalWorldsIntakeSseResultOut | ProfessionalWorldsAiSseErrorOut
    ]
):
    """OpenAPI doc for PW realtor object-intake ``text/event-stream`` ``data:`` JSON.

    Wire may also forward UGS ``progress`` / ``queued`` and keep-alive comments.
    """


class ObjectIntakeCommitRequest(BaseModel):
    """Commit accepted intake fields into a new or existing property."""

    job_id: UUID
    accepted_fields: list[str] = Field(default_factory=list)
    target_property_id: UUID | None = None


class MediaEnhancementRequest(BaseModel):
    """Start media enhancement from existing Unified Content."""

    content_id: UUID
    preset_key: str = Field(..., min_length=2, max_length=140)
    instruction: str | None = Field(None, max_length=2000)
    attach_on_complete: bool = False
    idempotency_key: str | None = Field(None, min_length=8, max_length=120)
    reuse_existing_duplicate_job: bool = False


class MediaEnhancementJobOut(BaseModel):
    """Persisted media enhancement job."""

    id: UUID
    property_id: UUID
    source_content_id: UUID | None = None
    output_content_id: UUID | None = None
    preset_key: str
    status: str
    instruction: str | None = None
    provider_result: dict[str, Any] = Field(default_factory=dict)
    batch_job_id: UUID | None = None
    created_at: datetime
    updated_at: datetime


class ProfessionalWorldsMediaSseStartedOut(BaseModel):
    """SSE ``event: started`` after a media enhancement job row exists."""

    job_id: UUID
    status: str | None = None
    batch_id: UUID | None = None
    batch_job_id: UUID | None = None
    batch_item_id: UUID | None = None
    item_index: int | None = None


class ProfessionalWorldsMediaSseResultOut(BaseModel):
    """SSE ``event: result`` with completed job + Unified Content stub."""

    job: MediaEnhancementJobOut
    content: dict[str, Any] = Field(default_factory=dict)
    batch_id: UUID | None = None
    batch_job_id: UUID | None = None
    batch_item_id: UUID | None = None
    item_index: int | None = None


class ProfessionalWorldsMediaSseErrorOut(BaseModel):
    """SSE ``event: error`` for media enhance streams (may include job snapshot)."""

    error: Any
    job: MediaEnhancementJobOut | None = None
    batch_id: UUID | None = None
    batch_job_id: UUID | None = None
    batch_item_id: UUID | None = None
    item_index: int | None = None


class ProfessionalWorldsMediaEnhanceStreamSsePayloadDoc(
    RootModel[
        ProfessionalWorldsMediaSseStartedOut
        | ProfessionalWorldsMediaSseResultOut
        | ProfessionalWorldsMediaSseErrorOut
        | ProfessionalWorldsAiSseErrorOut
    ]
):
    """OpenAPI doc for PW realtor media enhance / upload-enhance ``text/event-stream``."""


class ProfessionalWorldsMediaBatchSseStartedOut(BaseModel):
    """SSE ``event: batch_started`` before sequential batch items run."""

    batch_id: UUID
    total: int


class ProfessionalWorldsMediaBatchSseItemErrorOut(BaseModel):
    """SSE ``event: batch_item_error`` when a queued line cannot start."""

    item_index: int
    error: Any
    batch_item_id: UUID | None = None


class ProfessionalWorldsMediaBatchSseFinishedOut(BaseModel):
    """SSE ``event: batch_finished`` after all batch items were attempted."""

    batch_id: UUID


class ProfessionalWorldsMediaBatchStreamSsePayloadDoc(
    RootModel[
        ProfessionalWorldsMediaBatchSseStartedOut
        | ProfessionalWorldsMediaBatchSseItemErrorOut
        | ProfessionalWorldsMediaBatchSseFinishedOut
        | ProfessionalWorldsMediaSseStartedOut
        | ProfessionalWorldsMediaSseResultOut
        | ProfessionalWorldsMediaSseErrorOut
        | ProfessionalWorldsAiSseErrorOut
    ]
):
    """OpenAPI doc for PW realtor media batch ``…/run/stream`` ``data:`` JSON.

    Per-item enhance events reuse the single-enhance envelopes (with batch trail fields).
    """


class RealtorMediaBatchCreate(BaseModel):
    """Queue a batch group of media enhancements for one listing."""

    preset_key: str = Field(..., min_length=2, max_length=140)
    instruction: str | None = Field(None, max_length=2000)
    source_content_ids: list[UUID] = Field(..., min_length=1, max_length=64)
    idempotency_key: str | None = Field(None, min_length=8, max_length=160)
    batch_meta: dict[str, Any] = Field(default_factory=dict)


class RealtorMediaBatchItemOut(BaseModel):
    """One source image in a batch."""

    id: UUID
    batch_job_id: UUID
    source_content_id: UUID
    enhancement_job_id: UUID | None = None
    preset_key: str | None = None
    status: str
    review_decision: str | None = None
    error: str | None = None
    created_at: datetime
    updated_at: datetime


class RealtorMediaBatchItemReviewBody(BaseModel):
    """User before/after review on a batch line."""

    decision: Literal["accepted", "rejected", "skipped", "pending"]


class BrandVisualKitUpsert(BaseModel):
    """Brand-facing visual kit preferences (colors, logo ref, typography, watermark prefs)."""

    kit: dict[str, Any] = Field(default_factory=dict)


class BrandVisualKitOut(BaseModel):
    """Persisted brand kit row."""

    id: UUID
    user_id: UUID
    vertical_slug: str
    kit: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class ProfessionalMediaAlbumCreate(BaseModel):
    """Create gallery album linked to optionally property/campaign/artifact."""

    title: str = Field(..., min_length=1, max_length=220)
    vertical_slug: str = Field(REALTOR_VERTICAL_SLUG, max_length=80)
    property_id: UUID | None = None
    campaign_id: UUID | None = None
    artifact_id: UUID | None = None
    unified_content_ids: list[UUID] = Field(default_factory=list)
    album_data: dict[str, Any] = Field(default_factory=dict)


class ProfessionalMediaAlbumPatch(BaseModel):
    """Patch album membership or linkage."""

    title: str | None = Field(None, min_length=1, max_length=220)
    unified_content_ids: list[UUID] | None = None
    album_data_patch: dict[str, Any] | None = None
    property_id: UUID | None = None
    campaign_id: UUID | None = None
    artifact_id: UUID | None = None


class ProfessionalMediaAlbumOut(BaseModel):
    """Persisted gallery album."""

    id: UUID
    user_id: UUID
    vertical_slug: str
    title: str
    property_id: UUID | None = None
    campaign_id: UUID | None = None
    artifact_id: UUID | None = None
    unified_content_ids: list[Any] = Field(default_factory=list)
    album_data: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class ProfessionalCrossAppDraftLinkOut(BaseModel):
    """Cross-app artifact handoff bookkeeping."""

    id: UUID
    user_id: UUID
    vertical_slug: str
    draft_kind: str
    artifact_id: UUID | None = None
    external_ref: dict[str, Any] = Field(default_factory=dict)
    lifecycle_state: str
    stale_reason: str | None = None
    source_digest: str | None = None
    is_stale: bool = False
    stale_hint: str | None = None
    created_at: datetime
    updated_at: datetime


class ProfessionalCrossAppDraftReportIn(BaseModel):
    """Destination-app lifecycle report for a persisted cross-app draft link."""

    lifecycle_state: str = Field(..., min_length=1, max_length=24)
    remote_tracking: dict[str, Any] | None = None


class RealtorMediaBatchJobOut(BaseModel):
    """Batch processing group with item rows."""

    id: UUID
    property_id: UUID
    preset_key: str
    status: str
    instruction: str | None = None
    idempotency_key: str | None = None
    batch_meta: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime
    items: list[RealtorMediaBatchItemOut] = Field(default_factory=list)


class RealtorMediaBatchDetailOut(BaseModel):
    """Batch job with linked items and enhancement rows."""

    batch: RealtorMediaBatchJobOut
    items: list[RealtorMediaBatchItemOut]
    enhancement_jobs: list[MediaEnhancementJobOut] = Field(default_factory=list)


class ProfessionalAiEvalDatasetCreate(BaseModel):
    """Create an evaluation dataset."""

    vertical_slug: str = Field(..., min_length=2, max_length=80)
    name: str = Field(..., min_length=1, max_length=180)
    description: str | None = Field(None, max_length=4000)
    cases: list[dict[str, Any]] = Field(default_factory=list)
    is_active: bool = True


class ProfessionalAiEvalDatasetUpdate(BaseModel):
    """Patch dataset metadata or cases."""

    name: str | None = Field(None, min_length=1, max_length=180)
    description: str | None = Field(None, max_length=4000)
    cases: list[dict[str, Any]] | None = None
    is_active: bool | None = None


class ProfessionalAiEvalDatasetOut(BaseModel):
    """Persisted evaluation dataset."""

    id: UUID
    vertical_slug: str
    name: str
    description: str | None = None
    cases: list[dict[str, Any]] = Field(default_factory=list)
    is_active: bool = True
    created_at: datetime
    updated_at: datetime


class ProfessionalAiEvalRunCreateBody(BaseModel):
    """Start an evaluation run for one action or playbook."""

    dataset_id: UUID
    target_type: Literal["ai_action", "playbook"]
    target_key: str = Field(..., min_length=1, max_length=160)
    simulate: bool = False
    notes: str | None = Field(None, max_length=4000)
    idempotency_prefix: str | None = Field(None, min_length=4, max_length=120)


class ProfessionalAiEvalRunSampleOut(BaseModel):
    """Single case result."""

    id: UUID
    run_id: UUID
    case_index: int
    label: str | None = None
    input_redacted: dict[str, Any] = Field(default_factory=dict)
    prompt_sample: str | None = None
    output_sample: dict[str, Any] = Field(default_factory=dict)
    scores: dict[str, Any] = Field(default_factory=dict)
    rubric_details: dict[str, Any] = Field(default_factory=dict)
    human_review_notes: str | None = None
    human_reviewed_by: UUID | None = None
    human_reviewed_at: datetime | None = None
    created_at: datetime


class ProfessionalAiEvalRunOut(BaseModel):
    """Evaluation run with optional nested samples."""

    id: UUID
    dataset_id: UUID
    vertical_slug: str
    target_type: str
    target_key: str
    status: str
    scores: dict[str, Any] = Field(default_factory=dict)
    notes: str | None = None
    human_review_notes: str | None = None
    admin_user_id: UUID | None = None
    error: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    dataset_name: str | None = None
    samples: list[ProfessionalAiEvalRunSampleOut] = Field(default_factory=list)


class ProfessionalAiEvalDashboardOut(BaseModel):
    """Admin dashboard snapshot for AI evaluation."""

    datasets: list[ProfessionalAiEvalDatasetOut] = Field(default_factory=list)
    recent_runs: list[ProfessionalAiEvalRunOut] = Field(default_factory=list)


class ProfessionalAiEvalHumanNotesBody(BaseModel):
    """Patch human review notes."""

    human_review_notes: str | None = Field(None, max_length=8000)


class RealtorLeadCreate(BaseModel):
    """Create a realtor lead."""

    name: str = Field(..., min_length=1, max_length=180)
    contact: str | None = Field(None, max_length=240)
    source: str | None = Field(None, max_length=120)
    notes: str | None = None
    status: str = Field(default="new", max_length=80)
    vertical_slug: str = Field(default=REALTOR_VERTICAL_SLUG, max_length=80)
    lead_data: dict[str, Any] = Field(default_factory=dict)


class RealtorLeadOut(BaseModel):
    """Persisted realtor lead."""

    id: UUID
    user_id: UUID
    vertical_slug: str
    name: str
    contact: str | None = None
    source: str | None = None
    status: str
    notes: str | None = None
    converted_client_id: UUID | None = None
    lead_data: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class RealtorLeadConvertOut(BaseModel):
    """Lead converted (or already linked) to a CRM client."""

    lead: RealtorLeadOut
    client: ProfessionalClientOut


class RealtorPropertyShowingCreate(BaseModel):
    """Schedule a property showing."""

    property_id: UUID
    client_id: UUID | None = None
    scheduled_at: datetime
    status: RealtorShowingStatus = Field(default="planned")
    notes: str | None = None
    duration_minutes: int | None = Field(default=None, ge=1, le=1440)
    location_notes: str | None = Field(default=None, max_length=2000)
    deal_id: UUID | None = None

    @field_validator("status", mode="before")
    @classmethod
    def _normalize_showing_status_create(cls, value: object) -> str:
        try:
            normalized = normalize_realtor_showing_status(None if value is None else str(value))
        except ValueError as exc:
            raise ValueError(str(exc)) from exc
        return normalized or "planned"


class RealtorPropertyShowingUpdate(BaseModel):
    """Patch a scheduled showing."""

    client_id: UUID | None = None
    clear_client: bool = False
    scheduled_at: datetime | None = None
    status: RealtorShowingStatus | None = Field(default=None)
    notes: str | None = None
    duration_minutes: int | None = Field(default=None, ge=1, le=1440)
    location_notes: str | None = Field(default=None, max_length=2000)
    deal_id: UUID | None = None
    clear_deal: bool = False

    @field_validator("status", mode="before")
    @classmethod
    def _normalize_showing_status_update(cls, value: object) -> str | None:
        if value is None:
            return None
        try:
            return normalize_realtor_showing_status(str(value))
        except ValueError as exc:
            raise ValueError(str(exc)) from exc


class RealtorPropertyShowingOut(BaseModel):
    """Persisted showing row."""

    id: UUID
    user_id: UUID
    property_id: UUID
    client_id: UUID | None = None
    scheduled_at: datetime
    status: str
    notes: str | None = None
    duration_minutes: int | None = None
    location_notes: str | None = None
    deal_id: UUID | None = None
    created_at: datetime
    updated_at: datetime


class RealtorTaskCreate(BaseModel):
    """Create a Realtor Pro task / next-action."""

    title: str = Field(..., min_length=1, max_length=220)
    status: str = Field("open", max_length=60)
    priority: str = Field("normal", max_length=40)
    due_at: datetime | None = None
    reminder_at: datetime | None = None
    next_action: str | None = Field(None, max_length=280)
    notes: str | None = None
    property_id: UUID | None = None
    client_id: UUID | None = None
    showing_id: UUID | None = None
    deal_id: UUID | None = None
    task_meta: dict[str, Any] = Field(default_factory=dict)


class RealtorTaskUpdate(BaseModel):
    """Patch realtor task."""

    title: str | None = Field(None, min_length=1, max_length=220)
    status: str | None = Field(None, max_length=60)
    priority: str | None = Field(None, max_length=40)
    due_at: datetime | None = None
    reminder_at: datetime | None = None
    next_action: str | None = Field(None, max_length=280)
    notes: str | None = None
    property_id: UUID | None = None
    clear_property: bool = False
    client_id: UUID | None = None
    clear_client: bool = False
    showing_id: UUID | None = None
    clear_showing: bool = False
    deal_id: UUID | None = None
    clear_deal: bool = False
    task_meta: dict[str, Any] | None = None


class RealtorTaskOut(BaseModel):
    """Persisted realtor task."""

    id: UUID
    user_id: UUID
    title: str
    status: str
    priority: str
    due_at: datetime | None = None
    reminder_at: datetime | None = None
    next_action: str | None = None
    notes: str | None = None
    property_id: UUID | None = None
    client_id: UUID | None = None
    showing_id: UUID | None = None
    deal_id: UUID | None = None
    task_meta: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class ProfessionalPlaybookCostStepEstimate(BaseModel):
    """Per-step billing hint rollup for playbook estimates."""

    step_order: int
    action_key: str
    billing_hint: dict[str, Any] = Field(default_factory=dict)
    estimated_units: float = 0.0


class ProfessionalPlaybookCostEstimateOut(BaseModel):
    """Aggregate hint-only cost estimate before executing a playbook."""

    vertical_slug: str
    playbook_key: str
    total_estimated_units: float = 0.0
    total_ugs_credits: float | None = None
    steps: list[ProfessionalPlaybookCostStepEstimate] = Field(default_factory=list)


class RealtorQuotaPlaybookEstimateOut(BaseModel):
    """Hint-only playbook cost row for realtor quota summary."""

    playbook_key: str
    display_name: str | None = None
    total_estimated_units: float = 0.0
    total_ugs_credits: float | None = None


class RealtorQuotaSummaryOut(BaseModel):
    """User-scoped realtor quota and playbook estimate helpers."""

    vertical_slug: str = "realtor"
    credits_used_24h: float = 0.0
    credits_balance: float | None = None
    playbook_estimates: list[RealtorQuotaPlaybookEstimateOut] = Field(default_factory=list)


# --- Realtor Pro (next expansion tables) ---


class RealtorBuyerRequirementCreate(BaseModel):
    """Create buyer requirement sheet."""

    title: str = Field(..., min_length=1, max_length=220)
    client_id: UUID | None = None
    requirements: dict[str, Any] = Field(default_factory=dict)


class RealtorBuyerRequirementUpdate(BaseModel):
    """Patch buyer requirements."""

    title: str | None = Field(None, min_length=1, max_length=220)
    requirements: dict[str, Any] | None = None


class RealtorBuyerRequirementOut(BaseModel):
    """Persisted buyer requirements row."""

    id: UUID
    user_id: UUID
    client_id: UUID | None = None
    title: str
    requirements: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class RealtorSellerProfileCreate(BaseModel):
    """Create seller context profile."""

    client_id: UUID | None = None
    seller_context: dict[str, Any] = Field(default_factory=dict)


class RealtorSellerProfileUpdate(BaseModel):
    """Replace seller context JSON."""

    seller_context: dict[str, Any] = Field(default_factory=dict)


class RealtorSellerProfileOut(BaseModel):
    """Persisted seller profile."""

    id: UUID
    user_id: UUID
    client_id: UUID | None = None
    seller_context: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class DealEventAppend(BaseModel):
    """Append deal pipeline event."""

    stage_from: str | None = Field(None, max_length=80)
    stage_to: str = Field(..., min_length=1, max_length=80)
    note: str | None = None
    event_data: dict[str, Any] = Field(default_factory=dict)


class RealtorDealEventOut(BaseModel):
    """Deal timeline row."""

    id: UUID
    user_id: UUID
    deal_id: UUID
    stage_from: str | None = None
    stage_to: str
    note: str | None = None
    event_data: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class RealtorProDocumentCreate(BaseModel):
    """Document checklist row."""

    deal_id: UUID | None = None
    property_id: UUID | None = None
    title: str = Field(..., min_length=1, max_length=220)
    doc_type: str = Field("other", max_length=120)
    checklist_state: dict[str, Any] = Field(default_factory=dict)
    unified_content_id: UUID | None = None


class RealtorProDocumentUpdate(BaseModel):
    """Patch document metadata."""

    title: str | None = Field(None, min_length=1, max_length=220)
    doc_type: str | None = Field(None, max_length=120)
    checklist_state: dict[str, Any] | None = None
    unified_content_id: UUID | None = None


class RealtorProDocumentOut(BaseModel):
    """Persisted realtor document."""

    id: UUID
    user_id: UUID
    deal_id: UUID | None = None
    property_id: UUID | None = None
    title: str
    doc_type: str
    checklist_state: dict[str, Any] = Field(default_factory=dict)
    unified_content_id: UUID | None = None
    created_at: datetime
    updated_at: datetime


class PriceAnalysisSnapshotCreate(BaseModel):
    """Store comps / analyst snapshot payload."""

    snapshot: dict[str, Any] = Field(default_factory=dict)


class RealtorPriceAnalysisSnapshotOut(BaseModel):
    """Persisted price analysis snapshot."""

    id: UUID
    user_id: UUID
    property_id: UUID
    snapshot: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class MarketingCampaignCreate(BaseModel):
    """Marketing campaign plan."""

    property_id: UUID | None = None
    title: str = Field(..., min_length=1, max_length=220)
    channels: list[Any] = Field(default_factory=list)
    status: str = Field("draft", max_length=80)
    campaign_data: dict[str, Any] = Field(default_factory=dict)


class MarketingCampaignUpdate(BaseModel):
    """Patch campaign."""

    title: str | None = Field(None, min_length=1, max_length=220)
    channels: list[Any] | None = None
    status: str | None = Field(None, max_length=80)
    campaign_data: dict[str, Any] | None = None


class RealtorMarketingCampaignOut(BaseModel):
    """Persisted campaign."""

    id: UUID
    user_id: UUID
    property_id: UUID | None = None
    title: str
    channels: list[Any] = Field(default_factory=list)
    status: str
    campaign_data: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class CommunicationLogCreate(BaseModel):
    """Outbound communication log entry."""

    related_type: str = Field(..., min_length=1, max_length=80)
    related_id: UUID | None = None
    channel: str = Field(..., min_length=1, max_length=80)
    body: str = Field(..., min_length=1)
    meta: dict[str, Any] = Field(default_factory=dict)


class RealtorCommunicationLogOut(BaseModel):
    """Persisted communication log."""

    id: UUID
    user_id: UUID
    related_type: str
    related_id: UUID | None = None
    channel: str
    body: str
    meta: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class ObjectionReplyUpsert(BaseModel):
    """Library snippet for objections."""

    reply_text: str = Field(..., min_length=1)
    tags: list[str] = Field(default_factory=list)


class RealtorObjectionReplyOut(BaseModel):
    """Persisted objection reply."""

    id: UUID
    user_id: UUID
    objection_key: str
    reply_text: str
    tags: list[Any] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class PublicationChannelUpsert(BaseModel):
    """Create or replace channel row for listing."""

    channel_key: str = Field(..., min_length=1, max_length=120)
    status: RealtorPublicationChannelStatus = Field("pending")
    meta: dict[str, Any] = Field(default_factory=dict)

    @field_validator("status", mode="before")
    @classmethod
    def _normalize_channel_status_upsert(cls, value: object) -> str:
        try:
            normalized = normalize_realtor_publication_channel_status(None if value is None else str(value))
        except ValueError as exc:
            raise ValueError(str(exc)) from exc
        return normalized or "pending"


class PublicationChannelPatch(BaseModel):
    """Patch publication channel row."""

    status: RealtorPublicationChannelStatus | None = Field(None)
    meta: dict[str, Any] | None = None

    @field_validator("status", mode="before")
    @classmethod
    def _normalize_channel_status_patch(cls, value: object) -> str | None:
        if value is None:
            return None
        try:
            return normalize_realtor_publication_channel_status(str(value))
        except ValueError as exc:
            raise ValueError(str(exc)) from exc


class RealtorPublicationChannelOut(BaseModel):
    """Listing × channel status."""

    id: UUID
    user_id: UUID
    property_id: UUID
    channel_key: str
    status: str
    meta: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class RealtorListingQualityScoreOut(BaseModel):
    """Heuristic listing quality history row."""

    id: UUID
    user_id: UUID
    property_id: UUID
    score: float
    breakdown: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
