# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared types for EWA companion server-only tool registry (handlers + core).
# Invariants:
# - No handler imports — breaks circular dependency with ``registry_core``.
# Related:
# - api/ewa_platform/companion/orchestration/tools/registry_core.py
# - api/ewa_platform/companion/orchestration/tools/registry_helpers.py
# ---
"""EWA companion tool registry shared types."""

from __future__ import annotations

from collections.abc import Awaitable, Callable, Mapping
from dataclasses import dataclass, field
from typing import Any, Literal, Required, TypedDict

import asyncpg

ToolStatus = Literal[
    "ok",
    "error",
    "skipped",
    "needs_confirm",
    "needs_open_editor",
    "unavailable",
    "memory_append",
    "accepted",
    "continue",
]


class ToolResult(TypedDict, total=False):
    """Uniform envelope returned by every server-only tool handler.

    Handlers always set tool, status, and reply. actions, data, task_run, and
    output_surface are present only when that handler has them.
    """

    tool: Required[str]
    status: Required[ToolStatus]
    reply: Required[str]
    actions: list[dict[str, Any]]
    data: dict[str, Any]
    task_run: dict[str, Any] | None
    output_surface: dict[str, Any]


@dataclass(frozen=True)
class ToolContext:
    """Per-turn execution context handed to every tool handler."""

    principal_id: str
    user_line: str
    content_catalog_user_id: str | None
    oauth2_sub_for_content_alternate: str | None
    main_pool: asyncpg.Pool | None = None
    companion_pool: asyncpg.Pool | None = None
    shell_norm: Mapping[str, Any] | None = None
    intent_plan: Mapping[str, Any] | None = None
    bearer_token: str | None = None
    auth_user: Any | None = None
    profile: Mapping[str, Any] | None = None
    image_attachment: Mapping[str, Any] | None = None


ToolHandler = Callable[[Mapping[str, Any], ToolContext], Awaitable[ToolResult | None]]


@dataclass(frozen=True)
class ToolDescriptor:
    """Static metadata for a registered tool — used by tests, docs, and (future) planner JSON."""

    name: str
    summary: str
    input_keys: tuple[str, ...] = field(default_factory=tuple)
    result_keys: tuple[str, ...] = field(default_factory=tuple)
    requires: tuple[str, ...] = field(default_factory=tuple)
    server_only: bool = True


__all__ = (
    "ToolContext",
    "ToolDescriptor",
    "ToolHandler",
    "ToolResult",
    "ToolStatus",
)
