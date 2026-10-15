# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# HTTP contract tests for `/api/v1/desktop/poemma/workspace*` router paths.
# Invariants:
# - Router maps service/domain errors to stable HTTP status codes (400/403/422).
# - Tests run with FastAPI dependency overrides only; no real Postgres/Keycloak runtime.
# - Response body keeps role + workspace payload shape for both exists=false and exists=true.
# Related:
# - api/routers/poemma.py
# - api/services/poemma_service.py
# ---

from __future__ import annotations

from datetime import datetime
from types import SimpleNamespace
from uuid import UUID, uuid4

from fastapi import FastAPI  # type: ignore[import-untyped]
from fastapi.testclient import TestClient

from api.core.auth import User
from api.core.database_manager import get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.routers import poemma as poemma_router
from api.services.poemma_service import PoemmaWorkspaceState

ACTOR_USER_ID = UUID("11111111-1111-4111-8111-111111111111")


def _workspace_state(
    *,
    role: str,
    exists: bool = True,
    org_id: str = "org-poemma",
    payload_version: str = "v1",
    storage_payload: dict[str, object] | None = None,
    migrated_from_local: bool = False,
) -> PoemmaWorkspaceState:
    if not exists:
        return PoemmaWorkspaceState(workspace=None, role=role)
    workspace = SimpleNamespace(
        id=uuid4(),
        owner_user_id=ACTOR_USER_ID,
        org_id=org_id,
        payload_version=payload_version,
        storage_payload=storage_payload or {"poemma:v1:user:org": {"id": org_id}},
        migrated_from_local=migrated_from_local,
        updated_at=datetime(2026, 6, 4, 12, 0, 0),
    )
    return PoemmaWorkspaceState(workspace=workspace, role=role)


def _client(monkeypatch) -> TestClient:
    app = FastAPI()
    app.include_router(poemma_router.router, prefix="/api/v1")

    async def fake_user() -> User:
        return User(
            id="oauth-user-1",
            email="poemma@empery.world",
            username="poemma",
            role="admin",
        )

    async def fake_session():
        yield object()

    async def fake_resolve_db_user_uuid_with_session(
        current_user: User,
        db,
    ) -> UUID:
        del current_user, db
        return ACTOR_USER_ID

    app.dependency_overrides[require_oauth2_user] = fake_user
    app.dependency_overrides[get_postgres_session] = fake_session
    monkeypatch.setattr(
        poemma_router,
        "resolve_db_user_uuid_with_session",
        fake_resolve_db_user_uuid_with_session,
    )
    return TestClient(app)


def test_get_workspace_returns_exists_false_when_state_empty(
    monkeypatch,
) -> None:
    client = _client(monkeypatch)

    async def fake_resolve_state(db, actor_user_id, platform_role):
        del db, actor_user_id, platform_role
        return _workspace_state(role="team", exists=False)

    monkeypatch.setattr(
        poemma_router,
        "resolve_poemma_workspace_state",
        fake_resolve_state,
    )

    response = client.get("/api/v1/desktop/poemma/workspace")
    assert response.status_code == 200
    payload = response.json()
    assert payload["exists"] is False
    assert payload["role"] == "team"
    assert payload["storage_payload"] == {}
    assert payload["workspace_id"] is None


def test_get_workspace_returns_snapshot_when_workspace_exists(
    monkeypatch,
) -> None:
    client = _client(monkeypatch)

    async def fake_resolve_state(db, actor_user_id, platform_role):
        del db, actor_user_id, platform_role
        return _workspace_state(
            role="owner",
            exists=True,
            payload_version="v2",
            org_id="org-zoya",
            storage_payload={"k": "v"},
            migrated_from_local=True,
        )

    monkeypatch.setattr(
        poemma_router,
        "resolve_poemma_workspace_state",
        fake_resolve_state,
    )

    response = client.get("/api/v1/desktop/poemma/workspace")
    assert response.status_code == 200
    payload = response.json()
    assert payload["exists"] is True
    assert payload["role"] == "owner"
    assert payload["org_id"] == "org-zoya"
    assert payload["payload_version"] == "v2"
    assert payload["storage_payload"] == {"k": "v"}
    assert payload["migrated_from_local"] is True


def test_put_workspace_upserts_snapshot_and_returns_state(
    monkeypatch,
) -> None:
    client = _client(monkeypatch)
    captured: dict[str, object] = {}

    async def fake_upsert(
        *,
        db,
        actor_user_id,
        platform_role,
        storage_payload,
        payload_version,
        org_id,
        mutation,
        migrated_from_local,
    ):
        del db
        captured.update(
            {
                "actor_user_id": actor_user_id,
                "platform_role": platform_role,
                "storage_payload": storage_payload,
                "payload_version": payload_version,
                "org_id": org_id,
                "mutation": mutation,
                "migrated_from_local": migrated_from_local,
            }
        )
        return _workspace_state(
            role="manager",
            exists=True,
            org_id=org_id or "org-poemma",
            payload_version=payload_version,
            storage_payload=storage_payload,
            migrated_from_local=bool(migrated_from_local),
        )

    monkeypatch.setattr(
        poemma_router,
        "upsert_poemma_workspace_payload",
        fake_upsert,
    )

    response = client.put(
        "/api/v1/desktop/poemma/workspace",
        json={
            "storage_payload": {"poemma:v1:u:org": {"id": "org-upsert"}},
            "payload_version": "v9",
            "org_id": "org-upsert",
            "mutation": "saveTeamTask",
            "migrated_from_local": True,
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["exists"] is True
    assert payload["role"] == "manager"
    assert payload["org_id"] == "org-upsert"
    assert payload["payload_version"] == "v9"
    assert captured["actor_user_id"] == ACTOR_USER_ID
    assert captured["platform_role"] == "admin"
    assert captured["mutation"] == "saveTeamTask"


def test_put_workspace_maps_permission_error_to_403(monkeypatch) -> None:
    client = _client(monkeypatch)

    async def fake_upsert(**kwargs):
        del kwargs
        raise PermissionError("poemma_forbidden_mutation")

    monkeypatch.setattr(
        poemma_router,
        "upsert_poemma_workspace_payload",
        fake_upsert,
    )

    response = client.put(
        "/api/v1/desktop/poemma/workspace",
        json={"storage_payload": {}, "mutation": "saveFinanceSnapshot"},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "poemma_forbidden_mutation"


def test_import_local_backup_rejects_foreign_backup(monkeypatch) -> None:
    client = _client(monkeypatch)

    def fake_validate_backup(backup, actor_user_id):
        del backup, actor_user_id
        raise ValueError("poemma_backup_wrong_user")

    monkeypatch.setattr(
        poemma_router,
        "validate_poemma_backup_payload",
        fake_validate_backup,
    )

    response = client.post(
        "/api/v1/desktop/poemma/workspace/import-local-backup",
        json={"backup": {"userId": "foreign-user", "entries": {}}},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "poemma_backup_wrong_user"


def test_patch_workspace_role_updates_membership(monkeypatch) -> None:
    client = _client(monkeypatch)
    captured: dict[str, object] = {}

    async def fake_update_role(
        *,
        db,
        actor_user_id,
        platform_role,
        next_role,
    ):
        del db
        captured.update(
            {
                "actor_user_id": actor_user_id,
                "platform_role": platform_role,
                "next_role": next_role,
            }
        )
        return _workspace_state(role=next_role, exists=True)

    monkeypatch.setattr(poemma_router, "update_poemma_actor_role", fake_update_role)

    response = client.patch(
        "/api/v1/desktop/poemma/workspace/role",
        json={"role": "manager"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["exists"] is True
    assert payload["role"] == "manager"
    assert captured["actor_user_id"] == ACTOR_USER_ID
    assert captured["platform_role"] == "admin"
    assert captured["next_role"] == "manager"


def test_patch_workspace_role_maps_value_error_to_400(monkeypatch) -> None:
    client = _client(monkeypatch)

    async def fake_update_role(**kwargs):
        del kwargs
        raise ValueError("poemma_invalid_role")

    monkeypatch.setattr(poemma_router, "update_poemma_actor_role", fake_update_role)

    response = client.patch(
        "/api/v1/desktop/poemma/workspace/role",
        json={"role": "invalid-role"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "poemma_invalid_role"


def test_patch_workspace_role_maps_permission_error_to_403(monkeypatch) -> None:
    client = _client(monkeypatch)

    async def fake_update_role(**kwargs):
        del kwargs
        raise PermissionError("poemma_forbidden_role_change")

    monkeypatch.setattr(poemma_router, "update_poemma_actor_role", fake_update_role)

    response = client.patch(
        "/api/v1/desktop/poemma/workspace/role",
        json={"role": "owner"},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "poemma_forbidden_role_change"


def test_patch_workspace_role_validates_empty_role_payload(monkeypatch) -> None:
    client = _client(monkeypatch)

    response = client.patch(
        "/api/v1/desktop/poemma/workspace/role",
        json={"role": ""},
    )
    assert response.status_code == 422
