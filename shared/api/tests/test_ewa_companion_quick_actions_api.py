# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Behavioural tests for companion profile quick-action preset CRUD (GET/POST/PATCH/DELETE + validation).
# Invariants:
# - No live Postgres; ``companion_asyncpg`` helpers are monkeypatched at module boundary.
# Related:
# - api/ewa_platform/gateways/routers/companion_profile.py
# - api/ewa_platform/persistence_pg/companion_asyncpg.py
# ---

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock

import pytest

pytest.importorskip("jose")

from fastapi import FastAPI  # type: ignore[import-untyped]
from fastapi.testclient import TestClient

from api.core.auth import User
from api.core.oauth2_auth import require_oauth2_user
from api.ewa_platform.gateways.routers.companion_profile import router as companion_profile_router
from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg

_PRESET_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
_PRINCIPAL = "u1"


def _preset_row(**overrides: Any) -> dict[str, Any]:
    row = {
        "id": _PRESET_ID,
        "principal_id": _PRINCIPAL,
        "label": "Summarize",
        "prompt_text": "Summarize the open document in three bullets.",
        "sort_order": 100,
        "created_at": "2026-05-27T12:00:00+00:00",
        "updated_at": "2026-05-27T12:00:00+00:00",
    }
    row.update(overrides)
    return row


def _app(*, pool: object | None = object()) -> FastAPI:
    app = FastAPI()
    app.include_router(companion_profile_router, prefix="/api/v1/ewa")
    app.state.ewa_orchestration_pool = pool

    async def fake_user() -> User:
        return User(id=_PRINCIPAL, email="a@b.c", username="t", role="user")

    app.dependency_overrides[require_oauth2_user] = fake_user
    return app


@pytest.mark.unit
def test_quick_actions_list_returns_presets(monkeypatch: pytest.MonkeyPatch) -> None:
    presets = [_preset_row()]
    monkeypatch.setattr(
        companion_pg,
        "companion_quick_presets_list",
        AsyncMock(return_value=presets),
    )
    client = TestClient(_app())
    response = client.get("/api/v1/ewa/companion-profile/quick-actions")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["id"] == _PRESET_ID
    assert body[0]["label"] == "Summarize"


@pytest.mark.unit
def test_quick_actions_create_returns_preset(monkeypatch: pytest.MonkeyPatch) -> None:
    created = _preset_row(label="Draft reply", prompt_text="Draft a polite reply.", sort_order=50)
    create_mock = AsyncMock(return_value=created)
    monkeypatch.setattr(companion_pg, "companion_quick_preset_create", create_mock)
    client = TestClient(_app())
    response = client.post(
        "/api/v1/ewa/companion-profile/quick-actions",
        json={"label": "Draft reply", "prompt_text": "Draft a polite reply.", "sort_order": 50},
    )
    assert response.status_code == 200
    assert response.json()["label"] == "Draft reply"
    create_mock.assert_awaited_once()
    create_call = create_mock.await_args
    assert create_call is not None
    assert create_call.kwargs == {
        "principal_id": _PRINCIPAL,
        "label": "Draft reply",
        "prompt_text": "Draft a polite reply.",
        "sort_order": 50,
    }


@pytest.mark.unit
def test_quick_actions_create_validation_rejects_empty_label() -> None:
    client = TestClient(_app())
    response = client.post(
        "/api/v1/ewa/companion-profile/quick-actions",
        json={"label": "", "prompt_text": "ok"},
    )
    assert response.status_code == 422


@pytest.mark.unit
def test_quick_actions_create_validation_rejects_empty_prompt() -> None:
    client = TestClient(_app())
    response = client.post(
        "/api/v1/ewa/companion-profile/quick-actions",
        json={"label": "Ok", "prompt_text": ""},
    )
    assert response.status_code == 422


@pytest.mark.unit
def test_quick_actions_patch_updates_preset(monkeypatch: pytest.MonkeyPatch) -> None:
    updated = _preset_row(label="Summarize v2", sort_order=10)
    update_mock = AsyncMock(return_value=updated)
    monkeypatch.setattr(companion_pg, "companion_quick_preset_update", update_mock)
    client = TestClient(_app())
    response = client.patch(
        f"/api/v1/ewa/companion-profile/quick-actions/{_PRESET_ID}",
        json={"label": "Summarize v2", "sort_order": 10},
    )
    assert response.status_code == 200
    assert response.json()["label"] == "Summarize v2"
    update_mock.assert_awaited_once()
    update_call = update_mock.await_args
    assert update_call is not None
    kwargs = update_call.kwargs
    assert kwargs["principal_id"] == _PRINCIPAL
    assert kwargs["preset_id"] == _PRESET_ID
    assert kwargs["label"] == "Summarize v2"
    assert kwargs["sort_order"] == 10


@pytest.mark.unit
def test_quick_actions_patch_not_found(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        companion_pg,
        "companion_quick_preset_update",
        AsyncMock(return_value=None),
    )
    client = TestClient(_app())
    response = client.patch(
        f"/api/v1/ewa/companion-profile/quick-actions/{_PRESET_ID}",
        json={"label": "Missing"},
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "quick_action_preset_not_found"


@pytest.mark.unit
def test_quick_actions_delete_ok(monkeypatch: pytest.MonkeyPatch) -> None:
    delete_mock = AsyncMock(return_value=True)
    monkeypatch.setattr(companion_pg, "companion_quick_preset_delete", delete_mock)
    client = TestClient(_app())
    response = client.delete(f"/api/v1/ewa/companion-profile/quick-actions/{_PRESET_ID}")
    assert response.status_code == 200
    assert response.json() == {"ok": True}
    delete_mock.assert_awaited_once()
    delete_call = delete_mock.await_args
    assert delete_call is not None
    assert delete_call.kwargs == {
        "principal_id": _PRINCIPAL,
        "preset_id": _PRESET_ID,
    }


@pytest.mark.unit
def test_quick_actions_delete_not_found(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        companion_pg,
        "companion_quick_preset_delete",
        AsyncMock(return_value=False),
    )
    client = TestClient(_app())
    response = client.delete(f"/api/v1/ewa/companion-profile/quick-actions/{_PRESET_ID}")
    assert response.status_code == 404
    assert response.json()["detail"] == "quick_action_preset_not_found"


@pytest.mark.unit
def test_quick_actions_list_503_without_pool(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EWA_DATABASE_URL", raising=False)
    client = TestClient(_app(pool=None))
    response = client.get("/api/v1/ewa/companion-profile/quick-actions")
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "ewa_database_url_unset"
