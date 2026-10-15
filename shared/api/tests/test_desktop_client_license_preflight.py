# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for DesktopClientLicenseService.preflight_license / heartbeat_license (DB-free fakes).
# Invariants:
# - Expired / revoked / missing licenses fail closed with stable codes.
# - Success payload has no email / Keycloak PII fields.
# Related:
# - api/services/desktop_client/license_service.py
# - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
# ---

from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

import pytest

from api.services.desktop_client.license_service import (
    DesktopClientError,
    DesktopClientLicenseService,
)
from api.services.desktop_client.limits import SlidingTokenBucket


class _FakeConn:
    def __init__(
        self,
        *,
        license_row: dict[str, Any] | None,
        device_row: dict[str, Any] | None = None,
        active_device_count: int = 0,
        device_row_by_fingerprint: dict[str, Any] | None = None,
    ) -> None:
        self._license_row = license_row
        self._device_row = device_row
        self._active_device_count = active_device_count
        self._device_row_by_fingerprint = device_row_by_fingerprint
        self.executed: list[str] = []
        self.audits: list[str] = []

    async def fetchrow(self, query: str, *args: Any) -> dict[str, Any] | None:
        q = " ".join(query.split()).lower()
        if "from desktop_client_licenses" in q:
            return self._license_row
        if "from desktop_client_devices" in q:
            if "machine_fingerprint = $2" in q:
                return self._device_row_by_fingerprint
            return self._device_row
        return None

    async def fetchval(self, query: str, *args: Any) -> Any:
        q = " ".join(query.split()).lower()
        if "count(" in q and "desktop_client_devices" in q:
            return self._active_device_count
        return None

    async def execute(self, query: str, *args: Any) -> str:
        q = " ".join(query.split()).lower()
        self.executed.append(q)
        if "insert into desktop_client_audit" in q:
            self.audits.append(str(args[0]) if args else "")
        return "OK"


class _FakePool:
    def __init__(self, conn: _FakeConn) -> None:
        self._conn = conn

    @asynccontextmanager
    async def acquire(self):
        yield self._conn


def _service(conn: _FakeConn) -> DesktopClientLicenseService:
    return DesktopClientLicenseService(
        _FakePool(conn),  # type: ignore[arg-type]
        rate_limiter=SlidingTokenBucket(capacity=100, refill_per_sec=100),
    )


@pytest.mark.asyncio
async def test_preflight_ok_without_device() -> None:
    license_id = uuid4()
    conn = _FakeConn(
        license_row={
            "id": license_id,
            "status": "active",
            "expires_at": None,
            "allow_offline": False,
            "allow_online": True,
            "allow_fofline": False,
        }
    )
    view = await _service(conn).preflight_license(license_id=license_id, client_ip="127.0.0.1")
    assert view.ok is True
    assert view.code == "ok"
    assert view.allow_online is True
    assert view.allow_offline is False
    assert "license_preflight_ok" in conn.audits


@pytest.mark.asyncio
async def test_preflight_license_expired() -> None:
    license_id = uuid4()
    conn = _FakeConn(
        license_row={
            "id": license_id,
            "status": "active",
            "expires_at": datetime.now(UTC) - timedelta(hours=1),
            "allow_offline": False,
            "allow_online": True,
            "allow_fofline": False,
        }
    )
    with pytest.raises(DesktopClientError) as exc:
        await _service(conn).preflight_license(license_id=license_id, client_ip="127.0.0.1")
    assert exc.value.code == "license_expired"
    assert exc.value.http_status == 403
    assert "license_preflight_expired" in conn.audits


@pytest.mark.asyncio
async def test_preflight_license_revoked() -> None:
    license_id = uuid4()
    conn = _FakeConn(
        license_row={
            "id": license_id,
            "status": "revoked",
            "expires_at": None,
            "allow_offline": False,
            "allow_online": True,
            "allow_fofline": False,
        }
    )
    with pytest.raises(DesktopClientError) as exc:
        await _service(conn).preflight_license(license_id=license_id, client_ip="127.0.0.1")
    assert exc.value.code == "license_revoked"
    assert "license_preflight_revoked" in conn.audits


@pytest.mark.asyncio
async def test_heartbeat_touches_device_last_seen() -> None:
    license_id = uuid4()
    device_id = uuid4()
    conn = _FakeConn(
        license_row={
            "id": license_id,
            "status": "active",
            "expires_at": None,
            "allow_offline": True,
            "allow_online": True,
            "allow_fofline": False,
        },
        device_row={
            "id": device_id,
            "status": "active",
            "machine_fingerprint": "fp-aaaa",
        },
    )
    view = await _service(conn).heartbeat_license(
        license_id=license_id,
        device_id=device_id,
        machine_fingerprint="fp-aaaa",
        client_ip="10.0.0.1",
    )
    assert view.ok is True
    assert any("update desktop_client_devices" in q for q in conn.executed)
    assert "license_heartbeat_ok" in conn.audits


@pytest.mark.asyncio
async def test_preflight_device_revoked() -> None:
    license_id = uuid4()
    device_id = uuid4()
    conn = _FakeConn(
        license_row={
            "id": license_id,
            "status": "active",
            "expires_at": None,
            "allow_offline": False,
            "allow_online": True,
            "allow_fofline": False,
        },
        device_row={
            "id": device_id,
            "status": "revoked",
            "machine_fingerprint": "fp-aaaa",
        },
    )
    with pytest.raises(DesktopClientError) as exc:
        await _service(conn).preflight_license(
            license_id=license_id,
            device_id=device_id,
            machine_fingerprint="fp-aaaa",
            client_ip="127.0.0.1",
        )
    assert exc.value.code == "device_revoked"


@pytest.mark.asyncio
async def test_preflight_device_required_when_active_devices_exist() -> None:
    license_id = uuid4()
    conn = _FakeConn(
        license_row={
            "id": license_id,
            "status": "active",
            "expires_at": None,
            "allow_offline": False,
            "allow_online": True,
            "allow_fofline": False,
        },
        active_device_count=1,
    )
    with pytest.raises(DesktopClientError) as exc:
        await _service(conn).preflight_license(license_id=license_id, client_ip="127.0.0.1")
    assert exc.value.code == "device_required"
    assert "license_preflight_device_required" in conn.audits


@pytest.mark.asyncio
async def test_preflight_fingerprint_required_with_device() -> None:
    license_id = uuid4()
    device_id = uuid4()
    conn = _FakeConn(
        license_row={
            "id": license_id,
            "status": "active",
            "expires_at": None,
            "allow_offline": False,
            "allow_online": True,
            "allow_fofline": False,
        },
        device_row={
            "id": device_id,
            "status": "active",
            "machine_fingerprint": "fp-aaaa",
        },
    )
    with pytest.raises(DesktopClientError) as exc:
        await _service(conn).preflight_license(
            license_id=license_id,
            device_id=device_id,
            client_ip="127.0.0.1",
        )
    assert exc.value.code == "fingerprint_required"
    assert "license_preflight_fingerprint_required" in conn.audits


@pytest.mark.asyncio
async def test_preflight_resolves_device_by_fingerprint_without_device_id() -> None:
    license_id = uuid4()
    device_id = uuid4()
    conn = _FakeConn(
        license_row={
            "id": license_id,
            "status": "active",
            "expires_at": None,
            "allow_offline": False,
            "allow_online": True,
            "allow_fofline": False,
        },
        active_device_count=1,
        device_row_by_fingerprint={
            "id": device_id,
            "status": "active",
            "machine_fingerprint": "fp-aaaa",
        },
        device_row={
            "id": device_id,
            "status": "active",
            "machine_fingerprint": "fp-aaaa",
        },
    )
    view = await _service(conn).preflight_license(
        license_id=license_id,
        machine_fingerprint="fp-aaaa",
        client_ip="127.0.0.1",
    )
    assert view.ok is True
    assert "license_preflight_ok" in conn.audits


@pytest.mark.asyncio
async def test_preflight_fingerprint_mismatch() -> None:
    license_id = uuid4()
    device_id = uuid4()
    conn = _FakeConn(
        license_row={
            "id": license_id,
            "status": "active",
            "expires_at": None,
            "allow_offline": False,
            "allow_online": True,
            "allow_fofline": False,
        },
        device_row={
            "id": device_id,
            "status": "active",
            "machine_fingerprint": "fp-aaaa",
        },
    )
    with pytest.raises(DesktopClientError) as exc:
        await _service(conn).preflight_license(
            license_id=license_id,
            device_id=device_id,
            machine_fingerprint="fp-bbbb",
            client_ip="127.0.0.1",
        )
    assert exc.value.code == "device_conflict"
