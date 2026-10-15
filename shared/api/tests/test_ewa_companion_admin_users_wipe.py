# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioural tests for admin Users hard wipe (confirm gate + Qdrant fail-closed + PG delete).
# Related:
# - api/ewa_platform/companion/admin_users.py
# - api/ewa_platform/gateways/routers/companion_admin.py
# ---
"""Admin users wipe API tests."""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock

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
async def test_wipe_companion_principal_deletes_and_purges_qdrant(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    deleted: dict[str, Any] = {"workflows": 0, "profile": 0}

    async def fake_fetch(_pool: object, *, principal_id: str) -> dict[str, Any]:
        return {
            "principal_id": principal_id,
            "seed_persona_id": "zera",
            "companion_revision": 4,
            "baseline": {},
            "learned_preferences": {},
        }

    async def fake_audit(*_a: object, **_k: object) -> bool:
        return True

    class _Conn:
        async def execute(self, sql: str, *_args: object) -> str:
            if "ewa_companion_user_workflows" in sql:
                deleted["workflows"] += 1
            if "ewa_companion_profile" in sql:
                deleted["profile"] += 1
            return "DELETE 1"

        async def __aenter__(self) -> _Conn:
            return self

        async def __aexit__(self, *_exc: object) -> None:
            return None

        def transaction(self) -> _Conn:
            return self

    class _Pool:
        def acquire(self) -> _Conn:
            return _Conn()

    monkeypatch.setattr(admin_users_mod.companion_pg, "companion_profile_fetch", fake_fetch)
    monkeypatch.setattr(admin_users_mod.companion_pg, "companion_audit_only", fake_audit)

    async def fake_client() -> object:
        return object()

    monkeypatch.setattr(
        "api.services.chat_memory_service._get_qdrant_client_companion_episodic",
        fake_client,
    )
    monkeypatch.setattr("api.services.chat_memory_service._embedding_dim", lambda: 768)
    purge = AsyncMock(return_value=3)
    monkeypatch.setattr(
        "api.ewa_platform.persistence_vector.companion_qdrant.delete_companion_episodic_for_principal",
        purge,
    )

    out = await admin_users_mod.wipe_companion_principal(
        pool=_Pool(),  # type: ignore[arg-type]
        principal_id="p-1",
        actor_sub="ops",
    )
    assert out["wiped"] is True
    assert out["principal_id"] == "p-1"
    assert out["qdrant_points_deleted"] == 3
    assert deleted["workflows"] == 1
    assert deleted["profile"] == 1
    purge.assert_awaited_once()


@pytest.mark.asyncio
async def test_wipe_companion_principal_fail_closed_without_qdrant(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake_fetch(_pool: object, *, principal_id: str) -> dict[str, Any]:
        return {"principal_id": principal_id, "seed_persona_id": "parent", "companion_revision": 1}

    monkeypatch.setattr(admin_users_mod.companion_pg, "companion_profile_fetch", fake_fetch)

    async def no_client() -> None:
        return None

    monkeypatch.setattr(
        "api.services.chat_memory_service._get_qdrant_client_companion_episodic",
        no_client,
    )

    with pytest.raises(admin_users_mod.CompanionAdminWipeQdrantUnavailable):
        await admin_users_mod.wipe_companion_principal(
            pool=object(),  # type: ignore[arg-type]
            principal_id="p-1",
            actor_sub="ops",
        )


@pytest.mark.unit
def test_wipe_route_confirm_mismatch(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_ADMIN_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_ADMIN_WRITE", "1")
    c = TestClient(_admin_app())
    r = c.post(
        "/api/v1/ewa/admin/companion/users/p-1/wipe",
        json={"confirm_principal_id": "other"},
    )
    assert r.status_code == 400
    assert r.json()["detail"] == "confirm_principal_id_mismatch"


@pytest.mark.unit
def test_wipe_route_write_off(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_ADMIN_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_ADMIN_WRITE", "0")
    c = TestClient(_admin_app())
    r = c.post(
        "/api/v1/ewa/admin/companion/users/p-1/wipe",
        json={"confirm_principal_id": "p-1"},
    )
    assert r.status_code == 503
    assert r.json()["detail"] == "ewa_companion_admin_write_disabled"


@pytest.mark.unit
def test_wipe_route_ok(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_ADMIN_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_ADMIN_WRITE", "1")

    async def fake_wipe(*_a: object, **_k: object) -> dict[str, Any]:
        return {"wiped": True, "principal_id": "p-1", "qdrant_points_deleted": 2}

    from api.ewa_platform.gateways.routers import companion_admin as admin_router

    monkeypatch.setattr(admin_router.admin_users_svc, "wipe_companion_principal", fake_wipe)
    c = TestClient(_admin_app())
    r = c.post(
        "/api/v1/ewa/admin/companion/users/p-1/wipe",
        json={"confirm_principal_id": "p-1"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["wiped"] is True
    assert body["qdrant_points_deleted"] == 2
