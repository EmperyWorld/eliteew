# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Wave 5 admin recovery actions for atomic identity bindings (DB-free fakes).
# Invariants:
# - Quarantine/restore never writes license status.
# - Idempotent replay returns the stored outcome.
# Related:
# - api/services/desktop_client/auth_binding_recovery.py
# ---

from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.routers import desktop_admin_platform_ops as ops_router
from api.routers.admin_auth import require_admin_user
from api.services.desktop_client import DesktopClientError
from api.services.desktop_client.auth_binding_recovery import DesktopClientAuthRecoveryService
from api.tests.test_desktop_client_auth_binding import (
    _AuthBindingFakeConn,
    _FakePool,
    _license_row,
)


def _binding_row(license_id, *, state: str = "active") -> dict:
    return {
        "id": "bind_recovery_1",
        "license_id": license_id,
        "device_id": None,
        "keycloak_sub": "kc-sub-1",
        "dpop_jkt": "jkt",
        "channel": "desktop",
        "client_id": "empery-desktop",
        "state": state,
        "authz_epoch": 3,
        "rebind_allowed_until": None,
        "last_risk_at": None,
        "updated_at": datetime.now(UTC),
    }


def _svc(conn: _AuthBindingFakeConn) -> DesktopClientAuthRecoveryService:
    return DesktopClientAuthRecoveryService(_FakePool(conn))  # type: ignore[arg-type]


@pytest.mark.asyncio
async def test_admin_quarantine_does_not_change_license_status() -> None:
    license_id = uuid4()
    conn = _AuthBindingFakeConn(
        license_row=_license_row(license_id=license_id),
        binding_row=_binding_row(license_id),
    )
    view = await _svc(conn).apply_action(
        binding_id="bind_recovery_1",
        action="quarantine_device",
        reason="device replay corroborated",
        idempotency_key="idem-quarantine-001",
        actor_sub="admin-1",
        confirm=True,
        client_ip="127.0.0.1",
    )
    assert view.state == "quarantined"
    assert view.license_status_unchanged is True
    assert conn.license_row is not None
    assert conn.license_row["status"] == "active"
    replay = await _svc(conn).apply_action(
        binding_id="bind_recovery_1",
        action="quarantine_device",
        reason="device replay corroborated",
        idempotency_key="idem-quarantine-001",
        actor_sub="admin-1",
        confirm=True,
        client_ip="127.0.0.1",
    )
    assert replay.replayed is True
    assert replay.state == "quarantined"


@pytest.mark.asyncio
async def test_admin_restore_returns_active() -> None:
    license_id = uuid4()
    conn = _AuthBindingFakeConn(
        license_row=_license_row(license_id=license_id),
        binding_row=_binding_row(license_id, state="quarantined"),
    )
    view = await _svc(conn).apply_action(
        binding_id="bind_recovery_1",
        action="restore_login",
        reason="hardware replaced after review",
        idempotency_key="idem-restore-001",
        actor_sub="admin-1",
        confirm=True,
        client_ip=None,
    )
    assert view.state == "active"
    assert conn.license_row is not None
    assert conn.license_row["status"] == "active"


@pytest.mark.asyncio
async def test_admin_end_sessions_requires_keycloak_admin(monkeypatch: pytest.MonkeyPatch) -> None:
    license_id = uuid4()
    conn = _AuthBindingFakeConn(
        license_row=_license_row(license_id=license_id),
        binding_row=_binding_row(license_id),
    )

    async def _missing_admin(_user_id: str) -> bool:
        raise ValueError("KEYCLOAK_ADMIN_PASSWORD environment variable required for admin operations")

    monkeypatch.setattr(
        "api.services.desktop_client.auth_binding_recovery.keycloak_service.logout_all_user_sessions",
        _missing_admin,
    )
    with pytest.raises(DesktopClientError) as exc:
        await _svc(conn).apply_action(
            binding_id="bind_recovery_1",
            action="end_sessions",
            reason="user reports stolen laptop",
            idempotency_key="idem-end-sessions-001",
            actor_sub="admin-1",
            confirm=True,
            client_ip=None,
        )
    assert exc.value.http_status == 503
    assert conn.bindings["bind_recovery_1"]["state"] == "active"
    assert not conn.recovery_actions


@pytest.mark.asyncio
async def test_admin_end_sessions_logs_out_keycloak_then_clears_sso(monkeypatch: pytest.MonkeyPatch) -> None:
    license_id = uuid4()
    conn = _AuthBindingFakeConn(
        license_row=_license_row(license_id=license_id),
        binding_row=_binding_row(license_id),
    )
    calls: list[str] = []

    async def _logout(user_id: str) -> bool:
        calls.append(user_id)
        return True

    monkeypatch.setattr(
        "api.services.desktop_client.auth_binding_recovery.keycloak_service.logout_all_user_sessions",
        _logout,
    )
    view = await _svc(conn).apply_action(
        binding_id="bind_recovery_1",
        action="end_sessions",
        reason="user reports stolen laptop",
        idempotency_key="idem-end-sessions-002",
        actor_sub="admin-1",
        confirm=True,
        client_ip=None,
    )
    assert view.ok is True
    assert view.keycloak_touched is True
    assert calls == ["kc-sub-1"]
    assert "bind_recovery_1:end_sessions:idem-end-sessions-002" in conn.recovery_actions


@pytest.mark.asyncio
async def test_admin_idempotency_key_is_scoped_per_binding() -> None:
    license_id = uuid4()
    conn = _AuthBindingFakeConn(
        license_row=_license_row(license_id=license_id),
        binding_row=_binding_row(license_id),
    )
    other = {
        "id": "bind_recovery_2",
        "license_id": license_id,
        "device_id": None,
        "keycloak_sub": "kc-sub-2",
        "dpop_jkt": "jkt",
        "channel": "desktop",
        "client_id": "empery-desktop",
        "state": "active",
        "authz_epoch": 1,
        "rebind_allowed_until": None,
        "last_risk_at": None,
        "updated_at": datetime.now(UTC),
    }
    conn.bindings[other["id"]] = other
    first = await _svc(conn).apply_action(
        binding_id="bind_recovery_1",
        action="quarantine_device",
        reason="device replay corroborated",
        idempotency_key="shared-idem-key-01",
        actor_sub="admin-1",
        confirm=True,
        client_ip=None,
    )
    second = await _svc(conn).apply_action(
        binding_id="bind_recovery_2",
        action="quarantine_device",
        reason="device replay corroborated",
        idempotency_key="shared-idem-key-01",
        actor_sub="admin-1",
        confirm=True,
        client_ip=None,
    )
    assert first.replayed is False
    assert second.replayed is False
    assert first.binding_id == "bind_recovery_1"
    assert second.binding_id == "bind_recovery_2"
    assert conn.bindings["bind_recovery_1"]["state"] == "quarantined"
    assert conn.bindings["bind_recovery_2"]["state"] == "quarantined"


@pytest.mark.asyncio
async def test_admin_end_sessions_bumps_epoch_without_open_tickets(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    license_id = uuid4()
    conn = _AuthBindingFakeConn(
        license_row=_license_row(license_id=license_id),
        binding_row=_binding_row(license_id),
    )
    epoch_before = conn.bindings["bind_recovery_1"]["authz_epoch"]

    async def _logout(_user_id: str) -> bool:
        return True

    monkeypatch.setattr(
        "api.services.desktop_client.auth_binding_recovery.keycloak_service.logout_all_user_sessions",
        _logout,
    )
    view = await _svc(conn).apply_action(
        binding_id="bind_recovery_1",
        action="end_sessions",
        reason="user reports stolen laptop",
        idempotency_key="idem-end-sessions-epoch",
        actor_sub="admin-1",
        confirm=True,
        client_ip=None,
    )
    assert view.ok is True
    assert view.authz_epoch == epoch_before + 1
    assert conn.bindings["bind_recovery_1"]["authz_epoch"] == epoch_before + 1


@pytest.mark.asyncio
async def test_admin_clear_kc_failures_503_when_keycloak_returns_false(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    license_id = uuid4()
    conn = _AuthBindingFakeConn(
        license_row=_license_row(license_id=license_id),
        binding_row=_binding_row(license_id),
    )

    async def _clear(_user_id: str) -> bool:
        return False

    monkeypatch.setattr(
        "api.services.desktop_client.auth_binding_recovery.keycloak_service.clear_user_brute_force",
        _clear,
    )
    with pytest.raises(DesktopClientError) as exc:
        await _svc(conn).apply_action(
            binding_id="bind_recovery_1",
            action="clear_kc_login_failures",
            reason="unlock after support review",
            idempotency_key="idem-clear-kc-false",
            actor_sub="admin-1",
            confirm=True,
            client_ip=None,
        )
    assert exc.value.http_status == 503
    assert conn.bindings["bind_recovery_1"]["state"] == "active"
    assert not conn.recovery_actions


@pytest.mark.asyncio
async def test_admin_action_requires_confirm_and_reason() -> None:
    license_id = uuid4()
    conn = _AuthBindingFakeConn(
        license_row=_license_row(license_id=license_id),
        binding_row=_binding_row(license_id),
    )
    with pytest.raises(DesktopClientError) as exc:
        await _svc(conn).apply_action(
            binding_id="bind_recovery_1",
            action="end_sessions",
            reason="long-enough-reason",
            idempotency_key="idem-end-001",
            actor_sub="admin-1",
            confirm=False,
            client_ip=None,
        )
    assert exc.value.http_status == 400


class _FakeRecovery:
    def __init__(self) -> None:
        self.license_id = uuid4()
        self.calls: list[str] = []

    async def list_bindings_for_license(self, *, license_id):
        from api.services.desktop_client.auth_binding_recovery import BindingRecoveryView

        return [
            BindingRecoveryView(
                binding_id="bind_http_1",
                license_id=self.license_id,
                device_id=None,
                client_id="empery-desktop",
                channel="desktop",
                state="restricted",
                authz_epoch=2,
                keycloak_sub="sub",
                rebind_allowed_until=None,
                last_risk_at=None,
                updated_at=datetime.now(UTC),
                events=[],
            )
        ]

    async def apply_action(self, **kwargs):
        from api.services.desktop_client.auth_binding_recovery import RecoveryActionView

        self.calls.append(str(kwargs["action"]))
        return RecoveryActionView(
            ok=True,
            action=kwargs["action"],
            binding_id=kwargs["binding_id"],
            state="quarantined",
            authz_epoch=4,
            replayed=False,
            keycloak_touched=False,
            license_status_unchanged=True,
        )


def _admin() -> SimpleNamespace:
    return SimpleNamespace(id="admin-1", sub="admin-1", role="admin")


def test_admin_auth_binding_routes_require_admin_and_do_not_touch_license() -> None:
    fake = _FakeRecovery()
    app = FastAPI()
    app.include_router(ops_router.router, prefix="/api/v1/desktop/admin")
    app.dependency_overrides[require_admin_user] = _admin
    app.dependency_overrides[ops_router.get_auth_recovery_service] = lambda: fake
    client = TestClient(app)
    listed = client.get(f"/api/v1/desktop/admin/platform-ops/licenses/{fake.license_id}/auth-bindings")
    assert listed.status_code == 200
    assert listed.json()["bindings"][0]["state"] == "restricted"
    acted = client.post(
        "/api/v1/desktop/admin/platform-ops/auth-bindings/bind_http_1/actions",
        json={
            "action": "quarantine_device",
            "reason": "corroborated replay",
            "idempotency_key": "idem-http-001",
            "confirm": True,
        },
    )
    assert acted.status_code == 200
    body = acted.json()
    assert body["license_status_unchanged"] is True
    assert body["state"] == "quarantined"
    assert fake.calls == ["quarantine_device"]
