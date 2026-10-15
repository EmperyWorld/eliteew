# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Schema + router contract tests for POST /api/v1/content/{id}/copy.
# Invariants:
# - Empty name rejected by ContentCopyRequest.
# - Copy route returns 201 with new Content owned by caller; 403 on PermissionError.
# Related:
# - api/routers/unified_content.py
# - api/services/unified_content/content_storage_service.py
# ---

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError
from starlette import status

from api.routers import unified_content as unified_content_router
from api.routers import unified_content_crud
from api.routers.unified_content import get_content_service
from api.schemas.unified_content import (
    Content,
    ContentCopyRequest,
    ContentType,
    ProcessingStatus,
    StorageBackendType,
    Visibility,
)

_SOURCE_ID = UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
_COPY_ID = UUID("bbbbbbbb-cccc-dddd-eeee-ffffffffffff")
_USER_ID = "11111111-1111-1111-1111-111111111111"
_FILE_BYTES = b"%PDF-1.4 copy-bytes"


def test_content_copy_request_accepts_name() -> None:
    req = ContentCopyRequest(name="Copy of report.pdf")
    assert req.name == "Copy of report.pdf"


def test_content_copy_request_rejects_empty_name() -> None:
    with pytest.raises(ValidationError):
        ContentCopyRequest(name="")


def _content(**overrides: Any) -> Content:
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "id": _SOURCE_ID,
        "user_id": _USER_ID,
        "name": "report.pdf",
        "title": None,
        "content_type": ContentType.DOCUMENT,
        "mime_type": "application/pdf",
        "visibility": Visibility.PRIVATE,
        "storage_backend": StorageBackendType.POSTGRESQL,
        "file_path": "docs/report.pdf",
        "file_size": len(_FILE_BYTES),
        "file_hash": "hash-report",
        "original_filename": "report.pdf",
        "processing_status": ProcessingStatus.COMPLETED,
        "metadata": {},
        "tags": ["a"],
        "description": "src",
        "folder_item_id": "documents",
        "created_at": now,
        "updated_at": now,
        "version": 1,
        "is_owner": True,
        "can_edit": True,
        "can_delete": True,
    }
    payload.update(overrides)
    return Content(**payload)


def _mock_user() -> MagicMock:
    user = MagicMock()
    user.id = _USER_ID
    user.username = "tester"
    return user


def test_copy_content_route_returns_201() -> None:
    source = _content()
    copied = _content(
        id=_COPY_ID,
        name="Copy of report.pdf",
        visibility=Visibility.PRIVATE,
        source_service="content_copy",
    )

    backend = MagicMock()
    backend.retrieve = AsyncMock(return_value=_FILE_BYTES)
    storage_factory = MagicMock()
    storage_factory.get_backend_by_name.return_value = backend

    service = MagicMock()
    service.get_content = AsyncMock(return_value=source)
    service.copy_content = AsyncMock(return_value=copied)
    service.storage_factory = storage_factory

    app = FastAPI()
    app.include_router(unified_content_router.router, prefix="/api/v1")
    app.dependency_overrides[get_content_service] = lambda: service
    app.dependency_overrides[unified_content_router.require_oauth2_user] = lambda: _mock_user()
    app.dependency_overrides[unified_content_router.get_content_user_id] = lambda: _USER_ID

    with (
        patch.object(
            unified_content_crud,
            "is_queue_enabled",
            return_value=False,
        ),
        patch(
            "api.services.cache_service.best_effort_invalidate_after_content_mutation",
            new=AsyncMock(),
        ),
        TestClient(app) as client,
    ):
        response = client.post(
            f"/api/v1/content/{_SOURCE_ID}/copy",
            json={"name": "Copy of report.pdf"},
        )

    assert response.status_code == status.HTTP_201_CREATED
    body = response.json()
    assert body["id"] == str(_COPY_ID)
    assert body["name"] == "Copy of report.pdf"
    service.copy_content.assert_awaited()
    call_kwargs = service.copy_content.await_args.kwargs
    assert call_kwargs["new_name"] == "Copy of report.pdf"
    assert call_kwargs["user_id"] == _USER_ID
    assert call_kwargs["file_data"] == _FILE_BYTES


def test_copy_content_route_forbidden() -> None:
    backend = MagicMock()
    backend.retrieve = AsyncMock(return_value=_FILE_BYTES)
    storage_factory = MagicMock()
    storage_factory.get_backend_by_name.return_value = backend

    service = MagicMock()
    service.get_content = AsyncMock(side_effect=PermissionError("denied"))
    service.storage_factory = storage_factory

    app = FastAPI()
    app.include_router(unified_content_router.router, prefix="/api/v1")
    app.dependency_overrides[get_content_service] = lambda: service
    app.dependency_overrides[unified_content_router.require_oauth2_user] = lambda: _mock_user()
    app.dependency_overrides[unified_content_router.get_content_user_id] = lambda: _USER_ID

    with TestClient(app) as client:
        response = client.post(
            f"/api/v1/content/{_SOURCE_ID}/copy",
            json={"name": "Copy of report.pdf"},
        )

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_copy_content_service_skips_dedup_and_forces_private() -> None:
    from api.services.unified_content.content_storage_service import (
        ContentStorageService,
    )

    source = _content(user_id=_USER_ID, folder_item_id="documents")
    created = _content(id=_COPY_ID, name="My copy", folder_item_id="documents")

    service = ContentStorageService.__new__(ContentStorageService)
    service.get_content = AsyncMock(return_value=source)  # type: ignore[method-assign]
    service.create_content = AsyncMock(return_value=created)  # type: ignore[method-assign]

    out = await ContentStorageService.copy_content(
        service,
        source_content_id=_SOURCE_ID,
        user_id=_USER_ID,
        new_name="My copy",
        file_data=_FILE_BYTES,
    )
    assert out.id == _COPY_ID
    await_args = service.create_content.await_args
    assert await_args is not None
    kwargs = await_args.kwargs
    assert kwargs["skip_deduplication"] is True
    assert kwargs["content_data"].visibility == Visibility.PRIVATE
    assert kwargs["content_data"].folder_item_id == "documents"
    assert kwargs["content_data"].source_service == "content_copy"


@pytest.mark.anyio
async def test_copy_content_service_unfiles_when_not_owner() -> None:
    from api.services.unified_content.content_storage_service import (
        ContentStorageService,
    )

    other = str(uuid4())
    source = _content(user_id=other, folder_item_id="documents", is_owner=False)
    created = _content(id=_COPY_ID, name="Shared copy", folder_item_id=None)

    service = ContentStorageService.__new__(ContentStorageService)
    service.get_content = AsyncMock(return_value=source)  # type: ignore[method-assign]
    service.create_content = AsyncMock(return_value=created)  # type: ignore[method-assign]

    await ContentStorageService.copy_content(
        service,
        source_content_id=_SOURCE_ID,
        user_id=_USER_ID,
        new_name="Shared copy",
        file_data=_FILE_BYTES,
    )
    await_args = service.create_content.await_args
    assert await_args is not None
    kwargs = await_args.kwargs
    assert kwargs["content_data"].folder_item_id is None
    assert kwargs["content_data"].company_id is None
    assert kwargs["content_data"].project_id is None
