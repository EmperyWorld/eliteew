# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# stack0 MCP Host: allowlisted MCP servers for Desktop AI Chat, EWA companion, and ops.
# Invariants:
# - Only MIT / Apache-2.0 servers; no telemetry-required servers in v1.
# - Surface gates + server allowlist; fail closed.
# Related:
# - documentation/platform/ELITEEW-MCP-HOST-AND-SERVERS.md
# ---
"""EliteEW MCP Host package."""

from api.services.mcp_host.config import McpServerConfig, load_mcp_server_configs, mcp_host_enabled
from api.services.mcp_host.runtime import mcp_call_tool, mcp_list_servers, mcp_list_tools

__all__ = [
    "McpServerConfig",
    "load_mcp_server_configs",
    "mcp_call_tool",
    "mcp_host_enabled",
    "mcp_list_servers",
    "mcp_list_tools",
]
