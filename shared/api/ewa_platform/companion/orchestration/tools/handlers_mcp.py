# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# EWA companion MCP Host bridge: mcp_list / mcp_call via tool registry (explicit args only).
# Invariants:
# - Skips (returns None) without structured server_id/tool args — no chat hijack.
# - Surface ``ewa``; gated by mcp_host_enabled / ELITEEW_MCP_HOST_ENABLED.
# Related:
# - api/services/mcp_host/runtime.py
# - documentation/platform/ELITEEW-MCP-HOST-AND-SERVERS.md
# ---
"""EWA companion MCP Host handlers."""

from __future__ import annotations

import json
import logging
from collections.abc import Mapping
from typing import Any, Final

from api.ewa_platform.companion.orchestration.tools.registry_types import (
    ToolContext,
    ToolHandler,
    ToolResult,
)
from api.services.mcp_host.config import mcp_host_enabled
from api.services.mcp_host.runtime import mcp_call_tool, mcp_list_servers, mcp_list_tools
from api.services.research_tools.context import ResearchCallContext

logger = logging.getLogger(__name__)

_SURFACE = "ewa"


def _research_context_from_tool_ctx(ctx: ToolContext) -> ResearchCallContext | None:
    """Best-effort research context for MCP research_native (web only without chat/project)."""
    uid_raw = (ctx.content_catalog_user_id or ctx.principal_id or "").strip()
    if not uid_raw:
        return None
    try:
        from uuid import UUID

        user_id = UUID(uid_raw)
    except ValueError:
        return None
    return ResearchCallContext(
        user_id=user_id,
        chat_id=None,
        project_id=None,
        db_pool=ctx.main_pool,
        defaults={},
        web_search_allowed=False,  # companion web uses its own prefetch path; research web needs explicit allow
        use_project_rag=False,
        kbsew_agent="ewa",
    )


async def _handle_mcp_list(args: Mapping[str, Any], ctx: ToolContext) -> ToolResult | None:
    _ = ctx
    if not mcp_host_enabled():
        return ToolResult(
            tool="mcp_list",
            status="unavailable",
            reply="MCP Host is disabled (ELITEEW_MCP_HOST_ENABLED / mcp_host_enabled).",
            actions=[],
            data={},
        )
    server_id = str(args.get("server_id") or "").strip()
    if not server_id:
        servers = mcp_list_servers(surface=_SURFACE)
        body = json.dumps({"servers": servers}, ensure_ascii=False)
        return ToolResult(tool="mcp_list", status="ok", reply=body, actions=[], data={"servers": servers})
    tools = await mcp_list_tools(server_id=server_id, surface=_SURFACE)
    body = json.dumps({"server_id": server_id, "tools": tools}, ensure_ascii=False)
    return ToolResult(
        tool="mcp_list",
        status="ok",
        reply=body,
        actions=[],
        data={"server_id": server_id, "tool_count": len(tools)},
    )


async def _handle_mcp_call(args: Mapping[str, Any], ctx: ToolContext) -> ToolResult | None:
    _ = ctx
    server_id = str(args.get("server_id") or "").strip()
    tool = str(args.get("tool") or args.get("tool_name") or "").strip()
    if not server_id or not tool:
        return None
    if not mcp_host_enabled():
        return ToolResult(
            tool="mcp_call",
            status="unavailable",
            reply="MCP Host is disabled (ELITEEW_MCP_HOST_ENABLED / mcp_host_enabled).",
            actions=[],
            data={},
        )
    raw_arguments = args.get("arguments")
    if not isinstance(raw_arguments, dict):
        skip = {"server_id", "tool", "tool_name", "user_line", "arguments", "invoke"}
        raw_arguments = {k: v for k, v in args.items() if k not in skip}
    result = await mcp_call_tool(
        server_id=server_id,
        tool=tool,
        arguments=raw_arguments,
        surface=_SURFACE,
        research_context=_research_context_from_tool_ctx(ctx),
    )
    status = "ok"
    try:
        payload = json.loads(result) if isinstance(result, str) else None
    except json.JSONDecodeError:
        payload = None
    if isinstance(payload, dict) and payload.get("error"):
        status = "error"
        logger.info(
            "[STEP] companion_mcp_call_tool_error server_id=%s tool=%s error=%s",
            server_id,
            tool,
            str(payload.get("error"))[:80],
        )
    return ToolResult(
        tool="mcp_call",
        status=status,
        reply=result,
        actions=[],
        data={"server_id": server_id, "mcp_tool": tool},
    )


HANDLERS: Final[dict[str, ToolHandler]] = {
    "mcp_list": _handle_mcp_list,
    "mcp_call": _handle_mcp_call,
}
