# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for desktop-client license redeem / prove / conflict (DB-free fakes).
# Invariants:
# - Public allowlist paths stay JWT-exempt at middleware layer.
# Related:
# - api/routers/desktop_client/
# - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
# ---

from __future__ import annotations

from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.middleware.oauth2_protection import build_public_path_strings
from api.routers.desktop_client import devices as devices_router
from api.routers.desktop_client import license as license_router
from api.routers.desktop_client import router as desktop_client_router
from api.services.desktop_client import BoundLicenseView, DesktopClientError
from api.services.desktop_client.crypto_util import (
    challenge_proof,
    generate_license_key,
    hash_license_key,
    is_plausible_license_key,
    verify_challenge_proof,
)
from api.services.desktop_client.license_service import LicensePreflightView
from api.services.desktop_client.limits import ChallengeStore, SlidingTokenBucket


class FakeDesktopClientService:
    def __init__(self) -> None:
        self.bound: dict[str, BoundLicenseView] = {}
        self.challenges = ChallengeStore(ttl_sec=60)
        self.rate = SlidingTokenBucket(capacity=100, refill_per_sec=100)
        self.preflight_by_id: dict[str, LicensePreflightView | DesktopClientError] = {}

    async def redeem(self, *, license_key, device_pubkey, machine_fingerprint, client_ip):
        if not self.rate.allow(f"redeem:{client_ip or 'x'}"):
            raise DesktopClientError("rate_limited", "Too many", http_status=429)
        if license_key.startswith("EE-MISS"):
            raise DesktopClientError("unknown_license", "nope", http_status=404)
        key = f"{device_pubkey}:{machine_fingerprint}"
        if "conflict" in self.bound and key not in self.bound:
            raise DesktopClientError("device_conflict", "taken", http_status=409)
        view = BoundLicenseView(
            license_id=uuid4(),
            device_id=uuid4(),
            edition="connected",
            profile_id=None,
            apps=[],
            expires_at=None,
            status="bound",
        )
        self.bound[key] = view
        self.bound["conflict"] = view
        return view

    def issue_challenge(self, *, device_pubkey: str):
        from api.services.desktop_client.crypto_util import new_challenge_nonce

        nonce = new_challenge_nonce()
        self.challenges.put(device_pubkey=device_pubkey, nonce=nonce)
        return nonce, 300

    async def prove(self, *, device_pubkey, machine_fingerprint, challenge, proof, client_ip):
        if not self.challenges.pop_valid(device_pubkey=device_pubkey, nonce=challenge):
            raise DesktopClientError("challenge_invalid", "bad challenge", http_status=401)
        if not verify_challenge_proof(
            challenge=challenge,
            device_pubkey=device_pubkey,
            machine_fingerprint=machine_fingerprint,
            proof=proof,
        ):
            raise DesktopClientError("proof_invalid", "bad proof", http_status=401)
        key = f"{device_pubkey}:{machine_fingerprint}"
        view = self.bound.get(key)
        if view is None:
            raise DesktopClientError("device_unknown", "missing", http_status=404)
        return BoundLicenseView(
            license_id=view.license_id,
            device_id=view.device_id,
            edition=view.edition,
            profile_id=view.profile_id,
            apps=view.apps,
            expires_at=view.expires_at,
            status="proven",
        )

    async def preflight_license(
        self,
        *,
        license_id,
        device_id=None,
        machine_fingerprint=None,
        client_ip=None,
        purpose: str = "preflight",
    ):
        _ = (device_id, machine_fingerprint, client_ip, purpose)
        if not self.rate.allow(f"{purpose}:{client_ip or 'x'}"):
            raise DesktopClientError("rate_limited", "Too many", http_status=429)
        entry = self.preflight_by_id.get(str(license_id))
        if entry is None:
            raise DesktopClientError("not_found", "License not found", http_status=404)
        if isinstance(entry, DesktopClientError):
            raise entry
        return entry

    async def heartbeat_license(
        self,
        *,
        license_id,
        device_id=None,
        machine_fingerprint=None,
        client_ip=None,
    ):
        return await self.preflight_license(
            license_id=license_id,
            device_id=device_id,
            machine_fingerprint=machine_fingerprint,
            client_ip=client_ip,
            purpose="heartbeat",
        )


def _client(fake: FakeDesktopClientService) -> TestClient:
    app = FastAPI()
    app.include_router(desktop_client_router, prefix="/api/v1")
    app.dependency_overrides[license_router.get_desktop_client_license_service] = lambda: fake
    app.dependency_overrides[devices_router.get_desktop_client_license_service] = lambda: fake
    return TestClient(app)


def test_license_key_hash_and_format() -> None:
    key = generate_license_key(groups=5)
    assert is_plausible_license_key(key)
    assert len(hash_license_key(key)) == 64
    assert hash_license_key(key) == hash_license_key(key.lower())


def test_challenge_proof_roundtrip() -> None:
    challenge = "abc"
    pubkey = "device-pubkey-aaaaaaaa"
    fp = "machine-fp-bbbbbbbb"
    proof = challenge_proof(challenge=challenge, device_pubkey=pubkey, machine_fingerprint=fp)
    assert verify_challenge_proof(
        challenge=challenge,
        device_pubkey=pubkey,
        machine_fingerprint=fp,
        proof=proof,
    )


def test_public_paths_include_desktop_client_enroll() -> None:
    paths = build_public_path_strings()
    joined = "\n".join(paths)
    assert "desktop-client/license/redeem" in joined
    assert "desktop-client/license/preflight" in joined
    assert "desktop-client/license/heartbeat" in joined
    assert "desktop-client/devices/challenge" in joined
    assert "desktop-client/devices/prove" in joined


def test_assert_session_allows_license_only_without_device_join() -> None:
    """Cause lock: expiry/email must gate even when Capsule seat has zero devices."""
    from pathlib import Path

    src = Path(__file__).resolve().parents[1] / "services/desktop_client/license_runtime.py"
    text = src.read_text(encoding="utf-8")
    assert "device_id: UUID | None" in text
    assert 'event="session_assert_ok"' in text
    assert '"device_optional"' in text
    # Must not require JOIN devices before license expiry check.
    assert "JOIN desktop_client_devices d ON d.license_id = l.id" not in text.split("async def assert_session")[1]


def test_public_paths_include_desktop_client_ops_token_routes() -> None:
    """JWT middleware skip for ops-token routes; routers still require DESKTOP_CLIENT_OPS_TOKEN."""
    import re

    patterns = [re.compile(p) for p in build_public_path_strings()]

    def is_public(path: str) -> bool:
        return any(p.match(path) for p in patterns)

    assert is_public("/api/v1/desktop-client/license/issue")
    assert is_public("/api/v1/desktop-client/license/revoke")
    assert is_public("/api/v1/desktop-client/devices/revoke")
    assert is_public("/api/v1/desktop-client/portal-peers")
    assert is_public("/api/v1/desktop-client/portal-peers/import")
    assert is_public("/api/v1/desktop-client/portal-peers/sync")
    assert is_public("/api/v1/desktop-client/portal-peers/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/revoke")
    assert is_public("/api/v1/desktop-client/seats/issue")
    # Must not open arbitrary desktop-client paths without an explicit allowlist entry.
    assert not is_public("/api/v1/desktop-client/secret")
    assert not is_public("/api/v1/desktop/admin/platform-ops/portal-peers")
    assert not is_public("/api/v1/desktop/admin/platform-ops/seats/issue")


def test_redeem_and_prove_contract() -> None:
    fake = FakeDesktopClientService()
    client = _client(fake)
    pubkey = "device-pubkey-aaaaaaaa"
    fp = "machine-fp-bbbbbbbb"

    redeem = client.post(
        "/api/v1/desktop-client/license/redeem",
        json={
            "license_key": "EE-TEST-TEST-TEST-TEST",
            "device_pubkey": pubkey,
            "machine_fingerprint": fp,
        },
    )
    assert redeem.status_code == 200, redeem.text
    body = redeem.json()
    assert body["status"] == "bound"
    assert body["edition"] == "connected"
    # Entitlement is optional: minted when DESKTOP_CLIENT_ENTITLEMENT_SIGNING_KEY is set.
    ent = body.get("entitlement")
    assert ent is None or (isinstance(ent, dict) and "sig" in ent and "payload" in ent)

    ch = client.post(
        "/api/v1/desktop-client/devices/challenge",
        json={"device_pubkey": pubkey},
    )
    assert ch.status_code == 200
    challenge = ch.json()["challenge"]
    proof = challenge_proof(challenge=challenge, device_pubkey=pubkey, machine_fingerprint=fp)

    proven = client.post(
        "/api/v1/desktop-client/devices/prove",
        json={
            "device_pubkey": pubkey,
            "machine_fingerprint": fp,
            "challenge": challenge,
            "challenge_proof": proof,
        },
    )
    assert proven.status_code == 200, proven.text
    assert proven.json()["status"] == "proven"


def test_redeem_unknown_maps_404() -> None:
    fake = FakeDesktopClientService()
    client = _client(fake)
    response = client.post(
        "/api/v1/desktop-client/license/redeem",
        json={
            "license_key": "EE-MISS-TEST-TEST-TEST",
            "device_pubkey": "device-pubkey-aaaaaaaa",
            "machine_fingerprint": "machine-fp-bbbbbbbb",
        },
    )
    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "unknown_license"


def test_capabilities_ops_path_is_jwt_skip_but_assert_is_not() -> None:
    import re

    patterns = [re.compile(p) for p in build_public_path_strings()]
    assert any(p.match("/api/v1/desktop-client/licenses/11111111-1111-1111-1111-111111111111") for p in patterns)
    assert any(p.match("/api/v1/desktop-client/license/preflight") for p in patterns)
    assert any(p.match("/api/v1/desktop-client/license/heartbeat") for p in patterns)
    assert not any(p.match("/api/v1/desktop-client/session/assert") for p in patterns)


def test_license_preflight_and_heartbeat_contract() -> None:
    fake = FakeDesktopClientService()
    license_id = uuid4()
    fake.preflight_by_id[str(license_id)] = LicensePreflightView(
        ok=True,
        code="ok",
        expires_at=None,
        allow_online=True,
        allow_offline=False,
        allow_fofline=True,
    )
    client = _client(fake)

    preflight = client.post(
        "/api/v1/desktop-client/license/preflight",
        json={"license_id": str(license_id)},
    )
    assert preflight.status_code == 200, preflight.text
    body = preflight.json()
    assert body["ok"] is True
    assert body["code"] == "ok"
    assert body["allow_online"] is True
    assert body["allow_fofline"] is True
    assert body["allow_offline"] is False
    assert "allowed_email" not in body
    assert "bound_keycloak_sub" not in body

    heartbeat = client.post(
        "/api/v1/desktop-client/license/heartbeat",
        json={"license_id": str(license_id), "device_id": str(uuid4())},
    )
    assert heartbeat.status_code == 200, heartbeat.text
    assert heartbeat.json()["code"] == "ok"


def test_license_preflight_expired_and_revoked_codes() -> None:
    fake = FakeDesktopClientService()
    expired_id = uuid4()
    revoked_id = uuid4()
    fake.preflight_by_id[str(expired_id)] = DesktopClientError(
        "license_expired",
        "License expired",
        http_status=403,
    )
    fake.preflight_by_id[str(revoked_id)] = DesktopClientError(
        "license_revoked",
        "License is revoked",
        http_status=403,
    )
    client = _client(fake)

    expired = client.post(
        "/api/v1/desktop-client/license/preflight",
        json={"license_id": str(expired_id)},
    )
    assert expired.status_code == 403
    assert expired.json()["detail"]["code"] == "license_expired"

    revoked = client.post(
        "/api/v1/desktop-client/license/heartbeat",
        json={"license_id": str(revoked_id)},
    )
    assert revoked.status_code == 403
    assert revoked.json()["detail"]["code"] == "license_revoked"

    missing = client.post(
        "/api/v1/desktop-client/license/preflight",
        json={"license_id": str(uuid4())},
    )
    assert missing.status_code == 404
    assert missing.json()["detail"]["code"] == "not_found"


def test_preflight_service_source_has_no_pii_in_select() -> None:
    """Cause lock: preflight SELECT must not pull allowed_email / bound_keycloak_sub."""
    from pathlib import Path

    src = Path(__file__).resolve().parents[1] / "services/desktop_client/license_runtime.py"
    text = src.read_text(encoding="utf-8")
    block = text.split("async def preflight_license")[1].split("async def heartbeat_license")[0]
    assert "allowed_email" not in block
    assert "bound_keycloak_sub" not in block
    assert 'f"{event_prefix}_ok"' in block
    assert "[STEP]" in block
    assert "JOIN desktop_client_devices" not in block


def test_license_issue_retired_returns_410(monkeypatch) -> None:
    """Wave 9: POST /license/issue is gone — Capsule v2 seats/issue only."""
    monkeypatch.setenv("DESKTOP_CLIENT_OPS_TOKEN", "ops-test-token")
    fake = FakeDesktopClientService()
    client = _client(fake)
    response = client.post(
        "/api/v1/desktop-client/license/issue",
        headers={"X-Desktop-Client-Ops-Token": "ops-test-token"},
        json={"label": "retired", "edition": "connected"},
    )
    assert response.status_code == 410, response.text
    detail = response.json()["detail"]
    assert detail["code"] == "license_issue_retired"
    assert "seats/issue" in detail["message"]
