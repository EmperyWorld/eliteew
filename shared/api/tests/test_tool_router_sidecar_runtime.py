# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
"""Shared tool-router sidecar URL/model resolution."""

from __future__ import annotations

import pytest

from api.utils.tool_router_sidecar_runtime import (
    marketing_tool_router_stack2_fallback_enabled,
    shared_tool_router_base_url,
    shared_tool_router_model,
)


def test_shared_tool_router_base_url_chain(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EWA_COMPANION_TOOL_ROUTER_URL", raising=False)
    monkeypatch.delenv("DESKTOP_AI_CHAT_TOOL_ROUTER_URL", raising=False)
    monkeypatch.delenv("LLAMA_TOOL_ROUTER_URL", raising=False)
    monkeypatch.delenv("HOST_IP", raising=False)
    monkeypatch.delenv("LLAMA_TOOL_ROUTER_HOST_PORT", raising=False)
    assert shared_tool_router_base_url(primary_url_env="MARKETING_CABINET_TOOL_ROUTER_URL") == (
        "http://stack2-llama-tool-router:8080"
    )

    monkeypatch.setenv("HOST_IP", "192.168.1.141")
    monkeypatch.setenv("LLAMA_TOOL_ROUTER_HOST_PORT", "8083")
    assert shared_tool_router_base_url(primary_url_env="MARKETING_CABINET_TOOL_ROUTER_URL") == (
        "http://192.168.1.141:8083"
    )
    monkeypatch.delenv("HOST_IP", raising=False)
    monkeypatch.delenv("LLAMA_TOOL_ROUTER_HOST_PORT", raising=False)

    monkeypatch.setenv("DESKTOP_AI_CHAT_TOOL_ROUTER_URL", "http://desktop-router:8083")
    assert shared_tool_router_base_url(primary_url_env="EWA_COMPANION_TOOL_ROUTER_URL") == (
        "http://desktop-router:8083"
    )

    monkeypatch.setenv("EWA_COMPANION_TOOL_ROUTER_URL", "http://192.168.1.141:8083")
    assert shared_tool_router_base_url(primary_url_env="DESKTOP_AI_CHAT_TOOL_ROUTER_URL") == (
        "http://desktop-router:8083"
    )
    monkeypatch.delenv("DESKTOP_AI_CHAT_TOOL_ROUTER_URL", raising=False)
    assert shared_tool_router_base_url(primary_url_env="DESKTOP_AI_CHAT_TOOL_ROUTER_URL") == (
        "http://192.168.1.141:8083"
    )

    monkeypatch.setenv("MARKETING_CABINET_TOOL_ROUTER_URL", "http://marketing-only:8083")
    assert shared_tool_router_base_url(primary_url_env="MARKETING_CABINET_TOOL_ROUTER_URL") == (
        "http://marketing-only:8083"
    )


def test_shared_tool_router_prefers_lan_over_docker_hostname(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_TOOL_ROUTER_URL", "http://stack2-llama-tool-router:8080")
    monkeypatch.delenv("LLAMA_TOOL_ROUTER_URL", raising=False)
    monkeypatch.setenv("HOST_IP", "127.0.0.1")
    assert shared_tool_router_base_url(primary_url_env="EWA_COMPANION_TOOL_ROUTER_URL") == ("http://192.168.1.141:8083")

    monkeypatch.setenv("LLAMA_TOOL_ROUTER_URL", "http://192.168.1.141:8083")
    assert shared_tool_router_base_url(primary_url_env="EWA_COMPANION_TOOL_ROUTER_URL") == ("http://192.168.1.141:8083")


def test_shared_tool_router_model_chain(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EWA_COMPANION_TOOL_ROUTER_MODEL", raising=False)
    monkeypatch.delenv("DESKTOP_AI_CHAT_TOOL_ROUTER_MODEL", raising=False)
    monkeypatch.delenv("MARKETING_CABINET_TOOL_ROUTER_MODEL", raising=False)
    monkeypatch.delenv("LLAMA_TOOL_ROUTER_FILE", raising=False)
    assert shared_tool_router_model() == "Qwen3-4B-Instruct-2507-Q4_K_M.gguf"

    monkeypatch.setenv("LLAMA_TOOL_ROUTER_FILE", "legacy-qwen.gguf")
    assert shared_tool_router_model(primary_model_env="EWA_COMPANION_TOOL_ROUTER_MODEL") == "legacy-qwen.gguf"


def test_marketing_stack2_fallback_default_off(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("MARKETING_CABINET_TOOL_ROUTER_FALLBACK_STACK2", raising=False)
    assert marketing_tool_router_stack2_fallback_enabled() is False

    monkeypatch.setenv("MARKETING_CABINET_TOOL_ROUTER_FALLBACK_STACK2", "1")
    assert marketing_tool_router_stack2_fallback_enabled() is True
