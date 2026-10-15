# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Contract tests for companion vision attachments — MIME/size validation and multimodal LLM message injection.
# Invariants:
# - Stored transcript uses ``[Изображение]`` marker only; base64 stays out of history helpers.
# Related:
# - api/ewa_platform/companion/turn/vision_attachment.py
# ---
"""Tests for EWA companion chat vision attachments."""

from __future__ import annotations

import base64

import pytest

from api.ewa_platform.companion.turn.vision_attachment import (
    build_openai_user_content_with_image,
    companion_stored_user_line_for_turn,
    inject_turn_vision_into_llm_messages,
    resolve_companion_vision_data_url,
)


def test_companion_stored_user_line_image_marker() -> None:
    assert companion_stored_user_line_for_turn("", has_image=True) == "[Изображение]"
    assert companion_stored_user_line_for_turn("Привет", has_image=True) == "Привет\n[Изображение]"
    assert companion_stored_user_line_for_turn("Привет", has_image=False) == "Привет"


def test_resolve_companion_vision_data_url_accepts_png() -> None:
    raw = b"\x89PNG\r\n\x1a\n"
    b64 = base64.b64encode(raw).decode("ascii")
    url = resolve_companion_vision_data_url({"mime_type": "image/png", "data_base64": b64})
    assert url == f"data:image/png;base64,{b64}"


def test_resolve_companion_vision_rejects_oversize() -> None:
    raw = b"\x89PNG\r\n\x1a\n" + (b"x" * (4 * 1024 * 1024 + 1))
    big = base64.b64encode(raw).decode("ascii")
    with pytest.raises(ValueError, match="companion_vision_too_large"):
        resolve_companion_vision_data_url({"mime_type": "image/png", "data_base64": big})


def test_resolve_companion_vision_rejects_gif_mime() -> None:
    raw = b"GIF89a"
    b64 = base64.b64encode(raw).decode("ascii")
    with pytest.raises(ValueError, match="companion_vision_mime_not_allowed"):
        resolve_companion_vision_data_url({"mime_type": "image/gif", "data_base64": b64})


def test_inject_turn_vision_patches_last_user_message() -> None:
    data_url = "data:image/png;base64,abcd"
    msgs: list[dict] = [
        {"role": "system", "content": "sys"},
        {"role": "user", "content": "old"},
        {"role": "assistant", "content": "hi"},
        {"role": "user", "content": "Что на картинке?"},
    ]
    inject_turn_vision_into_llm_messages(msgs, user_text="Что на картинке?", data_url=data_url)
    last = msgs[-1]
    assert last["role"] == "user"
    content = last["content"]
    assert isinstance(content, list)
    assert content[0]["type"] == "text"
    assert content[1]["type"] == "image_url"
    assert content[1]["image_url"]["url"] == data_url


def test_build_openai_user_content_image_only_default_prompt() -> None:
    parts = build_openai_user_content_with_image("", "data:image/png;base64,abcd")
    assert parts[0]["text"] == "Опиши изображение."
    assert parts[1]["type"] == "image_url"
