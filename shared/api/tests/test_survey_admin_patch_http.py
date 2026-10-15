# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
#   HTTP contract for published survey PATCH (closes_at only).
# Related:
#   - api/routers/product_desktop_surveys_admin.py
# ---

from __future__ import annotations

import importlib.util
import sys
from datetime import UTC, datetime
from types import ModuleType
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID, uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.core.auth import User
from api.services.surveys.survey_api_schemas import SurveyAdminOut, SurveyRewardSpec

pytestmark = pytest.mark.skipif(
    importlib.util.find_spec("jose") is None,
    reason="Host venv missing auth stack; use run-stack0-api-tests.sh for HTTP contract",
)


def _ensure_tenacity_stub() -> None:
    if "tenacity" in sys.modules:
        return
    stub = ModuleType("tenacity")

    def _passthrough_decorator(*_args: object, **_kwargs: object):
        def _wrap(fn: object) -> object:
            return fn

        return _wrap

    setattr(stub, "RetryError", Exception)
    setattr(stub, "retry", _passthrough_decorator)
    setattr(stub, "retry_if_exception_type", lambda *_a, **_k: None)
    setattr(stub, "stop_after_attempt", lambda *_a, **_k: None)
    setattr(stub, "wait_exponential", lambda *_a, **_k: None)
    sys.modules["tenacity"] = stub


def _admin_user() -> User:
    return User(id=str(uuid4()), email="admin@test", username="admin", role="admin")


def _admin_out(survey_id: UUID) -> SurveyAdminOut:
    now = datetime.now(UTC).replace(tzinfo=None)
    return SurveyAdminOut(
        id=survey_id,
        title="Pulse",
        description_user="",
        description_admin=None,
        status="published",
        audience_mode="groups_or_users",
        reward=SurveyRewardSpec(),
        gaf_notify_body_template=None,
        closes_at=datetime(2026, 8, 1, 12, 0, 0),
        published_at=now,
        sort_order=0,
        created_at=now,
        updated_at=now,
        question_count=1,
    )


def _patch_client(
    monkeypatch: pytest.MonkeyPatch,
    *,
    survey_id: UUID,
    survey_status: str,
) -> TestClient:
    _ensure_tenacity_stub()
    from api.core.database_manager import get_postgres_session
    from api.routers import product_desktop_surveys_admin as admin_module
    from api.routers.admin_auth import require_admin_user
    from api.routers.product_desktop_surveys_admin import surveys_admin_router

    app = FastAPI()
    app.include_router(surveys_admin_router, prefix="/product-desktop")

    mock_db = MagicMock()
    mock_db.commit = AsyncMock()

    async def fake_session() -> MagicMock:
        return mock_db

    app.dependency_overrides[get_postgres_session] = fake_session

    async def fake_admin() -> User:
        return _admin_user()

    app.dependency_overrides[require_admin_user] = fake_admin

    survey = MagicMock()
    survey.id = survey_id
    survey.status = survey_status
    survey.closes_at = None

    async def fake_load(_db: object, sid: UUID) -> MagicMock | None:
        return survey if sid == survey_id else None

    async def fake_serialize(_db: object, _survey: object) -> SurveyAdminOut:
        return _admin_out(survey_id)

    monkeypatch.setattr(admin_module, "load_survey", fake_load)
    monkeypatch.setattr(admin_module, "serialize_admin", fake_serialize)

    return TestClient(app, raise_server_exceptions=False)


@pytest.mark.unit
def test_published_patch_closes_at_returns_200(monkeypatch: pytest.MonkeyPatch) -> None:
    survey_id = uuid4()
    client = _patch_client(
        monkeypatch,
        survey_id=survey_id,
        survey_status="published",
    )
    response = client.patch(
        f"/product-desktop/admin/surveys/{survey_id}",
        json={"closes_at": "2026-08-01T12:00:00Z"},
    )
    assert response.status_code == 200
    assert response.json()["id"] == str(survey_id)


@pytest.mark.unit
def test_published_patch_title_returns_409(monkeypatch: pytest.MonkeyPatch) -> None:
    survey_id = uuid4()
    client = _patch_client(
        monkeypatch,
        survey_id=survey_id,
        survey_status="published",
    )
    response = client.patch(
        f"/product-desktop/admin/surveys/{survey_id}",
        json={"title": "Renamed"},
    )
    assert response.status_code == 409
    assert response.json()["detail"] == "Published surveys only allow closes_at updates"


@pytest.mark.unit
def test_archived_patch_returns_409(monkeypatch: pytest.MonkeyPatch) -> None:
    survey_id = uuid4()
    client = _patch_client(
        monkeypatch,
        survey_id=survey_id,
        survey_status="archived",
    )
    response = client.patch(
        f"/product-desktop/admin/surveys/{survey_id}",
        json={"closes_at": "2026-08-01T12:00:00Z"},
    )
    assert response.status_code == 409
    assert response.json()["detail"] == "Archived surveys cannot be edited"
