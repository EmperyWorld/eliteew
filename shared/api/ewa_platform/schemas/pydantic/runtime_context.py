# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Public HTTP schemas for the EWA Runtime Gateway read-side: authenticated user context, companion status, desktop hints,
# and paginated Unified Content inventory slices shared by companion, orchestration, and EWA UI surfaces.
# Invariants:
# - Models expose server-derived user/content scope only; callers never provide a user id in these contracts.
# - Large inventories are always paginated and carry total/truncation metadata.
# Related:
# - api/ewa_platform/gateways/routers/runtime_context.py
# - api/ewa_platform/gateways/runtime_gateway/runtime_context.py
# ---
"""EWA Runtime Gateway read-side schemas."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class EwaRuntimePrincipalOut(BaseModel):
    """Authenticated principal as seen by EWA."""

    principal_id: str = Field(min_length=1)
    content_user_id: str = Field(min_length=1)
    username: str = ""
    role: str = ""
    ew_family: bool = False


class EwaRuntimeLimitsOut(BaseModel):
    """Server caps that EWA must respect when asking for context pages."""

    max_content_page_size: int = Field(default=200, ge=1)
    default_content_page_size: int = Field(default=50, ge=1)
    max_prompt_content_items: int = Field(default=120, ge=1)


class EwaRuntimeCompanionStatusOut(BaseModel):
    """Small, PII-light companion profile status."""

    loaded: bool
    reason: Literal["no_database_pool", "not_initialized"] | None = None
    seed_persona_id: str | None = None
    companion_revision: int | None = Field(default=None, ge=1)


EwaRuntimeMimeGroup = Literal["audio", "docs", "media", "text", "binary"]
EwaRuntimeSearchScope = Literal["metadata", "content", "hybrid"]


class EwaRuntimeCatalogFilters(BaseModel):
    """Typed filters for EWA-visible content listings."""

    content_types: list[str] = Field(default_factory=list)
    mime_groups: list[EwaRuntimeMimeGroup] = Field(default_factory=list)
    extension_include: list[str] = Field(default_factory=list)
    extension_exclude: list[str] = Field(default_factory=list)
    include_audio: bool | None = None
    exclude_audio: bool | None = None


class EwaRuntimeCatalogPreferencesOut(BaseModel):
    """Persistent per-user defaults applied to EWA catalogue listings."""

    exclude_content_types: list[str] = Field(default_factory=list)
    exclude_mime_groups: list[EwaRuntimeMimeGroup] = Field(default_factory=list)
    extension_exclude: list[str] = Field(default_factory=list)


class EwaRuntimeContentItemOut(BaseModel):
    """Compact inventory row for EWA tools and prompts."""

    unified_content_id: str = Field(min_length=1)
    name: str
    title: str | None = None
    content_type: str | None = None
    mime_type: str | None = None
    file_size: int | None = Field(default=None, ge=0)
    visibility: str | None = None
    owner_user_id: str | None = None
    is_owner: bool | None = None
    can_edit: bool | None = None
    folder_item_id: str | None = None
    company_id: str | None = None
    project_id: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    search_matched_scope: EwaRuntimeSearchScope | Literal["both"] | None = None
    search_snippet: str | None = None
    search_score: float | None = None
    search_degraded: bool | None = None


class EwaRuntimeContentPageOut(BaseModel):
    """Paginated Unified Content inventory page."""

    items: list[EwaRuntimeContentItemOut] = Field(default_factory=list)
    total: int = Field(ge=0)
    offset: int = Field(ge=0)
    limit: int = Field(ge=1, le=200)
    next_offset: int | None = Field(default=None, ge=0)
    truncated: bool
    search_query: str | None = None
    search_scope: EwaRuntimeSearchScope = "metadata"
    sort_field: str | None = None
    sort_order: str | None = None
    applied_filters: EwaRuntimeCatalogFilters = Field(default_factory=EwaRuntimeCatalogFilters)
    applied_preferences: EwaRuntimeCatalogPreferencesOut | None = None
    search_diagnostics: dict[str, Any] = Field(default_factory=dict)


class EwaRuntimeDesktopHintsOut(BaseModel):
    """Persisted shell hints summary; live window/excerpt context still comes from shell_context POST bodies."""

    source: Literal["shell_state", "not_attached"] = "not_attached"
    ewa_hints: dict[str, Any] | None = None
    recent_app_ids: list[str] = Field(default_factory=list)
    recent_file_ids: list[str] = Field(default_factory=list)


class EwaRuntimeContextOut(BaseModel):
    """Top-level EWA Runtime Gateway context snapshot."""

    context_version: Literal["ewa_runtime_context_v1"] = "ewa_runtime_context_v1"
    generated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    principal: EwaRuntimePrincipalOut
    companion: EwaRuntimeCompanionStatusOut
    content: EwaRuntimeContentPageOut
    desktop: EwaRuntimeDesktopHintsOut = Field(default_factory=EwaRuntimeDesktopHintsOut)
    limits: EwaRuntimeLimitsOut = Field(default_factory=EwaRuntimeLimitsOut)
