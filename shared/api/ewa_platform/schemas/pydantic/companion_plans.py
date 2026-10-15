# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Pydantic models for **EWA companion plans** read/write HTTP API.
# Invariants:
# - Wire shapes mirror ``persistence_pg/companion_plans_asyncpg`` row dicts.
# Related:
# - api/ewa_platform/gateways/routers/companion_plans.py
# - documentation/product/ewa/EWA-COMPANION-SERVER-PLANS-ADR.md
# ---

from __future__ import annotations

from datetime import date, datetime, time
from typing import Any

from pydantic import BaseModel, Field


class CompanionPlanGoalOut(BaseModel):
    id: str
    plan_id: str
    title: str
    description: str | None = None
    category: str = "general"
    progress: float = 0.0
    status: str = "active"
    priority: str = "medium"
    sort_order: int = 0


class CompanionPlanTaskOut(BaseModel):
    id: str
    plan_id: str
    goal_id: str | None = None
    title: str
    description: str | None = None
    status: str = "pending"
    priority: str = "medium"
    due_date: date | None = None
    due_time: time | None = None
    due_duration_minutes: int | None = None
    sort_order: int = 0
    completed_at: datetime | None = None


class CompanionPlanOut(BaseModel):
    id: str
    principal_id: str
    title: str
    description: str | None = None
    status: str = "wait"
    progress: float = 0.0
    source_turn_id: str | None = None
    is_active: bool = True
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime | None = None
    updated_at: datetime | None = None


class CompanionPlanBundleOut(BaseModel):
    plan: CompanionPlanOut | None = None
    goals: list[CompanionPlanGoalOut] = Field(default_factory=list)
    tasks: list[CompanionPlanTaskOut] = Field(default_factory=list)


class CompanionPlanSummaryOut(BaseModel):
    plan_id: str
    title: str
    status: str
    progress: float
    summary_markdown: str


class CompanionPlanTaskPatchIn(BaseModel):
    """CalendarApp / chat light-write onto an existing plan task (not a personal calendar event)."""

    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    due_date: date | None = None
    due_time: time | None = None
    due_duration_minutes: int | None = Field(default=None, ge=15, le=720)
    all_day: bool | None = None


__all__ = (
    "CompanionPlanBundleOut",
    "CompanionPlanGoalOut",
    "CompanionPlanOut",
    "CompanionPlanSummaryOut",
    "CompanionPlanTaskOut",
    "CompanionPlanTaskPatchIn",
)
