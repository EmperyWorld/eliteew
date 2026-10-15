# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Reliability contract: POST /music-generator/generate must dedupe UGS billing work when
# idempotency_key repeats (audit A-02).
# Invariants:
# - run_studio_ugs_generate is invoked at most once per (user, type_key, idempotency_key) replay.
# - In-progress reuse returns HTTP 409 with structured detail.
# Related:
# - api/routers/music_generator.py (parent mount; domain registers parent only)
# - api/routers/music_generator_generate.py (POST /generate handler)
# - api/routers/music_generator_generate_support.py (UGS idempotency + persist helpers)
# - api/routers/creative_studio_utils.py
# - documentation/platform/docker-re_doc/UGS-IDEMPOTENCY.md
# ---

from __future__ import annotations

import base64
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.core.auth import User
from api.core.oauth2_auth import require_oauth2_user
from api.routers.music_generator import router as music_generator_router
from api.routers.ugs import get_ugs_service
from api.routers.unified_content import get_content_service

_FAKE_MP3_B64 = base64.b64encode(b"ID3fake").decode()
_IDEM_KEY = "970e23a2-7b1c-4d5e-9f0a-1b2c3d4e5f6a"
_USER_ID = uuid4()


def _completed_ugs_payload() -> dict:
    return {
        "status": "completed",
        "result": {"audio": [{"data": _FAKE_MP3_B64}]},
    }


def _in_progress_reuse_payload(request_id: str | None = None) -> dict:
    return {
        "request_id": request_id or str(uuid4()),
        "status": "processing",
        "reused": True,
        "message": "Запрос уже выполняется, возвращён текущий request_id.",
        "idempotency_key": _IDEM_KEY,
    }


def _make_music_generate_app() -> FastAPI:
    app = FastAPI()
    app.include_router(music_generator_router, prefix="/api/v1")

    fake_user = User(
        id=str(_USER_ID),
        username="music-idem-user",
        email="idem@test.local",
        is_active=True,
    )

    async def override_user() -> User:
        return fake_user

    fake_ugs = MagicMock()
    fake_content = MagicMock()
    fake_content.create_content = AsyncMock(
        return_value=SimpleNamespace(id=uuid4(), name="Test Song"),
    )

    async def override_ugs() -> MagicMock:
        return fake_ugs

    async def override_content() -> MagicMock:
        return fake_content

    app.dependency_overrides[require_oauth2_user] = override_user
    app.dependency_overrides[get_ugs_service] = override_ugs
    app.dependency_overrides[get_content_service] = override_content
    return app


def _generate_payload(*, idempotency_key: str | None = _IDEM_KEY) -> dict:
    body: dict = {
        "lyrics": "[Verse]\nTest line for idempotency",
        "tags": "120 BPM pop, female vocal",
        "skip_lyrics_validation": True,
        "billing_mode": "professional",
    }
    if idempotency_key is not None:
        body["idempotency_key"] = idempotency_key
    return body


@pytest.mark.asyncio
async def test_duplicate_generate_calls_run_studio_ugs_once() -> None:
    """Two POSTs with the same idempotency_key must invoke run_studio_ugs_generate exactly once."""
    app = _make_music_generate_app()
    run_calls: list[dict] = []

    async def track_run_studio_ugs_generate(
        ugs: object,
        *,
        user_id: str,
        type_key: str,
        input_data: dict,
        idempotency_key: str | None = None,
        allow_idempotent_reuse: bool = False,
    ) -> dict:
        run_calls.append(
            {
                "user_id": user_id,
                "type_key": type_key,
                "idempotency_key": idempotency_key,
                "allow_idempotent_reuse": allow_idempotent_reuse,
            }
        )
        return _completed_ugs_payload()

    find_calls = 0

    async def track_find_reuse(
        ugs: object,
        *,
        user_id: str,
        type_key: str,
        idempotency_key: str,
    ) -> dict | None:
        nonlocal find_calls
        find_calls += 1
        if find_calls >= 2:
            return {
                **_completed_ugs_payload(),
                "reused": True,
                "request_id": str(uuid4()),
            }
        return None

    with (
        patch(
            "api.routers.music_generator_generate_support.run_studio_ugs_generate",
            side_effect=track_run_studio_ugs_generate,
        ),
        patch(
            "api.routers.music_generator_generate_support.find_studio_ugs_idempotent_reuse",
            side_effect=track_find_reuse,
        ),
        patch(
            "api.routers.music_generator_generate_support.get_notification_service",
            return_value=MagicMock(send_to_user=AsyncMock()),
        ),
        patch(
            "api.routers.music_generator_generate._maybe_save_music_generator_request_json",
            return_value=None,
        ),
    ):
        client = TestClient(app, raise_server_exceptions=True)
        payload = _generate_payload()
        r1 = client.post("/api/v1/music-generator/generate", json=payload)
        r2 = client.post("/api/v1/music-generator/generate", json=payload)

    assert r1.status_code == 200, r1.text
    assert r2.status_code == 200, r2.text
    assert len(run_calls) == 1, f"expected one UGS call, got {len(run_calls)}: {run_calls}"
    assert run_calls[0]["idempotency_key"] == _IDEM_KEY


@pytest.mark.asyncio
async def test_in_progress_idempotency_returns_409() -> None:
    app = _make_music_generate_app()

    async def reuse_processing(
        ugs: object,
        *,
        user_id: str,
        type_key: str,
        idempotency_key: str,
    ) -> dict | None:
        return _in_progress_reuse_payload()

    with (
        patch(
            "api.routers.music_generator_generate_support.find_studio_ugs_idempotent_reuse",
            side_effect=reuse_processing,
        ),
        patch(
            "api.routers.music_generator_generate_support.run_studio_ugs_generate",
            new=AsyncMock(),
        ) as mock_run,
        patch(
            "api.routers.music_generator_generate._maybe_save_music_generator_request_json",
            return_value=None,
        ),
    ):
        client = TestClient(app, raise_server_exceptions=True)
        response = client.post(
            "/api/v1/music-generator/generate",
            json=_generate_payload(),
        )

    assert response.status_code == 409
    body = response.json()
    assert body["detail"]["code"] == "music_generate_in_progress"
    mock_run.assert_not_awaited()


def test_music_generate_request_idempotency_key_must_be_uuid() -> None:
    from pydantic import ValidationError

    from api.schemas.music_generate_request import MusicGenerateRequest

    ok = MusicGenerateRequest.model_validate(
        {"lyrics": "x", "idempotency_key": _IDEM_KEY},
    )
    assert ok.idempotency_key == _IDEM_KEY

    with pytest.raises(ValidationError):
        MusicGenerateRequest.model_validate(
            {"lyrics": "x", "idempotency_key": "not-a-uuid"},
        )
