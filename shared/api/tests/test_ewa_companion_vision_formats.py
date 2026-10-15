# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Contract tests for companion vision format allowlist (JPEG/PNG/WebP).
# Related:
# - api/ewa_platform/companion/contracts/vision_formats.py
# ---

from __future__ import annotations

import pytest

from api.ewa_platform.companion.contracts.vision_formats import (
    COMPANION_VISION_ACCEPT_ATTR,
    companion_vision_mime_allowed,
    companion_vision_mime_from_magic,
)


def test_companion_vision_accept_attr_no_gif() -> None:
    assert "gif" not in COMPANION_VISION_ACCEPT_ATTR.lower()


@pytest.mark.parametrize(
    ("mime", "allowed"),
    [
        ("image/jpeg", True),
        ("image/png", True),
        ("image/webp", True),
        ("image/gif", False),
        ("image/bmp", False),
    ],
)
def test_companion_vision_mime_allowed(mime: str, allowed: bool) -> None:
    assert companion_vision_mime_allowed(mime) is allowed


def test_companion_vision_magic_png() -> None:
    assert companion_vision_mime_from_magic(b"\x89PNG\r\n\x1a\n\x00") == "image/png"


def test_companion_vision_magic_rejects_gif_header() -> None:
    assert companion_vision_mime_from_magic(b"GIF89a") is None
