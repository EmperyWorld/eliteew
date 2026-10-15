# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
#   Unit tests for Video Studio helpers that validate and resolve ComfyUI video payloads.
# Invariants:
#   - Truncated UGS strings must never be treated as playable video bytes.
# Related:
#   - api/routers/video_studio.py
# ---
from __future__ import annotations

import base64
from unittest.mock import AsyncMock, MagicMock

import pytest

from api.routers import video_studio as video_studio_module


def test_video_b64_is_usable_rejects_truncated_marker() -> None:
    assert video_studio_module._video_b64_is_usable("AAAA...TRUNCATED...") is False


@pytest.mark.asyncio
async def test_resolve_video_b64_refetches_from_comfyui_when_payload_truncated() -> None:
    ugs = MagicMock()
    ugs.provider_manager.fetch_comfyui_output_video = AsyncMock(
        return_value="QUJDRA=="  # ABCD in base64 — too small alone
    )
    first = {
        "data": "X" * 40_000 + "...TRUNCATED...",
        "filename": "clip.mp4",
        "subfolder": "video",
        "storage_reference": {
            "provider": "comfyui",
            "kind": "video",
            "filename": "clip.mp4",
            "subfolder": "video",
        },
    }
    # Use a payload large enough to pass the size gate (>1000 decoded bytes).
    large_b64 = base64.b64encode(b"x" * 1500).decode("ascii")
    ugs.provider_manager.fetch_comfyui_output_video = AsyncMock(return_value=large_b64)
    out = await video_studio_module._resolve_video_b64(first, ugs=ugs)
    assert out == large_b64
    ugs.provider_manager.fetch_comfyui_output_video.assert_awaited_once_with("clip.mp4", "video")
