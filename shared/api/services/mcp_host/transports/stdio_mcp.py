# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Optional stdio MCP client transport (official mcp SDK) for allowlisted external servers.
# Invariants:
# - Command from allowlist only; bounded timeout; no secret logging.
# - Child env is allowlisted base keys + cfg.env only (no full parent env merge).
# Related:
# - documentation/platform/ELITEEW-MCP-HOST-AND-SERVERS.md
# ---
"""stdio MCP transport via official SDK."""

from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any

from api.services.mcp_host.config import McpServerConfig

logger = logging.getLogger(__name__)

_DEFAULT_STDIO_TIMEOUT_SEC = 45.0
_ENV_PASS_KEYS = ("PATH", "HOME", "LANG", "LC_ALL", "LC_CTYPE", "TMPDIR", "TMP", "TEMP")


def _stdio_timeout_sec() -> float:
    raw = (os.getenv("ELITEEW_MCP_STDIO_TIMEOUT_SEC") or "").strip()
    if not raw:
        return _DEFAULT_STDIO_TIMEOUT_SEC
    try:
        value = float(raw)
    except ValueError:
        return _DEFAULT_STDIO_TIMEOUT_SEC
    return max(5.0, min(300.0, value))


def _child_env(cfg: McpServerConfig) -> dict[str, str] | None:
    """Build child env without dumping the full parent process environment."""
    if not cfg.env:
        return None
    base = {k: os.environ[k] for k in _ENV_PASS_KEYS if k in os.environ}
    base.update({str(k): str(v) for k, v in cfg.env.items()})
    return base


async def list_stdio_tools(cfg: McpServerConfig) -> list[dict[str, Any]]:
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client

    if not cfg.command:
        return []
    params = StdioServerParameters(
        command=cfg.command[0],
        args=list(cfg.command[1:]),
        env=_child_env(cfg),
    )
    timeout = _stdio_timeout_sec()

    async def _run() -> Any:
        async with stdio_client(params) as (read, write), ClientSession(read, write) as session:
            await session.initialize()
            return await session.list_tools()

    try:
        result = await asyncio.wait_for(_run(), timeout=timeout)
    except TimeoutError as exc:
        logger.warning(
            "[STEP] mcp_stdio_list_tools_timeout server_id=%s timeout_sec=%s",
            cfg.id,
            timeout,
        )
        raise RuntimeError(f"MCP stdio list_tools timed out for {cfg.id}") from exc
    except Exception as exc:
        logger.warning(
            "[STEP] mcp_stdio_list_tools_fail server_id=%s err=%s",
            cfg.id,
            type(exc).__name__,
        )
        raise RuntimeError(f"MCP stdio list_tools failed for {cfg.id}") from exc
    tools: list[dict[str, Any]] = []
    for tool in getattr(result, "tools", None) or []:
        tools.append(
            {
                "name": getattr(tool, "name", ""),
                "description": getattr(tool, "description", "") or "",
                "inputSchema": getattr(tool, "inputSchema", None) or {},
            }
        )
    return tools


async def call_stdio_tool(cfg: McpServerConfig, name: str, arguments: dict[str, Any] | None) -> str:
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client

    if not cfg.command:
        return json.dumps({"error": "stdio_missing_command"})
    params = StdioServerParameters(
        command=cfg.command[0],
        args=list(cfg.command[1:]),
        env=_child_env(cfg),
    )
    args = arguments if isinstance(arguments, dict) else {}
    timeout = _stdio_timeout_sec()

    async def _run() -> Any:
        async with stdio_client(params) as (read, write), ClientSession(read, write) as session:
            await session.initialize()
            return await session.call_tool(name, arguments=args)

    try:
        result = await asyncio.wait_for(_run(), timeout=timeout)
    except TimeoutError:
        logger.warning(
            "[STEP] mcp_stdio_call_timeout server_id=%s tool=%s timeout_sec=%s",
            cfg.id,
            name,
            timeout,
        )
        return json.dumps(
            {
                "error": "stdio_timeout",
                "server_id": cfg.id,
                "tool": name,
                "timeout_sec": timeout,
            }
        )
    except Exception as exc:
        logger.warning(
            "[STEP] mcp_stdio_call_fail server_id=%s tool=%s err=%s",
            cfg.id,
            name,
            type(exc).__name__,
        )
        return json.dumps({"error": "stdio_call_failed", "server_id": cfg.id, "tool": name})
    # Prefer text content blocks.
    parts: list[str] = []
    for block in getattr(result, "content", None) or []:
        text = getattr(block, "text", None)
        if text:
            parts.append(str(text))
    if parts:
        return "\n".join(parts)
    return json.dumps({"ok": True, "server_id": cfg.id, "tool": name}, ensure_ascii=False)
