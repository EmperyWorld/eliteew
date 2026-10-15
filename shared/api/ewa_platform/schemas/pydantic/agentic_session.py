# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# HTTP schemas for EWA Agentic Substrate REST API.
# Related:
# - api/ewa_platform/gateways/routers/agentic_sessions.py
# ---

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class AgenticSessionCreateIn(BaseModel):
    goal: str = Field(min_length=1, max_length=12000)
    policy: dict[str, Any] = Field(default_factory=dict)


class AgenticSessionRespondIn(BaseModel):
    decision: Literal["confirm", "cancel"] = "confirm"
    message: str = Field(default="", max_length=12000)
    expect_session_revision: int | None = Field(default=None, ge=1)
    client_turn_id: str | None = Field(default=None, max_length=120)


class AgenticSessionOut(BaseModel):
    id: str
    status: str
    session_revision: int
    goal_json: dict[str, Any] = Field(default_factory=dict)
    plan_summary: str = ""
    linked_task_run_id: str | None = None
    gate_json: dict[str, Any] = Field(default_factory=dict)


class AgenticSessionCreateOut(BaseModel):
    ok: bool = True
    session: AgenticSessionOut
    task_run_id: str | None = None
    reply: str = ""


class AgenticSessionRespondOut(BaseModel):
    ok: bool = True
    reply: str = ""
    session: AgenticSessionOut | None = None
    task_run_id: str | None = None


class AgenticCheckpointOut(BaseModel):
    seq: int
    kind: str
    node_id: str | None = None
    payload_json: dict[str, Any] = Field(default_factory=dict)


class AgenticTraceOut(BaseModel):
    session_id: str
    checkpoints: list[AgenticCheckpointOut] = Field(default_factory=list)


class AgenticTreeNodeOut(BaseModel):
    id: str
    node_kind: str
    status: str
    title: str
    tool_name: str | None = None
    sort_order: int = 0
    materialized_path: str = ""


class AgenticTreeOut(BaseModel):
    session_id: str
    nodes: list[AgenticTreeNodeOut] = Field(default_factory=list)
