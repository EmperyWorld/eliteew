# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Wire export shape for companion tool catalog (admin read API, WF-0).
# Related:
# - api/ewa_platform/companion/orchestration/tool_catalog_v2.py
# ---
"""Pydantic export models for EWA companion tool catalog."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class CompanionToolCatalogEntryOut(BaseModel):
    name: str
    summary: str
    input_keys: list[str] = Field(default_factory=list)
    result_keys: list[str] = Field(default_factory=list)
    requires: list[str] = Field(default_factory=list)
    server_only: bool = True
    capability: str = "general"
    execution_mode: Literal["sync", "async", "either"] = "sync"
    router_exposed: bool = False
    router_partial: bool = False
    confirm_by_default: bool = False
    max_concurrent_per_principal: int = 1
    step_kinds: list[str] = Field(default_factory=list)
    slots_schema: dict[str, Any] = Field(default_factory=dict)
    handler_registered: bool = False


class CompanionToolRouterRuntimeOut(BaseModel):
    enabled: bool = False
    mode: Literal["shadow", "partial", "full"] = "shadow"
    base_url: str = ""
    model: str = ""
    uses_gpu141: bool = False


class CompanionToolCatalogOut(BaseModel):
    tools: list[CompanionToolCatalogEntryOut] = Field(default_factory=list)
    tool_router_runtime: CompanionToolRouterRuntimeOut | None = None
    schema_version: str = "companion_tool_catalog_v1"


__all__ = (
    "CompanionToolCatalogEntryOut",
    "CompanionToolCatalogOut",
    "CompanionToolRouterRuntimeOut",
)
