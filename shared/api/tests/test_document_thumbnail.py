# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract locks for regenerable Unified Content document/image preview helpers.
# Invariants:
# - Text/PDF/image may lazy-heal; broken_quarantined and video must not.
# - Text card JPEG is non-empty and decodable.
# ---
"""Tests for api.services.unified_content.document_thumbnail."""

from __future__ import annotations

from io import BytesIO

import pytest
from PIL import Image

from api.services.unified_content.document_thumbnail import (
    render_text_preview_jpeg,
    should_generate_document_thumbnail,
    should_lazy_heal_thumbnail,
)


@pytest.mark.parametrize(
    ("mime", "filename", "expected"),
    [
        ("text/plain", "note.txt", True),
        ("text/markdown", "readme.md", True),
        ("application/pdf", "doc.pdf", True),
        ("application/pdf", None, True),
        ("image/jpeg", "photo.jpg", False),
        ("video/mp4", "clip.mp4", False),
        (
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "a.docx",
            False,
        ),
    ],
)
def test_should_generate_document_thumbnail(
    mime: str | None,
    filename: str | None,
    expected: bool,
) -> None:
    assert should_generate_document_thumbnail(mime, filename) is expected


@pytest.mark.parametrize(
    ("mime", "filename", "integrity", "expected"),
    [
        ("text/plain", "a.txt", None, True),
        ("image/png", "a.png", None, True),
        ("application/pdf", "a.pdf", None, True),
        ("video/mp4", "a.mp4", None, False),
        ("text/plain", "a.txt", "broken_quarantined", False),
        ("image/jpeg", "a.jpg", "broken_quarantined", False),
    ],
)
def test_should_lazy_heal_thumbnail(
    mime: str | None,
    filename: str | None,
    integrity: str | None,
    expected: bool,
) -> None:
    assert (
        should_lazy_heal_thumbnail(
            mime,
            filename,
            integrity_status=integrity,
        )
        is expected
    )


def test_render_text_preview_jpeg_decodable() -> None:
    raw = render_text_preview_jpeg("Hello EliteEW\nLine two")
    assert isinstance(raw, (bytes, bytearray))
    assert len(raw) > 100
    img = Image.open(BytesIO(raw))
    assert img.format == "JPEG"
    assert img.size[0] > 0 and img.size[1] > 0
