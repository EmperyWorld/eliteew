# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Call-site context for shared research tools (web / chat RAG / vault).
# Invariants:
# - Missing ACL fields → tool returns error JSON, never silent success.
# Related:
# - api/services/research_tools/executor.py
# ---
"""Context for research tool execution."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-untyped]


@dataclass(slots=True)
class ResearchCallContext:
    """Capability-bearing context for one research tool call."""

    user_id: UUID | None = None
    chat_id: UUID | None = None
    project_id: UUID | None = None
    db_pool: asyncpg.Pool | None = None
    defaults: dict[str, Any] = field(default_factory=dict)
    web_search_allowed: bool = False
    use_project_rag: bool = False
    recent_messages: list[dict[str, str | None]] | None = None
    kbsew_agent: str = "desktop"
    kbsew_registry: list[Any] | None = None
