# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# MCP Host transport for shared research tools (web / chat RAG / vault).
# Invariants:
# - Reuses research_tools.executor → ensemble runners; no second HTTP stack.
# - Requires ResearchCallContext on call; deny without context.
# Related:
# - documentation/platform/ELITEEW-MCP-HOST-AND-SERVERS.md
# ---
"""Research native MCP transport."""

from __future__ import annotations

import json
from typing import Any

from api.services.research_tools.context import ResearchCallContext
from api.services.research_tools.executor import execute_research_kind, list_research_tool_specs


async def list_research_native_tools() -> list[dict[str, Any]]:
    return list_research_tool_specs()


async def call_research_native_tool(
    name: str,
    arguments: dict[str, Any] | None,
    *,
    call_context: ResearchCallContext | None = None,
) -> str:
    if call_context is None:
        return json.dumps({"error": "research_context_required", "tool": name})
    return await execute_research_kind(name, arguments, ctx=call_context)
