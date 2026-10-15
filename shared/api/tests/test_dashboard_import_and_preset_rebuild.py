"""Tests: dashboard layout import envelope and preset rebuild flag (API layer)."""

from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.routers.marketing_cabinet.common import get_marketing_db_pool, get_marketing_user_id
from api.routers.marketing_cabinet.dashboard import router as dashboard_router
from api.schemas.marketing_cabinet.dashboard import DashboardLayoutResponse


def _make_app(user_id: UUID) -> FastAPI:
    app = FastAPI()
    app.include_router(dashboard_router, prefix="/api/v1/marketing-cabinet")
    fake_pool = MagicMock()

    async def override_pool() -> MagicMock:
        return fake_pool

    async def override_user() -> UUID:
        return user_id

    app.dependency_overrides[get_marketing_db_pool] = override_pool
    app.dependency_overrides[get_marketing_user_id] = override_user
    return app


def _empty_layout_response(*, layout_id: UUID, user_id: UUID, project_id: UUID) -> DashboardLayoutResponse:
    now = datetime.now(UTC)
    return DashboardLayoutResponse(
        id=layout_id,
        user_id=user_id,
        project_id=project_id,
        name="Imported x",
        type="custom",
        description=None,
        layout_config={},
        settings={},
        is_active=True,
        is_default=False,
        created_at=now,
        updated_at=now,
        last_accessed_at=None,
        widgets=[],
    )


@pytest.mark.integration
def test_import_dashboard_layout_rejects_wrong_schema_version() -> None:
    user_id = uuid4()
    project_id = uuid4()
    app = _make_app(user_id)
    with patch(
        "api.routers.marketing_cabinet.dashboard.get_accessible_project",
        new=AsyncMock(return_value=MagicMock()),
    ):
        client = TestClient(app)
        r = client.post(
            f"/api/v1/marketing-cabinet/projects/{project_id}/dashboard-layouts/import",
            json={"_exportSchemaVersion": 999, "layout": {"widgets": [{"widget_key": "tasks"}]}},
        )
        assert r.status_code == 400
        assert "schema version" in r.json()["detail"].lower()


@pytest.mark.integration
def test_import_dashboard_layout_calls_service_with_layout_payload() -> None:
    user_id = uuid4()
    project_id = uuid4()
    layout_id = uuid4()
    app = _make_app(user_id)
    mock_svc = MagicMock()
    mock_svc.import_layout_from_export = AsyncMock(
        return_value=_empty_layout_response(layout_id=layout_id, user_id=user_id, project_id=project_id)
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
            body = {
                "_exportSchemaVersion": 1,
                "layout": {
                    "name": "Q1",
                    "widgets": [
                        {
                            "widget_key": "tasks",
                            "widget_title": "T",
                            "widget_config": {},
                            "grid_position": {"x": 0, "y": 0, "w": 4, "h": 4},
                        }
                    ],
                },
            }
            r = client.post(
                f"/api/v1/marketing-cabinet/projects/{project_id}/dashboard-layouts/import",
                json=body,
            )
            assert r.status_code == 200
            mock_svc.import_layout_from_export.assert_awaited_once()
            call_kw = mock_svc.import_layout_from_export.await_args.kwargs
            assert call_kw["user_id"] == str(user_id)
            assert call_kw["project_id"] == project_id
            assert call_kw["layout_payload"]["name"] == "Q1"


@pytest.mark.integration
def test_from_preset_passes_rebuild_existing_to_service() -> None:
    user_id = uuid4()
    project_id = uuid4()
    app = _make_app(user_id)
    mock_svc = MagicMock()
    mock_svc.create_layout_from_preset = AsyncMock(
        return_value=_empty_layout_response(layout_id=uuid4(), user_id=user_id, project_id=project_id)
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
                f"/api/v1/marketing-cabinet/projects/{project_id}/dashboard-layouts/from-preset",
                json={"preset_name": "minimal", "rebuild_existing": True},
            )
            assert r.status_code == 200
            mock_svc.create_layout_from_preset.assert_awaited_once()
            call_kw = mock_svc.create_layout_from_preset.await_args.kwargs
            assert call_kw["rebuild_existing"] is True
