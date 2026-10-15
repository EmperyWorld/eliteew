# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lock: ContentQueryService and GET /content must gate project-scoped lists with assert_project_accessible.
# Invariants:
# - project_id without access yields 404/403 before storage list_content runs.
# - project_id omitted skips project access check.
# Related:
# - api/services/unified_content/content_query_service.py
# - api/routers/unified_content.py
# - documentation/product/CONTENT-MANAGER.md
# ---

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from starlette import status

from api.routers import unified_content as unified_content_router
from api.routers.unified_content_deps import get_content_query_service, get_db_pool
from api.services.unified_content.content_query_service import ContentQueryService

_USER_ID = "11111111-1111-1111-1111-111111111111"


def _mock_user() -> MagicMock:
    user = MagicMock()
    user.id = _USER_ID
    user.email = "list-acl@example.test"
    user.username = "list-acl"
    return user


def _storage_mock() -> MagicMock:
    storage = MagicMock()
    storage.db_pool = MagicMock()
    storage.list_content = AsyncMock(return_value=([], 0))
    return storage


@pytest.mark.asyncio
async def test_list_content_skips_project_access_when_project_id_unset() -> None:
    storage = _storage_mock()
    svc = ContentQueryService(storage)

    with patch(
        "api.services.unified_content.content_query_service.assert_project_accessible",
        new=AsyncMock(),
    ) as access_mock:
        await svc.list_content(user_id=_USER_ID)

    access_mock.assert_not_awaited()
    storage.list_content.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("http_status", "detail"),
    [
        (status.HTTP_404_NOT_FOUND, "Project not found or access denied"),
        (status.HTTP_403_FORBIDDEN, "Проект удалён"),
    ],
)
async def test_list_content_denies_inaccessible_project_before_storage(
    http_status: int,
    detail: str,
) -> None:
    project_id = uuid4()
    storage = _storage_mock()
    svc = ContentQueryService(storage)

    async def deny(*_args: object, **_kwargs: object) -> None:
        raise HTTPException(status_code=http_status, detail=detail)

    with patch(
        "api.services.unified_content.content_query_service.assert_project_accessible",
        new=AsyncMock(side_effect=deny),
    ) as access_mock:
        with pytest.raises(HTTPException) as exc_info:
            await svc.list_content(user_id=_USER_ID, project_id=project_id)

    assert exc_info.value.status_code == http_status
    access_mock.assert_awaited_once_with(storage.db_pool, project_id, UUID(_USER_ID))
    storage.list_content.assert_not_awaited()


@pytest.mark.asyncio
async def test_list_content_checks_project_access_before_filter() -> None:
    project_id = uuid4()
    storage = _storage_mock()
    svc = ContentQueryService(storage)
    access_mock = AsyncMock(return_value=None)

    with patch(
        "api.services.unified_content.content_query_service.assert_project_accessible",
        new=access_mock,
    ):
        rows, total = await svc.list_content(user_id=_USER_ID, project_id=project_id)

    assert rows == []
    assert total == 0
    access_mock.assert_awaited_once_with(storage.db_pool, project_id, UUID(_USER_ID))
    storage.list_content.assert_awaited_once()


def _list_route_app(query_service: ContentQueryService) -> FastAPI:
    app = FastAPI()
    app.include_router(unified_content_router.router, prefix="/api/v1")
    app.dependency_overrides[unified_content_router.require_oauth2_user] = _mock_user
    app.dependency_overrides[unified_content_router.get_content_user_id] = lambda: _USER_ID
    app.dependency_overrides[get_content_query_service] = lambda: query_service

    async def mock_db_pool() -> MagicMock:
        return MagicMock()

    app.dependency_overrides[get_db_pool] = mock_db_pool
    return app


@pytest.mark.integration
def test_get_content_list_returns_404_when_project_inaccessible() -> None:
    project_id = uuid4()
    query_service = ContentQueryService(_storage_mock())
    access_denied = HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Project not found or access denied",
    )

    app = _list_route_app(query_service)

    with (
        patch(
            "api.routers.unified_content_query.get_db_pool",
            new=AsyncMock(return_value=MagicMock()),
        ),
        patch(
            "api.routers.unified_content_query.assert_project_accessible",
            new=AsyncMock(side_effect=access_denied),
        ),
        patch(
            "api.routers.unified_content_query.resolve_db_user_uuid_with_pool",
            new=AsyncMock(return_value=UUID(_USER_ID)),
        ),
        TestClient(app) as client,
    ):
        response = client.get("/api/v1/content", params={"project_id": str(project_id)})

    assert response.status_code == status.HTTP_404_NOT_FOUND, response.text


@pytest.mark.integration
def test_get_content_list_returns_403_when_project_deleted() -> None:
    project_id = uuid4()
    query_service = ContentQueryService(_storage_mock())
    project_deleted = HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Проект удалён",
    )

    app = _list_route_app(query_service)

    with (
        patch(
            "api.routers.unified_content_query.get_db_pool",
            new=AsyncMock(return_value=MagicMock()),
        ),
        patch(
            "api.routers.unified_content_query.assert_project_accessible",
            new=AsyncMock(side_effect=project_deleted),
        ),
        patch(
            "api.routers.unified_content_query.resolve_db_user_uuid_with_pool",
            new=AsyncMock(return_value=UUID(_USER_ID)),
        ),
        TestClient(app) as client,
    ):
        response = client.get("/api/v1/content", params={"project_id": str(project_id)})

    assert response.status_code == status.HTTP_403_FORBIDDEN, response.text
