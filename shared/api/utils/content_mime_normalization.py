# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Normalize Content-Type for download/stream when DB stores empty/octet-stream
# or generic text/plain for known extensions (.md, audio).
# Invariants:
# - Never invent MIME without a filename extension hint.
# - Prefer explicit audio/* / text/markdown over application/octet-stream for <audio>/preview.
# Related:
# - api/routers/unified_content_download.py
# - documentation/product/desktop/DESKTOP-MUSIC-PLAYER.md
# ---

"""Normalize mime for downloads (markdown + audio extension hints)."""

from __future__ import annotations

from pathlib import Path

_GENERIC_BINARY = frozenset(
    {
        "",
        "application/octet-stream",
        "binary/octet-stream",
        "application/binary",
    }
)

_AUDIO_EXT_MIME: dict[str, str] = {
    "mp3": "audio/mpeg",
    "m4a": "audio/mp4",
    "aac": "audio/aac",
    "wav": "audio/wav",
    "flac": "audio/flac",
    "ogg": "audio/ogg",
    "opus": "audio/ogg",
    "oga": "audio/ogg",
    "aif": "audio/aiff",
    "aiff": "audio/aiff",
    "wma": "audio/x-ms-wma",
}


def normalized_mime_type(mime_type: str | None, original_filename: str | None) -> str | None:
    """
    When storage MIME is empty/generic, map known extensions to a usable Content-Type.

    - `.md` / `.markdown` + text/plain|octet → text/markdown
    - audio extensions + empty/octet → audio/*
    """
    leaf = Path((original_filename or "").strip()).name.lower()
    m = (mime_type or "").strip().lower()

    if leaf.endswith(".md") or leaf.endswith(".markdown"):
        if m in ("text/plain", *_GENERIC_BINARY):
            return "text/markdown"
        return mime_type

    ext = Path(leaf).suffix.lstrip(".").lower()
    audio_mime = _AUDIO_EXT_MIME.get(ext)
    if audio_mime and m in _GENERIC_BINARY:
        return audio_mime

    return mime_type
