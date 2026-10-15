# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# HTTP-level tests for Professional Worlds admin RBAC on pack publish, rollout
# mutations, and module assignment routes.
# Invariants:
# - Regular admin receives 403 on publish and rollout mutations; Empery World admin
#   may proceed when service succeeds; module assign stays on require_admin_user.
# Related:
# - api/routers/professional_worlds_admin.py
# - tests/test_professional_worlds_admin_permissions.py
# ---

from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import FastAPI  # type: ignore[import-untyped]
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.core.auth import User
from api.core.database_manager import get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.routers.professional_worlds_admin import router as professional_worlds_admin_router


def _user(role: str) -> User:
    return User(id=str(uuid4()), email="admin@test", username="admin", role=role)


def _admin_app(*, role: str = "admin") -> FastAPI:
    app = FastAPI()
    app.include_router(
        professional_worlds_admin_router,
        prefix="/api/v1",
    )

    async def fake_session() -> AsyncSession:
        return MagicMock(spec=AsyncSession)

    app.dependency_overrides[get_postgres_session] = fake_session

    async def fake_oauth_user() -> User:
        return _user(role)

    app.dependency_overrides[require_oauth2_user] = fake_oauth_user

    return app


@pytest.mark.unit
def test_regular_admin_overview_returns_200(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_overview(_self: object) -> dict[str, object]:
        return {"verticals_count": 1}

    from api.services.professional_worlds import admin_service

    monkeypatch.setattr(
        admin_service.ProfessionalWorldsAdminService,
        "overview",
        fake_overview,
    )

    client = TestClient(_admin_app(role="admin"), raise_server_exceptions=False)
    response = client.get("/api/v1/professional-worlds/admin/overview")
    assert response.status_code == 200
    assert response.json()["verticals_count"] == 1


@pytest.mark.unit
def test_regular_admin_publish_release_returns_403() -> None:
    client = TestClient(_admin_app(role="admin"), raise_server_exceptions=False)
    response = client.post(f"/api/v1/professional-worlds/admin/packs/releases/{uuid4()}/publish")
    assert response.status_code == 403


@pytest.mark.unit
def test_emperyworld_admin_publish_release_not_forbidden(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    release_id = uuid4()

    async def fake_publish(
        _self: object,
        _admin_id: object,
        _admin_svc: object,
        rid: object,
    ) -> dict[str, object]:
        assert rid == release_id
        return {"id": str(release_id), "status": "published"}

    from api.services.professional_worlds import pack_service

    monkeypatch.setattr(
        pack_service.ProfessionalWorldsPackService,
        "publish_release",
        fake_publish,
    )

    client = TestClient(_admin_app(role="emperyworld_admin"), raise_server_exceptions=False)
    response = client.post(
        f"/api/v1/professional-worlds/admin/packs/releases/{release_id}/publish",
    )
    assert response.status_code != 403
    assert response.status_code == 200
    assert response.json()["status"] == "published"


@pytest.mark.unit
def test_regular_admin_create_rollout_returns_403() -> None:
    release_id = uuid4()
    client = TestClient(_admin_app(role="admin"), raise_server_exceptions=False)
    response = client.post(
        "/api/v1/professional-worlds/admin/rollouts",
        params={"vertical_slug": "realtor"},
        json={"release_id": str(release_id), "mode": "all", "percentage": 100},
    )
    assert response.status_code == 403


@pytest.mark.unit
def test_emperyworld_admin_create_rollout_not_forbidden(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    release_id = uuid4()
    rollout_id = uuid4()

    async def fake_create_rollout(
        _self: object,
        vertical_slug: object,
        rid: object,
        mode: object,
        percentage: object,
    ) -> dict[str, object]:
        assert vertical_slug == "realtor"
        assert rid == release_id
        assert mode == "all"
        assert percentage == 100
        return {"id": str(rollout_id), "release_id": str(release_id), "mode": "all"}

    from api.services.professional_worlds import pack_service

    monkeypatch.setattr(
        pack_service.ProfessionalWorldsPackService,
        "create_rollout",
        fake_create_rollout,
    )

    client = TestClient(_admin_app(role="emperyworld_admin"), raise_server_exceptions=False)
    response = client.post(
        "/api/v1/professional-worlds/admin/rollouts",
        params={"vertical_slug": "realtor"},
        json={"release_id": str(release_id), "mode": "all", "percentage": 100},
    )
    assert response.status_code != 403
    assert response.status_code == 200
    assert response.json()["id"] == str(rollout_id)


@pytest.mark.unit
def test_regular_admin_patch_rollout_returns_403() -> None:
    client = TestClient(_admin_app(role="admin"), raise_server_exceptions=False)
    response = client.patch(
        f"/api/v1/professional-worlds/admin/rollouts/{uuid4()}",
        json={"mode": "percentage", "percentage": 25},
    )
    assert response.status_code == 403


@pytest.mark.unit
def test_regular_admin_pause_rollout_returns_403() -> None:
    client = TestClient(_admin_app(role="admin"), raise_server_exceptions=False)
    response = client.post(f"/api/v1/professional-worlds/admin/rollouts/{uuid4()}/pause")
    assert response.status_code == 403


@pytest.mark.unit
def test_regular_admin_assign_module_returns_200(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module_key = "realtor_leads"
    vertical_slug = "realtor"

    async def fake_assign_module(
        _self: object,
        _admin_id: object,
        slug: object,
        key: object,
        _payload: object,
    ) -> dict[str, object]:
        assert slug == vertical_slug
        assert key == module_key
        now = datetime.now(UTC)
        return {
            "id": uuid4(),
            "vertical_slug": vertical_slug,
            "module_key": module_key,
            "is_enabled": True,
            "sort_order": 0,
            "config": {},
            "created_at": now,
            "updated_at": now,
        }

    from api.services.professional_worlds import admin_service

    monkeypatch.setattr(
        admin_service.ProfessionalWorldsAdminService,
        "assign_module",
        fake_assign_module,
    )

    client = TestClient(_admin_app(role="admin"), raise_server_exceptions=False)
    response = client.post(
        f"/api/v1/professional-worlds/admin/verticals/{vertical_slug}/modules/{module_key}",
        json={"is_enabled": True, "sort_order": 0, "config": {}},
    )
    assert response.status_code != 403
    assert response.status_code == 200
    assert response.json()["module_key"] == module_key
