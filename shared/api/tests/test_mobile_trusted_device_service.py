#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral tests for MobileAndroid trusted-device pairing and binding service.
# Invariants:
# - Tests never use production keys, tokens, pairing codes, or a real database.
# - Private keys stay in test memory and are never passed to the service.
# Related:
# - api.services.mobile_trusted_device_service, api.routers.mobile_trusted_devices
# ---

from __future__ import annotations

import base64
import json
import os
import time
from datetime import UTC, datetime
from types import SimpleNamespace
from uuid import UUID

import pytest
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from fastapi import HTTPException

from api.routers.mobile_trusted_devices import _require_fresh_auth
from api.schemas.mobile_trusted_devices import (
    MobileDeviceTransferOldConfirmRequest,
    MobileDeviceTransferStartRequest,
    MobileTrustedDeviceBindRequest,
)
from api.services.mobile_trusted_device_service import MobileTrustedDeviceService


@pytest.fixture(autouse=True)
def disable_edge_sync_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "api.services.mobile_private_tunnel_edge_sync.unified_settings.mobile_private_tunnel_edge_sync_enabled",
        False,
        raising=False,
    )
    monkeypatch.setattr(
        "api.services.mobile_private_tunnel_edge_sync.unified_settings.mobile_private_tunnel_edge_ssh_host",
        None,
        raising=False,
    )
    monkeypatch.setattr(
        "api.services.mobile_private_tunnel_edge_sync.unified_settings.mobile_private_tunnel_edge_ssh_private_key",
        None,
        raising=False,
    )


_USER_ID = UUID("11111111-1111-1111-1111-111111111111")
_ADMIN_ID = UUID("99999999-9999-9999-9999-999999999999")
_OLD_DEVICE_ID = UUID("33333333-3333-3333-3333-333333333333")
_NEW_DEVICE_ID = UUID("44444444-4444-4444-4444-444444444444")
_WG_ENDPOINT = "93.77.165.185:51822"
_WG_SERVER_PUBLIC_KEY = "server-public-key-test"


def _b64(raw: bytes) -> str:
    return base64.b64encode(raw).decode("ascii")


def _configure_wg(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "api.services.mobile_trusted_device_service.unified_settings.mobile_trusted_device_wg_endpoint",
        _WG_ENDPOINT,
    )
    monkeypatch.setattr(
        "api.services.mobile_trusted_device_service.unified_settings.mobile_trusted_device_wg_server_public_key",
        _WG_SERVER_PUBLIC_KEY,
    )


def test_fresh_auth_helper_requires_recent_keycloak_auth_time() -> None:
    fresh_request = SimpleNamespace(
        state=SimpleNamespace(oidc_auth_time_epoch=int(time.time())),
    )
    stale_request = SimpleNamespace(
        state=SimpleNamespace(oidc_auth_time_epoch=int(time.time()) - 3600),
    )

    _require_fresh_auth(fresh_request)  # type: ignore[arg-type]
    with pytest.raises(HTTPException) as exc:
        _require_fresh_auth(stale_request)  # type: ignore[arg-type]

    assert exc.value.status_code == 403


class _FakeTx:
    async def __aenter__(self) -> None:
        return None

    async def __aexit__(self, *_args: object) -> None:
        return None


class _FakeAcquire:
    def __init__(self, conn: _FakeConn) -> None:
        self.conn = conn

    async def __aenter__(self) -> _FakeConn:
        return self.conn

    async def __aexit__(self, *_args: object) -> None:
        return None


class _FakePool:
    def __init__(self, conn: _FakeConn) -> None:
        self.conn = conn

    def acquire(self) -> _FakeAcquire:
        return _FakeAcquire(self.conn)


class _FakeEmailNotifier:
    def __init__(self) -> None:
        self.token: str | None = None
        self.to_email: str | None = None

    async def send_transfer_confirmation(
        self,
        *,
        to_email: str,
        transfer_id: UUID,
        confirmation_token: str,
        expires_at: datetime,
    ) -> None:
        self.to_email = to_email
        self.token = confirmation_token


class _FakeConn:
    def __init__(self, *, trusted: bool = True) -> None:
        self.trusted = trusted
        self.challenges: dict[object, dict[str, object]] = {}
        self.devices: dict[object, dict[str, object]] = {}
        self.transfers: dict[object, dict[str, object]] = {}
        self.user_email = "trusted@example.com"
        self.audit: list[tuple[str, str, object | None]] = []

    def transaction(self) -> _FakeTx:
        return _FakeTx()

    async def fetchval(self, query: str, *args: object) -> object:
        if "COALESCE(is_trusted" in query:
            return self.trusted
        if "SELECT challenge_nonce" in query:
            challenge = self.challenges.get(args[0])
            return None if challenge is None else challenge["challenge_nonce"]
        if "MAX((split_part(host(wg_assigned_ip)" in query:
            return None
        if "FROM candidates c" in query or "generate_series" in query:
            used: set[int] = set()
            for device in self.devices.values():
                if device.get("status") != "active":
                    continue
                ip = device.get("wg_assigned_ip")
                if not ip:
                    continue
                used.add(int(str(ip).rsplit(".", 1)[-1]))
            start = int(args[0]) if args else 101
            for octet in range(start, 255):
                if octet not in used:
                    return octet
            return None
        if "SELECT EXISTS" in query and "public.mobile_trusted_devices" in query:
            row = self.devices.get(args[0])
            return bool(row and row.get("user_id") == args[1] and row.get("status") == "active")
        if "SELECT email FROM public.users" in query:
            return self.user_email
        raise AssertionError(f"unexpected fetchval query: {query}")

    async def execute(self, query: str, *args: object) -> str:
        if "pg_advisory_xact_lock" in query:
            return "SELECT 1"
        if "INSERT INTO public.mobile_device_pairing_challenges" in query:
            self.challenges[args[0]] = {
                "id": args[0],
                "user_id": args[1],
                "code_hash": args[2],
                "challenge_nonce": args[3],
                "status": "pending",
                "attempts": 0,
                "max_attempts": args[5],
                "expires_at": args[4],
                "metadata": args[8],
            }
            return "INSERT 0 1"
        if "INSERT INTO public.mobile_device_audit_events" in query:
            details = args[9] if len(args) > 9 else None
            if isinstance(details, str):
                try:
                    details = json.loads(details)
                except json.JSONDecodeError:
                    pass
            self.audit.append((str(args[5]), str(args[6]), details))
            return "INSERT 0 1"
        if "SET status = 'expired', updated_at = now()" in query:
            self.transfers[args[0]]["status"] = "expired"
            return "UPDATE 1"
        if "SET status = 'consumed'" in query:
            self.challenges[args[0]]["status"] = "consumed"
            return "UPDATE 1"
        if "SET attempts = attempts + 1" in query:
            self.challenges[args[0]]["attempts"] = int(self.challenges[args[0]]["attempts"]) + 1
            return "UPDATE 1"
        if "SET status = 'expired'" in query:
            self.challenges[args[0]]["status"] = "expired"
            return "UPDATE 1"
        if "SET wg_edge_sync_status = $2" in query or "SET wg_edge_sync_status" in query:
            device = self.devices.get(args[0])
            if device is not None:
                device["wg_edge_sync_status"] = args[1]
            return "UPDATE 1"
        if "UPDATE public.mobile_device_audit_events" in query and "SET details" in query:
            # Patch latest audit details after post-commit edge enqueue.
            for idx in range(len(self.audit) - 1, -1, -1):
                event_type, _result, _details = self.audit[idx]
                if event_type == str(args[1]):
                    patched = args[2]
                    if isinstance(patched, str):
                        try:
                            patched = json.loads(patched)
                        except json.JSONDecodeError:
                            pass
                    self.audit[idx] = (event_type, _result, patched)
                    break
            return "UPDATE 1"
        raise AssertionError(f"unexpected execute query: {query}")

    async def fetchrow(self, query: str, *args: object) -> dict[str, object] | None:
        if "FROM public.mobile_device_pairing_challenges" in query:
            challenge = self.challenges.get(args[0])
            return challenge
        if "SELECT *" in query and "FROM public.mobile_device_transfer_requests" in query:
            transfer = self.transfers.get(args[0])
            if transfer and (args[1] is None or transfer["user_id"] == args[1]):
                return transfer
            return None
        if "SELECT id, device_public_key_algorithm, device_public_key" in query:
            device = self.devices.get(args[0])
            if device and device.get("user_id") == args[1] and device.get("status") == "active":
                return device
            return None
        if "INSERT INTO public.mobile_trusted_devices" in query:
            now = datetime.now(tz=UTC)
            inserted: dict[str, object] = {
                "id": UUID("22222222-2222-2222-2222-222222222222"),
                "user_id": args[0],
                "stable_device_id": args[1],
                "device_label": args[2],
                "platform": "android",
                "status": "active",
                "device_public_key_fingerprint": args[5],
                "wg_public_key_fingerprint": args[7],
                "wg_assigned_ip": args[8],
                "wg_allowed_ips": args[9],
                "wg_dns": args[10],
                "wg_endpoint": args[11],
                "wg_server_public_key": args[12],
                "gaf_public_key_fingerprint": args[15],
                "capabilities": args[16],
                "metadata": args[17],
                "approved_at": now,
                "revoked_at": None,
                "last_seen_at": now,
                "created_at": now,
                "updated_at": now,
            }
            self.devices[inserted["id"]] = inserted
            return inserted
        if "INSERT INTO public.mobile_device_transfer_requests" in query:
            now = datetime.now(tz=UTC)
            row = {
                "id": args[0],
                "user_id": args[1],
                "old_device_id": args[2],
                "new_device_id": args[3],
                "status": "pending_old_device",
                "transfer_public_key": args[4],
                "transfer_public_key_algorithm": args[5],
                "transfer_public_key_fingerprint": args[6],
                "transfer_nonce": args[7],
                "encrypted_transfer_blob": None,
                "encrypted_transfer_blob_metadata": args[8],
                "old_device_signature": None,
                "old_device_confirmed_at": None,
                "admin_approved_by": None,
                "admin_approved_at": None,
                "admin_rejected_by": None,
                "admin_rejected_at": None,
                "admin_reject_reason": None,
                "email_confirmation_token_hash": None,
                "email_confirmation_sent_at": None,
                "email_confirmation_expires_at": None,
                "email_confirmation_to": None,
                "email_confirmed_at": None,
                "completed_at": None,
                "expires_at": args[9],
                "created_at": now,
                "updated_at": now,
            }
            self.transfers[row["id"]] = row
            return row
        if "SET status = 'pending_admin'" in query:
            row = self.transfers[args[0]]
            row.update(
                {
                    "status": "pending_admin",
                    "encrypted_transfer_blob": args[1],
                    "encrypted_transfer_blob_metadata": args[2],
                    "old_device_signature": args[3],
                    "old_device_confirmed_at": datetime.now(tz=UTC),
                    "updated_at": datetime.now(tz=UTC),
                }
            )
            return row
        if "SET status = 'pending_user_email'" in query:
            row = self.transfers[args[0]]
            row.update(
                {
                    "status": "pending_user_email",
                    "admin_approved_by": args[1],
                    "admin_approved_at": datetime.now(tz=UTC),
                    "email_confirmation_token_hash": args[2],
                    "email_confirmation_sent_at": datetime.now(tz=UTC),
                    "email_confirmation_expires_at": args[3],
                    "email_confirmation_to": args[4],
                    "updated_at": datetime.now(tz=UTC),
                }
            )
            return row
        if "SET status = 'ready_for_new_device'" in query:
            row = self.transfers[args[0]]
            row.update(
                {
                    "status": "ready_for_new_device",
                    "email_confirmed_at": datetime.now(tz=UTC),
                    "updated_at": datetime.now(tz=UTC),
                }
            )
            return row
        if "SET status = 'completed'" in query:
            row = self.transfers[args[0]]
            row.update(
                {
                    "status": "completed",
                    "completed_at": datetime.now(tz=UTC),
                    "updated_at": datetime.now(tz=UTC),
                }
            )
            return row
        if (
            "FROM public.mobile_trusted_devices" in query
            and "status = 'active'" in query
            and "ORDER BY created_at DESC" in query
        ):
            active = [
                row for row in self.devices.values() if row.get("user_id") == args[0] and row.get("status") == "active"
            ]
            if not active:
                return None
            active.sort(key=lambda row: row.get("created_at") or datetime.min.replace(tzinfo=UTC), reverse=True)
            return active[0]
        if (
            "UPDATE public.mobile_trusted_devices" in query
            and "wg_server_public_key = $3" in query
            and "RETURNING *" in query
        ):
            device = self.devices.get(args[0])
            if device is None:
                return None
            now = datetime.now(tz=UTC)
            device.update(
                {
                    "wg_endpoint": args[1],
                    "wg_server_public_key": args[2],
                    "wg_dns": args[3],
                    "wg_allowed_ips": args[4],
                    "updated_at": now,
                }
            )
            return device
        if (
            "FROM public.mobile_trusted_devices" in query
            and "UPDATE" not in query
            and "INSERT" not in query
            and "SELECT *" in query
        ):
            device = self.devices.get(args[0])
            if device and device.get("user_id") == args[1]:
                return device
            return None
        if "UPDATE public.mobile_trusted_devices" in query and "status = 'revoked'" in query:
            device = self.devices.get(args[0])
            if not device or device.get("user_id") != args[1]:
                return None
            if device.get("status") != "active":
                return None
            now = datetime.now(tz=UTC)
            device.update(
                {
                    "status": "revoked",
                    "revoked_by": args[2],
                    "revoked_at": now,
                    "revoke_reason": (args[3] or None) if len(args) > 3 else None,
                    "updated_at": now,
                }
            )
            return device
        raise AssertionError(f"unexpected fetchrow query: {query}")

    async def fetch(self, query: str, *args: object) -> list[dict[str, object]]:
        if "FROM public.mobile_device_pairing_challenges" in query:
            now = datetime.now(tz=UTC)
            pending: list[dict[str, object]] = []
            for row in self.challenges.values():
                if row["user_id"] != args[0] or row["status"] != "pending":
                    continue
                expires_at = row["expires_at"]
                if not isinstance(expires_at, datetime) or expires_at <= now:
                    continue
                attempts = int(row["attempts"])  # type: ignore[arg-type]
                max_attempts = int(row["max_attempts"])  # type: ignore[arg-type]
                if attempts < max_attempts:
                    pending.append(row)
            return pending[-5:]
        if "FROM public.mobile_trusted_devices" in query:
            include_inactive = bool(args[1]) if len(args) > 1 else True
            return [
                row
                for row in self.devices.values()
                if row["user_id"] == args[0] and (include_inactive or row["status"] == "active")
            ]
        if "FROM public.mobile_device_transfer_requests" in query:
            return list(self.transfers.values())
        raise AssertionError(f"unexpected fetch query: {query}")


@pytest.mark.anyio
async def test_create_pairing_challenge_requires_trusted_user() -> None:
    service = MobileTrustedDeviceService(_FakePool(_FakeConn(trusted=False)))  # type: ignore[arg-type]

    with pytest.raises(HTTPException) as exc:
        await service.create_pairing_challenge(
            user_id=_USER_ID,
            ip_address="127.0.0.1",
            user_agent="pytest",
        )

    assert exc.value.status_code == 403


@pytest.mark.anyio
async def test_create_pairing_challenge_hashes_pairing_code() -> None:
    conn = _FakeConn()
    service = MobileTrustedDeviceService(_FakePool(conn))  # type: ignore[arg-type]

    response = await service.create_pairing_challenge(
        user_id=_USER_ID,
        ip_address="127.0.0.1",
        user_agent="pytest",
        prepare_gaf_e2ee=True,
    )

    challenge = conn.challenges[response["challenge_id"]]
    assert len(response["pairing_code"]) == 8
    assert challenge["code_hash"] != response["pairing_code"]
    assert response["pairing_code"] in response["qr_payload"]["pairing_code"]
    assert ("pairing_challenge_created", "ok") in [(event, result) for event, result, _ in conn.audit]


@pytest.mark.anyio
async def test_resolve_pairing_challenge_accepts_code_only() -> None:
    conn = _FakeConn()
    service = MobileTrustedDeviceService(_FakePool(conn))  # type: ignore[arg-type]
    challenge = await service.create_pairing_challenge(
        user_id=_USER_ID,
        ip_address="127.0.0.1",
        user_agent="pytest",
        prepare_gaf_e2ee=True,
    )

    resolved = await service.resolve_pairing_challenge(
        user_id=_USER_ID,
        pairing_code=str(challenge["pairing_code"]),
        ip_address="127.0.0.1",
        user_agent="pytest",
    )

    assert resolved["challenge_id"] == challenge["challenge_id"]
    assert resolved["challenge_nonce"] == challenge["challenge_nonce"]
    assert resolved["prepare_gaf_e2ee"] is True
    assert ("pairing_challenge_resolved", "ok") in [(event, result) for event, result, _ in conn.audit]


@pytest.mark.anyio
async def test_bind_device_consumes_challenge_and_creates_active_device(monkeypatch: pytest.MonkeyPatch) -> None:
    _configure_wg(monkeypatch)
    conn = _FakeConn()
    service = MobileTrustedDeviceService(_FakePool(conn))  # type: ignore[arg-type]
    challenge = await service.create_pairing_challenge(user_id=_USER_ID, ip_address=None, user_agent=None)
    private_key = Ed25519PrivateKey.generate()
    public_key = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )
    signature = private_key.sign(str(challenge["challenge_nonce"]).encode("utf-8"))
    body = MobileTrustedDeviceBindRequest(
        challenge_id=challenge["challenge_id"],
        pairing_code=challenge["pairing_code"],
        stable_device_id="device-stable-1",
        device_label="Honor VNE-LX1",
        device_public_key=_b64(public_key),
        device_public_key_algorithm="ed25519",
        signed_challenge=_b64(signature),
        wg_public_key=_b64(os.urandom(32)),
        gaf_public_key=_b64(os.urandom(32)),
        gaf_public_key_algorithm="x25519",
        capabilities={"screen_lock": True, "biometric": True},
    )

    result = await service.bind_device(
        user_id=_USER_ID,
        body=body,
        ip_address="127.0.0.1",
        user_agent="pytest",
    )

    assert conn.challenges[challenge["challenge_id"]]["status"] == "consumed"
    assert result.device.status == "active"
    assert result.device.device_label == "Honor VNE-LX1"
    assert result.device.wg_assigned_ip == "10.88.88.101"
    assert result.gaf_e2ee_ready is True
    assert result.tunnel["status"] == "ready"
    assert result.tunnel["edge_sync_status"] == "manual_required"
    assert result.tunnel["mtu"] == 1280
    assert result.tunnel["interface_address"] == "10.88.88.101/32"
    assert result.tunnel["endpoint"] == _WG_ENDPOINT
    assert result.tunnel["server_public_key"] == _WG_SERVER_PUBLIC_KEY
    bound_audit = next(
        (entry for entry in conn.audit if entry[0] == "device_bound" and entry[1] == "ok"),
        None,
    )
    assert bound_audit is not None
    assert isinstance(bound_audit[2], dict)
    assert bound_audit[2]["edge_peer_deploy_required"] is True
    assert "render-db-peers.sh" in bound_audit[2]["operator_action"]
    assert bound_audit[2]["edge_peer_sync_mode"] == "manual_operator"
    assert ("device_bound", "ok") in [(event, result) for event, result, _ in conn.audit]


@pytest.mark.anyio
async def test_bind_device_schedules_edge_sync_when_automation_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    _configure_wg(monkeypatch)
    monkeypatch.setattr(
        "api.services.mobile_trusted_device_service.edge_sync_enqueue_ready",
        lambda: True,
    )
    monkeypatch.setattr(
        "api.services.mobile_private_tunnel_edge_sync.edge_sync_enqueue_ready",
        lambda: True,
    )
    scheduled: list[dict[str, object]] = []

    def _capture_schedule(**kwargs: object) -> bool:
        scheduled.append(dict(kwargs))
        return True

    monkeypatch.setattr(
        "api.services.mobile_private_tunnel_edge_sync.schedule_mobile_wg_edge_reconcile",
        _capture_schedule,
    )
    conn = _FakeConn()
    service = MobileTrustedDeviceService(_FakePool(conn))  # type: ignore[arg-type]
    challenge = await service.create_pairing_challenge(user_id=_USER_ID, ip_address=None, user_agent=None)
    private_key = Ed25519PrivateKey.generate()
    public_key = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )
    signature = private_key.sign(str(challenge["challenge_nonce"]).encode("utf-8"))
    body = MobileTrustedDeviceBindRequest(
        challenge_id=challenge["challenge_id"],
        pairing_code=challenge["pairing_code"],
        stable_device_id="device-stable-edge-sync",
        device_label="Edge sync phone",
        device_public_key=_b64(public_key),
        device_public_key_algorithm="ed25519",
        signed_challenge=_b64(signature),
        wg_public_key=_b64(os.urandom(32)),
        capabilities={"screen_lock": True},
    )

    await service.bind_device(
        user_id=_USER_ID,
        body=body,
        ip_address="127.0.0.1",
        user_agent="pytest",
    )

    bound_audit = next(
        (entry for entry in conn.audit if entry[0] == "device_bound" and entry[1] == "ok"),
        None,
    )
    assert bound_audit is not None
    assert isinstance(bound_audit[2], dict)
    assert bound_audit[2]["edge_peer_sync_scheduled"] is True
    assert bound_audit[2]["edge_peer_sync_mode"] == "celery_ssh"
    assert "edge_peer_deploy_required" not in bound_audit[2]
    assert len(scheduled) == 1
    assert scheduled[0]["trigger"] == "device_bound"


@pytest.mark.anyio
async def test_bind_device_rejects_incomplete_wireguard_config_without_consuming_challenge(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "api.services.mobile_trusted_device_service.unified_settings.mobile_trusted_device_wg_endpoint",
        None,
    )
    monkeypatch.setattr(
        "api.services.mobile_trusted_device_service.unified_settings.mobile_trusted_device_wg_server_public_key",
        None,
    )
    conn = _FakeConn()
    service = MobileTrustedDeviceService(_FakePool(conn))  # type: ignore[arg-type]
    challenge = await service.create_pairing_challenge(user_id=_USER_ID, ip_address=None, user_agent=None)
    private_key = Ed25519PrivateKey.generate()
    public_key = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )
    signature = private_key.sign(str(challenge["challenge_nonce"]).encode("utf-8"))
    body = MobileTrustedDeviceBindRequest(
        challenge_id=challenge["challenge_id"],
        pairing_code=challenge["pairing_code"],
        stable_device_id="device-stable-no-wg-config",
        device_label="No WG config phone",
        device_public_key=_b64(public_key),
        device_public_key_algorithm="ed25519",
        signed_challenge=_b64(signature),
        wg_public_key=_b64(os.urandom(32)),
        capabilities={"screen_lock": True},
    )

    with pytest.raises(HTTPException) as exc:
        await service.bind_device(user_id=_USER_ID, body=body, ip_address=None, user_agent=None)

    assert exc.value.status_code == 503
    assert conn.challenges[challenge["challenge_id"]]["status"] == "pending"
    assert conn.devices == {}


@pytest.mark.anyio
async def test_bind_device_accepts_android_keystore_p256_signature(monkeypatch: pytest.MonkeyPatch) -> None:
    _configure_wg(monkeypatch)
    conn = _FakeConn()
    service = MobileTrustedDeviceService(_FakePool(conn))  # type: ignore[arg-type]
    challenge = await service.create_pairing_challenge(user_id=_USER_ID, ip_address=None, user_agent=None)
    private_key = ec.generate_private_key(ec.SECP256R1())
    public_key = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.DER,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    signature = private_key.sign(str(challenge["challenge_nonce"]).encode("utf-8"), ec.ECDSA(hashes.SHA256()))
    body = MobileTrustedDeviceBindRequest(
        challenge_id=challenge["challenge_id"],
        pairing_code=challenge["pairing_code"],
        stable_device_id="device-stable-p256",
        device_label="Android Keystore Device",
        device_public_key=_b64(public_key),
        device_public_key_algorithm="p256-es256",
        signed_challenge=_b64(signature),
        wg_public_key=_b64(os.urandom(32)),
        capabilities={"screen_lock": True, "biometric": False},
    )

    result = await service.bind_device(user_id=_USER_ID, body=body, ip_address=None, user_agent=None)

    assert result.device.status == "active"
    assert result.device.device_label == "Android Keystore Device"


@pytest.mark.anyio
async def test_list_devices_hides_revoked_by_default_but_admin_can_include_history() -> None:
    conn = _FakeConn()
    now = datetime.now(tz=UTC)
    active_device = {
        "id": UUID("22222222-2222-2222-2222-222222222222"),
        "user_id": _USER_ID,
        "stable_device_id": "active-stable",
        "device_label": "Active phone",
        "platform": "android",
        "status": "active",
        "device_public_key_fingerprint": "active-device-fp",
        "wg_public_key_fingerprint": "active-wg-fp",
        "wg_assigned_ip": "10.88.88.101",
        "wg_allowed_ips": "10.88.88.1/32",
        "wg_dns": "10.88.88.1",
        "wg_endpoint": None,
        "wg_server_public_key": None,
        "gaf_public_key_fingerprint": None,
        "capabilities": {},
        "metadata": {},
        "approved_at": now,
        "revoked_at": None,
        "last_seen_at": now,
        "created_at": now,
        "updated_at": now,
    }
    revoked_device = {
        **active_device,
        "id": UUID("55555555-5555-5555-5555-555555555555"),
        "stable_device_id": "revoked-stable",
        "device_label": "Revoked phone",
        "status": "revoked",
        "revoked_at": now,
    }
    conn.devices[active_device["id"]] = active_device
    conn.devices[revoked_device["id"]] = revoked_device
    service = MobileTrustedDeviceService(_FakePool(conn))  # type: ignore[arg-type]

    user_items = await service.list_devices(user_id=_USER_ID)
    admin_items = await service.list_devices(user_id=_USER_ID, include_inactive=True)

    assert [item.device_label for item in user_items] == ["Active phone"]
    assert {item.device_label for item in admin_items} == {"Active phone", "Revoked phone"}


@pytest.mark.anyio
async def test_get_active_tunnel_metadata_returns_live_config_and_heals_db(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _configure_wg(monkeypatch)
    conn = _FakeConn()
    now = datetime.now(tz=UTC)
    device_id = UUID("22222222-2222-2222-2222-222222222222")
    conn.devices[device_id] = {
        "id": device_id,
        "user_id": _USER_ID,
        "stable_device_id": "active-stable",
        "device_label": "Active phone",
        "platform": "android",
        "status": "active",
        "device_public_key_fingerprint": "active-device-fp",
        "wg_public_key_fingerprint": "active-wg-fp",
        "wg_assigned_ip": "10.88.88.101",
        "wg_allowed_ips": "10.88.88.1/32",
        "wg_dns": "10.88.88.1",
        "wg_endpoint": "old-endpoint:51822",
        "wg_server_public_key": "stale-server-key",
        "gaf_public_key_fingerprint": None,
        "capabilities": {},
        "metadata": {},
        "approved_at": now,
        "revoked_at": None,
        "last_seen_at": now,
        "created_at": now,
        "updated_at": now,
    }
    service = MobileTrustedDeviceService(_FakePool(conn))  # type: ignore[arg-type]

    item, tunnel = await service.get_active_tunnel_metadata(user_id=_USER_ID)

    assert item.id == device_id
    assert tunnel["server_public_key"] == _WG_SERVER_PUBLIC_KEY
    assert tunnel["endpoint"] == _WG_ENDPOINT
    assert conn.devices[device_id]["wg_server_public_key"] == _WG_SERVER_PUBLIC_KEY
    assert conn.devices[device_id]["wg_endpoint"] == _WG_ENDPOINT


@pytest.mark.anyio
async def test_get_active_tunnel_metadata_404_without_active_device() -> None:
    conn = _FakeConn()
    service = MobileTrustedDeviceService(_FakePool(conn))  # type: ignore[arg-type]

    with pytest.raises(HTTPException) as exc:
        await service.get_active_tunnel_metadata(user_id=_USER_ID)

    assert exc.value.status_code == 404


@pytest.mark.anyio
async def test_revoke_device_is_idempotent_when_already_revoked() -> None:
    conn = _FakeConn()
    now = datetime.now(tz=UTC)
    device_id = UUID("55555555-5555-5555-5555-555555555555")
    conn.devices[device_id] = {
        "id": device_id,
        "user_id": _USER_ID,
        "stable_device_id": "revoked-stable",
        "device_label": "Revoked phone",
        "platform": "android",
        "status": "revoked",
        "device_public_key_fingerprint": "revoked-device-fp",
        "wg_public_key_fingerprint": "revoked-wg-fp",
        "wg_assigned_ip": "10.88.88.101",
        "wg_allowed_ips": "10.88.88.1/32",
        "wg_dns": "10.88.88.1",
        "wg_endpoint": None,
        "wg_server_public_key": None,
        "gaf_public_key_fingerprint": None,
        "capabilities": {},
        "metadata": {},
        "approved_at": now,
        "revoked_at": now,
        "last_seen_at": now,
        "created_at": now,
        "updated_at": now,
    }
    service = MobileTrustedDeviceService(_FakePool(conn))  # type: ignore[arg-type]

    item = await service.revoke_device(
        user_id=_USER_ID,
        device_id=device_id,
        actor_user_id=_USER_ID,
        reason="retry",
        ip_address="127.0.0.1",
        user_agent="pytest",
    )

    assert item.status == "revoked"
    assert item.id == device_id
    assert conn.audit == []


@pytest.mark.anyio
async def test_transfer_requires_old_device_signature_admin_email_and_new_device_complete() -> None:
    conn = _FakeConn()
    notifier = _FakeEmailNotifier()
    service = MobileTrustedDeviceService(_FakePool(conn), email_notifier=notifier)  # type: ignore[arg-type]
    private_key = Ed25519PrivateKey.generate()
    public_key = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )
    now = datetime.now(tz=UTC)
    conn.devices[_OLD_DEVICE_ID] = {
        "id": _OLD_DEVICE_ID,
        "user_id": _USER_ID,
        "status": "active",
        "device_public_key_algorithm": "ed25519",
        "device_public_key": _b64(public_key),
        "device_label": "Old phone",
        "stable_device_id": "old-stable",
        "platform": "android",
        "device_public_key_fingerprint": "old-device-fp",
        "wg_public_key_fingerprint": "old-wg-fp",
        "wg_assigned_ip": "10.88.88.101",
        "wg_allowed_ips": "10.88.88.1/32",
        "wg_dns": "10.88.88.1",
        "wg_endpoint": None,
        "wg_server_public_key": None,
        "gaf_public_key_fingerprint": "old-gaf-fp",
        "capabilities": {},
        "metadata": {},
        "approved_at": now,
        "revoked_at": None,
        "last_seen_at": now,
        "created_at": now,
        "updated_at": now,
    }
    conn.devices[_NEW_DEVICE_ID] = {
        **conn.devices[_OLD_DEVICE_ID],
        "id": _NEW_DEVICE_ID,
        "device_label": "New phone",
        "stable_device_id": "new-stable",
        "device_public_key_fingerprint": "new-device-fp",
        "wg_public_key_fingerprint": "new-wg-fp",
        "wg_assigned_ip": "10.88.88.102",
        "gaf_public_key_fingerprint": None,
    }

    started = await service.start_transfer(
        user_id=_USER_ID,
        body=MobileDeviceTransferStartRequest(
            old_device_id=_OLD_DEVICE_ID,
            new_device_id=_NEW_DEVICE_ID,
            transfer_public_key=_b64(os.urandom(32)),
        ),
        ip_address="127.0.0.1",
        user_agent="pytest",
    )
    transfer_row = conn.transfers[started.id]
    signature = private_key.sign(service._transfer_signature_message(transfer_row).encode("utf-8"))

    old_confirmed = await service.confirm_transfer_old_device(
        user_id=_USER_ID,
        transfer_id=started.id,
        body=MobileDeviceTransferOldConfirmRequest(
            signed_transfer_nonce=_b64(signature),
            encrypted_transfer_blob=_b64(os.urandom(64)),
            encrypted_transfer_blob_metadata={"format": "test-envelope-v1"},
        ),
        ip_address="127.0.0.1",
        user_agent="pytest",
    )
    assert old_confirmed.status == "pending_admin"

    admin_approved = await service.admin_approve_transfer(
        transfer_id=started.id,
        admin_user_id=_ADMIN_ID,
        ip_address="127.0.0.1",
        user_agent="pytest",
    )
    assert admin_approved.status == "pending_user_email"
    assert notifier.to_email == conn.user_email
    assert notifier.token is not None
    assert conn.transfers[started.id]["email_confirmation_token_hash"] != notifier.token

    email_confirmed = await service.confirm_transfer_email(
        user_id=_USER_ID,
        transfer_id=started.id,
        confirmation_token=notifier.token,
        ip_address="127.0.0.1",
        user_agent="pytest",
    )
    assert email_confirmed.status == "ready_for_new_device"

    completed = await service.complete_transfer(
        user_id=_USER_ID,
        transfer_id=started.id,
        new_device_id=_NEW_DEVICE_ID,
        ip_address="127.0.0.1",
        user_agent="pytest",
    )
    assert completed.transfer.status == "completed"
    assert completed.encrypted_transfer_blob == conn.transfers[started.id]["encrypted_transfer_blob"]
    assert ("transfer_completed", "ok") in [(event, result) for event, result, _ in conn.audit]
