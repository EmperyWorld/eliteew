"""Tests: user dashboard layout templates (save from project, list, delete, apply)."""

from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi import FastAPI, HTTPException, status
from fastapi.testclient import TestClient

from api.routers.marketing_cabinet.common import get_marketing_db_pool, get_marketing_user_id
from api.routers.marketing_cabinet.dashboard import router as dashboard_router
from api.routers.marketing_cabinet.dashboard_layout_templates import (
    router as dashboard_layout_templates_router,
)
from api.schemas.marketing_cabinet.dashboard import DashboardLayoutResponse


def _make_app(user_id: UUID) -> FastAPI:
    app = FastAPI()
    app.include_router(
        dashboard_layout_templates_router,
        prefix="/api/v1/marketing-cabinet",
    )
    app.include_router(dashboard_router, prefix="/api/v1/marketing-cabinet")
    fake_pool = MagicMock()

    async def override_pool() -> MagicMock:
        return fake_pool

    async def override_user() -> UUID:
        return user_id

    app.dependency_overrides[get_marketing_db_pool] = override_pool
    app.dependency_overrides[get_marketing_user_id] = override_user
    return app


def _empty_layout_response(
    *,
    layout_id: UUID,
    user_id: UUID,
    project_id: UUID | None,
) -> DashboardLayoutResponse:
    now = datetime.now(UTC)
    return DashboardLayoutResponse(
        id=layout_id,
        user_id=user_id,
        project_id=project_id,
        name="T",
        type="custom",
        description=None,
        layout_config={},
        settings={},
        is_active=project_id is not None,
        is_default=False,
        created_at=now,
        updated_at=now,
        last_accessed_at=None,
        widgets=[],
    )


@pytest.mark.integration
def test_list_dashboard_layout_templates_calls_service() -> None:
    user_id = uuid4()
    app = _make_app(user_id)
    mock_svc = MagicMock()
    mock_svc.list_layout_templates = AsyncMock(
        return_value={
            "success": True,
            "data": [],
            "total": 0,
            "page": 1,
            "per_page": 50,
        }
    )
    with patch(
        "api.routers.marketing_cabinet.dashboard_layout_templates.DashboardService",
        return_value=mock_svc,
    ):
        client = TestClient(app)
        r = client.get("/api/v1/marketing-cabinet/dashboard-layout-templates?page=2&per_page=10")
        assert r.status_code == 200
        mock_svc.list_layout_templates.assert_awaited_once_with(str(user_id), page=2, per_page=10)


@pytest.mark.integration
def test_save_template_from_project_requires_project_access() -> None:
    user_id = uuid4()
    project_id = uuid4()
    app = _make_app(user_id)
    mock_svc = MagicMock()
    mock_svc.save_active_layout_as_template = AsyncMock()

    with patch(
        "api.routers.marketing_cabinet.dashboard_layout_templates.get_accessible_project",
        new=AsyncMock(
            side_effect=HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="no",
            )
        ),
    ):
        with patch(
            "api.routers.marketing_cabinet.dashboard_layout_templates.DashboardService",
            return_value=mock_svc,
        ):
            client = TestClient(app)
            r = client.post(
                f"/api/v1/marketing-cabinet/dashboard-layout-templates/from-project/{project_id}",
                json={"name": "My template"},
            )
            assert r.status_code == 403
            mock_svc.save_active_layout_as_template.assert_not_called()


@pytest.mark.integration
def test_save_template_from_project_calls_service() -> None:
    user_id = uuid4()
    project_id = uuid4()
    layout_id = uuid4()
    app = _make_app(user_id)
    mock_svc = MagicMock()
    mock_svc.save_active_layout_as_template = AsyncMock(
        return_value=_empty_layout_response(layout_id=layout_id, user_id=user_id, project_id=None)
    )

    with patch(
        "api.routers.marketing_cabinet.dashboard_layout_templates.get_accessible_project",
        new=AsyncMock(return_value=MagicMock()),
    ):
        with patch(
            "api.routers.marketing_cabinet.dashboard_layout_templates.DashboardService",
            return_value=mock_svc,
        ):
            client = TestClient(app)
            r = client.post(
                f"/api/v1/marketing-cabinet/dashboard-layout-templates/from-project/{project_id}",
                json={"name": "Snap", "description": "d"},
            )
            assert r.status_code == 200
            mock_svc.save_active_layout_as_template.assert_awaited_once_with(
                user_id=str(user_id),
                source_project_id=project_id,
                name="Snap",
                description="d",
            )


@pytest.mark.integration
def test_delete_dashboard_layout_template_calls_service() -> None:
    user_id = uuid4()
    template_id = uuid4()
    app = _make_app(user_id)
    mock_svc = MagicMock()
    mock_svc.delete_layout_template = AsyncMock(return_value=None)

    with patch(
        "api.routers.marketing_cabinet.dashboard_layout_templates.DashboardService",
        return_value=mock_svc,
    ):
        client = TestClient(app)
        r = client.delete(
            f"/api/v1/marketing-cabinet/dashboard-layout-templates/{template_id}",
        )
        assert r.status_code == 204
        mock_svc.delete_layout_template.assert_awaited_once_with(template_id, str(user_id))


@pytest.mark.integration
def test_apply_template_to_project_calls_service() -> None:
    user_id = uuid4()
    project_id = uuid4()
    template_id = uuid4()
    new_layout_id = uuid4()
    app = _make_app(user_id)
    mock_svc = MagicMock()
    mock_svc.apply_layout_template_to_project = AsyncMock(
        return_value=_empty_layout_response(layout_id=new_layout_id, user_id=user_id, project_id=project_id)
    )

    with patch(
        "api.routers.marketing_cabinet.dashboard.get_accessible_project",
        new=AsyncMock(return_value=MagicMock()),
    ):
        with patch(
            "api.routers.marketing_cabinet.dashboard.DashboardService",
            return_value=mock_svc,
        ):
            client = TestClient(app)
            r = client.post(
                f"/api/v1/marketing-cabinet/projects/{project_id}/dashboard-layouts/from-template",
                json={"template_layout_id": str(template_id)},
            )
            assert r.status_code == 200
            mock_svc.apply_layout_template_to_project.assert_awaited_once_with(
                template_layout_id=template_id,
                user_id=str(user_id),
                target_project_id=project_id,
            )


@pytest.mark.integration
def test_apply_template_forbidden_without_project_access() -> None:
    user_id = uuid4()
    project_id = uuid4()
    template_id = uuid4()
    app = _make_app(user_id)
    mock_svc = MagicMock()
    mock_svc.apply_layout_template_to_project = AsyncMock()

    with patch(
        "api.routers.marketing_cabinet.dashboard.get_accessible_project",
        new=AsyncMock(
            side_effect=HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Проект не найден или доступ запрещён",
            )
        ),
    ):
        with patch(
            "api.routers.marketing_cabinet.dashboard.DashboardService",
            return_value=mock_svc,
        ):
            client = TestClient(app)
            r = client.post(
                f"/api/v1/marketing-cabinet/projects/{project_id}/dashboard-layouts/from-template",
                json={"template_layout_id": str(template_id)},
            )
            assert r.status_code == 404
            mock_svc.apply_layout_template_to_project.assert_not_called()
