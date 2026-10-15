# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Load MCP server allowlist from env (JSON) with safe defaults for kbsew + research.
# Invariants:
# - Default host OFF (ELITEEW_MCP_HOST_ENABLED unset/0).
# - Reject entries that fail license/telemetry policy.
# Related:
# - documentation/platform/ELITEEW-MCP-HOST-AND-SERVERS.md
# ---
"""MCP Host configuration."""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field
from typing import Any, Literal

from api.services.mcp_host.policy import license_allowed, telemetry_forbidden

logger = logging.getLogger(__name__)

McpSurface = Literal["desktop", "ewa", "cursor", "ops"]
McpTransport = Literal["kbsew_native", "research_native", "stdio"]


@dataclass(frozen=True, slots=True)
class McpServerConfig:
    id: str
    transport: McpTransport
    license: str
    surfaces: tuple[str, ...] = ("desktop", "ewa")
    command: tuple[str, ...] = ()
    env: dict[str, str] = field(default_factory=dict)
    telemetry_ok: bool = False


def mcp_host_enabled(*, defaults: dict[str, Any] | None = None) -> bool:
    if defaults is not None and "mcp_host_enabled" in defaults:
        return bool(defaults.get("mcp_host_enabled"))
    raw = (os.getenv("ELITEEW_MCP_HOST_ENABLED") or "").strip().lower()
    return raw in {"1", "true", "yes", "on"}


def _default_kbsew_entry() -> McpServerConfig:
    return McpServerConfig(
        id="kbsew",
        transport="kbsew_native",
        license="MIT",
        surfaces=("desktop", "ewa", "cursor", "ops"),
        telemetry_ok=False,
    )


def _default_research_entry() -> McpServerConfig:
    return McpServerConfig(
        id="research",
        transport="research_native",
        license="MIT",
        surfaces=("desktop", "ewa"),
        telemetry_ok=False,
    )


def _default_server_entries() -> list[McpServerConfig]:
    return [_default_kbsew_entry(), _default_research_entry()]


def _parse_entry(raw: dict[str, Any]) -> McpServerConfig | None:
    sid = str(raw.get("id") or "").strip()
    transport = str(raw.get("transport") or "").strip().lower()
    lic = str(raw.get("license") or "").strip()
    if not sid or not transport:
        logger.warning("[STEP] mcp_host_config_skip reason=missing_id_or_transport")
        return None
    if transport not in {"kbsew_native", "research_native", "stdio"}:
        logger.warning("[STEP] mcp_host_config_skip id=%s reason=unsupported_transport=%s", sid, transport)
        return None
    if not license_allowed(lic):
        logger.warning("[STEP] mcp_host_config_skip id=%s reason=license_not_allowed license=%s", sid, lic)
        return None
    if telemetry_forbidden(bool(raw.get("telemetry_ok"))):
        logger.warning("[STEP] mcp_host_config_skip id=%s reason=telemetry_forbidden", sid)
        return None
    surfaces_raw = raw.get("surfaces")
    if isinstance(surfaces_raw, list) and surfaces_raw:
        surfaces = tuple(str(s).strip() for s in surfaces_raw if str(s).strip())
    else:
        surfaces = ("desktop", "ewa")
    cmd_raw = raw.get("command")
    if isinstance(cmd_raw, list):
        command = tuple(str(x) for x in cmd_raw if str(x).strip())
    elif isinstance(cmd_raw, str) and cmd_raw.strip():
        command = tuple(cmd_raw.split())
    else:
        command = ()
    env_raw = raw.get("env")
    env: dict[str, str] = {}
    if isinstance(env_raw, dict):
        env = {str(k): str(v) for k, v in env_raw.items()}
    if transport == "stdio" and not command:
        logger.warning("[STEP] mcp_host_config_skip id=%s reason=stdio_missing_command", sid)
        return None
    return McpServerConfig(
        id=sid,
        transport=transport,  # type: ignore[arg-type]
        license=lic or "MIT",
        surfaces=surfaces,
        command=command,
        env=env,
        telemetry_ok=False,
    )


def load_mcp_server_configs() -> list[McpServerConfig]:
    raw = (os.getenv("ELITEEW_MCP_SERVERS_JSON") or "").strip()
    if not raw:
        return _default_server_entries()
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("[STEP] mcp_host_config_invalid_json fallback=defaults")
        return _default_server_entries()
    if not isinstance(parsed, list):
        logger.warning("[STEP] mcp_host_config_not_list fallback=defaults")
        return _default_server_entries()
    out: list[McpServerConfig] = []
    for item in parsed:
        if not isinstance(item, dict):
            continue
        cfg = _parse_entry(item)
        if cfg is not None:
            out.append(cfg)
    if not out:
        logger.warning("[STEP] mcp_host_config_empty_after_filter fallback=defaults")
        return _default_server_entries()
    return out


def servers_for_surface(surface: str, configs: list[McpServerConfig] | None = None) -> list[McpServerConfig]:
    cfgs = configs if configs is not None else load_mcp_server_configs()
    surf = str(surface or "").strip().lower()
    return [c for c in cfgs if surf in {s.lower() for s in c.surfaces}]
