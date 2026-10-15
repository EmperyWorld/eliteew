# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioural tests for admin Users soft clear-namespace (allowlist + confirm gate).
# Related:
# - api/ewa_platform/companion/admin_users.py
# - api/ewa_platform/gateways/routers/companion_admin.py
# ---
"""Admin users clear-namespace API tests."""

from __future__ import annotations

from typing import Any

import pytest

pytest.importorskip("jose")

from fastapi import FastAPI  # type: ignore[import-untyped]
from fastapi.testclient import TestClient

from api.core.auth import User
from api.core.oauth2_auth import require_oauth2_user
from api.ewa_platform.companion import admin_users as admin_users_mod
from api.ewa_platform.gateways.routers.companion_admin import (
    require_companion_admin_user,
)
from api.ewa_platform.gateways.routers.companion_admin import (
    router as companion_admin_router,
)


def _admin_app(*, pool: object | None = object()) -> FastAPI:
    app = FastAPI()
    app.include_router(companion_admin_router, prefix="/api/v1/ewa")

    async def fake_admin() -> User:
        return User(id="u1", email="a@b.c", username="ops", role="admin")

    app.dependency_overrides[require_oauth2_user] = fake_admin
    app.dependency_overrides[require_companion_admin_user] = fake_admin
    app.state.ewa_orchestration_pool = pool
    return app


@pytest.mark.asyncio
async def test_clear_learned_namespace_empties_memory(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    patched_payload: dict[str, Any] = {}

    async def fake_fetch(_pool: object, *, principal_id: str) -> dict[str, Any]:
        return {
            "principal_id": principal_id,
            "seed_persona_id": "zera",
            "companion_revision": 2,
            "baseline": {},
            "learned_preferences": {
                "companion_memory_v1": [{"content": "keep?"}],
                "companion_meta_v1": {"x": 1},
            },
        }

    async def fake_patch(
        _pool: object,
        *,
        principal_id: str,
        learned_preferences: dict[str, Any] | None = None,
        expect_revision: int | None = None,
        audit_action: str = "patch",
        audit_detail_override: dict[str, Any] | None = None,
        **_kw: object,
    ) -> dict[str, Any]:
        assert audit_action == "admin_clear_namespace"
        assert expect_revision == 2
        assert learned_preferences is not None
        assert learned_preferences["companion_memory_v1"] == []
        assert learned_preferences["companion_meta_v1"] == {"x": 1}
        assert (audit_detail_override or {}).get("namespace") == "companion_memory_v1"
        patched_payload.update(learned_preferences)
        return {
            "principal_id": principal_id,
            "seed_persona_id": "zera",
            "companion_revision": 3,
            "baseline": {},
            "learned_preferences": learned_preferences,
        }

    monkeypatch.setattr(admin_users_mod.companion_pg, "companion_profile_fetch", fake_fetch)
    monkeypatch.setattr(admin_users_mod.companion_pg, "companion_profile_patch", fake_patch)

    out = await admin_users_mod.clear_learned_namespace(
        object(),  # type: ignore[arg-type]
        principal_id="p1",
        namespace="companion_memory_v1",
        actor_sub="ops",
        expected_revision=2,
    )
    assert out["companion_revision"] == 3
    assert patched_payload["companion_memory_v1"] == []


def test_clear_namespace_route_confirm_and_ok(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_ADMIN_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_ADMIN_WRITE", "1")

    from api.ewa_platform.gateways.routers import companion_admin as admin_router

    async def fake_clear(*_a: object, **_k: object) -> dict[str, Any]:
        return {
            "principal_id": "p1",
            "seed_persona_id": "zera",
            "companion_revision": 4,
            "updated_at": None,
            "learned_preferences": {"companion_memory_v1": []},
            "baseline": {},
        }

    monkeypatch.setattr(admin_router.admin_users_svc, "clear_learned_namespace", fake_clear)

    client = TestClient(_admin_app())
    bad = client.post(
        "/api/v1/ewa/admin/companion/users/p1/clear-namespace",
        json={
            "namespace": "companion_memory_v1",
            "confirm_namespace": "other",
        },
    )
    assert bad.status_code == 400

    ok = client.post(
        "/api/v1/ewa/admin/companion/users/p1/clear-namespace",
        json={
            "namespace": "companion_memory_v1",
            "confirm_namespace": "companion_memory_v1",
            "expected_revision": 3,
        },
    )
    assert ok.status_code == 200
    assert ok.json()["companion_revision"] == 4


def test_clear_namespace_route_deny_ns(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_ADMIN_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_ADMIN_WRITE", "1")

    from api.ewa_platform.gateways.routers import companion_admin as admin_router

    async def deny(*_a: object, **_k: object) -> dict[str, Any]:
        raise ValueError("learned_path_denied:not_allowed_ns")

    monkeypatch.setattr(admin_router.admin_users_svc, "clear_learned_namespace", deny)
    client = TestClient(_admin_app())
    denied = client.post(
        "/api/v1/ewa/admin/companion/users/p1/clear-namespace",
        json={
            "namespace": "not_allowed_ns",
            "confirm_namespace": "not_allowed_ns",
        },
    )
    assert denied.status_code == 422


def test_clear_namespace_write_off(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_ADMIN_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_ADMIN_WRITE", "0")
    client = TestClient(_admin_app())
    res = client.post(
        "/api/v1/ewa/admin/companion/users/p1/clear-namespace",
        json={
            "namespace": "companion_memory_v1",
            "confirm_namespace": "companion_memory_v1",
        },
    )
    assert res.status_code == 503
    assert res.json()["detail"] == "ewa_companion_admin_write_disabled"
