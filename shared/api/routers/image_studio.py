# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://empery.world
#  Author: po&T && TZBrand
# ------------------------------------------------------------------------------
# Purpose:
#   Image Studio API models + legacy sync route retirement (use /stream endpoints).
# Invariants:
#   - Generation runs in UGS queue worker; SSE routes in image_studio_stream.py.
# Related:
#   - api/routers/image_studio_stream.py
#   - documentation/product/IMAGE-STUDIO.md
# ------------------------------------------------------------------------------
"""
Image Studio API.

Long-running generation uses POST ``/image-studio/*/stream`` (SSE + UGS queue worker).
Legacy sync POST routes return HTTP 410 with ``stream_path`` — see IMAGE-STUDIO.md.
"""

from __future__ import annotations

import base64
import logging
from typing import Any, NoReturn

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from api.core.auth import User
from api.core.oauth2_auth import require_oauth2_user
from api.services.image_studio.rotate_modes import STUDIO_ROTATE_OUTPUT_NODES

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/image-studio", tags=["Image Studio"])

MAX_IMAGE_BYTES = 10 * 1024 * 1024

_SYNC_RETIRED_BASE = {
    "code": "image_studio_sync_retired",
    "message": "Use the matching /stream endpoint; generation runs in the UGS queue worker.",
}


class TextToImageRequest(BaseModel):
    prompt: str | None = None
    width: int = 1024
    height: int = 1024
    seed: int | None = None
    idempotency_key: str | None = Field(default=None, max_length=220)


class SuggestImagePromptRequest(BaseModel):
    """Тело POST /image-studio/suggest-prompt/stream — идея для AI."""

    idea: str | None = None
    style_hint: str | None = None
    language: str | None = "en"
    idempotency_key: str | None = Field(default=None, max_length=220)


class ImageEditJsonRequest(BaseModel):
    prompt: str | None = None
    image: str | None = None
    negative_prompt: str = ""
    seed: int | None = None
    idempotency_key: str | None = Field(default=None, max_length=220)


def _b64_from_bytes(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def _raise_sync_retired(stream_path: str) -> NoReturn:
    raise HTTPException(
        status_code=410,
        detail={**_SYNC_RETIRED_BASE, "stream_path": stream_path},
    )


@router.post("/text-to-image")
async def text_to_image(
    body: TextToImageRequest,
    user: User = Depends(require_oauth2_user),  # noqa: ARG001
) -> dict[str, Any]:
    _raise_sync_retired("/api/v1/image-studio/text-to-image/stream")


@router.post("/suggest-prompt")
async def suggest_image_prompt(
    body: SuggestImagePromptRequest,
    user: User = Depends(require_oauth2_user),  # noqa: ARG001
) -> dict[str, Any]:
    _raise_sync_retired("/api/v1/image-studio/suggest-prompt/stream")


@router.post("/image-edit")
async def image_edit(
    prompt: str = Form(...),
    image: UploadFile = File(...),
    user: User = Depends(require_oauth2_user),  # noqa: ARG001
) -> dict[str, Any]:
    _raise_sync_retired("/api/v1/image-studio/image-edit/stream")


@router.post("/image-edit-json")
async def image_edit_json(
    body: ImageEditJsonRequest,
    user: User = Depends(require_oauth2_user),  # noqa: ARG001
) -> dict[str, Any]:
    _raise_sync_retired("/api/v1/image-studio/image-edit-json/stream")


@router.post("/image-rotate")
async def image_rotate(
    image: UploadFile = File(...),
    user: User = Depends(require_oauth2_user),  # noqa: ARG001
) -> dict[str, Any]:
    _raise_sync_retired("/api/v1/image-studio/image-rotate/stream")


# Back-compat alias for tests/importers that expected the old name on the router module.
ROTATE_OUTPUT_NODES = STUDIO_ROTATE_OUTPUT_NODES
