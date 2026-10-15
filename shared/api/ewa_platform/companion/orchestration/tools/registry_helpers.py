# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared helpers for EWA companion tool handlers (pool resolution, router bypass flag).
# Invariants:
# - No handler imports — safe for all ``handlers_*.py`` modules.
# Related:
# - api/ewa_platform/companion/orchestration/tools/registry_types.py
# ---
"""EWA companion tool registry shared helpers."""

from __future__ import annotations

from collections.abc import Mapping

import asyncpg

from api.ewa_platform.companion.orchestration.tools.registry_types import ToolContext
from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg

__all__ = (
    "_resolve_main_pool",
    "_tool_router_bypass_line_match",
    "companion_pg",
)


async def _resolve_main_pool(ctx: ToolContext) -> asyncpg.Pool:
    """Return ``ctx.main_pool`` or lazily acquire the application asyncpg pool via the core database manager."""

    if ctx.main_pool is not None:
        return ctx.main_pool
    from api.core.database_manager import get_asyncpg_pool

    return await get_asyncpg_pool()


def _tool_router_bypass_line_match(args: Mapping[str, object]) -> bool:
    """True when ``tool_router`` already classified the turn — skip regex line gates in handlers."""

    raw = args.get("_tool_router_bypass_line_match")
    return raw is True or str(raw or "").strip().lower() in ("1", "true", "yes", "on")
