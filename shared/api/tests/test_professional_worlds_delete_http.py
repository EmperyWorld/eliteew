# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# HTTP-level tests for Professional Worlds DELETE routes on CRM-lite clients/deals
# and learning artifacts; service layer mocked, assertions on status and JSON only.
# Invariants:
# - Client delete maps ClientHasDealsError to 409 with code and deal_count.
# - Missing or user-scoped misses return 404 for clients, deals, and artifacts.
# Related:
# - api/routers/professional_worlds_crm_lite.py
# - api/routers/professional_worlds_learning.py
# - tests/test_professional_worlds_admin_http_permissions.py
# ---

from __future__ import annotations

from unittest.mock import MagicMock
from uuid import UUID, uuid4

import pytest
from fastapi import FastAPI  # type: ignore[import-untyped]
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.core.auth import User
from api.core.database_manager import get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.routers.professional_worlds_crm_lite import crm_lite_router
from api.routers.professional_worlds_learning import learning_router
from api.services.professional_worlds.professional_crm_service import ClientHasDealsError


def _user() -> User:
    return User(id=str(uuid4()), email="pw@test", username="pw-user", role="user")


def _delete_app() -> FastAPI:
    app = FastAPI()
    from fastapi import APIRouter  # type: ignore[import-untyped]

    mount = APIRouter(prefix="/professional-worlds")
    mount.include_router(crm_lite_router)
    mount.include_router(learning_router)
    app.include_router(mount, prefix="/api/v1")

    async def fake_session() -> AsyncSession:
        return MagicMock(spec=AsyncSession)

    app.dependency_overrides[get_postgres_session] = fake_session

    async def fake_oauth_user() -> User:
        return _user()

    app.dependency_overrides[require_oauth2_user] = fake_oauth_user

    return app


@pytest.mark.unit
def test_delete_client_returns_204(monkeypatch: pytest.MonkeyPatch) -> None:
    client_id = uuid4()
    seen: dict[str, UUID] = {}

    async def fake_delete_client(_self: object, user_id: UUID, cid: UUID) -> bool:
        seen["user_id"] = user_id
        seen["client_id"] = cid
        return True

    from api.services.professional_worlds.service import ProfessionalWorldsService

    monkeypatch.setattr(ProfessionalWorldsService, "delete_client", fake_delete_client)

    client = TestClient(_delete_app(), raise_server_exceptions=False)
    response = client.delete(f"/api/v1/professional-worlds/clients/{client_id}")

    assert response.status_code == 204
    assert response.content == b""
    assert seen["client_id"] == client_id


@pytest.mark.unit
def test_delete_client_returns_409_when_deals_exist(monkeypatch: pytest.MonkeyPatch) -> None:
    client_id = uuid4()
    deal_count = 3

    async def fake_delete_client(_self: object, _user_id: UUID, _cid: UUID) -> bool:
        raise ClientHasDealsError(deal_count)

    from api.services.professional_worlds.service import ProfessionalWorldsService

    monkeypatch.setattr(ProfessionalWorldsService, "delete_client", fake_delete_client)

    client = TestClient(_delete_app(), raise_server_exceptions=False)
    response = client.delete(f"/api/v1/professional-worlds/clients/{client_id}")

    assert response.status_code == 409
    detail = response.json()["detail"]
    assert detail["code"] == "client_has_deals"
    assert detail["deal_count"] == deal_count


@pytest.mark.unit
def test_delete_client_returns_404_when_missing_or_wrong_user(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client_id = uuid4()

    async def fake_delete_client(_self: object, _user_id: UUID, _cid: UUID) -> bool:
        return False

    from api.services.professional_worlds.service import ProfessionalWorldsService

    monkeypatch.setattr(ProfessionalWorldsService, "delete_client", fake_delete_client)

    client = TestClient(_delete_app(), raise_server_exceptions=False)
    response = client.delete(f"/api/v1/professional-worlds/clients/{client_id}")

    assert response.status_code == 404
    assert response.json()["detail"] == "Client not found"


@pytest.mark.unit
def test_delete_deal_returns_204(monkeypatch: pytest.MonkeyPatch) -> None:
    deal_id = uuid4()
    seen: dict[str, UUID] = {}

    async def fake_delete_deal(_self: object, user_id: UUID, did: UUID) -> bool:
        seen["user_id"] = user_id
        seen["deal_id"] = did
        return True

    from api.services.professional_worlds.service import ProfessionalWorldsService

    monkeypatch.setattr(ProfessionalWorldsService, "delete_deal", fake_delete_deal)

    client = TestClient(_delete_app(), raise_server_exceptions=False)
    response = client.delete(f"/api/v1/professional-worlds/deals/{deal_id}")

    assert response.status_code == 204
    assert response.content == b""
    assert seen["deal_id"] == deal_id


@pytest.mark.unit
def test_delete_artifact_returns_204(monkeypatch: pytest.MonkeyPatch) -> None:
    artifact_id = uuid4()
    seen: dict[str, UUID] = {}

    async def fake_delete_artifact(_self: object, user_id: UUID, aid: UUID) -> bool:
        seen["user_id"] = user_id
        seen["artifact_id"] = aid
        return True

    from api.services.professional_worlds.service import ProfessionalWorldsService

    monkeypatch.setattr(ProfessionalWorldsService, "delete_artifact", fake_delete_artifact)

    client = TestClient(_delete_app(), raise_server_exceptions=False)
    response = client.delete(f"/api/v1/professional-worlds/artifacts/{artifact_id}")

    assert response.status_code == 204
    assert response.content == b""
    assert seen["artifact_id"] == artifact_id
