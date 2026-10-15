# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for Unified Content byte downloads with HTTP Range and ticket URLs used by Music Player streaming.
# Invariants:
# - _build_content_download_response advertises Accept-Ranges and honors 206/416 semantics.
# - download-by-ticket reuses the same byte builder and passes inline disposition from ticket payload.
# Related:
# - api/routers/unified_content.py
# - api/services/unified_content/content_download_ticket_service.py
# - documentation/product/desktop/DESKTOP-MUSIC-PLAYER.md
# ---

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID

import pytest
from fastapi import FastAPI  # type: ignore[import-untyped]
from fastapi.testclient import TestClient  # type: ignore[import-untyped]
from starlette import status
from starlette.requests import Request

from api.routers import unified_content as unified_content_router
from api.routers.unified_content import (
    _build_content_download_response,
    get_content_download_ticket_service,
    get_content_service,
)
from api.schemas.unified_content import (
    Content,
    ContentType,
    ProcessingStatus,
    StorageBackendType,
    Visibility,
)

_CONTENT_ID = UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
_USER_ID = "11111111-1111-1111-1111-111111111111"
_AUDIO_BYTES = b"ID3" + b"\x00" * 997


def _make_request(headers: dict[str, str] | None = None) -> Request:
    raw_headers: list[tuple[bytes, bytes]] = []
    for key, value in (headers or {}).items():
        raw_headers.append((key.lower().encode("latin-1"), value.encode("latin-1")))
    return Request({"type": "http", "headers": raw_headers})


def _audio_content(**overrides: Any) -> Content:
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "id": _CONTENT_ID,
        "user_id": _USER_ID,
        "name": "track.mp3",
        "title": "Track",
        "content_type": ContentType.AUDIO,
        "mime_type": "audio/mpeg",
        "visibility": Visibility.PRIVATE,
        "storage_backend": StorageBackendType.POSTGRESQL,
        "file_path": "audio/track.mp3",
        "file_size": len(_AUDIO_BYTES),
        "file_hash": "hash-track",
        "original_filename": "track.mp3",
        "processing_status": ProcessingStatus.COMPLETED,
        "metadata": {},
        "created_at": now,
        "updated_at": now,
        "version": 1,
        "is_owner": True,
        "can_edit": True,
    }
    payload.update(overrides)
    return Content(**payload)


def _mock_content_service(file_bytes: bytes) -> MagicMock:
    backend = MagicMock()
    backend.retrieve = AsyncMock(return_value=file_bytes)
    storage_factory = MagicMock()
    storage_factory.get_backend_by_name.return_value = backend
    service = MagicMock()
    service.get_content = AsyncMock(return_value=_audio_content())
    service.ensure_storage_blob_readable = AsyncMock()
    service.storage_factory = storage_factory
    service.audit_logger = MagicMock()
    service.audit_logger.log = AsyncMock()
    return service


async def _read_response_body(response: Any) -> bytes:
    if hasattr(response, "body") and response.body is not None:
        return bytes(response.body)
    chunks: list[bytes] = []
    async for chunk in response.body_iterator:
        chunks.append(chunk)
    return b"".join(chunks)


@pytest.mark.anyio
async def test_build_content_download_response_sets_accept_ranges_on_full_body() -> None:
    response = await _build_content_download_response(
        content_id=_CONTENT_ID,
        request=_make_request(),
        content_user_id=_USER_ID,
        service=_mock_content_service(_AUDIO_BYTES),
        disposition="inline",
    )

    body = await _read_response_body(response)
    assert response.status_code == status.HTTP_200_OK
    assert body == _AUDIO_BYTES
    assert response.headers["accept-ranges"] == "bytes"
    assert response.headers["content-disposition"].startswith("inline;")


@pytest.mark.anyio
async def test_build_content_download_response_honors_range_slice() -> None:
    response = await _build_content_download_response(
        content_id=_CONTENT_ID,
        request=_make_request({"Range": "bytes=0-15"}),
        content_user_id=_USER_ID,
        service=_mock_content_service(_AUDIO_BYTES),
        disposition="inline",
    )

    body = await _read_response_body(response)
    assert response.status_code == status.HTTP_206_PARTIAL_CONTENT
    assert body == _AUDIO_BYTES[:16]
    assert response.headers["content-range"].startswith("bytes 0-15/")


@pytest.mark.anyio
async def test_build_content_download_response_honors_suffix_range() -> None:
    response = await _build_content_download_response(
        content_id=_CONTENT_ID,
        request=_make_request({"Range": "bytes=-16"}),
        content_user_id=_USER_ID,
        service=_mock_content_service(_AUDIO_BYTES),
        disposition="inline",
    )

    body = await _read_response_body(response)
    assert response.status_code == status.HTTP_206_PARTIAL_CONTENT
    assert body == _AUDIO_BYTES[-16:]
    assert response.headers["content-range"].startswith(f"bytes {len(_AUDIO_BYTES) - 16}-{len(_AUDIO_BYTES) - 1}/")


@pytest.mark.anyio
async def test_build_content_download_response_returns_416_for_out_of_bounds_range() -> None:
    response = await _build_content_download_response(
        content_id=_CONTENT_ID,
        request=_make_request({"Range": "bytes=5000-"}),
        content_user_id=_USER_ID,
        service=_mock_content_service(_AUDIO_BYTES),
        disposition="inline",
    )

    assert response.status_code == status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE
    assert response.headers["content-range"] == f"bytes */{len(_AUDIO_BYTES)}"


def _ticket_download_test_client(
    monkeypatch: pytest.MonkeyPatch,
    *,
    ticket_payload: dict[str, Any] | None,
) -> TestClient:
    service = _mock_content_service(_AUDIO_BYTES)
    ticket_service = MagicMock()

    async def _consume(
        ticket: str,
        *,
        expected_kind: str,
        request: Request | None = None,
    ) -> dict[str, Any] | None:
        if ticket != "ticket-inline" or expected_kind != "content":
            return None
        return ticket_payload

    ticket_service.consume = AsyncMock(side_effect=_consume)

    app = FastAPI()
    app.include_router(unified_content_router.router, prefix="/api/v1")
    app.dependency_overrides[get_content_service] = lambda: service
    app.dependency_overrides[get_content_download_ticket_service] = lambda: ticket_service
    return TestClient(app)


def test_download_content_by_ticket_streams_with_range(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = _ticket_download_test_client(
        monkeypatch,
        ticket_payload={
            "kind": "content",
            "user_id": _USER_ID,
            "resource_id": str(_CONTENT_ID),
            "disposition": "inline",
            "revision": "rev-1",
        },
    )

    response = client.get(
        f"/api/v1/content/{_CONTENT_ID}/download-by-ticket?ticket=ticket-inline",
        headers={"Range": "bytes=0-15"},
    )

    assert response.status_code == 206
    assert response.content == _AUDIO_BYTES[:16]
    assert response.headers.get("accept-ranges") == "bytes"
    assert response.headers.get("content-disposition", "").startswith("inline;")


def test_download_content_by_ticket_invalid_returns_401(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = _ticket_download_test_client(monkeypatch, ticket_payload=None)

    response = client.get(
        f"/api/v1/content/{_CONTENT_ID}/download-by-ticket?ticket=expired-ticket",
    )

    assert response.status_code == 401
