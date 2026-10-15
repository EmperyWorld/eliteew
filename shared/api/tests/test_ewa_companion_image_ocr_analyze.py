# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Tests for companion image OCR fallback when stack2 chat has no mmproj.
# Invariants:
# - Default multimodal vision is off; attachment resolves to OCR context, not data URL.
# Related:
# - api/ewa_platform/companion/turn/companion_image_ocr_analyze.py
# ---

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch

import pytest

from api.ewa_platform.companion.turn.companion_image_ocr_analyze import (
    build_llm_user_line_with_image_ocr,
    format_companion_image_ocr_context,
)
from api.ewa_platform.companion.turn.phases.turn_entry import resolve_turn_message_context
from api.ewa_platform.companion.turn.vision_attachment import companion_vision_multimodal_enabled


def test_companion_vision_multimodal_default_off(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EWA_COMPANION_VISION_MULTIMODAL", raising=False)
    assert companion_vision_multimodal_enabled() is False


def test_format_companion_image_ocr_context_includes_marker() -> None:
    block = format_companion_image_ocr_context(ocr_text="Hello world")
    assert "OCR" in block
    assert "Hello world" in block


def test_build_llm_user_line_with_image_ocr() -> None:
    line = build_llm_user_line_with_image_ocr(
        user_line="Что на картинке?",
        image_ocr_context="[Изображение — распознанный текст (OCR)]\nLine1",
    )
    assert "Что на картинке?" in line
    assert "Line1" in line


def test_resolve_turn_message_context_ocr_fallback(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_VISION_MULTIMODAL", "0")
    png_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    with patch(
        "api.ewa_platform.companion.turn.phases.turn_entry.companion_ocr_text_from_image_attachment",
        new=AsyncMock(return_value="Invoice #42"),
    ):
        ctx = asyncio.run(
            resolve_turn_message_context(
                message="Что на картинке?",
                image_attachment={"mime_type": "image/png", "data_base64": png_b64},
            )
        )
    assert ctx.vision_data_url is None
    assert ctx.has_image_attachment is True
    assert ctx.image_ocr_context is not None
    assert "Invoice #42" in ctx.image_ocr_context
