# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract and unit coverage for GET /api/v1/content/folder-view and its desktop/content composition service.
# Invariants:
# - Conflicting folder selectors return 400 before service dispatch.
# - Unfiled root exposes top-level desktop folders for explorer navigation.
# - Service loads parent + direct children only (no full-tree / strip-apps on read).
# Related:
# - api/routers/unified_content.py
# - api/services/unified_content/folder_view_service.py
# ---

from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from starlette import status

from api.models.desktop import ItemType
from api.routers import unified_content as unified_content_router
from api.schemas.unified_content import (
    Content,
    ContentListCompactResponse,
    ContentType,
    FolderViewDesktopChild,
    FolderViewResponse,
    ProcessingStatus,
    Visibility,
)
from api.services.unified_content import folder_view_service as folder_view_module
from api.services.unified_content.folder_view_service import FolderViewService

_USER_ID = "11111111-1111-1111-1111-111111111111"
_DESKTOP_USER_ID = UUID(_USER_ID)


def _mock_user() -> MagicMock:
    user = MagicMock()
    user.id = _USER_ID
    user.email = "folder-view@example.test"
    user.username = "folder-view"
    return user


def _content(**overrides: Any) -> Content:
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "id": uuid4(),
        "user_id": _USER_ID,
        "name": "Child report.pdf",
        "content_type": ContentType.DOCUMENT,
        "visibility": Visibility.PRIVATE,
        "processing_status": ProcessingStatus.COMPLETED,
        "metadata": {},
        "tags": [],
        "folder_item_id": "documents",
        "created_at": now,
        "updated_at": now,
    }
    payload.update(overrides)
    return Content(**payload)


def _desktop_row(
    *,
    item_id: str,
    name: str,
    item_type: ItemType,
    parent_id: UUID | None,
) -> SimpleNamespace:
    now = datetime.now(UTC)
    return SimpleNamespace(
        id=uuid4(),
        item_id=item_id,
        item_type=item_type,
        name=name,
        position={"x": 20, "y": 20},
        color=None,
        gradient=None,
        is_pinned=False,
        app_component=None,
        parent_id=parent_id,
        is_system=False,
        system_key=None,
        meta={},
        created_at=now,
        updated_at=now,
    )


def _test_app(service: MagicMock) -> FastAPI:
    app = FastAPI()
    app.include_router(unified_content_router.router, prefix="/api/v1")
    app.dependency_overrides[unified_content_router.get_folder_view_service] = lambda: service
    app.dependency_overrides[unified_content_router.require_oauth2_user] = _mock_user
    app.dependency_overrides[unified_content_router.get_content_user_id] = lambda: _USER_ID
    return app


def test_folder_view_route_returns_children_and_files() -> None:
    now = datetime.now(UTC)
    response_payload = FolderViewResponse(
        folder_item_id="documents",
        unfiled=False,
        desktop_children=[
            FolderViewDesktopChild(
                id=uuid4(),
                item_id="nested",
                item_type=ItemType.FOLDER,
                name="Nested",
                position={"x": 20, "y": 20},
                color=None,
                gradient=None,
                is_pinned=False,
                app_component=None,
                parent_id=uuid4(),
                parent_item_id="documents",
                created_at=now,
                updated_at=now,
            )
        ],
        files=ContentListCompactResponse(items=[], total=0, page=1, page_size=50, has_more=False),
    )
    service = MagicMock()
    service.get_folder_view = AsyncMock(return_value=response_payload)

    with TestClient(_test_app(service)) as client:
        response = client.get("/api/v1/content/folder-view", params={"folder_item_id": "documents"})

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["desktop_children"][0]["parent_item_id"] == "documents"
    assert response.json()["files"]["items"] == []
    service.get_folder_view.assert_awaited_once()


def test_folder_view_route_accepts_pdf_ui_filter_alias() -> None:
    service = MagicMock()
    service.get_folder_view = AsyncMock(
        return_value=FolderViewResponse(
            folder_item_id="documents",
            unfiled=False,
            desktop_children=[],
            files=ContentListCompactResponse(items=[], total=0, page=1, page_size=50, has_more=False),
        )
    )

    with TestClient(_test_app(service)) as client:
        response = client.get(
            "/api/v1/content/folder-view",
            params={"folder_item_id": "documents", "content_type": "pdf"},
        )

    assert response.status_code == status.HTTP_200_OK
    service.get_folder_view.assert_awaited_once()
    kwargs = service.get_folder_view.await_args.kwargs
    assert kwargs["content_type"] == ContentType.DOCUMENT
    assert kwargs["mime_type"] == "application/pdf"


def test_folder_view_route_rejects_dual_folder_flags() -> None:
    service = MagicMock()
    service.get_folder_view = AsyncMock()

    with TestClient(_test_app(service)) as client:
        response = client.get(
            "/api/v1/content/folder-view",
            params={"folder_item_id": "documents", "folder_unassigned": "true"},
        )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    service.get_folder_view.assert_not_awaited()


@pytest.mark.anyio
async def test_folder_view_service_returns_sorted_matching_children_and_compact_files() -> None:
    parent = _desktop_row(item_id="documents", name="Documents", item_type=ItemType.FOLDER, parent_id=None)
    child_z = _desktop_row(item_id="z-child", name="Child Z", item_type=ItemType.FILE, parent_id=parent.id)
    child_a = _desktop_row(item_id="a-child", name="child A", item_type=ItemType.FOLDER, parent_id=parent.id)
    query_service = MagicMock()
    query_service.list_content = AsyncMock(return_value=([_content()], 1))
    db = MagicMock()
    db.commit = AsyncMock()
    service = FolderViewService(db, query_service)
    service._load_desktop_item_by_item_id = AsyncMock(return_value=parent)  # type: ignore[method-assign]
    service._load_direct_desktop_children = AsyncMock(  # type: ignore[method-assign]
        return_value=[child_a, child_z]
    )
    config = SimpleNamespace(id=uuid4())

    with (
        patch.object(
            folder_view_module.desktop_router, "get_desktop_user_id", new=AsyncMock(return_value=_DESKTOP_USER_ID)
        ),
        patch.object(folder_view_module, "_get_or_create_desktop_config_row", new=AsyncMock(return_value=config)),
        patch.object(folder_view_module, "ensure_system_folders", new=AsyncMock()),
    ):
        result = await service.get_folder_view(
            current_user=_mock_user(),
            content_user_id=_USER_ID,
            folder_item_id="documents",
            folder_unassigned=False,
            search="child",
            sort_field="name",
            sort_order="asc",
            limit=50,
            offset=0,
            content_type=ContentType.DOCUMENT,
        )

    assert [child.item_id for child in result.desktop_children] == ["a-child", "z-child"]
    assert all(child.parent_item_id == "documents" for child in result.desktop_children)
    assert result.files.total == 1
    assert result.files.items[0].name == "Child report.pdf"
    service._load_direct_desktop_children.assert_awaited_once()
    children_await = service._load_direct_desktop_children.await_args
    assert children_await is not None
    assert children_await.kwargs["parent_pk"] == parent.id
    query_service.list_content.assert_awaited_once_with(
        user_id=_USER_ID,
        content_type=ContentType.DOCUMENT,
        mime_type=None,
        search_query="child",
        folder_item_id="documents",
        folder_unassigned=False,
        sort_field="name",
        sort_order="asc",
        offset=0,
        limit=50,
        alternate_user_id=None,
        list_profile="compact",
    )


@pytest.mark.anyio
async def test_folder_view_service_unfiled_includes_root_desktop_children() -> None:
    root_a = _desktop_row(item_id="documents", name="Documents", item_type=ItemType.FOLDER, parent_id=None)
    root_b = _desktop_row(item_id="media", name="Media", item_type=ItemType.FOLDER, parent_id=None)
    query_service = MagicMock()
    query_service.list_content = AsyncMock(return_value=([], 0))
    db = MagicMock()
    db.commit = AsyncMock()
    service = FolderViewService(db, query_service)
    service._load_desktop_item_by_item_id = AsyncMock()  # type: ignore[method-assign]
    service._load_direct_desktop_children = AsyncMock(  # type: ignore[method-assign]
        return_value=[root_a, root_b]
    )
    config = SimpleNamespace(id=uuid4())

    with (
        patch.object(
            folder_view_module.desktop_router, "get_desktop_user_id", new=AsyncMock(return_value=_DESKTOP_USER_ID)
        ),
        patch.object(folder_view_module, "_get_or_create_desktop_config_row", new=AsyncMock(return_value=config)),
        patch.object(folder_view_module, "ensure_system_folders", new=AsyncMock()),
    ):
        result = await service.get_folder_view(
            current_user=_mock_user(),
            content_user_id=_USER_ID,
            folder_item_id=None,
            folder_unassigned=True,
            search=None,
            sort_field=None,
            sort_order=None,
            limit=50,
            offset=0,
            content_type=None,
        )

    assert result.unfiled is True
    assert [child.item_id for child in result.desktop_children] == ["documents", "media"]
    service._load_desktop_item_by_item_id.assert_not_awaited()
    children_await = service._load_direct_desktop_children.await_args
    assert children_await is not None
    assert children_await.kwargs["parent_pk"] is None
    query_service.list_content.assert_awaited_once()


@pytest.mark.anyio
async def test_folder_view_service_returns_404_for_missing_folder() -> None:
    query_service = MagicMock()
    query_service.list_content = AsyncMock()
    db = MagicMock()
    db.commit = AsyncMock()
    service = FolderViewService(db, query_service)
    service._load_desktop_item_by_item_id = AsyncMock(return_value=None)  # type: ignore[method-assign]
    service._load_direct_desktop_children = AsyncMock()  # type: ignore[method-assign]
    config = SimpleNamespace(id=uuid4())

    with (
        patch.object(
            folder_view_module.desktop_router, "get_desktop_user_id", new=AsyncMock(return_value=_DESKTOP_USER_ID)
        ),
        patch.object(folder_view_module, "_get_or_create_desktop_config_row", new=AsyncMock(return_value=config)),
        patch.object(folder_view_module, "ensure_system_folders", new=AsyncMock()),
        pytest.raises(HTTPException) as exc_info,
    ):
        await service.get_folder_view(
            current_user=_mock_user(),
            content_user_id=_USER_ID,
            folder_item_id="missing",
            folder_unassigned=False,
            search=None,
            sort_field=None,
            sort_order=None,
            limit=50,
            offset=0,
            content_type=None,
        )

    assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND
    service._load_direct_desktop_children.assert_not_awaited()
    query_service.list_content.assert_not_awaited()


@pytest.mark.anyio
async def test_folder_view_service_rejects_non_folder_parent() -> None:
    app_row = _desktop_row(item_id="calendar", name="Calendar", item_type=ItemType.APP, parent_id=None)
    query_service = MagicMock()
    query_service.list_content = AsyncMock()
    db = MagicMock()
    db.commit = AsyncMock()
    service = FolderViewService(db, query_service)
    service._load_desktop_item_by_item_id = AsyncMock(return_value=app_row)  # type: ignore[method-assign]
    service._load_direct_desktop_children = AsyncMock()  # type: ignore[method-assign]
    config = SimpleNamespace(id=uuid4())

    with (
        patch.object(
            folder_view_module.desktop_router, "get_desktop_user_id", new=AsyncMock(return_value=_DESKTOP_USER_ID)
        ),
        patch.object(folder_view_module, "_get_or_create_desktop_config_row", new=AsyncMock(return_value=config)),
        patch.object(folder_view_module, "ensure_system_folders", new=AsyncMock()),
        pytest.raises(HTTPException) as exc_info,
    ):
        await service.get_folder_view(
            current_user=_mock_user(),
            content_user_id=_USER_ID,
            folder_item_id="calendar",
            folder_unassigned=False,
            search=None,
            sort_field=None,
            sort_order=None,
            limit=50,
            offset=0,
            content_type=None,
        )

    assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
    service._load_direct_desktop_children.assert_not_awaited()
    query_service.list_content.assert_not_awaited()


@pytest.mark.anyio
async def test_folder_view_service_skips_strip_apps_on_read() -> None:
    """Regression: folder-view must not call desktop strip-apps / full-tree load helpers."""
    parent = _desktop_row(item_id="documents", name="Documents", item_type=ItemType.FOLDER, parent_id=None)
    query_service = MagicMock()
    query_service.list_content = AsyncMock(return_value=([], 0))
    db = MagicMock()
    db.commit = AsyncMock()
    service = FolderViewService(db, query_service)
    service._load_desktop_item_by_item_id = AsyncMock(return_value=parent)  # type: ignore[method-assign]
    service._load_direct_desktop_children = AsyncMock(return_value=[])  # type: ignore[method-assign]
    config = SimpleNamespace(id=uuid4())

    with (
        patch.object(
            folder_view_module.desktop_router, "get_desktop_user_id", new=AsyncMock(return_value=_DESKTOP_USER_ID)
        ),
        patch.object(folder_view_module, "_get_or_create_desktop_config_row", new=AsyncMock(return_value=config)),
        patch.object(folder_view_module, "ensure_system_folders", new=AsyncMock()),
        patch.object(
            folder_view_module.desktop_router,
            "_strip_unauthorized_app_desktop_items",
            new=AsyncMock(),
        ) as strip_apps,
        patch.object(
            folder_view_module.desktop_router,
            "_enforce_user_installed_apps_policy",
            new=AsyncMock(),
        ) as enforce_apps,
    ):
        await service.get_folder_view(
            current_user=_mock_user(),
            content_user_id=_USER_ID,
            folder_item_id="documents",
            folder_unassigned=False,
            search=None,
            sort_field=None,
            sort_order=None,
            limit=50,
            offset=0,
            content_type=None,
        )

    strip_apps.assert_not_awaited()
    enforce_apps.assert_not_awaited()
    assert not hasattr(FolderViewService, "_apply_desktop_app_visibility")
    assert not hasattr(FolderViewService, "_load_desktop_rows")
