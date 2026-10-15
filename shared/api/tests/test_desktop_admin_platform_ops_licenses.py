# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Admin JWT twins for license inventory / hard revoke / devices (Wave A).
# Invariants:
# - Inventory never exposes plaintext keys.
# - Revoke routes require require_admin_user (overridden in test).
# Related:
# - api/routers/desktop_admin_platform_ops.py
# - documentation/platform/docker-re_doc/ADMIN-PLATFORM-OPS.md
# ---

from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.routers import desktop_admin_platform_ops as ops_router
from api.routers.admin_auth import require_admin_user
from api.services.desktop_client import DesktopClientError
from api.services.desktop_client.license_service import (
    LicenseCapabilitiesView,
    LicenseDeviceItem,
    LicenseInventoryItem,
)


class FakeLicenseAdminService:
    def __init__(self) -> None:
        self.license_id = uuid4()
        self.device_id = uuid4()
        self.revoked_licenses: list[object] = []
        self.revoked_devices: list[object] = []

    async def list_licenses(self, *, status=None, mode=None, q=None, limit=50, offset=0):
        item = LicenseInventoryItem(
            license_id=self.license_id,
            status="active",
            edition="client",
            profile_id="client-offline-ai",
            label="pilot",
            allow_offline=True,
            allow_online=False,
            allow_fofline=False,
            allowed_email="a@example.com",
            bound_keycloak_sub=None,
            expires_at=None,
            created_at=datetime.now(UTC),
            revoked_at=None,
            device_count_active=1,
        )
        if status == "revoked":
            return [], 0
        if q and "miss" in q:
            return [], 0
        return [item], 1

    async def get_capabilities(self, *, license_id):
        if license_id != self.license_id:
            raise DesktopClientError("not_found", "License not found", http_status=404)
        return LicenseCapabilitiesView(
            license_id=self.license_id,
            status="active",
            edition="client",
            profile_id="client-offline-ai",
            apps=[],
            expires_at=None,
            label="pilot",
            allow_offline=True,
            allow_online=False,
            allow_fofline=False,
            allowed_email="a@example.com",
            bound_keycloak_sub=None,
            email_bound_at=None,
        )

    async def revoke_license(self, *, license_id, reason, client_ip):
        if license_id != self.license_id:
            raise DesktopClientError("not_found", "Active license not found", http_status=404)
        self.revoked_licenses.append((license_id, reason))

    async def list_devices(self, *, license_id):
        if license_id != self.license_id:
            raise DesktopClientError("not_found", "License not found", http_status=404)
        return [
            LicenseDeviceItem(
                device_id=self.device_id,
                license_id=self.license_id,
                status="active",
                machine_fingerprint="fp-aaaaaaaa",
                device_pubkey="pk-bbbbbbbb",
                last_seen_at=None,
                created_at=datetime.now(UTC),
                revoked_at=None,
            )
        ]

    async def revoke_device(self, *, device_id, reason, client_ip):
        if device_id != self.device_id:
            raise DesktopClientError("not_found", "Active device not found", http_status=404)
        self.revoked_devices.append((device_id, reason))


def _admin() -> SimpleNamespace:
    return SimpleNamespace(id="admin-1", sub="admin-1", role="admin")


def _client(fake: FakeLicenseAdminService) -> TestClient:
    app = FastAPI()
    app.include_router(ops_router.router, prefix="/api/v1/desktop/admin")
    app.dependency_overrides[require_admin_user] = _admin
    app.dependency_overrides[ops_router.get_license_service] = lambda: fake
    return TestClient(app)


def test_admin_list_licenses_returns_inventory_without_key() -> None:
    fake = FakeLicenseAdminService()
    client = _client(fake)
    res = client.get("/api/v1/desktop/admin/platform-ops/licenses")
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1
    assert body["licenses"][0]["license_id"] == str(fake.license_id)
    assert body["licenses"][0]["mode"] == "offline"
    assert "license_key" not in body["licenses"][0]
    assert "license_key_hash" not in body["licenses"][0]


def test_admin_revoke_license_and_device() -> None:
    fake = FakeLicenseAdminService()
    client = _client(fake)
    lid = str(fake.license_id)
    did = str(fake.device_id)

    rev = client.post(
        f"/api/v1/desktop/admin/platform-ops/licenses/{lid}/revoke",
        json={"reason": "lost seat"},
    )
    assert rev.status_code == 200
    assert rev.json() == {"ok": True, "status": "revoked"}
    assert fake.revoked_licenses == [(fake.license_id, "lost seat")]

    devices = client.get(f"/api/v1/desktop/admin/platform-ops/licenses/{lid}/devices")
    assert devices.status_code == 200
    assert devices.json()["devices"][0]["device_id"] == did

    drev = client.post(
        f"/api/v1/desktop/admin/platform-ops/licenses/{lid}/devices/{did}/revoke",
        json={"reason": "transfer"},
    )
    assert drev.status_code == 200
    assert fake.revoked_devices == [(fake.device_id, "transfer")]


def test_admin_revoke_device_wrong_license_404() -> None:
    fake = FakeLicenseAdminService()
    client = _client(fake)
    other = uuid4()
    res = client.post(
        f"/api/v1/desktop/admin/platform-ops/licenses/{other}/devices/{fake.device_id}/revoke",
        json={},
    )
    assert res.status_code == 404
