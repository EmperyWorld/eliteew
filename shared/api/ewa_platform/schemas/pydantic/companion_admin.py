# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Pydantic response models for EWA companion admin read API (WF-5).
# Related:
# - api/ewa_platform/gateways/routers/companion_admin.py
# - documentation/product/ewa/EWA-COMPANION-WORKFLOW-TOOLS-STANDARD-MASTER-PLAN.md §7.2
# ---

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from api.ewa_platform.schemas.pydantic.companion_tool_catalog import CompanionToolCatalogOut
from api.ewa_platform.schemas.pydantic.companion_workflow import CompanionWorkflowDefinitionV1


class CompanionWorkflowSummaryOut(BaseModel):
    workflow_id: str
    version: int
    title_ru: str
    title_en: str
    execution_mode: str
    enabled: bool
    effective_enabled: bool
    source: Literal["builtin", "pg"] = "builtin"
    env_gate: str | None = None
    tags: list[str] = Field(default_factory=list)
    step_count: int = 0


class CompanionWorkflowListOut(BaseModel):
    workflows: list[CompanionWorkflowSummaryOut] = Field(default_factory=list)
    schema_version: str = "companion_workflow_catalog_v1"


class CompanionWorkflowDetailOut(BaseModel):
    definition: CompanionWorkflowDefinitionV1
    effective_enabled: bool
    source: Literal["builtin", "pg"] = "builtin"
    catalog_enabled: bool | None = None
    pg_version: int | None = None


class CompanionWorkflowCreateRequestV1(BaseModel):
    definition: CompanionWorkflowDefinitionV1


class CompanionWorkflowEnableRequestV1(BaseModel):
    version: int = Field(ge=1)


class CompanionWorkflowAuditEntryOut(BaseModel):
    id: int
    workflow_id: str
    version: int
    action: str
    actor_sub: str | None = None
    detail: dict[str, Any] = Field(default_factory=dict)
    created_at: str | None = None


class CompanionWorkflowAuditListOut(BaseModel):
    workflow_id: str
    entries: list[CompanionWorkflowAuditEntryOut] = Field(default_factory=list)


class CompanionChatWorkflowSummaryOut(BaseModel):
    workflow_id: str
    title_ru: str
    title_en: str
    kind: Literal["chat_llm"] = "chat_llm"
    description_ru: str = ""
    description_en: str = ""


class CompanionChatWorkflowListOut(BaseModel):
    workflows: list[CompanionChatWorkflowSummaryOut] = Field(default_factory=list)
    schema_version: str = "companion_chat_workflow_catalog_v1"


class CompanionAdminStatusOut(BaseModel):
    admin_enabled: bool
    admin_write_enabled: bool
    pg_catalog_enabled: bool


class CompanionPlatformSettingOut(BaseModel):
    setting_key: str
    value_text: str
    value_type: str
    category: str
    title_ru: str = ""
    title_en: str = ""
    description_ru: str
    description_en: str
    default_value: str
    allowed_values: str
    affects_ru: str
    affects_en: str
    is_secret: bool = False
    value_masked: bool = False
    sort_order: int = 0
    updated_by: str | None = None
    updated_at: str | None = None


class CompanionPlatformSettingsListOut(BaseModel):
    settings: list[CompanionPlatformSettingOut] = Field(default_factory=list)
    settings_total: int = 0
    db_total: int = 0
    catalog_total: int = 0
    schema_version: str = "ewa_platform_settings_v3"


class CompanionPlatformSettingUpdateRequestV1(BaseModel):
    value_text: str = ""


class CompanionPlatformSettingAuditEntryOut(BaseModel):
    id: int
    setting_key: str
    old_value: str = ""
    new_value: str = ""
    actor_sub: str | None = None
    created_at: str | None = None
    value_masked: bool = False


class CompanionPlatformSettingAuditListOut(BaseModel):
    entries: list[CompanionPlatformSettingAuditEntryOut] = Field(default_factory=list)
    schema_version: str = "ewa_platform_setting_audit_v1"


class CompanionPromptBlockOut(BaseModel):
    block_key: str
    category: str = ""
    description: str = ""
    body_text: str = ""
    updated_at: str | None = None
    updated_by: str | None = None
    source: Literal["db", "canon"] = "db"


class CompanionPromptBlockListOut(BaseModel):
    blocks: list[CompanionPromptBlockOut] = Field(default_factory=list)
    schema_version: str = "ewa_companion_prompt_blocks_v1"


class CompanionPromptBlockUpdateRequestV1(BaseModel):
    body_text: str = ""


class CompanionPromptBlockAuditEntryOut(BaseModel):
    id: int
    block_key: str
    action: str
    actor_sub: str | None = None
    detail: dict[str, Any] = Field(default_factory=dict)
    created_at: str | None = None


class CompanionPromptBlockAuditListOut(BaseModel):
    entries: list[CompanionPromptBlockAuditEntryOut] = Field(default_factory=list)
    schema_version: str = "ewa_companion_prompt_block_audit_v1"


class CompanionAdminUserSummaryOut(BaseModel):
    principal_id: str
    seed_persona_id: str = "parent"
    companion_revision: int = 1
    updated_at: str | None = None
    run_count: int = 0


class CompanionAdminUserListOut(BaseModel):
    users: list[CompanionAdminUserSummaryOut] = Field(default_factory=list)
    schema_version: str = "ewa_companion_admin_users_v1"


class CompanionAdminUserDetailOut(BaseModel):
    principal_id: str
    seed_persona_id: str = "parent"
    companion_revision: int = 1
    updated_at: str | None = None
    summary: dict[str, Any] = Field(default_factory=dict)
    schema_version: str = "ewa_companion_admin_user_detail_v1"


class CompanionAdminUserTimelineOut(BaseModel):
    principal_id: str
    events: list[dict[str, Any]] = Field(default_factory=list)
    schema_version: str = "ewa_companion_admin_user_timeline_v1"


class CompanionAdminUserTranscriptOut(BaseModel):
    principal_id: str
    messages: list[dict[str, Any]] = Field(default_factory=list)
    schema_version: str = "ewa_companion_admin_user_transcript_v1"


class CompanionAdminUserPatchRequestV1(BaseModel):
    seed_persona_id: str | None = None
    admin_note: str | None = None
    learned_patch: dict[str, Any] | None = None
    baseline_patch: dict[str, Any] | None = None
    expected_revision: int | None = None


class CompanionAdminUserAuditNoteRequestV1(BaseModel):
    note: str = Field(min_length=1, max_length=4000)


class CompanionAdminUserWipeRequestV1(BaseModel):
    confirm_principal_id: str = Field(min_length=1, max_length=128)


class CompanionAdminUserWipeOut(BaseModel):
    wiped: bool = True
    principal_id: str
    qdrant_points_deleted: int = 0
    schema_version: str = "ewa_companion_admin_user_wipe_v1"


class CompanionAdminUserClearNamespaceRequestV1(BaseModel):
    namespace: str = Field(min_length=1, max_length=128)
    confirm_namespace: str = Field(min_length=1, max_length=128)
    expected_revision: int | None = None


__all__ = (
    "CompanionAdminStatusOut",
    "CompanionAdminUserAuditNoteRequestV1",
    "CompanionAdminUserClearNamespaceRequestV1",
    "CompanionAdminUserDetailOut",
    "CompanionAdminUserListOut",
    "CompanionAdminUserPatchRequestV1",
    "CompanionAdminUserSummaryOut",
    "CompanionAdminUserTimelineOut",
    "CompanionAdminUserTranscriptOut",
    "CompanionAdminUserWipeOut",
    "CompanionAdminUserWipeRequestV1",
    "CompanionChatWorkflowListOut",
    "CompanionChatWorkflowSummaryOut",
    "CompanionPlatformSettingOut",
    "CompanionPlatformSettingAuditEntryOut",
    "CompanionPlatformSettingAuditListOut",
    "CompanionPlatformSettingUpdateRequestV1",
    "CompanionPlatformSettingsListOut",
    "CompanionPromptBlockAuditEntryOut",
    "CompanionPromptBlockAuditListOut",
    "CompanionPromptBlockListOut",
    "CompanionPromptBlockOut",
    "CompanionPromptBlockUpdateRequestV1",
    "CompanionToolCatalogOut",
    "CompanionWorkflowAuditEntryOut",
    "CompanionWorkflowAuditListOut",
    "CompanionWorkflowCreateRequestV1",
    "CompanionWorkflowDetailOut",
    "CompanionWorkflowEnableRequestV1",
    "CompanionWorkflowListOut",
    "CompanionWorkflowSummaryOut",
)
