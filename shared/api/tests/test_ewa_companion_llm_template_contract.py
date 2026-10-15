# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract locks for Gemma 4 / Qwen companion LLM template kwargs and Tool Router token budget.
# Invariants:
# - Default companion chat disables thinking channel (Gemma 4 Canonical ``enable_thinking``).
# - Tool Router max_tokens honors env up to 1024 (not hard-capped at 128).
# Related:
# - api/ewa_platform/companion/turn/turn_llm_runtime.py
# - api/ewa_platform/companion/sidecar/tool_router.py
# ---

from __future__ import annotations

import asyncio
from unittest.mock import patch

import httpx
import pytest


@pytest.mark.unit
def test_companion_chat_template_kwargs_default_disables_thinking(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("EWA_COMPANION_CHAT_ENABLE_THINKING", raising=False)
    from api.ewa_platform.companion.turn import turn_llm_runtime as rtl

    assert rtl.companion_chat_enable_thinking() is False
    assert rtl.companion_chat_template_kwargs() == {"enable_thinking": False}
    assert rtl.companion_llm_extra_params() == {"reasoning_format": "none"}


@pytest.mark.unit
def test_companion_chat_template_kwargs_opt_in_thinking(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_CHAT_ENABLE_THINKING", "1")
    from api.ewa_platform.companion.turn import turn_llm_runtime as rtl

    assert rtl.companion_chat_enable_thinking() is True
    assert rtl.companion_chat_template_kwargs() == {"enable_thinking": True}
    assert rtl.companion_llm_extra_params() == {}


def _router_ok_payload() -> dict:
    return {
        "response": "",
        "message": {
            "role": "assistant",
            "tool_calls": [
                {
                    "function": {
                        "name": "companion_route_turn",
                        "arguments": {"intent": "chat_only", "confidence": 0.9},
                    }
                }
            ],
        },
        "finish_reason": "tool_calls",
    }


@pytest.mark.unit
def test_companion_tool_router_max_tokens_honors_env_not_128_cap(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Regression: max_tok was ``min(..., 128)`` which silently ignored env default 384."""

    monkeypatch.setenv("EWA_COMPANION_TOOL_ROUTER_MAX_TOKENS", "384")
    captured: dict[str, object] = {}

    async def _fake_json(client, base, **kwargs):  # noqa: ANN001
        opts = kwargs.get("options") or {}
        captured["num_predict"] = opts.get("num_predict")
        captured["chat_template_kwargs"] = kwargs.get("chat_template_kwargs")
        return _router_ok_payload()

    from api.ewa_platform.companion.sidecar import tool_router as tr

    async def _run() -> None:
        with patch.object(tr, "httpx_compat_chat_completion_json", new=_fake_json):
            with patch(
                "api.ewa_platform.companion.orchestration.branch_line_gates.user_line_may_probe_tool_router",
                return_value=True,
            ):
                async with httpx.AsyncClient() as client:
                    plan = await tr.run_companion_tool_router(
                        client,
                        user_line="открой музыку пожалуйста длинная фраза",
                        shell_norm={},
                        russian_user=True,
                    )
        assert plan is not None
        assert plan.tool == "chat_only"

    with patch.object(tr, "companion_tool_router_enabled", return_value=True):
        with patch.object(tr, "companion_tool_router_base_url", return_value="http://tool-router.test"):
            with patch.object(tr, "companion_tool_router_model", return_value="qwen.gguf"):
                with patch.object(tr, "companion_tool_router_mode", return_value="full"):
                    asyncio.run(_run())

    assert captured["num_predict"] == 384
    assert captured["chat_template_kwargs"] == {"enable_thinking": False}


@pytest.mark.unit
def test_companion_tool_router_max_tokens_clamped_to_1024(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_TOOL_ROUTER_MAX_TOKENS", "99999")
    captured: dict[str, object] = {}

    async def _fake_json(client, base, **kwargs):  # noqa: ANN001
        opts = kwargs.get("options") or {}
        captured["num_predict"] = opts.get("num_predict")
        return _router_ok_payload()

    from api.ewa_platform.companion.sidecar import tool_router as tr

    async def _run() -> None:
        with patch.object(tr, "httpx_compat_chat_completion_json", new=_fake_json):
            with patch(
                "api.ewa_platform.companion.orchestration.branch_line_gates.user_line_may_probe_tool_router",
                return_value=True,
            ):
                async with httpx.AsyncClient() as client:
                    await tr.run_companion_tool_router(
                        client,
                        user_line="сделай пожалуйста действие",
                        shell_norm={},
                        russian_user=True,
                    )

    with patch.object(tr, "companion_tool_router_enabled", return_value=True):
        with patch.object(tr, "companion_tool_router_base_url", return_value="http://tool-router.test"):
            with patch.object(tr, "companion_tool_router_model", return_value="qwen.gguf"):
                with patch.object(tr, "companion_tool_router_mode", return_value="full"):
                    asyncio.run(_run())

    assert captured["num_predict"] == 1024
