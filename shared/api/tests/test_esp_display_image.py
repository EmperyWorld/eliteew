# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract locks for ESP LLM-prompt → Comfy→WebP→RGB565 helpers and public path.
# Related:
# - documentation/product/ewa/EWA-ESP-DISPLAY-AI.md
# ---
from __future__ import annotations

import io
import re
from typing import Any
from unittest.mock import MagicMock

import pytest
from PIL import Image

from api.ewa_platform.companion.esp_display import image_gen as image_gen_mod
from api.ewa_platform.companion.esp_display.image_gen import (
    TFT_H,
    TFT_W,
    build_llm_prompt_messages,
    compose_image_prompt,
    encode_cover_webp,
    image_rate_limit_allow,
    reset_esp_display_image_rate_limit_for_tests,
    resolve_image_prompt,
    sanitize_image_prompt_text,
    webp_to_rgb565_le,
)
from api.middleware.oauth2_protection import build_public_path_strings


def test_esp_display_image_path_is_jwt_public() -> None:
    patterns = [re.compile(p) for p in build_public_path_strings()]
    assert any(p.match("/api/v1/ewa/esp-display/image") for p in patterns)


def test_encode_cover_webp_and_rgb565_roundtrip() -> None:
    img = Image.new("RGB", (640, 480), (10, 20, 250))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    webp = encode_cover_webp(buf.getvalue())
    assert webp[:4] == b"RIFF"
    assert len(webp) < 80_000
    rgb = webp_to_rgb565_le(webp)
    assert len(rgb) == TFT_W * TFT_H * 2


def test_resolve_image_prompt_preset_and_custom() -> None:
    assert (
        "desk" in resolve_image_prompt("scene", None).lower() or "lamp" in resolve_image_prompt("scene", None).lower()
    )
    assert resolve_image_prompt("mascot", "a red cube") == "a red cube"


def test_sanitize_strips_channel_and_keeps_prompt() -> None:
    raw = "<|channel|>thought\nignore\n</channel>\nneon fox mascot, soft light, no text"
    out = sanitize_image_prompt_text(raw)
    assert "neon fox" in out.lower()
    assert "thought" not in out.lower()


def test_build_llm_prompt_messages_include_entropy() -> None:
    msgs = build_llm_prompt_messages("abstract", entropy="abc123")
    assert msgs[0]["role"] == "system"
    assert "abc123" in msgs[1]["content"]
    assert "abstract" in msgs[1]["content"]


@pytest.mark.asyncio
async def test_compose_image_prompt_custom_skips_llm(monkeypatch: pytest.MonkeyPatch) -> None:
    called = False

    async def boom(*_a: Any, **_k: Any) -> str | None:
        nonlocal called
        called = True
        return None

    monkeypatch.setattr(image_gen_mod, "llm_compose_image_prompt", boom)
    text, source = await compose_image_prompt(
        MagicMock(),
        principal_id="u1",
        preset="scene",
        prompt="a red cube on marble",
    )
    assert source == "custom"
    assert text == "a red cube on marble"
    assert called is False


@pytest.mark.asyncio
async def test_compose_image_prompt_uses_llm(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_llm(*_a: Any, **_k: Any) -> str:
        return "aurora ribbons over glossy void, cinematic, no text, no watermark"

    monkeypatch.setattr(image_gen_mod, "llm_compose_image_prompt", fake_llm)
    text, source = await compose_image_prompt(
        MagicMock(),
        principal_id="u1",
        preset="abstract",
        prompt=None,
    )
    assert source == "llm"
    assert "aurora" in text.lower()


@pytest.mark.asyncio
async def test_compose_image_prompt_fallback(monkeypatch: pytest.MonkeyPatch) -> None:
    async def empty(*_a: Any, **_k: Any) -> None:
        return None

    monkeypatch.setattr(image_gen_mod, "llm_compose_image_prompt", empty)
    text, source = await compose_image_prompt(
        MagicMock(),
        principal_id="u1",
        preset="mascot",
        prompt=None,
    )
    assert source == "fallback"
    assert "robot" in text.lower() or "mascot" in text.lower()


def test_image_rate_limit() -> None:
    reset_esp_display_image_rate_limit_for_tests()
    assert image_rate_limit_allow(now=1.0) is True
    assert image_rate_limit_allow(now=2.0) is False
    assert image_rate_limit_allow(now=50.0) is True
