# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
"""Tests for marketing tool-router sidecar parsing and runtime."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from api.routers.marketing_cabinet.marketing_agent_tools import (
    parse_llama_tool_calls,
    parse_marketing_tool_calls_from_chat_result,
)
from api.services.marketing_cabinet.marketing_tool_router import (
    marketing_tool_router_enabled,
    resolve_marketing_tool_router_runtime,
    run_marketing_tool_router,
)


def test_parse_marketing_tool_calls_from_llama_top_level() -> None:
    raw = {
        "tool_calls": [
            {
                "function": {
                    "name": "get_entity_counts",
                    "arguments": {},
                }
            },
            {
                "function": {
                    "name": "search_project_documents",
                    "arguments": json.dumps({"query": "конкуренты"}),
                }
            },
        ]
    }
    out = parse_marketing_tool_calls_from_chat_result(raw)
    assert [x["name"] for x in out] == ["get_entity_counts", "search_project_documents"]
    assert out[1]["arguments"]["query"] == "конкуренты"


def test_parse_marketing_tool_calls_from_openai_message() -> None:
    raw = {
        "message": {
            "tool_calls": [
                {
                    "function": {
                        "name": "list_competitors",
                        "arguments": {"limit": 5},
                    }
                }
            ]
        }
    }
    out = parse_marketing_tool_calls_from_chat_result(raw)
    assert out == [{"name": "list_competitors", "arguments": {"limit": 5}}]


def test_parse_llama_tool_calls_alias() -> None:
    raw = {"tool_calls": [{"function": {"name": "list_job_stories", "arguments": {}}}]}
    assert parse_llama_tool_calls(raw) == [{"name": "list_job_stories", "arguments": {}}]


def test_marketing_tool_router_enabled_respects_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("MARKETING_CABINET_TOOL_ROUTER_ENABLED", raising=False)
    monkeypatch.delenv("MARKETING_CABINET_TOOL_ROUTER_URL", raising=False)
    monkeypatch.delenv("EWA_COMPANION_TOOL_ROUTER_URL", raising=False)
    monkeypatch.delenv("DESKTOP_AI_CHAT_TOOL_ROUTER_URL", raising=False)
    assert marketing_tool_router_enabled() is False

    monkeypatch.setenv("EWA_COMPANION_TOOL_ROUTER_URL", "http://192.168.1.141:8083")
    assert marketing_tool_router_enabled() is True

    monkeypatch.setenv("MARKETING_CABINET_TOOL_ROUTER_ENABLED", "0")
    assert marketing_tool_router_enabled() is False


def test_resolve_marketing_tool_router_runtime_fallback_chain(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("MARKETING_CABINET_TOOL_ROUTER_URL", raising=False)
    monkeypatch.setenv("EWA_COMPANION_TOOL_ROUTER_URL", "http://192.168.1.141:8083")
    monkeypatch.setenv("EWA_COMPANION_TOOL_ROUTER_MODEL", "Qwen3-test.gguf")
    base, model, max_tok, timeout_sec = resolve_marketing_tool_router_runtime()
    assert base == "http://192.168.1.141:8083"
    assert model == "Qwen3-test.gguf"
    assert max_tok == 512
    assert timeout_sec == 45.0


@pytest.mark.asyncio
async def test_run_marketing_tool_router_parses_sidecar_response(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MARKETING_CABINET_TOOL_ROUTER_ENABLED", "1")
    monkeypatch.setenv("MARKETING_CABINET_TOOL_ROUTER_URL", "http://192.168.1.141:8083")
    monkeypatch.setenv("MARKETING_CABINET_TOOL_ROUTER_MODEL", "Qwen3-test.gguf")

    fake_out = {
        "message": {
            "tool_calls": [
                {
                    "function": {
                        "name": "get_entity_counts",
                        "arguments": "{}",
                    }
                }
            ]
        }
    }

    with patch(
        "api.services.marketing_cabinet.marketing_tool_router.httpx_compat_chat_completion_json",
        new_callable=AsyncMock,
        return_value=fake_out,
    ):
        result = await run_marketing_tool_router(system_prompt="sys", user_prompt="user")

    assert result is not None
    planned, model = result
    assert model == "Qwen3-test.gguf"
    assert planned == [{"name": "get_entity_counts", "arguments": {}}]


def _router_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MARKETING_CABINET_TOOL_ROUTER_ENABLED", "1")
    monkeypatch.setenv("MARKETING_CABINET_TOOL_ROUTER_URL", "http://192.168.1.141:8083")
    monkeypatch.setenv("MARKETING_CABINET_TOOL_ROUTER_MODEL", "Qwen3-test.gguf")


@pytest.mark.asyncio
async def test_run_marketing_tool_router_returns_none_on_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    _router_env(monkeypatch)
    with patch(
        "api.services.marketing_cabinet.marketing_tool_router.httpx_compat_chat_completion_json",
        new_callable=AsyncMock,
        side_effect=httpx.TimeoutException("sidecar timeout"),
    ):
        result = await run_marketing_tool_router(system_prompt="sys", user_prompt="user")
    assert result is None


@pytest.mark.asyncio
async def test_run_marketing_tool_router_returns_none_on_502(monkeypatch: pytest.MonkeyPatch) -> None:
    _router_env(monkeypatch)
    request = httpx.Request("POST", "http://192.168.1.141:8083/v1/chat/completions")
    response = httpx.Response(502, request=request, text="Bad Gateway")
    with patch(
        "api.services.marketing_cabinet.marketing_tool_router.httpx_compat_chat_completion_json",
        new_callable=AsyncMock,
        side_effect=httpx.HTTPStatusError("Bad Gateway", request=request, response=response),
    ):
        result = await run_marketing_tool_router(system_prompt="sys", user_prompt="user")
    assert result is None


@pytest.mark.asyncio
async def test_run_marketing_tool_router_returns_none_on_empty_tool_calls(monkeypatch: pytest.MonkeyPatch) -> None:
    _router_env(monkeypatch)
    fake_out = {"message": {"content": "no tools", "tool_calls": []}}
    with patch(
        "api.services.marketing_cabinet.marketing_tool_router.httpx_compat_chat_completion_json",
        new_callable=AsyncMock,
        return_value=fake_out,
    ):
        result = await run_marketing_tool_router(system_prompt="sys", user_prompt="user")
    assert result is None
