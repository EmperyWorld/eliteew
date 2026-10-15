# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Contract tests for Marketing Cabinet dashboard routes, access checks, and additive performance analytics.
# Invariants:
# - Tests use FastAPI dependency overrides and mocks; no live Postgres is required.
# - Project/layout isolation and private cache scoping must stay explicit.
# Related:
# - api/routers/marketing_cabinet/projects.py
# - api/routers/marketing_cabinet/dashboard.py
# ---
"""
Contract tests: marketing cabinet interactive dashboard HTTP API (layouts, access control).

Uses FastAPI TestClient with dependency overrides and targeted mocks for DashboardService /
get_accessible_project. Full RLS against Postgres is out of scope here; we assert API-layer
isolation (layout project_id must match path project_id) and access denied statuses.
"""

from __future__ import annotations

from datetime import UTC, date, datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi import FastAPI, HTTPException, status
from fastapi.testclient import TestClient

from api.routers.marketing_cabinet.common import get_marketing_db_pool, get_marketing_user_id
from api.routers.marketing_cabinet.dashboard import router as dashboard_router
from api.routers.marketing_cabinet.projects import router as mc_projects_router
from api.schemas.marketing_cabinet.dashboard import (
    DashboardLayoutResponse,
    GridPosition,
    WidgetResponse,
)
from api.schemas.marketing_cabinet.performance import (
    MarketingPerformanceDashboardResponse,
    MarketingPerformanceFiltersOut,
    MarketingPerformanceTotalsOut,
)
from api.services.marketing_cabinet.project_dashboard_service import dashboard_service_cache_key_for_tests


def _make_test_app(user_id: UUID) -> FastAPI:
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


def _layout_response(
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
        name="test-layout",
        type="custom",
        description=None,
        layout_config={},
        settings={},
        is_active=False,
        is_default=False,
        created_at=now,
        updated_at=now,
        last_accessed_at=None,
        widgets=[],
    )


@pytest.mark.integration
def test_list_dashboard_layouts_returns_200_when_project_accessible() -> None:
    user_id = uuid4()
    project_id = uuid4()
    app = _make_test_app(user_id)
    mock_svc = MagicMock()
    mock_svc.list_layouts = AsyncMock(
        return_value={
            "success": True,
            "data": [],
            "total": 0,
            "page": 1,
            "per_page": 20,
        }
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
            r = client.get(f"/api/v1/marketing-cabinet/projects/{project_id}/dashboard-layouts")
            assert r.status_code == 200
            body = r.json()
            assert body["success"] is True
            assert body["total"] == 0
            mock_svc.list_layouts.assert_awaited_once()


@pytest.mark.integration
def test_list_dashboard_layouts_uses_read_access_not_mutation() -> None:
    """N.140 snapshot: list layouts must not request marketing write access."""
    user_id = uuid4()
    project_id = uuid4()
    app = _make_test_app(user_id)
    mock_svc = MagicMock()
    mock_svc.list_layouts = AsyncMock(
        return_value={
            "success": True,
            "data": [],
            "total": 0,
            "page": 1,
            "per_page": 20,
        }
    )
    access_mock = AsyncMock(return_value=MagicMock())

    with patch(
        "api.routers.marketing_cabinet.dashboard.get_accessible_project",
        new=access_mock,
    ):
        with patch(
            "api.routers.marketing_cabinet.dashboard.DashboardService",
            return_value=mock_svc,
        ):
            client = TestClient(app)
            r = client.get(f"/api/v1/marketing-cabinet/projects/{project_id}/dashboard-layouts")
    assert r.status_code == 200
    access_mock.assert_awaited()
    assert access_mock.await_args is not None
    assert access_mock.await_args.kwargs.get("for_mutation") is False


@pytest.mark.integration
def test_list_dashboard_layouts_returns_404_when_project_inaccessible() -> None:
    user_id = uuid4()
    project_id = uuid4()
    app = _make_test_app(user_id)

    async def deny(*_a: object, **_k: object) -> None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Проект не найден или доступ запрещён",
        )

    with patch(
        "api.routers.marketing_cabinet.dashboard.get_accessible_project",
        new=deny,
    ):
        client = TestClient(app)
        r = client.get(f"/api/v1/marketing-cabinet/projects/{project_id}/dashboard-layouts")
        assert r.status_code == 404


@pytest.mark.integration
def test_create_dashboard_layout_returns_403_when_mutation_forbidden() -> None:
    user_id = uuid4()
    project_id = uuid4()
    app = _make_test_app(user_id)

    async def forbidden(*_a: object, **_k: object) -> None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Изменение доступно только владельцу компании, руководителю проекта или участникам команды агента",
        )

    with patch(
        "api.routers.marketing_cabinet.dashboard.get_accessible_project",
        new=forbidden,
    ):
        client = TestClient(app)
        r = client.post(
            f"/api/v1/marketing-cabinet/projects/{project_id}/dashboard-layouts",
            json={
                "name": "n",
                "type": "custom",
                "layout_config": {},
                "settings": {},
                "is_active": False,
            },
        )
        assert r.status_code == 403


@pytest.mark.integration
def test_get_dashboard_layout_returns_404_when_layout_belongs_to_other_project() -> None:
    """API-layer isolation: layout row must match project_id in the URL (defense in depth with RLS)."""
    user_id = uuid4()
    project_in_path = uuid4()
    other_project = uuid4()
    layout_id = uuid4()
    app = _make_test_app(user_id)

    layout = _layout_response(
        layout_id=layout_id,
        user_id=user_id,
        project_id=other_project,
    )
    mock_svc = MagicMock()
    mock_svc.get_layout = AsyncMock(return_value=layout)

    with patch(
        "api.routers.marketing_cabinet.dashboard.get_accessible_project",
        new=AsyncMock(return_value=MagicMock()),
    ):
        with patch(
            "api.routers.marketing_cabinet.dashboard.DashboardService",
            return_value=mock_svc,
        ):
            client = TestClient(app)
            r = client.get(
                f"/api/v1/marketing-cabinet/projects/{project_in_path}/dashboard-layouts/{layout_id}",
            )
            assert r.status_code == 404
            assert "не найден" in r.json().get("detail", "")


@pytest.mark.integration
def test_get_dashboard_layout_returns_404_when_service_returns_none() -> None:
    user_id = uuid4()
    project_id = uuid4()
    layout_id = uuid4()
    app = _make_test_app(user_id)
    mock_svc = MagicMock()
    mock_svc.get_layout = AsyncMock(return_value=None)

    with patch(
        "api.routers.marketing_cabinet.dashboard.get_accessible_project",
        new=AsyncMock(return_value=MagicMock()),
    ):
        with patch(
            "api.routers.marketing_cabinet.dashboard.DashboardService",
            return_value=mock_svc,
        ):
            client = TestClient(app)
            r = client.get(
                f"/api/v1/marketing-cabinet/projects/{project_id}/dashboard-layouts/{layout_id}",
            )
            assert r.status_code == 404


def _minimal_project_dashboard_payload(*, project_id: UUID) -> dict[str, object]:
    """Sparse body matching MarketingProjectDashboardResponse for mocked GET dashboard."""
    cid = str(uuid4())
    pid = str(project_id)
    summary: dict[str, object] = {
        "id": pid,
        "company_id": cid,
        "name": "Contract test project",
        "slug": "contract-test",
        "tags": [],
        "enabled_modules": [],
    }
    counts: dict[str, int] = {
        "jtbd": 0,
        "value_propositions": 0,
        "swot": 0,
        "competitors": 0,
        "researches": 0,
        "content": 0,
        "segments": 0,
        "campaigns": 0,
        "funnels": 0,
        "tasks": 0,
        "alerts": 0,
        "ai_runs": 0,
        "open_alerts": 0,
        "critical_alerts": 0,
    }
    return {
        "project": summary,
        "counts": counts,
        "readiness_score": 0,
        "readiness_breakdown": {
            "strategy_base": 0,
            "operations": 0,
            "coverage": 0,
            "freshness": 0,
            "strategy_integrity": 0,
        },
        "last_activity_at": None,
        "coverage": [],
        "strategy_integrity_score": 0,
        "strategy_integrity": [],
        "strategy_integrity_issues": [],
        "issue_remediation": [],
        "freshness": [],
        "gaps": [],
        "highlights": [],
        "recommended_actions": [],
        "activity_feed": [],
        "company_rollup_excerpt": None,
        "latest_swot": None,
        "recent_content": [],
        "recent_researches": [],
        "segments": [],
        "campaigns": [],
        "funnels": [],
        "tasks": [],
        "alerts": [],
        "ai_runs": [],
        "job_stories": [],
        "value_propositions": [],
        "competitors": [],
        "researches": [],
        "content": [],
        "swot": None,
    }


def _make_mc_projects_test_app(user_id: UUID) -> FastAPI:
    app = FastAPI()
    app.include_router(mc_projects_router, prefix="/api/v1/marketing-cabinet")
    fake_pool = MagicMock()

    async def override_pool() -> MagicMock:
        return fake_pool

    async def override_user() -> UUID:
        return user_id

    app.dependency_overrides[get_marketing_db_pool] = override_pool
    app.dependency_overrides[get_marketing_user_id] = override_user
    return app


@pytest.mark.integration
def test_get_project_dashboard_include_series_forwards_flags() -> None:
    user_id = uuid4()
    project_id = uuid4()
    app = _make_mc_projects_test_app(user_id)
    captured: dict[str, object] = {}

    async def fake_build(
        *_a: object,
        **kwargs: object,
    ) -> dict[str, object]:
        captured.update(kwargs)
        return _minimal_project_dashboard_payload(project_id=project_id)

    with patch(
        "api.routers.marketing_cabinet.projects.build_project_dashboard",
        new=AsyncMock(side_effect=fake_build),
    ):
        client = TestClient(app)
        r = client.get(
            f"/api/v1/marketing-cabinet/projects/{project_id}/dashboard",
            params={"include": "series", "window_days": 14},
        )
    assert r.status_code == 200
    assert captured.get("include_series") is True
    assert captured.get("series_window_days") == 14


@pytest.mark.integration
def test_get_project_dashboard_omitted_include_disables_series() -> None:
    user_id = uuid4()
    project_id = uuid4()
    app = _make_mc_projects_test_app(user_id)
    captured: dict[str, object] = {}

    async def fake_build(
        *_a: object,
        **kwargs: object,
    ) -> dict[str, object]:
        captured.update(kwargs)
        return _minimal_project_dashboard_payload(project_id=project_id)

    with patch(
        "api.routers.marketing_cabinet.projects.build_project_dashboard",
        new=AsyncMock(side_effect=fake_build),
    ):
        client = TestClient(app)
        r = client.get(f"/api/v1/marketing-cabinet/projects/{project_id}/dashboard")
    assert r.status_code == 200
    assert captured.get("include_series") is False


@pytest.mark.integration
def test_get_project_dashboard_forwards_layout_id() -> None:
    user_id = uuid4()
    project_id = uuid4()
    layout_id = uuid4()
    app = _make_mc_projects_test_app(user_id)
    captured: dict[str, object] = {}

    async def fake_build(
        *_a: object,
        **kwargs: object,
    ) -> dict[str, object]:
        captured.update(kwargs)
        return _minimal_project_dashboard_payload(project_id=project_id)

    with patch(
        "api.routers.marketing_cabinet.projects.build_project_dashboard",
        new=AsyncMock(side_effect=fake_build),
    ):
        client = TestClient(app)
        r = client.get(
            f"/api/v1/marketing-cabinet/projects/{project_id}/dashboard",
            params={"layout_id": str(layout_id)},
        )
    assert r.status_code == 200
    assert captured.get("layout_id") == layout_id


@pytest.mark.integration
def test_get_project_dashboard_forwards_compact_lists() -> None:
    user_id = uuid4()
    project_id = uuid4()
    app = _make_mc_projects_test_app(user_id)
    captured: dict[str, object] = {}

    async def fake_build(
        *_a: object,
        **kwargs: object,
    ) -> dict[str, object]:
        captured.update(kwargs)
        return _minimal_project_dashboard_payload(project_id=project_id)

    with patch(
        "api.routers.marketing_cabinet.projects.build_project_dashboard",
        new=AsyncMock(side_effect=fake_build),
    ):
        client = TestClient(app)
        r = client.get(
            f"/api/v1/marketing-cabinet/projects/{project_id}/dashboard",
            params={"compact_lists": "true"},
        )
    assert r.status_code == 200
    assert captured.get("compact_lists") is True


def test_project_dashboard_cache_key_is_user_scoped() -> None:
    """Private dashboard/report cache keys must never collide across users."""
    project_id = uuid4()
    parts = (("date_from", "2026-05-01"), ("date_to", "2026-05-28"))
    key_a = dashboard_service_cache_key_for_tests(
        user_id=uuid4(),
        project_id=project_id,
        namespace="performance-dashboard",
        parts=parts,
    )
    key_b = dashboard_service_cache_key_for_tests(
        user_id=uuid4(),
        project_id=project_id,
        namespace="performance-dashboard",
        parts=parts,
    )
    assert key_a != key_b
    assert f"project={project_id}" in key_a


@pytest.mark.integration
def test_get_project_performance_dashboard_forwards_filters() -> None:
    user_id = uuid4()
    project_id = uuid4()
    campaign_id = uuid4()
    app = _make_mc_projects_test_app(user_id)
    response = MarketingPerformanceDashboardResponse(
        project_id=str(project_id),
        generated_at=datetime.now(UTC),
        filters=MarketingPerformanceFiltersOut(
            date_from=date(2026, 5, 1),
            date_to=date(2026, 5, 28),
            campaign_ids=[str(campaign_id)],
            sources=["paid"],
            geos=["EU"],
        ),
        totals=MarketingPerformanceTotalsOut(spend=100, revenue=250, leads=10, conversions=2),
    )
    mock_svc = MagicMock()
    mock_svc.build_performance_dashboard = AsyncMock(return_value=response)

    with patch(
        "api.routers.marketing_cabinet.projects.ProjectPerformanceService",
        return_value=mock_svc,
    ):
        client = TestClient(app)
        r = client.get(
            f"/api/v1/marketing-cabinet/projects/{project_id}/performance-dashboard",
            params={
                "date_from": "2026-05-01",
                "date_to": "2026-05-28",
                "campaign_ids": str(campaign_id),
                "sources": "paid",
                "geos": "EU",
            },
        )
    assert r.status_code == 200
    body = r.json()
    assert body["totals"]["spend"] == 100
    call = mock_svc.build_performance_dashboard.await_args
    assert call is not None
    assert call.kwargs["project_id"] == project_id
    assert call.kwargs["user_id"] == user_id
    assert call.kwargs["campaign_ids"] == [campaign_id]
    assert call.kwargs["sources"] == ["paid"]
    assert call.kwargs["geos"] == ["EU"]


@pytest.mark.integration
def test_get_project_performance_dashboard_rejects_inverted_dates() -> None:
    user_id = uuid4()
    project_id = uuid4()
    app = _make_mc_projects_test_app(user_id)
    client = TestClient(app)
    r = client.get(
        f"/api/v1/marketing-cabinet/projects/{project_id}/performance-dashboard",
        params={"date_from": "2026-05-28", "date_to": "2026-05-01"},
    )
    assert r.status_code == 422


@pytest.mark.integration
def test_update_dashboard_widget_accepts_widget_config_only() -> None:
    user_id = uuid4()
    project_id = uuid4()
    widget_id = uuid4()
    layout_id = uuid4()
    app = _make_test_app(user_id)
    now = datetime.now(UTC)
    updated = WidgetResponse(
        id=widget_id,
        layout_id=layout_id,
        widget_key="tasks",
        widget_title="Tasks",
        widget_config={"maxItems": 12, "density": "compact"},
        grid_position=GridPosition(x=0, y=0, w=2, h=3),
        is_visible=True,
        is_locked=False,
        display_order=0,
        created_at=now,
        updated_at=now,
    )
    mock_svc = MagicMock()
    mock_svc.update_widget = AsyncMock(return_value=updated)
    mock_svc.get_layout = AsyncMock(
        return_value=_layout_response(
            layout_id=layout_id,
            user_id=user_id,
            project_id=project_id,
        ),
    )

    with patch(
        "api.routers.marketing_cabinet.dashboard.get_accessible_project",
        new=AsyncMock(return_value=MagicMock()),
    ):
        with patch(
            "api.routers.marketing_cabinet.dashboard.check_marketing_dashboard_write_rate_limit",
            new=AsyncMock(return_value=(True, None)),
        ):
            with patch(
                "api.routers.marketing_cabinet.dashboard.DashboardService",
                return_value=mock_svc,
            ):
                client = TestClient(app)
                r = client.patch(
                    f"/api/v1/marketing-cabinet/projects/{project_id}/dashboard-widgets/{widget_id}",
                    json={"widget_config": {"maxItems": 12, "density": "compact"}},
                )
    assert r.status_code == 200
    body = r.json()
    assert body["widget_config"]["maxItems"] == 12
    mock_svc.update_widget.assert_awaited_once()
    call = mock_svc.update_widget.await_args
    assert call is not None
    body_arg = call.args[1]
    assert body_arg.widget_config is not None
    assert body_arg.widget_config["maxItems"] == 12


@pytest.mark.integration
def test_update_dashboard_layout_accepts_partial_fields() -> None:
    """PATCH layout: only supplied fields are updated (contract for partial updates)."""
    user_id = uuid4()
    project_id = uuid4()
    layout_id = uuid4()
    app = _make_test_app(user_id)
    now = datetime.now(UTC)
    updated = DashboardLayoutResponse(
        id=layout_id,
        user_id=user_id,
        project_id=project_id,
        name="patched-name-only",
        type="custom",
        description="unchanged-desc",
        layout_config={"cols": 12},
        settings={"k": 1},
        is_active=True,
        is_default=False,
        created_at=now,
        updated_at=now,
        last_accessed_at=None,
        widgets=[],
    )
    mock_svc = MagicMock()
    mock_svc.update_layout = AsyncMock(return_value=updated)
    mock_svc.get_layout = AsyncMock(
        return_value=_layout_response(
            layout_id=layout_id,
            user_id=user_id,
            project_id=project_id,
        ),
    )

    with patch(
        "api.routers.marketing_cabinet.dashboard.get_accessible_project",
        new=AsyncMock(return_value=MagicMock()),
    ):
        with patch(
            "api.routers.marketing_cabinet.dashboard.check_marketing_dashboard_write_rate_limit",
            new=AsyncMock(return_value=(True, None)),
        ):
            with patch(
                "api.routers.marketing_cabinet.dashboard.DashboardService",
                return_value=mock_svc,
            ):
                client = TestClient(app)
                r_name = client.patch(
                    f"/api/v1/marketing-cabinet/projects/{project_id}/dashboard-layouts/{layout_id}",
                    json={"name": "patched-name-only"},
                )
                assert r_name.status_code == 200
                body = r_name.json()
                assert body["name"] == "patched-name-only"

                r_cfg = client.patch(
                    f"/api/v1/marketing-cabinet/projects/{project_id}/dashboard-layouts/{layout_id}",
                    json={"layout_config": {"cols": 12}},
                )
                assert r_cfg.status_code == 200
                assert r_cfg.json()["layout_config"] == {"cols": 12}

    assert mock_svc.update_layout.await_count == 2


@pytest.mark.integration
def test_update_dashboard_layout_forwards_layout_config_merge_flag() -> None:
    """M.127: client may PATCH layout_config together with layout_config_merge (I.93)."""
    user_id = uuid4()
    project_id = uuid4()
    layout_id = uuid4()
    app = _make_test_app(user_id)
    now = datetime.now(UTC)
    updated = DashboardLayoutResponse(
        id=layout_id,
        user_id=user_id,
        project_id=project_id,
        name="merged-cfg",
        type="custom",
        description=None,
        layout_config={"cols": 12, "compactMode": True},
        settings={},
        is_active=False,
        is_default=False,
        created_at=now,
        updated_at=now,
        last_accessed_at=None,
        widgets=[],
    )
    mock_svc = MagicMock()
    mock_svc.update_layout = AsyncMock(return_value=updated)
    mock_svc.get_layout = AsyncMock(
        return_value=_layout_response(
            layout_id=layout_id,
            user_id=user_id,
            project_id=project_id,
        ),
    )

    with patch(
        "api.routers.marketing_cabinet.dashboard.get_accessible_project",
        new=AsyncMock(return_value=MagicMock()),
    ):
        with patch(
            "api.routers.marketing_cabinet.dashboard.check_marketing_dashboard_write_rate_limit",
            new=AsyncMock(return_value=(True, None)),
        ):
            with patch(
                "api.routers.marketing_cabinet.dashboard.DashboardService",
                return_value=mock_svc,
            ):
                client = TestClient(app)
                r = client.patch(
                    f"/api/v1/marketing-cabinet/projects/{project_id}/dashboard-layouts/{layout_id}",
                    json={
                        "layout_config": {"compactMode": True},
                        "layout_config_merge": True,
                    },
                )
    assert r.status_code == 200
    mock_svc.update_layout.assert_awaited_once()
    call = mock_svc.update_layout.await_args
    assert call is not None
    body_arg = call.args[1]
    assert body_arg.layout_config == {"compactMode": True}
    assert body_arg.layout_config_merge is True


@pytest.mark.integration
def test_update_dashboard_widget_accepts_mixed_fields() -> None:
    user_id = uuid4()
    project_id = uuid4()
    widget_id = uuid4()
    layout_id = uuid4()
    app = _make_test_app(user_id)
    now = datetime.now(UTC)
    updated = WidgetResponse(
        id=widget_id,
        layout_id=layout_id,
        widget_key="tasks",
        widget_title="Renamed",
        widget_config={"maxItems": 8},
        grid_position=GridPosition(x=1, y=1, w=2, h=2),
        is_visible=False,
        is_locked=True,
        display_order=1,
        created_at=now,
        updated_at=now,
    )
    mock_svc = MagicMock()
    mock_svc.update_widget = AsyncMock(return_value=updated)
    mock_svc.get_layout = AsyncMock(
        return_value=_layout_response(
            layout_id=layout_id,
            user_id=user_id,
            project_id=project_id,
        ),
    )

    with patch(
        "api.routers.marketing_cabinet.dashboard.get_accessible_project",
        new=AsyncMock(return_value=MagicMock()),
    ):
        with patch(
            "api.routers.marketing_cabinet.dashboard.check_marketing_dashboard_write_rate_limit",
            new=AsyncMock(return_value=(True, None)),
        ):
            with patch(
                "api.routers.marketing_cabinet.dashboard.DashboardService",
                return_value=mock_svc,
            ):
                client = TestClient(app)
                r = client.patch(
                    f"/api/v1/marketing-cabinet/projects/{project_id}/dashboard-widgets/{widget_id}",
                    json={
                        "widget_title": "Renamed",
                        "widget_config": {"maxItems": 8},
                        "is_visible": False,
                        "is_locked": True,
                        "display_order": 1,
                        "grid_position": {"x": 1, "y": 1, "w": 2, "h": 2},
                    },
                )
    assert r.status_code == 200
    body = r.json()
    assert body["widget_title"] == "Renamed"
    assert body["is_visible"] is False


@pytest.mark.integration
def test_add_dashboard_widget_returns_413_when_content_length_exceeds_cap() -> None:
    """N.139: Content-Length above MARKETING_DASHBOARD_POST_WIDGET_MAX_BYTES → 413 before service."""
    user_id = uuid4()
    project_id = uuid4()
    layout_id = uuid4()
    app = _make_test_app(user_id)
    mock_svc = MagicMock()

    fake_settings = MagicMock()
    fake_settings.marketing_dashboard_post_widget_max_bytes = 200

    with patch(
        "api.routers.marketing_cabinet.dashboard.get_accessible_project",
        new=AsyncMock(return_value=MagicMock()),
    ):
        with patch(
            "api.routers.marketing_cabinet.dashboard.check_marketing_dashboard_write_rate_limit",
            new=AsyncMock(return_value=(True, None)),
        ):
            with patch(
                "api.routers.marketing_cabinet.dashboard.unified_settings",
                fake_settings,
            ):
                with patch(
                    "api.routers.marketing_cabinet.dashboard.DashboardService",
                    return_value=mock_svc,
                ):
                    client = TestClient(app)
                    r = client.post(
                        f"/api/v1/marketing-cabinet/projects/{project_id}/dashboard-layouts/widgets",
                        json={
                            "layout_id": str(layout_id),
                            "widget_key": "tasks",
                            "widget_title": "T",
                            "widget_config": {},
                            "grid_position": {"x": 0, "y": 0, "w": 2, "h": 2},
                        },
                        headers={"Content-Length": "999999"},
                    )
    assert r.status_code == status.HTTP_413_CONTENT_TOO_LARGE
    mock_svc.add_widget.assert_not_called()
