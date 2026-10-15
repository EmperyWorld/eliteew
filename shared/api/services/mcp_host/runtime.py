# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# MCP Host runtime: list servers/tools and call tools for an allowlisted surface.
# Invariants:
# - Fail closed when host disabled, server missing, or surface not allowed.
# - Structured [STEP] logs on skip/fail.
# Related:
# - documentation/platform/ELITEEW-MCP-HOST-AND-SERVERS.md
# ---
"""MCP Host runtime API."""

from __future__ import annotations

import json
import logging
from typing import Any

from api.services.mcp_host.config import (
    McpServerConfig,
    load_mcp_server_configs,
    mcp_host_enabled,
    servers_for_surface,
)
from api.services.mcp_host.transports import kbsew_native, stdio_mcp
from api.services.research_tools.context import ResearchCallContext

logger = logging.getLogger(__name__)


def mcp_list_servers(*, surface: str, defaults: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    if not mcp_host_enabled(defaults=defaults):
        return []
    rows = []
    for cfg in servers_for_surface(surface):
        rows.append(
            {
                "id": cfg.id,
                "transport": cfg.transport,
                "license": cfg.license,
                "surfaces": list(cfg.surfaces),
            }
        )
    return rows


def _resolve_server(server_id: str, surface: str) -> McpServerConfig | None:
    sid = str(server_id or "").strip()
    if not sid:
        return None
    for cfg in servers_for_surface(surface):
        if cfg.id == sid:
            return cfg
    return None


async def mcp_list_tools(
    *,
    server_id: str,
    surface: str,
    defaults: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    if not mcp_host_enabled(defaults=defaults):
        logger.info("[STEP] mcp_host_list_tools_skip reason=host_disabled surface=%s", surface)
        return []
    cfg = _resolve_server(server_id, surface)
    if cfg is None:
        logger.warning(
            "[STEP] mcp_host_list_tools_deny server_id=%s surface=%s reason=not_allowlisted",
            server_id,
            surface,
        )
        return []
    if cfg.transport == "kbsew_native":
        return await kbsew_native.list_kbsew_native_tools()
    if cfg.transport == "research_native":
        from api.services.mcp_host.transports import research_native

        return await research_native.list_research_native_tools()
    if cfg.transport == "stdio":
        return await stdio_mcp.list_stdio_tools(cfg)
    return []


async def mcp_call_tool(
    *,
    server_id: str,
    tool: str,
    arguments: dict[str, Any] | None,
    surface: str,
    defaults: dict[str, Any] | None = None,
    research_context: ResearchCallContext | None = None,
) -> str:
    if not mcp_host_enabled(defaults=defaults):
        return json.dumps({"error": "mcp_host_disabled"})
    cfg = _resolve_server(server_id, surface)
    if cfg is None:
        logger.warning(
            "[STEP] mcp_host_call_deny server_id=%s tool=%s surface=%s reason=not_allowlisted",
            server_id,
            tool,
            surface,
        )
        return json.dumps({"error": "server_not_allowlisted", "server_id": server_id})
    tool_name = str(tool or "").strip()
    if not tool_name:
        return json.dumps({"error": "tool_required"})
    logger.info(
        "[STEP] mcp_host_call server_id=%s tool=%s transport=%s surface=%s",
        cfg.id,
        tool_name,
        cfg.transport,
        surface,
    )
    if cfg.transport == "kbsew_native":
        return await kbsew_native.call_kbsew_native_tool(tool_name, arguments)
    if cfg.transport == "research_native":
        from api.services.mcp_host.transports import research_native

        return await research_native.call_research_native_tool(
            tool_name,
            arguments,
            call_context=research_context,
        )
    if cfg.transport == "stdio":
        return await stdio_mcp.call_stdio_tool(cfg, tool_name, arguments)
    return json.dumps({"error": "unsupported_transport", "transport": cfg.transport})


def load_all_server_ids() -> list[str]:
    return [c.id for c in load_mcp_server_configs()]
