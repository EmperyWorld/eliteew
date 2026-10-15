# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Public HTTP schemas for the EWA Runtime Gateway write-side: typed, allowlisted commands that route EWA intentions to
# desktop UI actions, Unified Content reads/searches, and controlled DocEditor draft/apply actions.
# Invariants:
# - LLM/user text is never executed directly; only registered ``command_kind`` values are accepted.
# - Mutating commands expose safety/confirmation state and return typed actions/results instead of arbitrary code.
# Related:
# - api/ewa_platform/gateways/routers/runtime_command.py
# - api/ewa_platform/gateways/runtime_gateway/runtime_command.py
# ---
"""EWA Runtime Gateway command schemas."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from api.ewa_platform.schemas.pydantic.runtime_context import EwaRuntimeContextOut

EwaRuntimeCommandKind = Literal[
    "desktop.open_app",
    "desktop.focus_app",
    "desktop.minimize_app",
    "desktop.close_app",
    "content.list",
    "content.search",
    "catalog.preferences.update",
    "catalog.preferences.reset",
    "doc.create",
    "doc.resolve",
    "doc.read",
    "doc.edit.propose",
    "doc.edit.apply",
    "doc.delete.propose",
    "doc.delete.apply",
    "doc.restore",
    "file.rename",
    "file.update_metadata",
]

EwaRuntimeSafetyTier = Literal[
    "safe_ui", "safe_content_read", "draft_mutation", "confirmed_mutation", "destructive_mutation"
]
EwaRuntimeCommandStatus = Literal["ok", "dry_run", "requires_confirmation", "rejected"]


class EwaRuntimeCommandIn(BaseModel):
    """Command request from EWA runtime-turn/UI."""

    command_kind: EwaRuntimeCommandKind
    target_app: str | None = Field(default=None, max_length=96)
    arguments: dict[str, Any] = Field(default_factory=dict)
    dry_run: bool = False
    confirmed: bool = False
    confirmation_token: str | None = Field(default=None, max_length=256)


class EwaRuntimeCommandOut(BaseModel):
    """Canonical command result with optional SPA actions."""

    command_kind: EwaRuntimeCommandKind
    status: EwaRuntimeCommandStatus
    safety_tier: EwaRuntimeSafetyTier
    source: Literal["ewa_runtime_gateway"] = "ewa_runtime_gateway"
    authorized_user_id: str
    target: dict[str, Any] = Field(default_factory=dict)
    result: dict[str, Any] = Field(default_factory=dict)
    actions: list[dict[str, Any]] = Field(default_factory=list)
    events: list[dict[str, Any]] = Field(default_factory=list)
    audit_event_id: str | None = None
    audit_skipped_reason: str | None = None
    rejection_reason: str | None = None


class EwaRuntimeTurnIn(BaseModel):
    """Upper EWA runtime entry: optional commands plus optional context snapshot in one authenticated call."""

    message: str = Field(default="", max_length=12000)
    commands: list[EwaRuntimeCommandIn] = Field(default_factory=list, max_length=8)
    include_context: bool = True
    dry_run: bool = False


class EwaRuntimeTurnOut(BaseModel):
    """Deterministic runtime-turn response; LLM planning can be added behind this contract later."""

    reply: str
    context: EwaRuntimeContextOut | None = None
    command_results: list[EwaRuntimeCommandOut] = Field(default_factory=list)
    events: list[dict[str, Any]] = Field(default_factory=list)
