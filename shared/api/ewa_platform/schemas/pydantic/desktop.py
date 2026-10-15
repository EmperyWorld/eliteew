# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Pydantic envelope for synchronous EWA desktop orchestration HTTP responses (``EwaResponseV1`` shape).
# Invariants:
# - ``payload`` stays a JSON object map (result kind + session/events live inside ``payload``).
# Related:
# - shared/api/ewa_platform/io/envelope.py
# - shared/api/ewa_platform/gateways/routers/desktop.py
# ---
"""Schemas: EWA platform desktop orchestration HTTP."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class EwaDesktopOrchestrationTurnResponse(BaseModel):
    """Outbound envelope after one desktop orchestration turn."""

    model_config = ConfigDict(extra="ignore")

    api_version: str
    message_type: str
    correlation_id: str
    run_id: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
    schema_ref: str | None = None


class EwaDesktopOrchestrationSseEventOut(BaseModel):
    """Persisted desktop-orchestration session event as SSE ``data:`` JSON (honest bag)."""

    model_config = ConfigDict(extra="allow")
