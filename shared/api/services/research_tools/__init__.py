# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared Research Tool Surface — one executor path for Desktop ensemble, MCP Host, and EWA.
# Invariants:
# - Read-only probes only; reuses ensemble runners (no duplicate HTTP stacks).
# - Default-deny without capability context; never fabricates hits.
# Related:
# - documentation/platform/ELITEEW-MCP-HOST-AND-SERVERS.md
# - documentation/product/DESKTOP-ENSEMBLE-ACTIONS.md
# ---
"""Shared research tool surface."""

from __future__ import annotations

from typing import TYPE_CHECKING

from api.services.research_tools.context import ResearchCallContext

# Runtime: lazy via __getattr__ (avoid eager executor → ensemble cycle).
# Type-check: bind names so __all__ / basedpyright reportUnsupportedDunderAll pass.
if TYPE_CHECKING:
    from api.services.research_tools.executor import (
        execute_research_kind,
        list_research_tool_specs,
    )

__all__ = [
    "ResearchCallContext",
    "execute_research_kind",
    "list_research_tool_specs",
]


def __getattr__(name: str):
    if name in {"execute_research_kind", "list_research_tool_specs"}:
        from api.services.research_tools import executor as _executor

        return getattr(_executor, name)
    raise AttributeError(name)
