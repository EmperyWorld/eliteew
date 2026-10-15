# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# HTTP contract tests for ``POST …/companion-profile/arlika-v2-mode-toggle`` (sigil click ↔ chat switch).
# Invariants:
# - Reuses ``try_apply_arlika_v2_chat_mode_switch``; hostile **arlika** v1 returns **409** before sidecar call.
# - Successful toggle returns ``transform_event_kind`` aligned with chat switch (**ewa_to_arly** / **arly_to_ewa**).
# Related:
# - api/ewa_platform/gateways/routers/companion_profile.py
# - api/ewa_platform/companion/sidecar/arlika_v2_chat_switch.py
# ---
"""Tests for EWA companion arlika_v2 sigil mode toggle HTTP endpoint."""

from __future__ import annotations

from typing import Any

import pytest

pytest.importorskip("jose")

from fastapi import FastAPI  # type: ignore[import-untyped]
from fastapi.testclient import TestClient

from api.core.auth import User
from api.core.oauth2_auth import require_oauth2_user
from api.ewa_platform.gateways.routers import companion_profile as companion_profile_router
from api.ewa_platform.gateways.routers.companion_profile import router as ewa_companion_router
from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg


def _app_with_pool(pool: object = object()) -> FastAPI:
    app = FastAPI()
    app.state.ewa_orchestration_pool = pool
    app.include_router(ewa_companion_router, prefix="/api/v1/ewa")

    async def fake_user() -> User:
        return User(id="u1", email="a@b.c", username="t", role="admin")

    app.dependency_overrides[require_oauth2_user] = fake_user
    return app


def _profile_row(*, seed: str, baseline: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "principal_id": "u1",
        "schema_version": "1",
        "seed_persona_id": seed,
        "baseline": baseline or {},
        "learned_preferences": {},
        "style_parameters": {},
        "companion_revision": 3,
        "updated_at": None,
    }


def test_arlika_v2_mode_toggle_503_without_pool(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EWA_DATABASE_URL", raising=False)
    app = _app_with_pool(pool=None)
    c = TestClient(app)
    r = c.post("/api/v1/ewa/companion-profile/arlika-v2-mode-toggle")
    assert r.status_code == 503
    assert r.json()["detail"]["code"] == "ewa_database_url_unset"


def test_arlika_v2_mode_toggle_409_hostile_arlika_v1(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_fetch(_pool: Any, *, principal_id: str) -> dict[str, Any]:
        assert principal_id == "u1"
        return _profile_row(seed="arlika")

    monkeypatch.setattr(companion_pg, "companion_profile_fetch", fake_fetch)
    c = TestClient(_app_with_pool())
    r = c.post("/api/v1/ewa/companion-profile/arlika-v2-mode-toggle")
    assert r.status_code == 409
    assert r.json()["detail"] == "arlika_v1_active_calm_first"


def test_arlika_v2_mode_toggle_409_not_eligible(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_fetch(_pool: Any, *, principal_id: str) -> dict[str, Any]:
        return _profile_row(seed="mela", baseline={})

    async def fake_switch(*_a: Any, **_k: Any) -> tuple[dict[str, Any], bool, str | None]:
        return _profile_row(seed="mela", baseline={}), False, None

    monkeypatch.setattr(companion_pg, "companion_profile_fetch", fake_fetch)
    monkeypatch.setattr(
        companion_profile_router,
        "try_apply_arlika_v2_chat_mode_switch",
        fake_switch,
    )
    c = TestClient(_app_with_pool())
    r = c.post("/api/v1/ewa/companion-profile/arlika-v2-mode-toggle")
    assert r.status_code == 409
    assert r.json()["detail"] == "arlika_v2_mode_not_available"


def test_arlika_v2_mode_toggle_success_to_v2(monkeypatch: pytest.MonkeyPatch) -> None:
    row = _profile_row(
        seed="mela",
        baseline={"ewa_companion_arlika_v2_unlocked_v1": True},
    )
    patched = {**row, "seed_persona_id": "arlika_v2", "companion_revision": 4}

    async def fake_fetch(_pool: Any, *, principal_id: str) -> dict[str, Any]:
        return dict(row)

    async def fake_switch(
        _pool: Any,
        *,
        principal_id: str,
        profile: dict[str, Any],
        user_line: str,
    ) -> tuple[dict[str, Any], bool, str | None]:
        assert principal_id == "u1"
        assert profile["seed_persona_id"] == "mela"
        assert user_line == "Переключись в режим арлики"
        return patched, True, "ewa_to_arly"

    monkeypatch.setattr(companion_pg, "companion_profile_fetch", fake_fetch)
    monkeypatch.setattr(
        companion_profile_router,
        "try_apply_arlika_v2_chat_mode_switch",
        fake_switch,
    )
    c = TestClient(_app_with_pool())
    r = c.post("/api/v1/ewa/companion-profile/arlika-v2-mode-toggle")
    assert r.status_code == 200
    body = r.json()
    assert body["switched"] is True
    assert body["transform_event_kind"] == "ewa_to_arly"
    assert body["seed_persona_id"] == "arlika_v2"


def test_arlika_v2_mode_toggle_success_back_to_ewa(monkeypatch: pytest.MonkeyPatch) -> None:
    row = _profile_row(seed="arlika_v2", baseline={"ewa_companion_arlika_origin_seed_v1": "mela"})
    patched = {**row, "seed_persona_id": "mela", "companion_revision": 5}

    async def fake_fetch(_pool: Any, *, principal_id: str) -> dict[str, Any]:
        return dict(row)

    async def fake_switch(
        _pool: Any,
        *,
        principal_id: str,
        profile: dict[str, Any],
        user_line: str,
    ) -> tuple[dict[str, Any], bool, str | None]:
        assert profile["seed_persona_id"] == "arlika_v2"
        assert user_line == "Вернись к обычной EWA"
        return patched, True, "arly_to_ewa"

    monkeypatch.setattr(companion_pg, "companion_profile_fetch", fake_fetch)
    monkeypatch.setattr(
        companion_profile_router,
        "try_apply_arlika_v2_chat_mode_switch",
        fake_switch,
    )
    c = TestClient(_app_with_pool())
    r = c.post("/api/v1/ewa/companion-profile/arlika-v2-mode-toggle")
    assert r.status_code == 200
    body = r.json()
    assert body["transform_event_kind"] == "arly_to_ewa"
    assert body["seed_persona_id"] == "mela"
