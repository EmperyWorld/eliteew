# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Behavioural tests for WF-5 companion admin read API (tools + workflows).
# Related:
# - api/ewa_platform/gateways/routers/companion_admin.py
# ---

from __future__ import annotations

import pytest

pytest.importorskip("jose")

from fastapi import FastAPI  # type: ignore[import-untyped]
from fastapi.testclient import TestClient

from api.core.auth import User
from api.core.oauth2_auth import require_oauth2_user
from api.ewa_platform.gateways.routers.companion_admin import (
    require_companion_admin_user,
)
from api.ewa_platform.gateways.routers.companion_admin import (
    router as companion_admin_router,
)


def _admin_app() -> FastAPI:
    app = FastAPI()
    app.include_router(companion_admin_router, prefix="/api/v1/ewa")

    async def fake_admin() -> User:
        return User(id="u1", email="a@b.c", username="t", role="admin")

    app.dependency_overrides[require_oauth2_user] = fake_admin
    app.dependency_overrides[require_companion_admin_user] = fake_admin
    return app


@pytest.mark.unit
def test_companion_admin_status_reports_flags(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_ADMIN_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_ADMIN_WRITE", "1")
    monkeypatch.setenv("EWA_COMPANION_WF_PG_CATALOG", "0")
    c = TestClient(_admin_app())
    r = c.get("/api/v1/ewa/admin/companion/status")
    assert r.status_code == 200
    body = r.json()
    assert body["admin_enabled"] is True
    assert body["admin_write_enabled"] is True
    assert body["pg_catalog_enabled"] is False


@pytest.mark.unit
def test_companion_admin_task_runs_list(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_ADMIN_ENABLED", "1")

    sample_run = {
        "id": "run-admin-1",
        "principal_id": "principal-1",
        "status": "completed",
        "intent_kind": "music_generation_background",
        "user_message": "сделай трек",
        "plan_payload": {},
        "confirmation_state": {},
        "result_payload": {},
        "error_payload": {},
        "execution_mode": "async",
        "created_at": "2026-05-22T10:00:00+00:00",
        "updated_at": "2026-05-22T10:01:00+00:00",
        "completed_at": "2026-05-22T10:01:00+00:00",
    }

    async def fake_list_operator(*_args: object, **_kwargs: object) -> list[dict[str, object]]:
        return [sample_run]

    from api.ewa_platform.gateways.routers import companion_admin as admin_router

    monkeypatch.setattr(
        admin_router.companion_pg,
        "companion_task_runs_list_operator",
        fake_list_operator,
    )

    app = _admin_app()
    app.state.ewa_orchestration_pool = object()

    c = TestClient(app)
    r = c.get("/api/v1/ewa/admin/companion/task-runs?limit=5")
    assert r.status_code == 200
    body = r.json()
    assert len(body["runs"]) == 1
    assert body["runs"][0]["id"] == "run-admin-1"


@pytest.mark.unit
def test_companion_admin_tools_requires_feature_flag(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_ADMIN_ENABLED", "0")
    c = TestClient(_admin_app())
    r = c.get("/api/v1/ewa/admin/companion/tools")
    assert r.status_code == 503
    assert r.json()["detail"] == "ewa_companion_admin_disabled"


@pytest.mark.unit
def test_companion_admin_tools_export(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_ADMIN_ENABLED", "1")
    c = TestClient(_admin_app())
    r = c.get("/api/v1/ewa/admin/companion/tools")
    assert r.status_code == 200
    body = r.json()
    names = [t["name"] for t in body["tools"]]
    assert "music_generation" in names
    music = next(t for t in body["tools"] if t["name"] == "music_generation")
    assert music["router_exposed"] is True


@pytest.mark.unit
def test_companion_admin_workflows_list_and_detail(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_ADMIN_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_WF_ENGINE_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_WF_MUSIC_FULL_V1", "1")
    c = TestClient(_admin_app())
    listed = c.get("/api/v1/ewa/admin/companion/workflows")
    assert listed.status_code == 200
    ids = {row["workflow_id"] for row in listed.json()["workflows"]}
    assert "music_full_cycle_v1" in ids

    detail = c.get("/api/v1/ewa/admin/companion/workflows/music_full_cycle_v1")
    assert detail.status_code == 200
    payload = detail.json()
    assert payload["definition"]["workflow_id"] == "music_full_cycle_v1"
    assert payload["effective_enabled"] is True


@pytest.mark.unit
def test_companion_admin_workflow_not_found(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_ADMIN_ENABLED", "1")
    c = TestClient(_admin_app())
    r = c.get("/api/v1/ewa/admin/companion/workflows/does_not_exist_v9")
    assert r.status_code == 404
