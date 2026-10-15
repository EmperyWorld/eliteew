# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# HTTP-level tests for Professional Worlds profile upsert validation mapping.
# Invariants:
# - Active schema validation failures return 422 with structured detail, not ASGI 500.
# Related:
# - api/routers/professional_worlds_core.py
# - api/services/professional_worlds/service.py
# - tests/test_professional_worlds_delete_http.py
# ---

from __future__ import annotations

from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import APIRouter, FastAPI  # type: ignore[import-untyped]
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.core.auth import User
from api.core.database_manager import get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.routers.professional_worlds_core import core_router
from api.schemas.professional_worlds import SpecialistProfileUpsert
from api.services.professional_worlds.service import ActiveSchemaValidationError


def _user() -> User:
    return User(id=str(uuid4()), email="pw@test", username="pw-user", role="user")


def _profile_app() -> FastAPI:
    app = FastAPI()
    mount = APIRouter(prefix="/professional-worlds")
    mount.include_router(core_router)
    app.include_router(mount, prefix="/api/v1")

    async def fake_session() -> AsyncSession:
        return MagicMock(spec=AsyncSession)

    app.dependency_overrides[get_postgres_session] = fake_session

    async def fake_oauth_user() -> User:
        return _user()

    app.dependency_overrides[require_oauth2_user] = fake_oauth_user

    return app


@pytest.mark.unit
def test_upsert_profile_missing_required_fields_returns_422(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_upsert_profile(
        _self: object,
        _user_id: object,
        _payload: SpecialistProfileUpsert,
    ) -> dict[str, object]:
        raise ActiveSchemaValidationError(
            schema_key="realtor_profile",
            missing_fields=["display_name", "city"],
        )

    from api.services.professional_worlds.service import ProfessionalWorldsService

    monkeypatch.setattr(ProfessionalWorldsService, "upsert_profile", fake_upsert_profile)

    client = TestClient(_profile_app(), raise_server_exceptions=False)
    response = client.put(
        "/api/v1/professional-worlds/me/profile",
        json={"vertical_slug": "realtor", "display_name": "", "city": None},
    )

    assert response.status_code == 422
    detail = response.json()["detail"]
    assert detail["code"] == "schema_validation_failed"
    assert detail["schema_key"] == "realtor_profile"
    assert detail["missing_fields"] == ["display_name", "city"]
    assert "display_name" in detail["message"]


@pytest.mark.anyio
async def test_validate_against_active_schema_raises_typed_error() -> None:
    from api.services.professional_worlds.service import ProfessionalWorldsService
    from api.tests.test_professional_worlds import _FakeDb

    db = _FakeDb(
        [
            {
                "schema_json": {
                    "required": ["display_name", "city"],
                    "properties": {"display_name": {"type": "string"}, "city": {"type": "string"}},
                }
            }
        ]
    )
    service = ProfessionalWorldsService(db)  # type: ignore[arg-type]

    with pytest.raises(ActiveSchemaValidationError) as exc_info:
        await service.validate_against_active_schema(
            "realtor",
            "realtor_profile",
            {"vertical_slug": "realtor", "display_name": None, "city": "   "},
        )

    assert exc_info.value.schema_key == "realtor_profile"
    assert exc_info.value.missing_fields == ["display_name", "city"]
