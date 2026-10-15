# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Pydantic schemas for the UGS Admin API: users, providers, generation types, workflows, settings, and v2 bulk ops.
# Invariants:
# - Admin v2 DTOs are additive and must not weaken legacy UGS Admin response contracts.
# - Bulk operations are validated by discriminated `kind` fields and rechecked by backend services before apply.
# - AdminGenerationTypeResponse is named distinctly so public api.schemas.ugs.GenerationTypeResponse keeps a clean OpenAPI key.
# Related:
# - api/routers/ugs_admin.py
# - api/services/ugs/admin_v2_service.py
# - documentation/api/FRONTEND-BACKEND-HTTP.md §UGS typed contracts
# ---
"""Pydantic схемы для UGS админ-панели"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import AnyHttpUrl, BaseModel, ConfigDict, Field, field_validator  # type: ignore[import-untyped]

# ---------------------------------------------------------------------------
# Провайдеры
# ---------------------------------------------------------------------------

UGSSettingScope = Literal["global", "company", "project", "user"]


class AdminUserResponse(BaseModel):
    id: UUID
    email: str
    username: str
    full_name: str | None = None
    role: str
    is_trusted: bool = False
    admin_badge_label: str | None = None
    admin_badge_hint: str | None = None
    is_system_account: bool = False
    credits: float
    daily_credit_limit: int | None = None
    monthly_credit_limit: int | None = None
    concurrent_requests_limit: int | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class UserLimitsUpdateRequest(BaseModel):
    """Полная замена лимитов биллинга/параллелизма (админ UGS)."""

    daily_credit_limit: int = Field(..., ge=0, le=10_000_000)
    monthly_credit_limit: int = Field(..., ge=0, le=100_000_000)
    concurrent_requests_limit: int = Field(..., ge=1, le=10_000)


class UserCreditTopUpRequest(BaseModel):
    amount: int = Field(..., gt=0, le=100_000)
    reason: str | None = Field(None, max_length=500)


class UserTrustedSetRequest(BaseModel):
    """Админ: метка «доверенный пользователь» (бейдж в профиле и GAF)."""

    is_trusted: bool


class UserAdminBadgeSetRequest(BaseModel):
    """Админ: дополнительный значок (текст на выбор + подсказка). Пустой label — сброс."""

    label: str | None = Field(None, max_length=64)
    hint: str | None = Field(None, max_length=512)

    @field_validator("label", "hint", mode="before")
    @classmethod
    def _strip_optional(cls, v: object) -> str | None:
        if v is None:
            return None
        if isinstance(v, str):
            s = v.strip()
            return s or None
        return str(v) if v else None


class GenerationProviderBase(BaseModel):
    provider_name: str = Field(..., max_length=50)
    provider_type: str = Field(..., max_length=20)
    base_url: str | None = None
    api_key_required: bool = False
    health_endpoint: str | None = None
    timeout_seconds: int = Field(default=30, ge=1)
    max_concurrent: int = Field(default=5, ge=1)
    enabled: bool = True
    cost_per_request: float = Field(default=0.0, ge=0)
    fallback_priority: int = Field(default=0, ge=0)
    fallback_for: list[str] = Field(default_factory=list)
    config_json: dict[str, Any] = Field(default_factory=dict)
    display_label: str | None = Field(default=None, max_length=120)

    @field_validator("fallback_for", mode="before")
    @classmethod
    def _ensure_list(cls, value: Any) -> list[str]:  # pragma: no cover - defensive guard
        if value is None:
            return []
        if isinstance(value, (list, tuple)):
            return list(value)
        if isinstance(value, str):
            return [value]
        msg = "fallback_for must be list of provider names"
        raise ValueError(msg)

    @field_validator("base_url", mode="before")
    @classmethod
    def _normalize_base_url(cls, value: Any) -> str | None:
        if value is None:
            return None
        if isinstance(value, AnyHttpUrl):
            return str(value)
        if isinstance(value, str):
            normalized = value.strip()
            return normalized or None
        msg = "base_url must be a string URL"
        raise ValueError(msg)


class GenerationProviderCreate(GenerationProviderBase):
    pass


class GenerationProviderUpdate(BaseModel):
    base_url: str | None = None
    api_key_required: bool | None = None
    health_endpoint: str | None = None
    timeout_seconds: int | None = Field(None, ge=1)
    max_concurrent: int | None = Field(None, ge=1)
    enabled: bool | None = None
    cost_per_request: float | None = Field(None, ge=0)
    fallback_priority: int | None = Field(None, ge=0)
    fallback_for: list[str] | None = None
    config_json: dict[str, Any] | None = None
    display_label: str | None = Field(None, max_length=120)

    @field_validator("base_url", mode="before")
    @classmethod
    def _normalize_base_url(cls, value: Any) -> str | None:
        if value is None:
            return None
        if isinstance(value, AnyHttpUrl):
            return str(value)
        if isinstance(value, str):
            normalized = value.strip()
            return normalized or None
        msg = "base_url must be a string URL"
        raise ValueError(msg)


class GenerationProviderResponse(GenerationProviderBase):
    id: UUID
    created_at: datetime | None = None
    updated_at: datetime | None = None


# ---------------------------------------------------------------------------
# Generation Types
# ---------------------------------------------------------------------------


class GenerationTypeBase(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    type_key: str = Field(..., max_length=100)
    category: str = Field(..., max_length=50)
    display_name: str = Field(..., max_length=150)
    description: str | None = None
    provider: str = Field(..., max_length=100)
    model_name: str | None = Field(default=None, max_length=255)
    parameters: dict[str, Any] = Field(default_factory=dict)
    complexity: str = Field(default="medium", max_length=20)
    estimated_time: int = Field(default=60, ge=0)
    max_retries: int = Field(default=3, ge=0)
    priority: int = Field(default=5, ge=0, le=100)
    cost_credits: float = Field(default=0.0, ge=0)
    is_active: bool = True
    metadata: dict[str, Any] = Field(default_factory=dict)


class GenerationTypeCreate(GenerationTypeBase):
    pass


class GenerationTypeUpdate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    category: str | None = Field(None, max_length=50)
    display_name: str | None = Field(None, max_length=150)
    description: str | None = None
    provider: str | None = Field(None, max_length=100)
    model_name: str | None = Field(None, max_length=255)
    parameters: dict[str, Any] | None = None
    complexity: str | None = Field(None, max_length=20)
    estimated_time: int | None = Field(None, ge=0)
    max_retries: int | None = Field(None, ge=0)
    priority: int | None = Field(None, ge=0, le=100)
    cost_credits: float | None = Field(None, ge=0)
    is_active: bool | None = None
    metadata: dict[str, Any] | None = None


class AdminGenerationTypeResponse(GenerationTypeBase):
    """Admin catalog type row (distinct OpenAPI name from public GenerationTypeResponse)."""

    model_config = ConfigDict(title="AdminGenerationTypeResponse", protected_namespaces=())

    id: UUID
    created_at: datetime | None = None
    updated_at: datetime | None = None


# ---------------------------------------------------------------------------
# ComfyUI Workflows
# ---------------------------------------------------------------------------


class ComfyUIWorkflowBase(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    name: str
    slug: str
    category: str | None = None
    description: str | None = None
    json_body: dict[str, Any]
    model_dependencies: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
    estimated_time: int | None = Field(default=None, ge=0)
    version: int = Field(default=1, ge=1)
    is_active: bool = True


class ComfyUIWorkflowCreate(ComfyUIWorkflowBase):
    pass


class ComfyUIWorkflowUpdate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    name: str | None = None
    category: str | None = None
    description: str | None = None
    json_body: dict[str, Any] | None = None
    model_dependencies: list[str] | None = None
    metadata: dict[str, Any] | None = None
    estimated_time: int | None = Field(None, ge=0)
    version: int | None = Field(None, ge=1)
    is_active: bool | None = None


class ComfyUIWorkflowResponse(ComfyUIWorkflowBase):
    id: UUID
    created_by: UUID | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


# ---------------------------------------------------------------------------
# UGS Settings
# ---------------------------------------------------------------------------


class UGSSettingBase(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    scope: UGSSettingScope = Field(default="global")
    key: str = Field(..., max_length=150)
    value: dict[str, Any]
    description: str | None = None
    company_id: UUID | None = None
    project_id: UUID | None = None
    user_id: UUID | None = None


class UGSSettingCreate(UGSSettingBase):
    pass


class UGSSettingUpdate(BaseModel):
    value: dict[str, Any] | None = None
    description: str | None = None
    company_id: UUID | None = None
    project_id: UUID | None = None
    user_id: UUID | None = None


class UGSSettingResponse(UGSSettingBase):
    id: UUID
    created_at: datetime | None = None
    updated_at: datetime | None = None


# ---------------------------------------------------------------------------
# Admin V2: snapshot + bulk operations + validation
# ---------------------------------------------------------------------------


UgsAdminV2EntityType = Literal["provider", "type", "workflow", "settings", "model_route", "config_source"]
UgsAdminV2IssueSeverity = Literal["error", "warning", "info"]
UgsAdminV2OperationKind = Literal[
    "provider.create",
    "provider.patch",
    "provider.set_enabled",
    "type.create",
    "type.patch",
    "type.set_active",
    "type.clear_model_names",
    "workflow.create",
    "workflow.patch",
    "workflow.set_active",
    "model_routes.patch",
    "model_routes.replace",
    "provider.models.refresh",
    "provider.default_model.set",
    "workflow.import_from_disk",
    "settings.create",
    "settings.patch",
    "settings.delete",
]
UgsAdminV2BulkOperationStatus = Literal["applied", "skipped", "failed"]


class UgsAdminV2ValidationIssue(BaseModel):
    severity: UgsAdminV2IssueSeverity = Field(..., description="error blocks apply; warning requires confirmation")
    entity_type: UgsAdminV2EntityType
    entity_id: str
    message: str
    field: str | None = None


class UgsAdminV2ModelRoutes(BaseModel):
    global_default_model: str | None = None
    provider_defaults: dict[str, str | None] = Field(default_factory=dict)
    category_defaults: dict[str, str | None] = Field(default_factory=dict)
    domain_defaults: dict[str, str | None] = Field(default_factory=dict)
    type_overrides: dict[str, str | None] = Field(default_factory=dict)
    request_model_override_allowlist: list[str] = Field(default_factory=list)


class UgsAdminV2ModelInventoryItem(BaseModel):
    provider_name: str
    model_id: str
    label: str | None = None
    enabled: bool = True
    source: str = "provider.config_json"
    capabilities: list[str] = Field(default_factory=list)


class UgsAdminV2ResolvedModel(BaseModel):
    type_key: str
    provider: str
    category: str | None = None
    domain: str | None = None
    resolved_model: str | None = None
    source: str
    warnings: list[str] = Field(default_factory=list)


class UgsAdminV2ConfigSourceAuditItem(BaseModel):
    key: str
    severity: UgsAdminV2IssueSeverity = "warning"
    source_type: Literal["env", "hardcode", "file", "db"]
    message: str
    recommendation: str | None = None


class UgsAdminV2AutofixRecommendation(BaseModel):
    id: str
    title: str
    description: str
    severity: UgsAdminV2IssueSeverity = "info"
    operations: list[dict[str, Any]] = Field(default_factory=list)
    affected_count: int = 0


class UgsAdminV2SnapshotResponse(BaseModel):
    providers: list[GenerationProviderResponse]
    types: list[AdminGenerationTypeResponse]
    workflows: list[ComfyUIWorkflowResponse]
    settings: UGSSettingListResponse
    model_routes: UgsAdminV2ModelRoutes = Field(default_factory=UgsAdminV2ModelRoutes)
    model_inventory: list[UgsAdminV2ModelInventoryItem] = Field(default_factory=list)
    resolved_models_by_type: list[UgsAdminV2ResolvedModel] = Field(default_factory=list)
    config_source_audit: list[UgsAdminV2ConfigSourceAuditItem] = Field(default_factory=list)
    autofix_recommendations: list[UgsAdminV2AutofixRecommendation] = Field(default_factory=list)
    issues: list[UgsAdminV2ValidationIssue] = Field(default_factory=list)
    generated_at: datetime


class UgsAdminV2ProviderPatchOperation(BaseModel):
    kind: Literal["provider.patch"] = "provider.patch"
    provider_names: list[str] = Field(..., min_length=1)
    patch: GenerationProviderUpdate


class UgsAdminV2ProviderCreateOperation(BaseModel):
    kind: Literal["provider.create"] = "provider.create"
    provider: GenerationProviderCreate


class UgsAdminV2ProviderSetEnabledOperation(BaseModel):
    kind: Literal["provider.set_enabled"] = "provider.set_enabled"
    provider_names: list[str] = Field(..., min_length=1)
    enabled: bool


class UgsAdminV2TypeCreateOperation(BaseModel):
    kind: Literal["type.create"] = "type.create"
    generation_type: GenerationTypeCreate


class UgsAdminV2TypePatchOperation(BaseModel):
    kind: Literal["type.patch"] = "type.patch"
    type_keys: list[str] = Field(..., min_length=1)
    patch: GenerationTypeUpdate


class UgsAdminV2TypeSetActiveOperation(BaseModel):
    kind: Literal["type.set_active"] = "type.set_active"
    type_keys: list[str] = Field(..., min_length=1)
    is_active: bool


class UgsAdminV2TypeClearModelNamesOperation(BaseModel):
    kind: Literal["type.clear_model_names"] = "type.clear_model_names"
    type_keys: list[str] = Field(..., min_length=1)


class UgsAdminV2WorkflowCreateOperation(BaseModel):
    kind: Literal["workflow.create"] = "workflow.create"
    workflow: ComfyUIWorkflowCreate


class UgsAdminV2WorkflowPatchOperation(BaseModel):
    kind: Literal["workflow.patch"] = "workflow.patch"
    slugs: list[str] = Field(..., min_length=1)
    patch: ComfyUIWorkflowUpdate


class UgsAdminV2WorkflowSetActiveOperation(BaseModel):
    kind: Literal["workflow.set_active"] = "workflow.set_active"
    slugs: list[str] = Field(..., min_length=1)
    is_active: bool


class UgsAdminV2ModelRoutesPatchOperation(BaseModel):
    kind: Literal["model_routes.patch"] = "model_routes.patch"
    routes: UgsAdminV2ModelRoutes


class UgsAdminV2ModelRoutesReplaceOperation(BaseModel):
    kind: Literal["model_routes.replace"] = "model_routes.replace"
    routes: UgsAdminV2ModelRoutes


class UgsAdminV2ProviderDefaultModelSetOperation(BaseModel):
    kind: Literal["provider.default_model.set"] = "provider.default_model.set"
    provider_names: list[str] = Field(..., min_length=1)
    default_model: str


class UgsAdminV2ProviderModelsRefreshOperation(BaseModel):
    kind: Literal["provider.models.refresh"] = "provider.models.refresh"
    provider_names: list[str] = Field(..., min_length=1)


class UgsAdminV2WorkflowImportFromDiskOperation(BaseModel):
    kind: Literal["workflow.import_from_disk"] = "workflow.import_from_disk"
    overwrite_existing: bool = True


class UgsAdminV2SettingCreateOperation(BaseModel):
    kind: Literal["settings.create"] = "settings.create"
    setting: UGSSettingCreate


class UgsAdminV2SettingPatchOperation(BaseModel):
    kind: Literal["settings.patch"] = "settings.patch"
    setting_ids: list[str] = Field(..., min_length=1)
    patch: UGSSettingUpdate


class UgsAdminV2SettingDeleteOperation(BaseModel):
    kind: Literal["settings.delete"] = "settings.delete"
    setting_ids: list[str] = Field(..., min_length=1)


UgsAdminV2BulkOperation = (
    UgsAdminV2ProviderCreateOperation
    | UgsAdminV2ProviderPatchOperation
    | UgsAdminV2ProviderSetEnabledOperation
    | UgsAdminV2TypeCreateOperation
    | UgsAdminV2TypePatchOperation
    | UgsAdminV2TypeSetActiveOperation
    | UgsAdminV2TypeClearModelNamesOperation
    | UgsAdminV2WorkflowCreateOperation
    | UgsAdminV2WorkflowPatchOperation
    | UgsAdminV2WorkflowSetActiveOperation
    | UgsAdminV2ModelRoutesPatchOperation
    | UgsAdminV2ModelRoutesReplaceOperation
    | UgsAdminV2ProviderModelsRefreshOperation
    | UgsAdminV2ProviderDefaultModelSetOperation
    | UgsAdminV2WorkflowImportFromDiskOperation
    | UgsAdminV2SettingCreateOperation
    | UgsAdminV2SettingPatchOperation
    | UgsAdminV2SettingDeleteOperation
)


class UgsAdminV2ValidateRequest(BaseModel):
    operations: list[UgsAdminV2BulkOperation] = Field(default_factory=list)


class UgsAdminV2BulkApplyRequest(BaseModel):
    operations: list[UgsAdminV2BulkOperation] = Field(default_factory=list)
    validate_only: bool = False
    allow_warnings: bool = False


class UgsAdminV2BulkApplyOperationResult(BaseModel):
    kind: UgsAdminV2OperationKind
    entity_type: UgsAdminV2EntityType
    entity_id: str
    status: UgsAdminV2BulkOperationStatus
    message: str


class UgsAdminV2BulkApplyResult(BaseModel):
    issues: list[UgsAdminV2ValidationIssue] = Field(default_factory=list)
    applied: int = 0
    skipped: int = 0
    failed: int = 0
    operation_results: list[UgsAdminV2BulkApplyOperationResult] = Field(default_factory=list)


class UGSSettingListResponse(BaseModel):
    items: list[UGSSettingResponse]
    total: int
