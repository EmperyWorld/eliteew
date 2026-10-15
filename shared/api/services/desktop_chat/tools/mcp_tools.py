# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Desktop AI Chat meta-tools for MCP Host: mcp_list + mcp_call.
# Invariants:
# - Visible only when mcp_host_enabled (defaults or ELITEEW_MCP_HOST_ENABLED).
# - Surface always ``desktop`` for this module.
# Related:
# - api/services/mcp_host/runtime.py
# - documentation/platform/ELITEEW-MCP-HOST-AND-SERVERS.md
# ---
"""Desktop chat MCP meta-tools."""

from __future__ import annotations

import json
import logging
from typing import Any

from api.services.mcp_host.config import mcp_host_enabled
from api.services.mcp_host.runtime import mcp_call_tool, mcp_list_servers, mcp_list_tools

logger = logging.getLogger(__name__)

TOOL_LIST = "mcp_list"
TOOL_CALL = "mcp_call"
_SURFACE = "desktop"

LLAMA_TOOL_LIST = {
    "type": "function",
    "function": {
        "name": TOOL_LIST,
        "description": (
            "List allowlisted MCP servers for this chat, or list tools for one server_id. Use before mcp_call."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "server_id": {
                    "type": "string",
                    "description": "Optional MCP server id; omit to list servers only.",
                },
            },
            "required": [],
        },
    },
}

LLAMA_TOOL_CALL = {
    "type": "function",
    "function": {
        "name": TOOL_CALL,
        "description": (
            "Call a tool on an allowlisted MCP server. "
            "KBSEW (server_id=kbsew): kbsew_list_barrels, kbsew_list_drivers, kbsew_health, "
            "kbsew_resolve_corpus, kbsew_search. "
            "Research (server_id=research): web_search, chat_rag_search, project_vault_search "
            "(subject to chat capabilities)."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "server_id": {"type": "string"},
                "tool": {"type": "string"},
                "arguments": {
                    "type": "object",
                    "description": "JSON object of tool arguments.",
                },
            },
            "required": ["server_id", "tool"],
        },
    },
}


def mcp_tools_visible(defaults: dict[str, Any] | None) -> bool:
    return mcp_host_enabled(defaults=defaults)


async def run_mcp_list(*, arguments: dict[str, Any], defaults: dict[str, Any]) -> str:
    if not mcp_tools_visible(defaults):
        return "MCP Host отключён администратором."
    server_id = str(arguments.get("server_id") or "").strip()
    if not server_id:
        servers = mcp_list_servers(surface=_SURFACE, defaults=defaults)
        return json.dumps({"servers": servers}, ensure_ascii=False)
    tools = await mcp_list_tools(server_id=server_id, surface=_SURFACE, defaults=defaults)
    return json.dumps({"server_id": server_id, "tools": tools}, ensure_ascii=False)


async def run_mcp_call(
    *,
    arguments: dict[str, Any],
    defaults: dict[str, Any],
    research_context: Any | None = None,
) -> str:
    if not mcp_tools_visible(defaults):
        return "MCP Host отключён администратором."
    server_id = str(arguments.get("server_id") or "").strip()
    tool = str(arguments.get("tool") or "").strip()
    raw_args = arguments.get("arguments")
    tool_args = raw_args if isinstance(raw_args, dict) else {}
    return await mcp_call_tool(
        server_id=server_id,
        tool=tool,
        arguments=tool_args,
        surface=_SURFACE,
        defaults=defaults,
        research_context=research_context,
    )
