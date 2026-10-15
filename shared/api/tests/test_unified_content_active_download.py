"""Original uploads must never become application-origin active documents."""

from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.routers import unified_content_download as routes
from api.tests.test_unified_content_download_range import (
    _CONTENT_ID,
    _USER_ID,
    _audio_content,
    _make_request,
    _mock_content_service,
    _read_response_body,
)

_ACTIVE = b'<!doctype html><script>localStorage.setItem("executed", "yes")</script>'


def upload_service(mime, filename="payload.html", body=_ACTIVE):
    service = _mock_content_service(body)
    service.ensure_storage_blob_readable = AsyncMock()
    service.get_content.return_value = _audio_content(mime_type=mime, original_filename=filename)
    return service


def assert_isolated(response):
    policy = response.headers["content-security-policy"]
    assert "sandbox;" in policy
    assert "allow-scripts" not in policy and "allow-same-origin" not in policy
    assert "script-src 'none'" in policy
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["referrer-policy"] == "no-referrer"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "mime",
    [
        "text/html",
        "Text/HTML; charset=UTF-8",
        "application/xhtml+xml",
        "image/svg+xml",
        "text/xml",
        "application/xml",
        "application/javascript",
        "text/javascript",
        "text/css",
        "application/x-shockwave-flash",
        "application/octet-stream",
        "",
    ],
)
async def test_active_and_unknown_types_attach_original_bytes(mime):
    response = await routes._build_content_download_response(
        content_id=_CONTENT_ID,
        request=_make_request(),
        content_user_id=_USER_ID,
        service=upload_service(mime),
        disposition="inline",
    )
    assert response.headers["content-disposition"].startswith("attachment;")
    assert_isolated(response)
    assert await _read_response_body(response) == _ACTIVE


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "mime", ["image/png", "audio/mpeg", "video/mp4", "application/pdf", "text/plain", "text/markdown"]
)
async def test_safe_preview_types_keep_inline_but_metadata_never_removes_sandbox(mime):
    # Deliberately false metadata proves protection does not depend on classification.
    response = await routes._build_content_download_response(
        content_id=_CONTENT_ID,
        request=_make_request(),
        content_user_id=_USER_ID,
        service=upload_service(mime, "fake.png"),
        disposition="inline",
    )
    assert response.headers["content-disposition"].startswith("inline;")
    assert_isolated(response)
    assert await _read_response_body(response) == _ACTIVE


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "headers,status",
    [({}, 200), ({"range": "bytes=0-10"}, 206), ({"range": "bytes=999999-"}, 416), ({"if-none-match": "*"}, 304)],
)
async def test_every_response_branch_carries_policy(headers, status):
    response = await routes._build_content_download_response(
        content_id=_CONTENT_ID,
        request=_make_request(headers),
        content_user_id=_USER_ID,
        service=upload_service("text/html"),
        disposition="inline",
    )
    assert response.status_code == status
    assert response.headers["content-disposition"].startswith("attachment;")
    if status in {200, 206}:
        assert response.headers["content-type"] == "text/html; charset=utf-8"
    assert response.headers["etag"].startswith('"uc-safe-v1-')
    assert_isolated(response)


def test_existing_inline_ticket_is_enforced_at_redemption():
    app = FastAPI()
    app.include_router(routes.router, prefix="/api/v1")
    service = upload_service("image/svg+xml", "payload.svg")
    tickets = AsyncMock()
    tickets.consume.return_value = {
        "kind": "content",
        "user_id": _USER_ID,
        "resource_id": str(_CONTENT_ID),
        "disposition": "inline",
    }
    app.dependency_overrides[routes.get_content_service] = lambda: service
    app.dependency_overrides[routes.get_content_download_ticket_service] = lambda: tickets
    with TestClient(app) as client:
        response = client.get(f"/api/v1/content/{_CONTENT_ID}/download-by-ticket?ticket=old-inline-ticket")
    assert response.status_code == 200
    assert response.content == _ACTIVE
    assert response.headers["content-disposition"].startswith("attachment;")
    assert_isolated(response)
    service.get_content.assert_awaited_once_with(_CONTENT_ID, _USER_ID, check_permissions=True)
