# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for companion OCR instrument persist helpers (user/reply formatting).
# Related:
# - api/ewa_platform/companion/turn/companion_ocr_turn.py
# ---

from __future__ import annotations

from api.ewa_platform.companion.turn.companion_ocr_turn import (
    _format_ocr_reply,
    _format_user_line,
)


def test_format_user_line_local() -> None:
    assert _format_user_line(filename="scan.png", source="local") == ("Распознай текст на изображении: scan.png")


def test_format_user_line_content_manager() -> None:
    assert _format_user_line(filename="photo.jpg", source="content_manager") == (
        "Распознай текст на изображении из контент-менеджера: photo.jpg"
    )


def test_format_ocr_reply_includes_text_and_confidence() -> None:
    reply = _format_ocr_reply(filename="a.png", ocr_text="Hello", confidence=0.87)
    assert "Hello" in reply
    assert "a.png" in reply
    assert "87%" in reply


def test_format_ocr_reply_empty_text() -> None:
    reply = _format_ocr_reply(filename="blank.png", ocr_text="   ", confidence=None)
    assert "не удалось распознать" in reply.lower()
