# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Wave 6 atomic binding fleet inventory + migrate (DB-free fakes).
# Related:
# - api/services/desktop_client/auth_binding_fleet.py
# ---

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from typing import Any
from uuid import uuid4

import asyncpg
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.routers import desktop_admin_platform_ops as ops_router
from api.routers.admin_auth import require_admin_user
from api.services.desktop_client.atomic_conditional_access_contract import (
    MIGRATION_PENDING_DPOP_JKT,
    BindingState,
)
from api.services.desktop_client.auth_binding_fleet import DesktopClientAuthBindingFleetService
from api.tests.test_desktop_client_auth_binding import _FakePool, _license_row


class _Tx:
    async def __aenter__(self) -> None:
        return None

    async def __aexit__(self, *args: object) -> None:
        return None


class _FleetFakeConn:
    def __init__(
        self,
        *,
        licenses: list[dict[str, Any]],
        devices: list[dict[str, Any]] | None = None,
        bindings: list[dict[str, Any]] | None = None,
    ) -> None:
        self.licenses = licenses
        self.devices = devices or []
        self.bindings = {row["id"]: dict(row) for row in (bindings or [])}

    def transaction(self) -> _Tx:
        return _Tx()

    async def fetchrow(self, query: str, *args: Any) -> dict[str, Any] | None:
        q = " ".join(query.split()).lower()
        if "from desktop_client_licenses" in q and "count(*)" in q:
            active = [row for row in self.licenses if row.get("status") == "active"]
            return {
                "active_licenses": len(active),
                "active_allow_online": sum(1 for row in active if row.get("allow_online", True)),
                "active_allow_fofline": sum(1 for row in active if row.get("allow_fofline", False)),
                "active_with_bound_sub": sum(1 for row in active if str(row.get("bound_keycloak_sub") or "").strip()),
            }
        if "from desktop_client_devices" in q and "count(*)" in q:
            active = [row for row in self.devices if row.get("status") == "active"]
            return {
                "active_devices": len(active),
                "devices_with_pubkey": sum(1 for row in active if str(row.get("device_pubkey") or "").strip()),
            }
        if "from desktop_client_identity_bindings" in q and "count(*)" in q:
            rows = list(self.bindings.values())
            return {
                "identity_bindings": len(rows),
                "identity_bindings_active": sum(1 for row in rows if row.get("state") == "active"),
                "identity_bindings_restricted": sum(1 for row in rows if row.get("state") == "restricted"),
                "identity_bindings_pending_pop": sum(
                    1 for row in rows if row.get("dpop_jkt") == MIGRATION_PENDING_DPOP_JKT
                ),
            }
        if "from desktop_client_identity_bindings" in q and "license_id" in q:
            license_id, client_id = args[0], args[1]
            candidates = [
                row
                for row in self.bindings.values()
                if row["license_id"] == license_id and row["client_id"] == client_id and row.get("state") != "revoked"
            ]
            if not candidates:
                return None
            candidates.sort(key=lambda row: row.get("updated_at") or datetime.min.replace(tzinfo=UTC), reverse=True)
            return dict(candidates[0])
        return None

    async def fetch(self, query: str, *args: Any) -> list[dict[str, Any]]:
        q = " ".join(query.split()).lower()
        if "from desktop_client_licenses" in q and "status = 'active'" in q:
            return [dict(row) for row in self.licenses if row.get("status") == "active"]
        return []

    async def execute(self, query: str, *args: Any) -> str:
        q = " ".join(query.split()).lower()
        if "insert into desktop_client_identity_bindings" in q:
            license_id, client_id = args[1], args[5]
            for row in self.bindings.values():
                if row["license_id"] == license_id and row["client_id"] == client_id and row.get("state") != "revoked":
                    raise asyncpg.UniqueViolationError()
            binding_id = args[0]
            self.bindings[binding_id] = {
                "id": binding_id,
                "license_id": args[1],
                "device_id": None,
                "keycloak_sub": args[2],
                "dpop_jkt": args[3],
                "channel": args[4],
                "client_id": args[5],
                "state": args[6],
                "authz_epoch": 1,
                "rebind_allowed_until": args[7],
                "updated_at": datetime.now(UTC),
            }
            return "INSERT 0 1"
        return "OK"


@pytest.mark.asyncio
async def test_inventory_counts_only_no_sub_fields(monkeypatch: pytest.MonkeyPatch) -> None:
    license_id = uuid4()
    conn = _FleetFakeConn(
        licenses=[
            {
                **_license_row(license_id=license_id),
                "bound_keycloak_sub": "kc-sub-secret",
                "allow_online": True,
                "allow_fofline": True,
                "created_at": datetime.now(UTC),
            }
        ],
        devices=[],
        bindings=[],
    )
    monkeypatch.setattr(
        "api.services.desktop_client.auth_binding_fleet.keycloak_service.merge_user_attributes_by_id",
        lambda *a, **k: False,
    )
    inv = await DesktopClientAuthBindingFleetService(_FakePool(conn)).inventory()  # type: ignore[arg-type]
    assert inv.active_licenses == 1
    assert inv.active_with_bound_sub == 1
    assert inv.slots_needing_create == 2  # desktop + fofline
    assert inv.slots_skip_channel_disabled == 0
    # dataclass must not expose raw subject strings
    assert "kc-sub" not in repr(inv)


@pytest.mark.asyncio
async def test_migrate_reports_skip_channel_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    license_id = uuid4()
    conn = _FleetFakeConn(
        licenses=[
            {
                **_license_row(license_id=license_id),
                "bound_keycloak_sub": "kc-sub-1",
                "allow_online": True,
                "allow_fofline": False,
                "created_at": datetime.now(UTC),
            }
        ]
    )

    async def _sync(*_a: Any, **_k: Any) -> bool:
        return True

    monkeypatch.setattr(
        "api.services.desktop_client.auth_binding_fleet.keycloak_service.merge_user_attributes_by_id",
        _sync,
    )
    inv = await DesktopClientAuthBindingFleetService(_FakePool(conn)).inventory()  # type: ignore[arg-type]
    assert inv.slots_needing_create == 1
    assert inv.slots_skip_channel_disabled == 1
    result = await DesktopClientAuthBindingFleetService(_FakePool(conn)).migrate(dry_run=True)  # type: ignore[arg-type]
    assert result.created == 1
    assert result.skip_channel_disabled == 1


@pytest.mark.asyncio
async def test_migrate_creates_restricted_pending_pop(monkeypatch: pytest.MonkeyPatch) -> None:
    license_id = uuid4()
    conn = _FleetFakeConn(
        licenses=[
            {
                **_license_row(license_id=license_id),
                "bound_keycloak_sub": "kc-sub-1",
                "allow_online": True,
                "allow_fofline": False,
                "created_at": datetime.now(UTC),
            }
        ]
    )
    synced: list[str] = []

    async def _sync(user_id: str, attributes: dict[str, list[str]]) -> bool:
        synced.append(user_id)
        assert attributes["eliteew_binding_id"]
        return True

    monkeypatch.setattr(
        "api.services.desktop_client.auth_binding_fleet.keycloak_service.merge_user_attributes_by_id",
        _sync,
    )
    svc = DesktopClientAuthBindingFleetService(_FakePool(conn))  # type: ignore[arg-type]
    dry = await svc.migrate(dry_run=True)
    assert dry.created == 1
    assert not conn.bindings
    applied = await svc.migrate(dry_run=False)
    assert applied.created == 1
    assert applied.kc_attrs_synced == 1
    assert len(conn.bindings) == 1
    row = next(iter(conn.bindings.values()))
    assert row["state"] == BindingState.RESTRICTED.value
    assert row["dpop_jkt"] == MIGRATION_PENDING_DPOP_JKT
    assert row["keycloak_sub"] == "kc-sub-1"
    assert row["rebind_allowed_until"] > datetime.now(UTC) + timedelta(days=30)
    assert synced == ["kc-sub-1"]
    again = await svc.migrate(dry_run=False)
    assert again.created == 0
    assert again.already_migrated == 1


def test_admin_atomic_fleet_routes_require_confirm(monkeypatch: pytest.MonkeyPatch) -> None:
    license_id = uuid4()
    conn = _FleetFakeConn(
        licenses=[
            {
                **_license_row(license_id=license_id),
                "bound_keycloak_sub": "kc-sub-1",
                "allow_online": True,
                "allow_fofline": False,
                "created_at": datetime.now(UTC),
            }
        ]
    )

    async def _merge(*_a: Any, **_k: Any) -> bool:
        return True

    monkeypatch.setattr(
        "api.services.desktop_client.auth_binding_fleet.keycloak_service.merge_user_attributes_by_id",
        _merge,
    )

    app = FastAPI()
    app.include_router(ops_router.router, prefix="/api/v1/desktop/admin")
    app.dependency_overrides[require_admin_user] = lambda: SimpleNamespace(sub="admin-1")
    app.dependency_overrides[ops_router.get_auth_binding_fleet_service] = (
        lambda: DesktopClientAuthBindingFleetService(_FakePool(conn))  # type: ignore[arg-type]
    )
    client = TestClient(app)
    inv = client.get("/api/v1/desktop/admin/platform-ops/atomic-binding-fleet")
    assert inv.status_code == 200
    assert inv.json()["slots_needing_create"] == 1
    blocked = client.post(
        "/api/v1/desktop/admin/platform-ops/atomic-binding-fleet/migrate",
        json={"dry_run": False, "confirm": False},
    )
    assert blocked.status_code == 400
    ok = client.post(
        "/api/v1/desktop/admin/platform-ops/atomic-binding-fleet/migrate",
        json={"dry_run": False, "confirm": True},
    )
    assert ok.status_code == 200
    body = ok.json()
    assert body["created"] == 1
    assert body["license_status_unchanged"] is True
