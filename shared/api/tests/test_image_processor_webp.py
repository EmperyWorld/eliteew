# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Lock WebP thumbnail encode + media sniff for Unified Content images.
# Related:
# - documentation/product/CONTENT-BROKEN-FILES-AND-WEBP-DISPLAY.md
# ---

from __future__ import annotations

from io import BytesIO

import pytest
from PIL import Image

from api.services.unified_content.processors.image_processor import (
    ImageProcessor,
    sniff_image_media_type,
)


@pytest.mark.unit
def test_sniff_image_media_type_webp_and_jpeg() -> None:
    webp = b"RIFF\x00\x00\x00\x00WEBP" + b"\x00" * 8
    assert sniff_image_media_type(webp) == "image/webp"
    assert sniff_image_media_type(b"\xff\xd8\xff\xe0rest") == "image/jpeg"
    assert sniff_image_media_type(b"xxxx", "bucket/id/thumbnail_x.webp") == "image/webp"
    assert sniff_image_media_type(b"xxxx", "bucket/id/thumbnail_x.jpg") == "image/jpeg"


@pytest.mark.unit
def test_image_processor_encodes_webp_magic() -> None:
    img = Image.new("RGB", (64, 48), color=(20, 40, 60))
    buf = BytesIO()
    img.save(buf, format="PNG")
    png_bytes = buf.getvalue()

    proc = object.__new__(ImageProcessor)
    proc.THUMBNAIL_SIZE = (32, 32)
    proc.THUMBNAIL_QUALITY = 80
    _meta, thumb = ImageProcessor._extract_metadata_and_thumbnail(
        proc,
        png_bytes,
        "image/png",
        "sample.png",
    )
    assert thumb[:4] == b"RIFF"
    assert thumb[8:12] == b"WEBP"
    assert sniff_image_media_type(thumb) == "image/webp"
