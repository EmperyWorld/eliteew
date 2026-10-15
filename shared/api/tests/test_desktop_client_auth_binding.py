# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Wave 1 tests for desktop atomic auth binding service + HTTP routes (DB-free fakes).
# Invariants:
# - Public denials use auth_policy_denied; SPI routes require binding token.
# Related:
# - api/services/desktop_client/auth_binding.py
# - documentation/product/desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md
# ---

from __future__ import annotations

import re
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.middleware.oauth2_protection import (
    OAuth2ProtectionMiddleware,
    build_public_path_strings,
    build_route_auth_path_strings,
)
from api.routers.desktop_client import auth_binding as auth_binding_router
from api.routers.desktop_client import router as desktop_client_router
from api.services.desktop_client import DesktopClientError
from api.services.desktop_client.auth_binding import (
    AuthTicketView,
    DesktopClientAuthBindingService,
)
from api.services.desktop_client.auth_binding_crypto import build_ticket_transcript
from api.services.desktop_client.limits import ChallengeStore, SlidingTokenBucket


class _Tx:
    async def __aenter__(self) -> None:
        return None

    async def __aexit__(self, *args: object) -> None:
        return None


class _AuthBindingFakeConn:
    def __init__(
        self,
        *,
        license_row: dict[str, Any] | None,
        device_row: dict[str, Any] | None = None,
        binding_row: dict[str, Any] | None = None,
    ) -> None:
        self.license_row = license_row
        self.device_row = device_row
        self.binding_row = binding_row
        self.tickets: dict[str, dict[str, Any]] = {}
        self.bindings: dict[str, dict[str, Any]] = {}
        if binding_row:
            self.bindings[binding_row["id"]] = dict(binding_row)
        self.audits: list[str] = []
        self.risk_events: list[dict[str, Any]] = []
        self.recovery_actions: dict[str, dict[str, Any]] = {}
        self.license_status_writes: int = 0

    def transaction(self) -> _Tx:
        return _Tx()

    async def fetchrow(self, query: str, *args: Any) -> dict[str, Any] | None:
        q = " ".join(query.split()).lower()
        if "from desktop_client_licenses" in q:
            return self.license_row
        if "from desktop_client_devices" in q:
            if self.device_row is None:
                return None
            if "lower(device_pubkey)" in q:
                want = str(args[1]).strip().lower()
                have = str(self.device_row.get("device_pubkey") or "").strip().lower()
                if have != want or self.device_row.get("status") != "active":
                    return None
                return dict(self.device_row)
            if len(args) >= 2 and self.device_row.get("id") not in {args[1], args[0]}:
                if self.device_row.get("id") != args[1]:
                    return None
            return dict(self.device_row)
        if "from desktop_client_auth_tickets" in q and "transcript_jti" in q:
            jti = args[0]
            for row in self.tickets.values():
                if row.get("transcript_jti") == jti:
                    return {"id": row["id"]}
            return None
        if "from desktop_client_admin_recovery_actions" in q:
            key = args[0]
            row = self.recovery_actions.get(key)
            if row is None:
                return None
            return {
                "outcome_json": row["outcome_json"],
                "action": row.get("action"),
                "binding_id": row.get("binding_id"),
            }
        if "from desktop_client_auth_tickets" in q and "where idempotency_key" in q:
            key = args[0]
            for row in self.tickets.values():
                if row.get("idempotency_key") == key and row.get("idempotency_outcome_json"):
                    return {
                        "ticket_hash": row["ticket_hash"],
                        "idempotency_outcome_json": row["idempotency_outcome_json"],
                    }
            return None
        if "from desktop_client_auth_tickets" in q and "ticket_hash" in q:
            ticket_hash = args[0]
            for row in self.tickets.values():
                if row["ticket_hash"] == ticket_hash:
                    return dict(row)
            return None
        if "from desktop_client_identity_bindings" in q:
            if "where b.id = $1" in q:
                binding_id = args[0]
                row = self.bindings.get(binding_id)
                if row is None:
                    return None
                merged = dict(row)
                if self.license_row:
                    merged.update(
                        {
                            "license_status": self.license_row["status"],
                            "expires_at": self.license_row.get("expires_at"),
                            "allow_online": self.license_row.get("allow_online", True),
                            "allow_fofline": self.license_row.get("allow_fofline", False),
                        }
                    )
                return merged
            if "where id = $1" in q and len(args) == 1:
                row = self.bindings.get(args[0])
                return dict(row) if row else None
            license_id, client_id = args[0], args[1]
            for row in self.bindings.values():
                if row["license_id"] == license_id and row["client_id"] == client_id:
                    if "state <> 'revoked'" in q and row.get("state") == "revoked":
                        continue
                    return dict(row)
            if self.binding_row and self.binding_row.get("license_id") == license_id:
                if "state <> 'revoked'" in q and self.binding_row.get("state") == "revoked":
                    return None
                return dict(self.binding_row)
            return None
        return None

    async def fetch(self, query: str, *args: Any) -> list[dict[str, Any]]:
        q = " ".join(query.split()).lower()
        if "from desktop_client_identity_bindings" in q and "where license_id" in q:
            license_id = args[0]
            return [dict(row) for row in self.bindings.values() if row["license_id"] == license_id]
        if "from desktop_client_auth_risk_events" in q:
            binding_id = args[0]
            return [dict(ev) for ev in self.risk_events if ev.get("binding_id") == binding_id]
        return []

    async def execute(self, query: str, *args: Any) -> str:
        q = " ".join(query.split()).lower()
        if "insert into desktop_client_auth_tickets" in q:
            ticket_id = args[0]
            self.tickets[ticket_id] = {
                "id": ticket_id,
                "ticket_hash": args[1],
                "license_id": args[2],
                "device_id": args[3],
                "client_id": args[4],
                "channel": args[5],
                "dpop_jkt": args[6],
                "pkce_challenge": args[7],
                "redirect_uri_hash": args[8],
                "device_pubkey": args[9],
                "expires_at": args[10],
                "consumed_at": None,
                "keycloak_auth_session_id": None,
                "idempotency_key": None,
                "idempotency_outcome_json": {},
                "transcript_jti": args[11] if len(args) > 11 else None,
            }
        elif "insert into desktop_client_identity_bindings" in q:
            binding_id = args[0]
            if "rebind_allowed_until" in q:
                # Wave 6 fleet migrate insert
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
                    "last_risk_at": None,
                    "updated_at": datetime.now(UTC),
                }
            else:
                self.bindings[binding_id] = {
                    "id": binding_id,
                    "license_id": args[1],
                    "device_id": args[2],
                    "keycloak_sub": args[3],
                    "dpop_jkt": args[4],
                    "channel": args[5],
                    "client_id": args[6],
                    "state": "active",
                    "authz_epoch": args[7],
                    "rebind_allowed_until": None,
                    "last_risk_at": None,
                    "updated_at": datetime.now(UTC),
                }
            self.binding_row = self.bindings[binding_id]
        elif "update desktop_client_auth_tickets" in q and "risk_revoked" in q:
            n = 0
            for row in self.tickets.values():
                if row.get("consumed_at") is None and row["license_id"] == args[0]:
                    row["consumed_at"] = datetime.now(UTC)
                    row["consumed_outcome"] = "risk_revoked"
                    n += 1
            return f"UPDATE {n}"
        elif "update desktop_client_identity_bindings" in q and "last_risk_at" in q:
            binding_id = args[0]
            if binding_id in self.bindings:
                if args[1] is not None:
                    self.bindings[binding_id]["state"] = args[1]
                self.bindings[binding_id]["authz_epoch"] = args[2]
                self.bindings[binding_id]["last_risk_at"] = datetime.now(UTC)
        elif "update desktop_client_identity_bindings" in q and "rebind_allowed_until = $2" in q:
            binding_id = args[0]
            if binding_id in self.bindings:
                self.bindings[binding_id]["rebind_allowed_until"] = args[1]
        elif (
            "update desktop_client_identity_bindings" in q
            and "rebind_allowed_until = null" in q
            and "keycloak_sub" not in q
        ):
            binding_id = args[0]
            if binding_id in self.bindings:
                self.bindings[binding_id]["rebind_allowed_until"] = None
        elif "insert into desktop_client_auth_risk_events" in q:
            self.risk_events.append(
                {
                    "id": args[0],
                    "kind": args[1],
                    "binding_id": args[2],
                    "license_id": args[3],
                    "device_id": args[4],
                    "keycloak_sub": args[5],
                    "client_ip": args[6],
                    "corroborated": args[7],
                    "resulting_state": args[8],
                    "tickets_revoked": args[9],
                    "epoch_after": args[10],
                    "created_at": datetime.now(UTC),
                }
            )
        elif "insert into desktop_client_admin_recovery_actions" in q:
            self.recovery_actions[args[0]] = {
                "action": args[1],
                "binding_id": args[2],
                "outcome_json": args[5],
            }
        elif "delete from sso_user_sessions" in q:
            pass
        elif "update desktop_client_auth_tickets" in q and "keycloak_auth_session_id" in q:
            ticket_id = args[0]
            if ticket_id in self.tickets:
                self.tickets[ticket_id]["keycloak_auth_session_id"] = args[1]
        elif "update desktop_client_auth_tickets" in q and "consumed_at" in q:
            ticket_id = args[0]
            if ticket_id in self.tickets:
                self.tickets[ticket_id]["consumed_at"] = datetime.now(UTC)
                self.tickets[ticket_id]["consumed_outcome"] = args[1]
        elif "update desktop_client_auth_tickets" in q and "set idempotency_key = null" in q:
            key = args[0]
            for row in self.tickets.values():
                if row.get("idempotency_key") == key:
                    row["idempotency_key"] = None
        elif "update desktop_client_auth_tickets" in q and "idempotency_key" in q:
            ticket_id = args[0]
            if ticket_id in self.tickets:
                self.tickets[ticket_id]["idempotency_key"] = args[1]
                self.tickets[ticket_id]["idempotency_outcome_json"] = args[2]
        elif "update desktop_client_identity_bindings" in q:
            binding_id = args[0]
            if binding_id in self.bindings:
                self.bindings[binding_id]["keycloak_sub"] = args[1]
                self.bindings[binding_id]["dpop_jkt"] = args[2]
                self.bindings[binding_id]["authz_epoch"] = args[4]
        elif "update desktop_client_licenses" in q:
            pass
        elif "insert into desktop_client_audit" in q:
            self.audits.append(str(args[0]))
        return "OK"


class _FakePool:
    def __init__(self, conn: _AuthBindingFakeConn) -> None:
        self._conn = conn

    @asynccontextmanager
    async def acquire(self):
        yield self._conn


def _service(conn: _AuthBindingFakeConn) -> DesktopClientAuthBindingService:
    return DesktopClientAuthBindingService(
        _FakePool(conn),  # type: ignore[arg-type]
        rate_limiter=SlidingTokenBucket(capacity=100, refill_per_sec=100),
        challenges=ChallengeStore(ttl_sec=300),
    )


def _license_row(*, license_id=None, allow_fofline=False) -> dict[str, Any]:
    return {
        "id": license_id or uuid4(),
        "status": "active",
        "expires_at": None,
        "allow_online": True,
        "allow_fofline": allow_fofline,
        "allowed_email": "user@example.com",
        "bound_keycloak_sub": None,
    }


def _device_row(*, license_id, device_id, pubkey: str, status: str = "active") -> dict[str, Any]:
    return {
        "id": device_id,
        "license_id": license_id,
        "device_pubkey": pubkey,
        "status": status,
    }


def _signed_ticket_payload(
    *,
    signing: Ed25519PrivateKey,
    nonce: str,
    license_id,
    device_id=None,
) -> tuple[str, str, dict[str, Any]]:
    pubkey = signing.public_key().public_bytes_raw().hex()
    payload = {
        "nonce": nonce,
        "license_id": str(license_id),
        "device_id": str(device_id) if device_id else None,
        "client_id": "empery-desktop",
        "channel": "desktop",
        "dpop_jkt": "dpop-jkt-example",
        "pkce_challenge": "pkce-challenge-example",
        "redirect_uri": None,
        "jti": f"jti-{uuid4().hex[:16]}",
        "issued_at": int(datetime.now(UTC).timestamp()),
    }
    message = build_ticket_transcript(payload)
    signature = signing.sign(message).hex()
    return pubkey, signature, payload


async def _issue_signed_ticket(
    svc: DesktopClientAuthBindingService,
    *,
    signing: Ed25519PrivateKey,
    license_id: Any,
) -> AuthTicketView:
    pubkey = signing.public_key().public_bytes_raw().hex()
    challenge = await svc.issue_auth_challenge(device_pubkey=pubkey)
    pub, sig, payload = _signed_ticket_payload(
        signing=signing,
        nonce=challenge.nonce,
        license_id=license_id,
    )
    view = await svc.issue_ticket(
        device_pubkey=pub,
        device_signature_hex=sig,
        nonce=payload["nonce"],
        license_id=license_id,
        device_id=None,
        client_id="empery-desktop",
        channel="desktop",
        dpop_jkt=payload["dpop_jkt"],
        pkce_challenge=payload["pkce_challenge"],
        redirect_uri=None,
        jti=payload["jti"],
        issued_at=payload["issued_at"],
        client_ip="127.0.0.1",
    )
    return view


@pytest.mark.asyncio
async def test_issue_auth_challenge_returns_nonce() -> None:
    conn = _AuthBindingFakeConn(license_row=_license_row())
    view = await _service(conn).issue_auth_challenge(device_pubkey="a" * 32)
    assert len(view.nonce) >= 16
    assert view.expires_in_sec == 300


@pytest.mark.asyncio
async def test_issue_ticket_happy_path() -> None:
    license_id = uuid4()
    conn = _AuthBindingFakeConn(license_row=_license_row(license_id=license_id))
    svc = _service(conn)
    signing = Ed25519PrivateKey.generate()
    pubkey = signing.public_key().public_bytes_raw().hex()
    challenge = await svc.issue_auth_challenge(device_pubkey=pubkey)
    pub, sig, payload = _signed_ticket_payload(
        signing=signing,
        nonce=challenge.nonce,
        license_id=license_id,
    )
    view = await svc.issue_ticket(
        device_pubkey=pub,
        device_signature_hex=sig,
        nonce=payload["nonce"],
        license_id=license_id,
        device_id=None,
        client_id="empery-desktop",
        channel="desktop",
        dpop_jkt=payload["dpop_jkt"],
        pkce_challenge=payload["pkce_challenge"],
        redirect_uri=None,
        jti=payload["jti"],
        issued_at=payload["issued_at"],
        client_ip="127.0.0.1",
    )
    assert view.ticket.startswith("atkt_")
    assert view.ticket_id.startswith("tkt_")
    assert "auth_ticket_issued" in conn.audits


@pytest.mark.asyncio
async def test_issue_ticket_unsigned_proof_audits_without_state_change() -> None:
    license_id = uuid4()
    binding_id = "bind_unsigned"
    conn = _AuthBindingFakeConn(
        license_row=_license_row(license_id=license_id),
        binding_row={
            "id": binding_id,
            "license_id": license_id,
            "device_id": None,
            "keycloak_sub": "sub-1",
            "dpop_jkt": "jkt",
            "channel": "desktop",
            "client_id": "empery-desktop",
            "state": "active",
            "authz_epoch": 1,
            "rebind_allowed_until": None,
        },
    )
    svc = _service(conn)
    signing = Ed25519PrivateKey.generate()
    pubkey = signing.public_key().public_bytes_raw().hex()
    challenge = await svc.issue_auth_challenge(device_pubkey=pubkey)
    with pytest.raises(DesktopClientError) as exc:
        await svc.issue_ticket(
            device_pubkey=pubkey,
            device_signature_hex="aa" * 64,
            nonce=challenge.nonce,
            license_id=license_id,
            device_id=None,
            client_id="empery-desktop",
            channel="desktop",
            dpop_jkt="dpop-jkt-example",
            pkce_challenge="pkce-challenge-example",
            redirect_uri=None,
            jti="jti-unsigned",
            issued_at=1,
            client_ip="127.0.0.1",
        )
    assert exc.value.code == "auth_policy_denied"
    assert "auth_risk_unsigned_bad_proof" in conn.audits
    assert conn.bindings[binding_id]["state"] == "active"
    assert conn.license_row is not None
    assert conn.license_row["status"] == "active"


@pytest.mark.asyncio
async def test_issue_ticket_stale_signed_nonce_raises_device_risk() -> None:
    license_id = uuid4()
    device_id = uuid4()
    binding_id = "bind_stale"
    signing = Ed25519PrivateKey.generate()
    pub = signing.public_key().public_bytes_raw().hex()
    conn = _AuthBindingFakeConn(
        license_row=_license_row(license_id=license_id),
        device_row=_device_row(license_id=license_id, device_id=device_id, pubkey=pub),
        binding_row={
            "id": binding_id,
            "license_id": license_id,
            "device_id": device_id,
            "keycloak_sub": "sub-1",
            "dpop_jkt": "jkt",
            "channel": "desktop",
            "client_id": "empery-desktop",
            "state": "active",
            "authz_epoch": 1,
            "rebind_allowed_until": None,
        },
    )
    svc = _service(conn)
    pub, sig, payload = _signed_ticket_payload(
        signing=signing,
        nonce="stale-nonce-not-issued",
        license_id=license_id,
        device_id=device_id,
    )
    await svc.issue_auth_challenge(device_pubkey=pub)
    with pytest.raises(DesktopClientError):
        await svc.issue_ticket(
            device_pubkey=pub,
            device_signature_hex=sig,
            nonce=payload["nonce"],
            license_id=license_id,
            device_id=device_id,
            client_id="empery-desktop",
            channel="desktop",
            dpop_jkt=payload["dpop_jkt"],
            pkce_challenge=payload["pkce_challenge"],
            redirect_uri=None,
            jti=payload["jti"],
            issued_at=payload["issued_at"],
            client_ip="127.0.0.1",
        )
    assert conn.bindings[binding_id]["state"] == "restricted"
    assert conn.license_row is not None
    assert conn.license_row["status"] == "active"
    assert any(ev["kind"] == "stale_nonce" for ev in conn.risk_events)


@pytest.mark.asyncio
async def test_issue_ticket_missing_nonce_does_not_mutate_binding() -> None:
    license_id = uuid4()
    device_id = uuid4()
    binding_id = "bind_missing"
    signing = Ed25519PrivateKey.generate()
    pub = signing.public_key().public_bytes_raw().hex()
    conn = _AuthBindingFakeConn(
        license_row=_license_row(license_id=license_id),
        device_row=_device_row(license_id=license_id, device_id=device_id, pubkey=pub),
        binding_row={
            "id": binding_id,
            "license_id": license_id,
            "device_id": device_id,
            "keycloak_sub": "sub-1",
            "dpop_jkt": "jkt",
            "channel": "desktop",
            "client_id": "empery-desktop",
            "state": "active",
            "authz_epoch": 1,
            "rebind_allowed_until": None,
        },
    )
    svc = _service(conn)
    pub, sig, payload = _signed_ticket_payload(
        signing=signing,
        nonce="never-issued-on-this-worker",
        license_id=license_id,
        device_id=device_id,
    )
    with pytest.raises(DesktopClientError):
        await svc.issue_ticket(
            device_pubkey=pub,
            device_signature_hex=sig,
            nonce=payload["nonce"],
            license_id=license_id,
            device_id=device_id,
            client_id="empery-desktop",
            channel="desktop",
            dpop_jkt=payload["dpop_jkt"],
            pkce_challenge=payload["pkce_challenge"],
            redirect_uri=None,
            jti=payload["jti"],
            issued_at=payload["issued_at"],
            client_ip="127.0.0.1",
        )
    assert conn.bindings[binding_id]["state"] == "active"
    assert any(ev["kind"] == "unsigned_bad_proof" for ev in conn.risk_events)
    assert not any(ev["kind"] == "stale_nonce" for ev in conn.risk_events)


@pytest.mark.asyncio
async def test_issue_ticket_foreign_pubkey_cannot_restrict_victim() -> None:
    license_id = uuid4()
    device_id = uuid4()
    binding_id = "bind_victim"
    victim_pub = Ed25519PrivateKey.generate().public_key().public_bytes_raw().hex()
    attacker = Ed25519PrivateKey.generate()
    conn = _AuthBindingFakeConn(
        license_row=_license_row(license_id=license_id),
        device_row=_device_row(license_id=license_id, device_id=device_id, pubkey=victim_pub),
        binding_row={
            "id": binding_id,
            "license_id": license_id,
            "device_id": device_id,
            "keycloak_sub": "sub-1",
            "dpop_jkt": "jkt",
            "channel": "desktop",
            "client_id": "empery-desktop",
            "state": "active",
            "authz_epoch": 1,
            "rebind_allowed_until": None,
        },
    )
    svc = _service(conn)
    attacker_pub = attacker.public_key().public_bytes_raw().hex()
    await svc.issue_auth_challenge(device_pubkey=attacker_pub)
    pub, sig, payload = _signed_ticket_payload(
        signing=attacker,
        nonce="will-mismatch-after-challenge",
        license_id=license_id,
        device_id=device_id,
    )
    # Live challenge exists for attacker key, but ticket uses a different nonce → mismatch path.
    with pytest.raises(DesktopClientError):
        await svc.issue_ticket(
            device_pubkey=pub,
            device_signature_hex=sig,
            nonce=payload["nonce"],
            license_id=license_id,
            device_id=device_id,
            client_id="empery-desktop",
            channel="desktop",
            dpop_jkt=payload["dpop_jkt"],
            pkce_challenge=payload["pkce_challenge"],
            redirect_uri=None,
            jti=payload["jti"],
            issued_at=payload["issued_at"],
            client_ip="127.0.0.1",
        )
    assert conn.bindings[binding_id]["state"] == "active"
    assert any(ev["kind"] == "unsigned_bad_proof" for ev in conn.risk_events)
    assert not any(ev["kind"] in {"stale_nonce", "valid_replay"} for ev in conn.risk_events)


@pytest.mark.asyncio
async def test_issue_ticket_second_replay_stays_restricted() -> None:
    license_id = uuid4()
    device_id = uuid4()
    binding_id = "bind_replay"
    signing = Ed25519PrivateKey.generate()
    pubkey = signing.public_key().public_bytes_raw().hex()
    conn = _AuthBindingFakeConn(
        license_row=_license_row(license_id=license_id),
        device_row=_device_row(license_id=license_id, device_id=device_id, pubkey=pubkey),
        binding_row={
            "id": binding_id,
            "license_id": license_id,
            "device_id": device_id,
            "keycloak_sub": "sub-1",
            "dpop_jkt": "jkt",
            "channel": "desktop",
            "client_id": "empery-desktop",
            "state": "active",
            "authz_epoch": 1,
            "rebind_allowed_until": None,
        },
    )
    svc = _service(conn)
    challenge = await svc.issue_auth_challenge(device_pubkey=pubkey)
    pub, sig, payload = _signed_ticket_payload(
        signing=signing,
        nonce=challenge.nonce,
        license_id=license_id,
        device_id=device_id,
    )
    await svc.issue_ticket(
        device_pubkey=pub,
        device_signature_hex=sig,
        nonce=payload["nonce"],
        license_id=license_id,
        device_id=device_id,
        client_id="empery-desktop",
        channel="desktop",
        dpop_jkt=payload["dpop_jkt"],
        pkce_challenge=payload["pkce_challenge"],
        redirect_uri=None,
        jti=payload["jti"],
        issued_at=payload["issued_at"],
        client_ip="127.0.0.1",
    )
    for _ in range(2):
        challenge_n = await svc.issue_auth_challenge(device_pubkey=pubkey)
        pub_n, _, payload_n = _signed_ticket_payload(
            signing=signing,
            nonce=challenge_n.nonce,
            license_id=license_id,
            device_id=device_id,
        )
        payload_n["jti"] = payload["jti"]
        message = build_ticket_transcript(payload_n)
        sig_n = signing.sign(message).hex()
        with pytest.raises(DesktopClientError):
            await svc.issue_ticket(
                device_pubkey=pub_n,
                device_signature_hex=sig_n,
                nonce=payload_n["nonce"],
                license_id=license_id,
                device_id=device_id,
                client_id="empery-desktop",
                channel="desktop",
                dpop_jkt=payload_n["dpop_jkt"],
                pkce_challenge=payload_n["pkce_challenge"],
                redirect_uri=None,
                jti=payload_n["jti"],
                issued_at=payload_n["issued_at"],
                client_ip="127.0.0.1",
            )
    assert conn.bindings[binding_id]["state"] == "restricted"
    assert sum(1 for ev in conn.risk_events if ev["kind"] == "valid_replay") == 2
    assert conn.license_row is not None
    assert conn.license_row["status"] == "active"


@pytest.mark.asyncio
async def test_issue_ticket_rejects_wrong_client() -> None:
    license_id = uuid4()
    conn = _AuthBindingFakeConn(license_row=_license_row(license_id=license_id))
    svc = _service(conn)
    signing = Ed25519PrivateKey.generate()
    pubkey = signing.public_key().public_bytes_raw().hex()
    challenge = await svc.issue_auth_challenge(device_pubkey=pubkey)
    _, sig, payload = _signed_ticket_payload(
        signing=signing,
        nonce=challenge.nonce,
        license_id=license_id,
    )
    with pytest.raises(DesktopClientError) as exc:
        await svc.issue_ticket(
            device_pubkey=pubkey,
            device_signature_hex=sig,
            nonce=payload["nonce"],
            license_id=license_id,
            device_id=None,
            client_id="empery-web",
            channel="desktop",
            dpop_jkt=payload["dpop_jkt"],
            pkce_challenge=payload["pkce_challenge"],
            redirect_uri=None,
            jti=payload["jti"],
            issued_at=payload["issued_at"],
            client_ip=None,
        )
    assert exc.value.code == "auth_policy_denied"


@pytest.mark.asyncio
async def test_precheck_and_commit_flow() -> None:
    license_id = uuid4()
    conn = _AuthBindingFakeConn(license_row=_license_row(license_id=license_id))
    svc = _service(conn)
    signing = Ed25519PrivateKey.generate()
    pubkey = signing.public_key().public_bytes_raw().hex()
    challenge = await svc.issue_auth_challenge(device_pubkey=pubkey)
    pub, sig, payload = _signed_ticket_payload(
        signing=signing,
        nonce=challenge.nonce,
        license_id=license_id,
    )
    ticket_view = await svc.issue_ticket(
        device_pubkey=pub,
        device_signature_hex=sig,
        nonce=payload["nonce"],
        license_id=license_id,
        device_id=None,
        client_id="empery-desktop",
        channel="desktop",
        dpop_jkt=payload["dpop_jkt"],
        pkce_challenge=payload["pkce_challenge"],
        redirect_uri=None,
        jti=payload["jti"],
        issued_at=payload["issued_at"],
        client_ip="127.0.0.1",
    )

    pre = await svc.precheck(
        ticket_plaintext=ticket_view.ticket,
        keycloak_auth_session_id="kc-session-1",
        idempotency_key="idem-1",
        client_ip="127.0.0.1",
    )
    assert pre.allowed is True
    assert pre.ticket_id == ticket_view.ticket_id

    commit = await svc.commit(
        ticket_plaintext=ticket_view.ticket,
        keycloak_sub="kc-sub-abc",
        email="user@example.com",
        email_verified=True,
        idempotency_key="idem-commit-1",
        client_ip="127.0.0.1",
    )
    assert commit.allowed is True
    assert commit.authz_epoch == 1
    assert commit.binding_id.startswith("bind_")

    refresh = await svc.refresh_decision(
        binding_id=commit.binding_id,
        keycloak_sub="kc-sub-abc",
        client_id="empery-desktop",
        dpop_jkt=payload["dpop_jkt"],
        authz_epoch=1,
        idempotency_key="idem-refresh-1",
        client_ip="127.0.0.1",
    )
    assert refresh.allowed is True


@pytest.mark.asyncio
async def test_commit_grandfathers_unverified_email_for_bound_sub() -> None:
    license_id = uuid4()
    conn = _AuthBindingFakeConn(
        license_row={
            **_license_row(license_id=license_id),
            "bound_keycloak_sub": "kc-sub-abc",
        }
    )
    svc = _service(conn)
    signing = Ed25519PrivateKey.generate()
    pubkey = signing.public_key().public_bytes_raw().hex()
    challenge = await svc.issue_auth_challenge(device_pubkey=pubkey)
    pub, sig, payload = _signed_ticket_payload(
        signing=signing,
        nonce=challenge.nonce,
        license_id=license_id,
    )
    ticket_view = await svc.issue_ticket(
        device_pubkey=pub,
        device_signature_hex=sig,
        nonce=payload["nonce"],
        license_id=license_id,
        device_id=None,
        client_id="empery-desktop",
        channel="desktop",
        dpop_jkt=payload["dpop_jkt"],
        pkce_challenge=payload["pkce_challenge"],
        redirect_uri=None,
        jti=payload["jti"],
        issued_at=payload["issued_at"],
        client_ip="127.0.0.1",
    )
    await svc.precheck(
        ticket_plaintext=ticket_view.ticket,
        keycloak_auth_session_id="kc-session-gf",
        idempotency_key=None,
        client_ip="127.0.0.1",
    )
    commit = await svc.commit(
        ticket_plaintext=ticket_view.ticket,
        keycloak_sub="kc-sub-abc",
        email="user@example.com",
        email_verified=False,
        idempotency_key=None,
        client_ip="127.0.0.1",
    )
    assert commit.allowed is True


@pytest.mark.asyncio
async def test_commit_rejects_unverified_email_for_new_first_bind() -> None:
    license_id = uuid4()
    conn = _AuthBindingFakeConn(license_row=_license_row(license_id=license_id))
    svc = _service(conn)
    signing = Ed25519PrivateKey.generate()
    pubkey = signing.public_key().public_bytes_raw().hex()
    challenge = await svc.issue_auth_challenge(device_pubkey=pubkey)
    pub, sig, payload = _signed_ticket_payload(
        signing=signing,
        nonce=challenge.nonce,
        license_id=license_id,
    )
    ticket_view = await svc.issue_ticket(
        device_pubkey=pub,
        device_signature_hex=sig,
        nonce=payload["nonce"],
        license_id=license_id,
        device_id=None,
        client_id="empery-desktop",
        channel="desktop",
        dpop_jkt=payload["dpop_jkt"],
        pkce_challenge=payload["pkce_challenge"],
        redirect_uri=None,
        jti=payload["jti"],
        issued_at=payload["issued_at"],
        client_ip="127.0.0.1",
    )
    await svc.precheck(
        ticket_plaintext=ticket_view.ticket,
        keycloak_auth_session_id="kc-session-new",
        idempotency_key=None,
        client_ip="127.0.0.1",
    )
    with pytest.raises(DesktopClientError) as exc:
        await svc.commit(
            ticket_plaintext=ticket_view.ticket,
            keycloak_sub="kc-sub-new",
            email="user@example.com",
            email_verified=False,
            idempotency_key=None,
            client_ip="127.0.0.1",
        )
    assert exc.value.code == "auth_policy_denied"


@pytest.mark.asyncio
async def test_commit_rejects_unverified_when_license_cleared_but_binding_remains() -> None:
    """Admin clear of bound_keycloak_sub must stick even if a migrated binding still exists."""
    license_id = uuid4()
    conn = _AuthBindingFakeConn(
        license_row={
            **_license_row(license_id=license_id),
            "bound_keycloak_sub": None,
        },
        binding_row={
            "id": "bind_migrated_1",
            "license_id": license_id,
            "device_id": None,
            "keycloak_sub": "kc-sub-abc",
            "dpop_jkt": "migrate:pending-pop",
            "channel": "desktop",
            "client_id": "empery-desktop",
            "state": "restricted",
            "authz_epoch": 1,
            "rebind_allowed_until": datetime.now(UTC).replace(year=2099),
            "last_risk_at": None,
            "updated_at": datetime.now(UTC),
        },
    )
    svc = _service(conn)
    signing = Ed25519PrivateKey.generate()
    pubkey = signing.public_key().public_bytes_raw().hex()
    challenge = await svc.issue_auth_challenge(device_pubkey=pubkey)
    pub, sig, payload = _signed_ticket_payload(
        signing=signing,
        nonce=challenge.nonce,
        license_id=license_id,
    )
    ticket_view = await svc.issue_ticket(
        device_pubkey=pub,
        device_signature_hex=sig,
        nonce=payload["nonce"],
        license_id=license_id,
        device_id=None,
        client_id="empery-desktop",
        channel="desktop",
        dpop_jkt=payload["dpop_jkt"],
        pkce_challenge=payload["pkce_challenge"],
        redirect_uri=None,
        jti=payload["jti"],
        issued_at=payload["issued_at"],
        client_ip="127.0.0.1",
    )
    await svc.precheck(
        ticket_plaintext=ticket_view.ticket,
        keycloak_auth_session_id="kc-session-cleared",
        idempotency_key=None,
        client_ip="127.0.0.1",
    )
    with pytest.raises(DesktopClientError) as exc:
        await svc.commit(
            ticket_plaintext=ticket_view.ticket,
            keycloak_sub="kc-sub-abc",
            email="user@example.com",
            email_verified=False,
            idempotency_key=None,
            client_ip="127.0.0.1",
        )
    assert exc.value.code == "auth_policy_denied"


@pytest.mark.asyncio
async def test_precheck_idempotency_replay() -> None:
    license_id = uuid4()
    conn = _AuthBindingFakeConn(license_row=_license_row(license_id=license_id))
    svc = _service(conn)
    signing = Ed25519PrivateKey.generate()
    pubkey = signing.public_key().public_bytes_raw().hex()
    challenge = await svc.issue_auth_challenge(device_pubkey=pubkey)
    pub, sig, payload = _signed_ticket_payload(
        signing=signing,
        nonce=challenge.nonce,
        license_id=license_id,
    )
    ticket_view = await svc.issue_ticket(
        device_pubkey=pub,
        device_signature_hex=sig,
        nonce=payload["nonce"],
        license_id=license_id,
        device_id=None,
        client_id="empery-desktop",
        channel="desktop",
        dpop_jkt=payload["dpop_jkt"],
        pkce_challenge=payload["pkce_challenge"],
        redirect_uri=None,
        jti=payload["jti"],
        issued_at=payload["issued_at"],
        client_ip="127.0.0.1",
    )
    first = await svc.precheck(
        ticket_plaintext=ticket_view.ticket,
        keycloak_auth_session_id="kc-session-1",
        idempotency_key="idem-precheck-replay",
        client_ip="127.0.0.1",
    )
    second = await svc.precheck(
        ticket_plaintext=ticket_view.ticket,
        keycloak_auth_session_id="kc-session-1",
        idempotency_key="idem-precheck-replay",
        client_ip="127.0.0.1",
    )
    assert first == second
    assert first.allowed is True


@pytest.mark.asyncio
async def test_precheck_reused_session_key_binds_the_new_ticket() -> None:
    """SPI idempotency key is the Keycloak auth session. A new ticket must not inherit allow."""
    license_id = uuid4()
    conn = _AuthBindingFakeConn(license_row=_license_row(license_id=license_id))
    svc = _service(conn)
    signing = Ed25519PrivateKey.generate()
    first = await _issue_signed_ticket(svc, signing=signing, license_id=license_id)
    await svc.precheck(
        ticket_plaintext=first.ticket,
        keycloak_auth_session_id="kc-session-replay",
        idempotency_key="kc-session-replay",
        client_ip="127.0.0.1",
    )
    second = await _issue_signed_ticket(svc, signing=signing, license_id=license_id)
    pre = await svc.precheck(
        ticket_plaintext=second.ticket,
        keycloak_auth_session_id="kc-session-replay",
        idempotency_key="kc-session-replay",
        client_ip="127.0.0.1",
    )
    assert pre.allowed is True
    assert pre.ticket_id == second.ticket_id
    assert conn.tickets[second.ticket_id]["keycloak_auth_session_id"] == "kc-session-replay"
    assert conn.tickets[first.ticket_id]["idempotency_key"] is None
    assert conn.tickets[second.ticket_id]["idempotency_key"] == "precheck:kc-session-replay"

    commit = await svc.commit(
        ticket_plaintext=second.ticket,
        keycloak_sub="kc-sub-abc",
        email="user@example.com",
        email_verified=True,
        idempotency_key="kc-session-replay",
        client_ip="127.0.0.1",
    )
    assert commit.allowed is True
    assert conn.tickets[second.ticket_id]["consumed_outcome"] == "commit_ok"


@pytest.mark.asyncio
async def test_commit_reused_session_key_does_not_replay_another_ticket() -> None:
    license_id = uuid4()
    conn = _AuthBindingFakeConn(license_row=_license_row(license_id=license_id))
    svc = _service(conn)
    signing = Ed25519PrivateKey.generate()
    first = await _issue_signed_ticket(svc, signing=signing, license_id=license_id)
    await svc.precheck(
        ticket_plaintext=first.ticket,
        keycloak_auth_session_id="kc-session-commit",
        idempotency_key="precheck-first",
        client_ip="127.0.0.1",
    )
    first_commit = await svc.commit(
        ticket_plaintext=first.ticket,
        keycloak_sub="kc-sub-abc",
        email="user@example.com",
        email_verified=True,
        idempotency_key="kc-session-commit",
        client_ip="127.0.0.1",
    )
    second = await _issue_signed_ticket(svc, signing=signing, license_id=license_id)
    await svc.precheck(
        ticket_plaintext=second.ticket,
        keycloak_auth_session_id="kc-session-commit",
        idempotency_key="precheck-second",
        client_ip="127.0.0.1",
    )
    second_commit = await svc.commit(
        ticket_plaintext=second.ticket,
        keycloak_sub="kc-sub-abc",
        email="user@example.com",
        email_verified=True,
        idempotency_key="kc-session-commit",
        client_ip="127.0.0.1",
    )
    assert second_commit.allowed is True
    assert second_commit.authz_epoch == first_commit.authz_epoch + 1
    assert conn.tickets[second.ticket_id]["consumed_outcome"] == "commit_ok"
    assert conn.tickets[first.ticket_id]["idempotency_key"] is None
    assert conn.tickets[second.ticket_id]["idempotency_key"] == "commit:kc-session-commit"


@pytest.mark.asyncio
async def test_challenge_ticket_shared_process_store() -> None:
    """Two service instances must share the process ChallengeStore (router Depends pattern)."""
    license_id = uuid4()
    conn = _AuthBindingFakeConn(license_row=_license_row(license_id=license_id))
    rate = SlidingTokenBucket(capacity=100, refill_per_sec=100)
    from api.services.desktop_client.limits import auth_binding_challenge_store

    svc_a = DesktopClientAuthBindingService(
        _FakePool(conn),  # type: ignore[arg-type]
        rate_limiter=rate,
        challenges=auth_binding_challenge_store,
    )
    svc_b = DesktopClientAuthBindingService(
        _FakePool(conn),  # type: ignore[arg-type]
        rate_limiter=rate,
        challenges=auth_binding_challenge_store,
    )
    signing = Ed25519PrivateKey.generate()
    pubkey = signing.public_key().public_bytes_raw().hex()
    challenge = await svc_a.issue_auth_challenge(device_pubkey=pubkey)
    pub, sig, payload = _signed_ticket_payload(
        signing=signing,
        nonce=challenge.nonce,
        license_id=license_id,
    )
    view = await svc_b.issue_ticket(
        device_pubkey=pub,
        device_signature_hex=sig,
        nonce=payload["nonce"],
        license_id=license_id,
        device_id=None,
        client_id="empery-desktop",
        channel="desktop",
        dpop_jkt=payload["dpop_jkt"],
        pkce_challenge=payload["pkce_challenge"],
        redirect_uri=None,
        jti=payload["jti"],
        issued_at=payload["issued_at"],
        client_ip="127.0.0.1",
    )
    assert view.ticket_id.startswith("tkt_")


@pytest.mark.asyncio
async def test_precheck_denies_quarantined_binding() -> None:
    license_id = uuid4()
    conn = _AuthBindingFakeConn(
        license_row=_license_row(license_id=license_id),
        binding_row={
            "id": "bind_quarantined",
            "license_id": license_id,
            "device_id": None,
            "keycloak_sub": "old-sub",
            "dpop_jkt": "old-jkt",
            "channel": "desktop",
            "client_id": "empery-desktop",
            "state": "quarantined",
            "authz_epoch": 2,
        },
    )
    svc = _service(conn)
    signing = Ed25519PrivateKey.generate()
    pubkey = signing.public_key().public_bytes_raw().hex()
    challenge = await svc.issue_auth_challenge(device_pubkey=pubkey)
    pub, sig, payload = _signed_ticket_payload(
        signing=signing,
        nonce=challenge.nonce,
        license_id=license_id,
    )
    ticket_view = await svc.issue_ticket(
        device_pubkey=pub,
        device_signature_hex=sig,
        nonce=payload["nonce"],
        license_id=license_id,
        device_id=None,
        client_id="empery-desktop",
        channel="desktop",
        dpop_jkt=payload["dpop_jkt"],
        pkce_challenge=payload["pkce_challenge"],
        redirect_uri=None,
        jti=payload["jti"],
        issued_at=payload["issued_at"],
        client_ip="127.0.0.1",
    )
    with pytest.raises(DesktopClientError) as exc:
        await svc.precheck(
            ticket_plaintext=ticket_view.ticket,
            keycloak_auth_session_id="kc-session-1",
            idempotency_key=None,
            client_ip="127.0.0.1",
        )
    assert exc.value.code == "auth_policy_denied"


@pytest.mark.asyncio
async def test_precheck_denies_session_rebind() -> None:
    license_id = uuid4()
    conn = _AuthBindingFakeConn(license_row=_license_row(license_id=license_id))
    svc = _service(conn)
    signing = Ed25519PrivateKey.generate()
    pubkey = signing.public_key().public_bytes_raw().hex()
    challenge = await svc.issue_auth_challenge(device_pubkey=pubkey)
    pub, sig, payload = _signed_ticket_payload(
        signing=signing,
        nonce=challenge.nonce,
        license_id=license_id,
    )
    ticket_view = await svc.issue_ticket(
        device_pubkey=pub,
        device_signature_hex=sig,
        nonce=payload["nonce"],
        license_id=license_id,
        device_id=None,
        client_id="empery-desktop",
        channel="desktop",
        dpop_jkt=payload["dpop_jkt"],
        pkce_challenge=payload["pkce_challenge"],
        redirect_uri=None,
        jti=payload["jti"],
        issued_at=payload["issued_at"],
        client_ip="127.0.0.1",
    )
    await svc.precheck(
        ticket_plaintext=ticket_view.ticket,
        keycloak_auth_session_id="kc-session-1",
        idempotency_key=None,
        client_ip="127.0.0.1",
    )
    with pytest.raises(DesktopClientError) as exc:
        await svc.precheck(
            ticket_plaintext=ticket_view.ticket,
            keycloak_auth_session_id="kc-session-OTHER",
            idempotency_key=None,
            client_ip="127.0.0.1",
        )
    assert exc.value.code == "auth_policy_denied"


@pytest.mark.asyncio
async def test_commit_requires_precheck_session() -> None:
    license_id = uuid4()
    conn = _AuthBindingFakeConn(license_row=_license_row(license_id=license_id))
    svc = _service(conn)
    signing = Ed25519PrivateKey.generate()
    pubkey = signing.public_key().public_bytes_raw().hex()
    challenge = await svc.issue_auth_challenge(device_pubkey=pubkey)
    pub, sig, payload = _signed_ticket_payload(
        signing=signing,
        nonce=challenge.nonce,
        license_id=license_id,
    )
    ticket_view = await svc.issue_ticket(
        device_pubkey=pub,
        device_signature_hex=sig,
        nonce=payload["nonce"],
        license_id=license_id,
        device_id=None,
        client_id="empery-desktop",
        channel="desktop",
        dpop_jkt=payload["dpop_jkt"],
        pkce_challenge=payload["pkce_challenge"],
        redirect_uri=None,
        jti=payload["jti"],
        issued_at=payload["issued_at"],
        client_ip="127.0.0.1",
    )
    with pytest.raises(DesktopClientError) as exc:
        await svc.commit(
            ticket_plaintext=ticket_view.ticket,
            keycloak_sub="kc-sub-abc",
            email="user@example.com",
            email_verified=True,
            idempotency_key=None,
            client_ip="127.0.0.1",
        )
    assert exc.value.code == "auth_policy_denied"


def test_public_paths_include_auth_binding_routes() -> None:
    paths = build_public_path_strings()
    joined = "\n".join(paths)
    assert "desktop-client/auth/challenge" in joined
    assert "desktop-client/auth/ticket" in joined
    assert "desktop-client/auth/internal/precheck" not in joined

    route_auth_patterns = [re.compile(pattern) for pattern in build_route_auth_path_strings()]
    for path in (
        "/api/v1/desktop-client/auth/internal/precheck",
        "/api/v1/desktop-client/auth/internal/commit",
        "/api/v1/desktop-client/auth/internal/refresh-decision",
    ):
        assert any(pattern.match(path) for pattern in route_auth_patterns)
    assert not any(
        pattern.match("/api/v1/desktop-client/auth/internal/precheck/extra") for pattern in route_auth_patterns
    )


class _FakeAuthBindingService(DesktopClientAuthBindingService):
    """Minimal override hook for router tests."""

    def __init__(self) -> None:
        self.challenge_nonce = "nonce-router-test"


def _router_client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    fake = _FakeAuthBindingService()

    async def issue_auth_challenge(*, device_pubkey: str, client_ip: str | None = None):
        from api.services.desktop_client.auth_binding import AuthChallengeView

        _ = (device_pubkey, client_ip)
        return AuthChallengeView(nonce=fake.challenge_nonce, expires_in_sec=300)

    fake.issue_auth_challenge = issue_auth_challenge  # type: ignore[method-assign]

    app = FastAPI()
    app.include_router(desktop_client_router, prefix="/api/v1")
    app.add_middleware(OAuth2ProtectionMiddleware)
    app.dependency_overrides[auth_binding_router.get_auth_binding_service] = lambda: fake
    monkeypatch.setenv("DESKTOP_CLIENT_BINDING_SPI_TOKEN", "spi-test-token")
    return TestClient(app)


def test_router_auth_challenge_public(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _router_client(monkeypatch)
    resp = client.post(
        "/api/v1/desktop-client/auth/challenge",
        json={"device_pubkey": "b" * 32},
    )
    assert resp.status_code == 200
    assert resp.json()["nonce"] == "nonce-router-test"


_TICKET_BODY = "atkt_" + ("x" * 32)


def test_router_internal_precheck_requires_spi_token(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _router_client(monkeypatch)
    path = "/api/v1/desktop-client/auth/internal/precheck"
    resp = client.post(
        path,
        json={"ticket": _TICKET_BODY, "keycloak_auth_session_id": "kc-session-1"},
    )
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Invalid binding SPI token"

    wrong = client.post(
        path,
        json={"ticket": _TICKET_BODY, "keycloak_auth_session_id": "kc-session-1"},
        headers={"X-Desktop-Client-Binding-Spi-Token": "wrong-token"},
    )
    assert wrong.status_code == 401
    assert wrong.json()["detail"] == "Invalid binding SPI token"

    non_post = client.get(
        path,
        headers={"X-Desktop-Client-Binding-Spi-Token": "spi-test-token"},
    )
    assert non_post.status_code == 401
    assert non_post.json()["reason"] == "token_missing"

    async def precheck(**kwargs):
        from api.services.desktop_client.auth_binding import PrecheckView

        _ = kwargs
        return PrecheckView(allowed=True, ticket_id="tkt_1", binding_id=None, authz_epoch=None)

    app = client.app
    assert isinstance(app, FastAPI)
    fake_svc = app.dependency_overrides[auth_binding_router.get_auth_binding_service]()
    fake_svc.precheck = precheck  # type: ignore[method-assign]

    ok = client.post(
        path,
        json={"ticket": _TICKET_BODY, "keycloak_auth_session_id": "kc-session-1"},
        headers={"X-Desktop-Client-Binding-Spi-Token": "spi-test-token"},
    )
    assert ok.status_code == 200
    assert ok.json()["allowed"] is True


def test_router_spi_token_missing_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DESKTOP_CLIENT_BINDING_SPI_TOKEN", raising=False)
    app = FastAPI()
    app.include_router(desktop_client_router, prefix="/api/v1")
    app.add_middleware(OAuth2ProtectionMiddleware)
    app.dependency_overrides[auth_binding_router.get_auth_binding_service] = lambda: _FakeAuthBindingService()
    client = TestClient(app)
    resp = client.post(
        "/api/v1/desktop-client/auth/internal/commit",
        json={
            "ticket": _TICKET_BODY,
            "keycloak_sub": "kc-sub-abc",
            "email": "a@b.c",
            "email_verified": True,
        },
        headers={"X-Desktop-Client-Binding-Spi-Token": "anything"},
    )
    assert resp.status_code == 503
    assert "not configured" in resp.json()["detail"]
