# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Smoke tests for ``/api/v1/ewa/companion-profile`` and ``POST …/companion-chat/message`` when Postgres pool is absent (**503**).
# Invariants:
# - Module skipped at import if PyJWT is unavailable — run full suite in Docker API image.
# - Uses FastAPI ``TestClient`` + ``require_oauth2_user`` override; no asyncpg pool; asserts **503** ``detail.code``.
# Related:
# - api/ewa_platform/gateways/ewa_service_unavailable.py
# - api/ewa_platform/gateways/routers/companion_profile.py
# - api/ewa_platform/gateways/routers/companion_chat.py
# ---
from __future__ import annotations

import pytest

pytest.importorskip("jwt")

from fastapi import FastAPI  # type: ignore[import-untyped]
from fastapi.testclient import TestClient

from api.core.auth import User
from api.core.oauth2_auth import require_oauth2_user
from api.dependencies.user_context import get_current_user_db_id
from api.ewa_platform.gateways.routers.companion_chat import router as ewa_companion_chat_router
from api.ewa_platform.gateways.routers.companion_profile import router as ewa_companion_router


def test_companion_profile_get_503_without_pool(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EWA_DATABASE_URL", raising=False)
    app = FastAPI()
    app.state.ewa_orchestration_pool = None
    app.include_router(ewa_companion_router, prefix="/api/v1/ewa")

    async def fake_user() -> User:
        return User(id="u1", email="a@b.c", username="t", role="admin")

    app.dependency_overrides[require_oauth2_user] = fake_user
    c = TestClient(app)
    r = c.get("/api/v1/ewa/companion-profile")
    assert r.status_code == 503
    body = r.json()
    assert body["detail"]["code"] == "ewa_database_url_unset"


def test_companion_profile_get_503_pool_expected_but_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_DATABASE_URL", "postgresql://u:p@localhost:5432/ewa")
    app = FastAPI()
    app.state.ewa_orchestration_pool = None
    app.include_router(ewa_companion_router, prefix="/api/v1/ewa")

    async def fake_user() -> User:
        return User(id="u1", email="a@b.c", username="t", role="admin")

    app.dependency_overrides[require_oauth2_user] = fake_user
    c = TestClient(app)
    r = c.get("/api/v1/ewa/companion-profile")
    assert r.status_code == 503
    assert r.json()["detail"]["code"] == "ewa_orchestration_pool_unavailable"


def test_companion_chat_message_post_503_without_pool(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EWA_DATABASE_URL", raising=False)
    app = FastAPI()
    app.state.ewa_orchestration_pool = None
    app.include_router(ewa_companion_chat_router, prefix="/api/v1/ewa")

    async def fake_user() -> User:
        return User(id="u1", email="a@b.c", username="t", role="admin")

    async def fake_catalog_user_id() -> str:
        return "11111111-1111-1111-1111-111111111111"

    app.dependency_overrides[require_oauth2_user] = fake_user
    app.dependency_overrides[get_current_user_db_id] = fake_catalog_user_id
    c = TestClient(app)
    r = c.post("/api/v1/ewa/companion-chat/message", json={"message": "hi"})
    assert r.status_code == 503
    assert r.json()["detail"]["code"] == "ewa_database_url_unset"


def test_companion_chat_task_runs_get_503_without_pool(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EWA_DATABASE_URL", raising=False)
    app = FastAPI()
    app.state.ewa_orchestration_pool = None
    app.include_router(ewa_companion_chat_router, prefix="/api/v1/ewa")

    async def fake_user() -> User:
        return User(id="u1", email="a@b.c", username="t", role="admin")

    app.dependency_overrides[require_oauth2_user] = fake_user
    c = TestClient(app)
    r = c.get("/api/v1/ewa/companion-chat/task-runs")
    assert r.status_code == 503
    assert r.json()["detail"]["code"] == "ewa_database_url_unset"


def test_companion_chat_task_run_by_id_get_503_without_pool(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EWA_DATABASE_URL", raising=False)
    app = FastAPI()
    app.state.ewa_orchestration_pool = None
    app.include_router(ewa_companion_chat_router, prefix="/api/v1/ewa")

    async def fake_user() -> User:
        return User(id="u1", email="a@b.c", username="t", role="admin")

    app.dependency_overrides[require_oauth2_user] = fake_user
    c = TestClient(app)
    r = c.get("/api/v1/ewa/companion-chat/task-runs/run-1")
    assert r.status_code == 503
    assert r.json()["detail"]["code"] == "ewa_database_url_unset"


def test_companion_chat_task_run_events_get_503_without_pool(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EWA_DATABASE_URL", raising=False)
    app = FastAPI()
    app.state.ewa_orchestration_pool = None
    app.include_router(ewa_companion_chat_router, prefix="/api/v1/ewa")

    async def fake_user() -> User:
        return User(id="u1", email="a@b.c", username="t", role="admin")

    app.dependency_overrides[require_oauth2_user] = fake_user
    c = TestClient(app)
    r = c.get("/api/v1/ewa/companion-chat/task-runs/run-1/events")
    assert r.status_code == 503
    assert r.json()["detail"]["code"] == "ewa_database_url_unset"
