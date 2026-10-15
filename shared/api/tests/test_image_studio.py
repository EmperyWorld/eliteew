# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral tests for Image Studio helpers, rotate SSOT, sync retirement, finalize.
# Related:
# - api/routers/image_studio.py
# - api/services/image_studio/response_finalize.py
# ---

from __future__ import annotations

import base64
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from api.core.auth import User
from api.core.oauth2_auth import require_oauth2_user
from api.routers.creative_studio_utils import (
    build_image_edit_input_data,
    raise_http_from_ugs_value_error,
)
from api.routers.image_studio import router as image_studio_router
from api.services.image_studio.response_finalize import (
    finalize_suggest_prompt_response,
)
from api.services.image_studio.response_finalize import (
    sanitize_image_prompt_text as _sanitize_image_prompt_text,
)
from api.services.image_studio.response_finalize import (
    text_from_ugs_result as _text_from_ugs_result,
)
from api.services.image_studio.rotate_modes import (
    STUDIO_ROTATE_OUTPUT_NODES,
    validate_rotate_mode,
)

_FAKE_PNG_B64 = base64.b64encode(b"\x89PNG\r\n\x1a\nfake").decode()
_USER_ID = uuid4()


def test_sanitize_image_prompt_strips_channel_thought() -> None:
    raw = "<|channel>thought\nI will write a prompt\n<|channel|>mountain river, clear water, soft morning light"
    assert _sanitize_image_prompt_text(raw) == "mountain river, clear water, soft morning light"


def test_text_from_ugs_result_strips_channel_markup() -> None:
    ugs = {
        "result": {
            "result": {
                "text": "<|channel>thought\nplan\n<|channel|>red apple on wood, soft daylight",
            }
        }
    }
    assert _text_from_ugs_result(ugs) == "red apple on wood, soft daylight"


def test_build_image_edit_input_data_emits_canonical_shape() -> None:
    payload = build_image_edit_input_data(
        prompt="  Make shadows softer  ",
        image_base64="abc123",
        negative_prompt="  no artifacts ",
        seed=42,
    )
    assert payload == {
        "prompt": "Make shadows softer",
        "image_base64": "abc123",
        "negative_prompt": "no artifacts",
        "seed": 42,
    }


def test_rotate_modes_ssot_has_expected_keys() -> None:
    assert "angle90_right" in STUDIO_ROTATE_OUTPUT_NODES
    assert validate_rotate_mode("close_up") == "close_up"
    with pytest.raises(ValueError, match="Invalid mode"):
        validate_rotate_mode("not_a_mode")


def test_raise_http_from_ugs_value_error_insufficient_credits_structured() -> None:
    with pytest.raises(HTTPException) as ei:
        raise_http_from_ugs_value_error(ValueError("Insufficient credits: need 18"))
    assert ei.value.status_code == 402
    detail = ei.value.detail
    assert isinstance(detail, dict)
    assert detail["code"] == "insufficient_credits"


def test_finalize_suggest_prompt_response() -> None:
    out = finalize_suggest_prompt_response({"result": {"text": "sunset beach, golden hour, cinematic"}})
    assert out["prompt"] == "sunset beach, golden hour, cinematic"


def _make_image_studio_app() -> FastAPI:
    app = FastAPI()
    app.include_router(image_studio_router, prefix="/api/v1")

    fake_user = User(
        id=str(_USER_ID),
        username="image-studio-test",
        email="img@test.local",
        is_active=True,
    )

    async def override_user() -> User:
        return fake_user

    app.dependency_overrides[require_oauth2_user] = override_user
    return app


def test_sync_text_to_image_returns_410_with_stream_path() -> None:
    client = TestClient(_make_image_studio_app(), raise_server_exceptions=False)
    r = client.post(
        "/api/v1/image-studio/text-to-image",
        json={"prompt": "sunset over the sea", "width": 1024, "height": 1024},
    )
    assert r.status_code == 410
    detail = r.json().get("detail") or {}
    assert detail.get("code") == "image_studio_sync_retired"
    assert detail.get("stream_path") == "/api/v1/image-studio/text-to-image/stream"


@pytest.mark.asyncio
async def test_stream_finalize_image_empty_raises_value_error() -> None:
    from api.services.image_studio.streaming import _finalize_from_ugs_payload

    user = User(id=str(_USER_ID), username="t", email="t@t", is_active=True)
    content = MagicMock()

    async def finalize_image(_payload: dict) -> dict:
        raise ValueError("No image returned")

    with pytest.raises(ValueError, match="No image"):
        await _finalize_from_ugs_payload(
            {"status": "completed", "result": {"images": []}},
            user=user,
            content_service=content,
            finalize_image=finalize_image,
            finalize_prompt=None,
        )
