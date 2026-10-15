# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Pydantic schemas for user-owned companion action workflows HTTP API.
# Related:
# - api/ewa_platform/gateways/routers/companion_user_workflows.py
# ---

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from api.ewa_platform.companion.workflows.user.user_workflow_validation import (
    UserWorkflowCreateInV1,
    UserWorkflowPatchInV1,
    UserWorkflowStepInV1,
    UserWorkflowTriggerPhraseV1,
)


class CompanionUserWorkflowOut(BaseModel):
    id: str
    principal_id: str
    name: str
    enabled: bool
    definition_json: dict[str, Any] = Field(default_factory=dict)
    trigger_json: dict[str, Any] = Field(default_factory=dict)
    version: int = 1
    created_at: str | None = None
    updated_at: str | None = None


class CompanionUserWorkflowValidateIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    trigger: UserWorkflowTriggerPhraseV1
    steps: list[UserWorkflowStepInV1] = Field(min_length=1)
    exclude_workflow_id: str | None = None


class CompanionUserWorkflowStepPreviewOut(BaseModel):
    step_index: int
    tool_name: str
    title_ru: str
    title_en: str
    async_step: bool = False
    requires_confirm: bool = False
    missing_recommended_fields: list[str] = Field(default_factory=list)


class CompanionUserWorkflowValidateOut(BaseModel):
    ok: bool
    errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    execution_mode: str = "sync"
    preview_steps: list[CompanionUserWorkflowStepPreviewOut] = Field(default_factory=list)


class CompanionUserWorkflowObservationTriggersOut(BaseModel):
    idle_enabled: bool = True
    focus_app_enabled: bool = True
    persisted: bool = False


class CompanionUserWorkflowObservationTriggersPatchIn(BaseModel):
    idle_enabled: bool | None = None
    focus_app_enabled: bool | None = None


class CompanionUserWorkflowToolCatalogFieldOption(BaseModel):
    value: str
    label_ru: str
    label_en: str


class CompanionUserWorkflowToolCatalogField(BaseModel):
    key: str
    type: str = "text"
    label_ru: str = ""
    label_en: str = ""
    placeholder_ru: str = ""
    placeholder_en: str = ""
    options: list[CompanionUserWorkflowToolCatalogFieldOption] = Field(default_factory=list)


class CompanionUserWorkflowToolCatalogEntry(BaseModel):
    name: str
    title_ru: str
    title_en: str
    description_ru: str = ""
    description_en: str = ""
    async_step: bool = False
    requires_confirm: bool = False
    fields: list[CompanionUserWorkflowToolCatalogField] = Field(default_factory=list)


__all__ = (
    "CompanionUserWorkflowOut",
    "CompanionUserWorkflowObservationTriggersOut",
    "CompanionUserWorkflowObservationTriggersPatchIn",
    "CompanionUserWorkflowStepPreviewOut",
    "CompanionUserWorkflowToolCatalogEntry",
    "CompanionUserWorkflowToolCatalogField",
    "CompanionUserWorkflowToolCatalogFieldOption",
    "CompanionUserWorkflowValidateIn",
    "CompanionUserWorkflowValidateOut",
    "UserWorkflowCreateInV1",
    "UserWorkflowPatchInV1",
)
