# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Canonical allowlist for companion chat vision attachments (Gemma 4 E4B via llama.cpp mtmd).
# Invariants:
# - JPEG/PNG/WebP only — GIF/BMP/HEIC/SVG/TIFF are rejected (mtmd/stb decode + Gemma 4 guides).
# - Magic-byte probe is best-effort; MIME from client must still match allowlist.
# Related:
# - api/ewa_platform/companion/turn/vision_attachment.py
# - documentation/product/ewa/EWA-COMPANION-VISION-FORMATS.md (operator note)
# ---
"""Companion vision image format contract (Gemma 4 + llama-server)."""

from __future__ import annotations

from typing import Final

# llama.cpp mtmd + Gemma 4 practical set (JPEG/PNG/WebP). Not GIF (animation/decoder quirks).
COMPANION_VISION_ALLOWED_MIMES: Final[frozenset[str]] = frozenset(
    {
        "image/jpeg",
        "image/png",
        "image/webp",
    }
)

COMPANION_VISION_FILE_EXTENSIONS: Final[tuple[str, ...]] = (".jpg", ".jpeg", ".png", ".webp")

COMPANION_VISION_ACCEPT_ATTR: Final[str] = "image/jpeg,image/png,image/webp"

COMPANION_VISION_ACCEPT_LABEL_RU: Final[str] = "JPEG, PNG или WebP"
COMPANION_VISION_ACCEPT_LABEL_EN: Final[str] = "JPEG, PNG, or WebP"

_MAGIC_JPEG = b"\xff\xd8\xff"
_MAGIC_PNG = b"\x89PNG\r\n\x1a\n"
_MAGIC_WEBP_RIFF = b"RIFF"
_MAGIC_WEBP_FMT = b"WEBP"


def companion_vision_mime_from_magic(data: bytes) -> str | None:
    """Return canonical MIME when payload magic matches a supported format."""

    if len(data) >= 3 and data[:3] == _MAGIC_JPEG:
        return "image/jpeg"
    if len(data) >= 8 and data[:8] == _MAGIC_PNG:
        return "image/png"
    if len(data) >= 12 and data[:4] == _MAGIC_WEBP_RIFF and data[8:12] == _MAGIC_WEBP_FMT:
        return "image/webp"
    return None


def companion_vision_mime_allowed(mime_type: str) -> bool:
    return (mime_type or "").strip().lower() in COMPANION_VISION_ALLOWED_MIMES
