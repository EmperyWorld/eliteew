# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
#   Contract tests for Desktop AI Chat Tool Router parse/dispatch.
# Invariants:
#   - Invalid payloads → None / no dispatch.
# Related:
#   - api/services/desktop_chat/sidecar/tool_router.py
# ---

from __future__ import annotations

import pytest

from api.schemas.pydantic.desktop_tool_router import DesktopToolRouterResultV1
from api.services.desktop_chat.llm.runtime import resolve_desktop_tool_router_runtime
from api.services.desktop_chat.sidecar.tool_router import (
    desktop_tool_router_mode,
    parse_desktop_tool_router_payload,
    router_plan_to_tool_args,
    router_tool_allowed_in_current_mode,
)


def test_parse_desktop_tool_router_payload_ok() -> None:
    out = parse_desktop_tool_router_payload(
        {
            "tool": "generate_image",
            "confidence": 0.88,
            "prompt": "кот на крыше",
            "aspect_ratio": "16:9",
        }
    )
    assert out is not None
    assert out.tool == "generate_image"
    assert out.confidence == pytest.approx(0.88)
    assert out.prompt == "кот на крыше"


def test_parse_desktop_tool_router_invalid_tool() -> None:
    assert parse_desktop_tool_router_payload({"tool": "music_generation", "confidence": 1}) is None


def test_router_plan_to_image_args() -> None:
    plan = DesktopToolRouterResultV1(
        tool="generate_image",
        confidence=0.9,
        prompt="закат",
        aspect_ratio="1:1",
    )
    name, args = router_plan_to_tool_args(plan)
    assert name == "desktop_generate_image"
    assert args["prompt"] == "закат"
    assert args["aspect_ratio"] == "1:1"


def test_router_partial_allows_image_and_web_search() -> None:
    assert router_tool_allowed_in_current_mode("generate_image", mode="partial") is True
    assert router_tool_allowed_in_current_mode("web_search", mode="partial") is True
    assert router_tool_allowed_in_current_mode("fetch_url", mode="partial") is False
    assert router_tool_allowed_in_current_mode("fetch_url", mode="full") is True
    assert router_tool_allowed_in_current_mode("web_search", mode="full") is True


def test_router_plan_to_web_search_args() -> None:
    plan = DesktopToolRouterResultV1(
        tool="web_search",
        confidence=0.91,
        query="новости недвижимость владивосток вчера",
    )
    name, args = router_plan_to_tool_args(plan)
    assert name == "desktop_web_search"
    assert "владивосток" in args["query"]


def test_resolve_desktop_tool_router_runtime_num_ctx(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DESKTOP_AI_CHAT_TOOL_ROUTER_NUM_CTX", "12288")
    _base, _model, max_tok, num_ctx, timeout_sec = resolve_desktop_tool_router_runtime()
    assert max_tok >= 64
    assert num_ctx == 12288
    assert timeout_sec >= 3.0


def test_desktop_tool_router_mode_default_is_partial(monkeypatch: pytest.MonkeyPatch) -> None:
    """Wave 5 / desktop-ai-chat-013: env default partial; DB/admin may still pin shadow."""
    monkeypatch.delenv("DESKTOP_AI_CHAT_TOOL_ROUTER_MODE", raising=False)
    assert desktop_tool_router_mode(None) == "partial"
    assert desktop_tool_router_mode({}) == "partial"
    assert desktop_tool_router_mode({"desktop_tool_router_mode": "shadow"}) == "shadow"
    assert desktop_tool_router_mode({"desktop_tool_router_mode": "full"}) == "full"
