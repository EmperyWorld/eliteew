# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral tests for MCP Host config, policy, kbsew_native transport, and desktop tool visibility.
# Invariants:
# - Host default OFF; policy rejects telemetry; kbsew tools named like eliteew-kbsew-mcp.
# Related:
# - api/services/mcp_host/
# - documentation/platform/ELITEEW-MCP-HOST-AND-SERVERS.md
# ---

from __future__ import annotations

import json
from typing import Any
from unittest.mock import AsyncMock, patch

import pytest

from api.services.desktop_chat.tools.registry import build_llama_tools
from api.services.mcp_host.config import load_mcp_server_configs, mcp_host_enabled
from api.services.mcp_host.policy import license_allowed, telemetry_forbidden
from api.services.mcp_host.runtime import mcp_call_tool, mcp_list_servers, mcp_list_tools
from api.services.mcp_host.transports.kbsew_native import (
    TOOL_HEALTH,
    TOOL_LIST_BARRELS,
    TOOL_LIST_DRIVERS,
    TOOL_RESOLVE_CORPUS,
    TOOL_SEARCH,
)


def test_mcp_policy_license_and_telemetry() -> None:
    assert license_allowed("MIT")
    assert license_allowed("Apache-2.0")
    assert not license_allowed("PROPRIETARY")
    assert telemetry_forbidden(True)
    assert not telemetry_forbidden(False)


def test_mcp_host_enabled_default_off(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ELITEEW_MCP_HOST_ENABLED", raising=False)
    assert mcp_host_enabled() is False
    assert mcp_host_enabled(defaults={}) is False
    assert mcp_host_enabled(defaults={"mcp_host_enabled": True}) is True
    monkeypatch.setenv("ELITEEW_MCP_HOST_ENABLED", "1")
    assert mcp_host_enabled() is True


def test_mcp_default_server_is_kbsew_native(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ELITEEW_MCP_SERVERS_JSON", raising=False)
    cfgs = load_mcp_server_configs()
    assert len(cfgs) == 2
    by_id = {c.id: c for c in cfgs}
    assert by_id["kbsew"].transport == "kbsew_native"
    assert by_id["research"].transport == "research_native"
    assert by_id["kbsew"].license == "MIT"
    assert by_id["research"].license == "MIT"


def test_mcp_rejects_telemetry_server(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(
        "ELITEEW_MCP_SERVERS_JSON",
        json.dumps(
            [
                {
                    "id": "bad",
                    "transport": "kbsew_native",
                    "license": "MIT",
                    "telemetry_ok": True,
                    "surfaces": ["desktop"],
                }
            ]
        ),
    )
    cfgs = load_mcp_server_configs()
    # Falls back to default kbsew when all filtered.
    assert cfgs[0].id == "kbsew"


def test_desktop_mcp_tools_hidden_when_disabled() -> None:
    tools = build_llama_tools(
        image=False,
        web_search=False,
        fetch_url=False,
        defaults={"mcp_host_enabled": False},
    )
    names = [t["function"]["name"] for t in tools]
    assert "mcp_list" not in names
    assert "mcp_call" not in names


def test_desktop_mcp_tools_visible_when_enabled() -> None:
    tools = build_llama_tools(
        image=False,
        web_search=False,
        fetch_url=False,
        defaults={"mcp_host_enabled": True},
    )
    names = [t["function"]["name"] for t in tools]
    assert "mcp_list" in names
    assert "mcp_call" in names


@pytest.mark.asyncio
async def test_mcp_list_and_call_kbsew_native(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ELITEEW_MCP_HOST_ENABLED", "1")
    monkeypatch.delenv("ELITEEW_MCP_SERVERS_JSON", raising=False)
    servers = mcp_list_servers(surface="desktop", defaults={"mcp_host_enabled": True})
    assert any(s["id"] == "kbsew" for s in servers)

    tools = await mcp_list_tools(server_id="kbsew", surface="desktop", defaults={"mcp_host_enabled": True})
    tool_names = {t["name"] for t in tools}
    assert TOOL_LIST_BARRELS in tool_names
    assert TOOL_LIST_DRIVERS in tool_names
    assert TOOL_HEALTH in tool_names
    assert TOOL_RESOLVE_CORPUS in tool_names
    assert TOOL_SEARCH in tool_names

    with patch(
        "api.services.mcp_host.transports.kbsew_native.kbsew_list_barrels",
        new=AsyncMock(return_value=[{"id": "b1", "name": "eliteew-docs", "enabled": True}]),
    ):
        out = await mcp_call_tool(
            server_id="kbsew",
            tool=TOOL_LIST_BARRELS,
            arguments={},
            surface="desktop",
            defaults={"mcp_host_enabled": True},
        )
    payload: dict[str, Any] = json.loads(out)
    assert payload["barrels"][0]["id"] == "b1"

    with (
        patch(
            "api.services.mcp_host.transports.kbsew_native.kbsew_list_barrels",
            new=AsyncMock(return_value=[{"id": "docs-id", "name": "eliteew-docs", "enabled": True}]),
        ),
        patch(
            "api.services.mcp_host.transports.kbsew_native.kbsew_search_barrel",
            new=AsyncMock(return_value=["chunk-a"]),
        ),
    ):
        out2 = await mcp_call_tool(
            server_id="kbsew",
            tool=TOOL_SEARCH,
            arguments={"query": "hello", "corpus": "docs"},
            surface="desktop",
            defaults={"mcp_host_enabled": True},
        )
    payload2 = json.loads(out2)
    assert payload2["chunks"] == ["chunk-a"]
    assert payload2["barrel_id"] == "docs-id"


@pytest.mark.asyncio
async def test_mcp_research_native_requires_context(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ELITEEW_MCP_HOST_ENABLED", "1")
    monkeypatch.delenv("ELITEEW_MCP_SERVERS_JSON", raising=False)
    servers = mcp_list_servers(surface="desktop", defaults={"mcp_host_enabled": True})
    assert any(s["id"] == "research" for s in servers)
    tools = await mcp_list_tools(server_id="research", surface="desktop", defaults={"mcp_host_enabled": True})
    names = {t["name"] for t in tools}
    assert "web_search" in names
    assert "chat_rag_search" in names
    assert "project_vault_search" in names
    denied = await mcp_call_tool(
        server_id="research",
        tool="web_search",
        arguments={"query": "test query here"},
        surface="desktop",
        defaults={"mcp_host_enabled": True},
    )
    assert json.loads(denied).get("error") == "research_context_required"


@pytest.mark.asyncio
async def test_companion_mcp_handlers_registry() -> None:
    from api.ewa_platform.companion.orchestration.tools.registry_core import (
        REGISTRY,
        dispatch_tool_by_name,
    )
    from api.ewa_platform.companion.orchestration.tools.registry_types import ToolContext

    assert "mcp_list" in REGISTRY
    assert "mcp_call" in REGISTRY
    ctx = ToolContext(
        principal_id="u1",
        user_line="",
        content_catalog_user_id=None,
        oauth2_sub_for_content_alternate=None,
    )
    with patch("api.ewa_platform.companion.orchestration.tools.handlers_mcp.mcp_host_enabled", return_value=True):
        with patch(
            "api.ewa_platform.companion.orchestration.tools.handlers_mcp.mcp_list_servers",
            return_value=[{"id": "kbsew", "transport": "kbsew_native"}],
        ):
            result = await dispatch_tool_by_name("mcp_list", {}, ctx)
    assert result is not None
    assert result.get("status") == "ok"


@pytest.mark.asyncio
async def test_kbsew_native_invalid_limit_and_unknown_corpus() -> None:
    from api.services.mcp_host.transports.kbsew_native import call_kbsew_native_tool

    bad_limit = json.loads(
        await call_kbsew_native_tool(TOOL_SEARCH, {"query": "x", "barrel_id": "b1", "limit": "nope"})
    )
    assert bad_limit["error"] == "invalid_limit"

    with patch(
        "api.services.mcp_host.transports.kbsew_native.kbsew_list_barrels",
        new=AsyncMock(return_value=[]),
    ):
        unknown = json.loads(await call_kbsew_native_tool(TOOL_RESOLVE_CORPUS, {"corpus": "nope"}))
    assert unknown["error"] == "unknown_corpus"
    assert "docs" in unknown["allowed"]
    assert "eliteew-docs" in unknown["allowed"]


@pytest.mark.asyncio
async def test_kbsew_health_offline_returns_json_error() -> None:
    from api.services.kbsew.kbsew_client import KbsewClientError
    from api.services.mcp_host.transports.kbsew_native import call_kbsew_native_tool

    with patch(
        "api.services.mcp_host.transports.kbsew_native.kbsew_health_bundle",
        new=AsyncMock(side_effect=KbsewClientError("down")),
    ):
        out = json.loads(await call_kbsew_native_tool(TOOL_HEALTH, {}))
    assert out["error"] == "client_error"


@pytest.mark.asyncio
async def test_companion_mcp_call_marks_error_status() -> None:
    from api.ewa_platform.companion.orchestration.tools.registry_core import dispatch_tool_by_name
    from api.ewa_platform.companion.orchestration.tools.registry_types import ToolContext

    ctx = ToolContext(
        principal_id="u1",
        user_line="",
        content_catalog_user_id=None,
        oauth2_sub_for_content_alternate=None,
    )
    with patch("api.ewa_platform.companion.orchestration.tools.handlers_mcp.mcp_host_enabled", return_value=True):
        with patch(
            "api.ewa_platform.companion.orchestration.tools.handlers_mcp.mcp_call_tool",
            new=AsyncMock(return_value=json.dumps({"error": "unavailable", "message": "down"})),
        ):
            result = await dispatch_tool_by_name(
                "mcp_call",
                {"server_id": "kbsew", "tool": TOOL_HEALTH, "arguments": {}},
                ctx,
            )
    assert result is not None
    assert result.get("status") == "error"


def test_stdio_timeout_and_child_env(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.services.mcp_host.config import McpServerConfig
    from api.services.mcp_host.transports import stdio_mcp

    monkeypatch.delenv("ELITEEW_MCP_STDIO_TIMEOUT_SEC", raising=False)
    assert stdio_mcp._stdio_timeout_sec() == 45.0
    monkeypatch.setenv("ELITEEW_MCP_STDIO_TIMEOUT_SEC", "12")
    assert stdio_mcp._stdio_timeout_sec() == 12.0

    monkeypatch.setenv("PATH", "/usr/bin")
    monkeypatch.setenv("KBSEW_INTERNAL_SERVICE_TOKEN", "should-not-leak")
    cfg = McpServerConfig(
        id="ext",
        transport="stdio",
        license="MIT",
        command=("echo",),
        env={"FOO": "bar"},
    )
    child = stdio_mcp._child_env(cfg)
    assert child is not None
    assert child["FOO"] == "bar"
    assert child.get("PATH") == "/usr/bin"
    assert "KBSEW_INTERNAL_SERVICE_TOKEN" not in child
