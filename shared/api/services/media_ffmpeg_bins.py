# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Resolve ffmpeg/ffprobe binaries for ACE music stitch and other media helpers.
# Invariants:
# - Prefer PATH lookup; honor STACK0_FFMPEG_BIN when executable.
# Related:
# - api/services/ace_audio_stitch.py
# - documentation/platform/docker-re_doc/STACK0-BACKEND-IMAGES.md
# ---

from __future__ import annotations

import os
import shutil


def resolve_ffmpeg_bin(*, configured: str | None = None) -> str | None:
    path = shutil.which("ffmpeg")
    if path:
        return path
    candidate = (configured if configured is not None else os.environ.get("STACK0_FFMPEG_BIN", "")).strip()
    if candidate and os.path.isfile(candidate) and os.access(candidate, os.X_OK):
        return candidate
    return None


def resolve_ffprobe_bin(*, configured: str | None = None) -> str | None:
    path = shutil.which("ffprobe")
    if path:
        return path
    ffmpeg = resolve_ffmpeg_bin(configured=configured)
    if ffmpeg:
        sibling = os.path.join(os.path.dirname(ffmpeg), "ffprobe")
        if os.path.isfile(sibling) and os.access(sibling, os.X_OK):
            return sibling
    return None


def require_ffmpeg_bin(*, configured: str | None = None) -> str:
    path = resolve_ffmpeg_bin(configured=configured)
    if not path:
        msg = "ffmpeg not found on PATH (set STACK0_FFMPEG_BIN or install ffmpeg in the worker image)"
        raise FileNotFoundError(msg)
    return path


def require_ffprobe_bin(*, configured: str | None = None) -> str:
    path = resolve_ffprobe_bin(configured=configured)
    if not path:
        msg = "ffprobe not found on PATH (install ffmpeg in the worker image or set STACK0_FFMPEG_BIN)"
        raise FileNotFoundError(msg)
    return path
