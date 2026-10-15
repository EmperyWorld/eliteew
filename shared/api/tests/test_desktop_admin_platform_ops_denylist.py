# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Admin JWT soft-revoke denylist CRUD + publish (Wave B / O4).
# Invariants:
# - Soft revoke ≠ hard license revoke.
# - Publish requires signing key + updates out (fake service covers happy path).
# Related:
# - api/routers/desktop_admin_platform_ops.py
# - api/services/desktop_client/denylist_service.py
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
from api.services.desktop_client.denylist_service import (
    DenylistPublishResult,
    DenylistPublishView,
    SoftRevokeEntry,
)


class FakeDenylistService:
    def __init__(self) -> None:
        self.license_id = uuid4()
        self.entries: list[SoftRevokeEntry] = []
        self.publish_calls: list[str | None] = []

    async def list_entries(self) -> list[SoftRevokeEntry]:
        return list(self.entries)

    async def add_entry(self, *, license_id, reason, created_by):
        if str(license_id) == "00000000-0000-0000-0000-000000000099":
            raise DesktopClientError("not_found", "License not found", http_status=404)
        entry = SoftRevokeEntry(
            license_id=license_id,
            reason=reason,
            created_at=datetime.now(UTC),
            created_by=created_by,
            license_label="soft",
            license_status="active",
        )
        self.entries = [e for e in self.entries if e.license_id != license_id]
        self.entries.insert(0, entry)
        return entry

    async def remove_entry(self, *, license_id):
        before = len(self.entries)
        self.entries = [e for e in self.entries if e.license_id != license_id]
        if len(self.entries) == before:
            raise DesktopClientError("not_found", "Soft-revoke entry not found", http_status=404)

    async def status(self) -> DenylistPublishView:
        return DenylistPublishView(
            published_at=None,
            note=None,
            revoked_count=0,
            payload_hash=None,
            out_path=None,
            pending_count=len(self.entries),
            updates_out_configured=True,
            signing_key_configured=True,
        )

    async def publish(self, *, note=None) -> DenylistPublishResult:
        self.publish_calls.append(note)
        return DenylistPublishResult(
            published_at=datetime.now(UTC),
            revoked_count=len(self.entries),
            payload_hash="abc123",
            out_path="/tmp/denylist.json",
            note=note,
        )


def _admin() -> SimpleNamespace:
    return SimpleNamespace(id="admin-1", sub="admin-1", role="admin")


def _client(fake: FakeDenylistService) -> TestClient:
    app = FastAPI()
    app.include_router(ops_router.router, prefix="/api/v1/desktop/admin")
    app.dependency_overrides[require_admin_user] = _admin
    app.dependency_overrides[ops_router.get_denylist_service] = lambda: fake
    return TestClient(app)


def test_admin_denylist_status_and_add_remove() -> None:
    fake = FakeDenylistService()
    client = _client(fake)

    status = client.get("/api/v1/desktop/admin/platform-ops/denylist")
    assert status.status_code == 200
    body = status.json()
    assert body["pending_count"] == 0
    assert body["updates_out_configured"] is True
    assert body["entries"] == []

    lid = str(fake.license_id)
    added = client.post(
        "/api/v1/desktop/admin/platform-ops/denylist/entries",
        json={"license_id": lid, "reason": "lost device"},
    )
    assert added.status_code == 200
    assert added.json()["license_id"] == lid
    assert added.json()["reason"] == "lost device"

    status2 = client.get("/api/v1/desktop/admin/platform-ops/denylist")
    assert status2.json()["pending_count"] == 1
    assert len(status2.json()["entries"]) == 1

    removed = client.delete(f"/api/v1/desktop/admin/platform-ops/denylist/entries/{lid}")
    assert removed.status_code == 200
    assert removed.json() == {"ok": True, "status": "removed"}
    assert fake.entries == []


def test_admin_denylist_add_unknown_license_404() -> None:
    fake = FakeDenylistService()
    client = _client(fake)
    res = client.post(
        "/api/v1/desktop/admin/platform-ops/denylist/entries",
        json={"license_id": "00000000-0000-0000-0000-000000000099"},
    )
    assert res.status_code == 404


def test_admin_denylist_publish() -> None:
    fake = FakeDenylistService()
    client = _client(fake)
    lid = str(fake.license_id)
    client.post(
        "/api/v1/desktop/admin/platform-ops/denylist/entries",
        json={"license_id": lid},
    )
    pub = client.post(
        "/api/v1/desktop/admin/platform-ops/denylist/publish",
        json={"note": "pilot revoke"},
    )
    assert pub.status_code == 200
    body = pub.json()
    assert body["revoked_count"] == 1
    assert body["out_path"] == "/tmp/denylist.json"
    assert body["note"] == "pilot revoke"
    assert fake.publish_calls == ["pilot revoke"]
