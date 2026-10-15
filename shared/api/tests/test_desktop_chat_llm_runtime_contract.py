# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lock Desktop AI Chat Gemma template kwargs and default sampling (stack2 instrument map).
# Invariants:
# - Visible stream and JSON completion disable thinking + reasoning_format=none.
# - Default temperature aligns with companion on the same chat server (0.55).
# Related:
# - api/services/desktop_chat/llm/runtime.py
# - documentation/platform/STACK2-LLM-CONTRACT.md
# ---

from __future__ import annotations

from api.services.desktop_chat.llm.runtime import (
    desktop_chat_extra_params,
    desktop_chat_template_kwargs,
    desktop_http_llm_options,
    resolve_desktop_chat_temperature,
    resolve_desktop_tool_router_runtime,
)


def test_desktop_chat_gemma_template_kwargs_disable_thinking() -> None:
    assert desktop_chat_template_kwargs() == {"enable_thinking": False}
    assert desktop_chat_extra_params() == {"reasoning_format": "none"}


def test_desktop_chat_default_temperature_matches_companion_class() -> None:
    assert resolve_desktop_chat_temperature({}) == 0.55
    opts = desktop_http_llm_options(num_predict=1024, defaults={})
    assert opts["temperature"] == 0.55
    assert opts["openai_visible_assistant_content_only"] is True


def test_desktop_tool_router_max_tokens_clamped_to_stack2_contract() -> None:
    _base, _model, max_tok, _ctx, _to = resolve_desktop_tool_router_runtime()
    assert 64 <= max_tok <= 1024
