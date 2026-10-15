# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Behavioural tests for companion admin platform settings API.
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


_SAMPLE_SETTING = {
    "setting_key": "EWA_COMPANION_VOICE_ENABLED",
    "value_text": "0",
    "value_type": "bool",
    "category": "companion",
    "description_ru": "Голос",
    "description_en": "Voice",
    "default_value": "0",
    "allowed_values": "0|1",
    "affects_ru": "Voice UI",
    "affects_en": "Voice UI",
    "is_secret": False,
    "sort_order": 10,
    "updated_by": None,
    "updated_at": None,
}


@pytest.mark.unit
def test_companion_admin_settings_list(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.ewa_platform.gateways.routers import companion_admin as admin_router

    monkeypatch.setattr(
        "api.ewa_platform.companion.workflows.config.companion_admin_enabled",
        lambda: True,
    )

    async def fake_list(*_args: object, **_kwargs: object) -> list[dict[str, object]]:
        return [_SAMPLE_SETTING]

    monkeypatch.setattr(admin_router.settings_pg, "list_ewa_platform_settings", fake_list)

    app = _admin_app()
    app.state.ewa_orchestration_pool = object()
    r = TestClient(app).get("/api/v1/ewa/admin/companion/settings")
    assert r.status_code == 200
    body = r.json()
    assert len(body["settings"]) == 1
    assert body["settings"][0]["setting_key"] == "EWA_COMPANION_VOICE_ENABLED"
    assert body["settings_total"] == 1


@pytest.mark.unit
def test_companion_admin_settings_list_when_admin_flag_off(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.ewa_platform.gateways.routers import companion_admin as admin_router

    monkeypatch.setattr(
        "api.ewa_platform.companion.workflows.config.companion_admin_enabled",
        lambda: False,
    )

    async def fake_list(*_args: object, **_kwargs: object) -> list[dict[str, object]]:
        return [_SAMPLE_SETTING]

    monkeypatch.setattr(admin_router.settings_pg, "list_ewa_platform_settings", fake_list)

    app = _admin_app()
    app.state.ewa_orchestration_pool = object()
    r = TestClient(app).get("/api/v1/ewa/admin/companion/settings")
    assert r.status_code == 200


@pytest.mark.unit
def test_companion_admin_settings_update(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.ewa_platform.gateways.routers import companion_admin as admin_router

    updated = dict(_SAMPLE_SETTING)
    updated["value_text"] = "1"

    async def fake_update(*_args: object, **_kwargs: object) -> dict[str, object]:
        return updated

    monkeypatch.setattr(admin_router, "update_setting_and_reload", fake_update)

    app = _admin_app()
    app.state.ewa_orchestration_pool = object()
    r = TestClient(app).put(
        "/api/v1/ewa/admin/companion/settings/EWA_COMPANION_VOICE_ENABLED",
        json={"value_text": "1"},
    )
    assert r.status_code == 200
    assert r.json()["value_text"] == "1"


@pytest.mark.unit
def test_companion_admin_settings_audit_list(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.ewa_platform.gateways.routers import companion_admin as admin_router

    sample_audit = [
        {
            "id": 1,
            "setting_key": "EWA_COMPANION_VOICE_ENABLED",
            "old_value": "0",
            "new_value": "1",
            "actor_sub": "admin@test",
            "created_at": "2026-05-22T12:00:00+00:00",
            "value_masked": False,
        }
    ]

    async def fake_audit(*_args: object, **kwargs: object) -> list[dict[str, object]]:
        assert kwargs.get("setting_key") == "EWA_COMPANION_VOICE_ENABLED"
        return sample_audit

    monkeypatch.setattr(
        admin_router.settings_pg,
        "list_ewa_platform_setting_audit",
        fake_audit,
    )

    app = _admin_app()
    app.state.ewa_orchestration_pool = object()
    r = TestClient(app).get(
        "/api/v1/ewa/admin/companion/settings/audit",
        params={"setting_key": "EWA_COMPANION_VOICE_ENABLED", "limit": 10},
    )
    assert r.status_code == 200
    body = r.json()
    assert len(body["entries"]) == 1
    assert body["entries"][0]["new_value"] == "1"
