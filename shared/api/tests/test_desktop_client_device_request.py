# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Wave 3 device_request_v1 validator + seal-to-recipient regression locks.
# Related:
# - api/services/desktop_client/device_request.py
# ---

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey

from api.services.desktop_client.capsule_seal import (
    DEV_SIGNING_PK_HEX,
    DEV_SIGNING_SK_HEX,
    open_capsule_dict,
    seal_seat_dict,
)
from api.services.desktop_client.device_request import (
    parse_and_verify_device_request,
    signature_transcript,
)
from api.services.desktop_client.license_service import DesktopClientError


def _make_signed_request(**overrides):
    signing = Ed25519PrivateKey.generate()
    recipient = X25519PrivateKey.generate()
    signing_pk = signing.public_key().public_bytes_raw().hex()
    recipient_pk = recipient.public_key().public_bytes_raw().hex()
    created = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    req = {
        "kind": "device_request_v1",
        "request_id": "dr1_testvector01",
        "product_id": "eliteew-desktop-connected",
        "app_identifier": "world.empery.desktop.client",
        "device_signing_pubkey": signing_pk,
        "capsule_recipient_pubkey": recipient_pk,
        "recipient_key_id": "rk1_test",
        "machine_fingerprint_hash": "mfh1_test",
        "created_at": created,
        "nonce": "ab" * 16,
        "signature": "",
    }
    req.update(overrides)
    # resign if signature not provided
    if not overrides.get("signature"):
        msg = signature_transcript(req)
        req["signature"] = signing.sign(msg).hex()
    return req, recipient


def test_device_request_valid_accepts():
    req, _ = _make_signed_request()
    out = parse_and_verify_device_request(req)
    assert out["request_id"] == "dr1_testvector01"


def test_device_request_bad_signature_rejects():
    req, _ = _make_signed_request(signature="00" * 64)
    with pytest.raises(DesktopClientError) as exc:
        parse_and_verify_device_request(req)
    assert exc.value.code == "device_request_bad_signature"


def test_device_request_unknown_field_rejects():
    req, _ = _make_signed_request()
    req["extra"] = "nope"
    with pytest.raises(DesktopClientError) as exc:
        parse_and_verify_device_request(req)
    assert exc.value.code == "device_request_unknown_field"


def test_device_request_required_when_missing():
    with pytest.raises(DesktopClientError) as exc:
        parse_and_verify_device_request(None)
    assert exc.value.code == "device_request_required"


def test_seal_to_device_recipient_roundtrip(monkeypatch):
    monkeypatch.setenv("ELITEEW_CAPSULE_DEV_KEYS", "1")
    req, recipient_sk = _make_signed_request()
    verified = parse_and_verify_device_request(req)
    seat = {
        "kind": "eliteew_desktop_seat",
        "v": 1,
        "mode": "offline",
        "license_id": "00000000-0000-0000-0000-000000000099",
        "license_key": "EE-SHOULD-STRIP",
        "hello": "world",
    }
    monkeypatch.setenv("DESKTOP_CLIENT_CAPSULE_SIGNING_KEY", DEV_SIGNING_SK_HEX)
    sealed = seal_seat_dict(
        seat,
        recipient_public_key_hex=verified["capsule_recipient_pubkey"],
        verified_request=verified,
        activation_token="tok_device_roundtrip",
    )
    assert sealed["v"] == 2
    opened = open_capsule_dict(
        sealed,
        recipient_sk=recipient_sk.private_bytes_raw(),
        signing_pk=bytes.fromhex(DEV_SIGNING_PK_HEX),
    )
    assert opened["kind"] == "eliteew_desktop_capsule_payload"
    assert "license_key" not in opened
    assert opened["activation_token"] == "tok_device_roundtrip"
    assert opened["request_id"] == verified["request_id"]


def test_maybe_seal_requires_recipient_without_plaintext(monkeypatch):
    monkeypatch.delenv("DESKTOP_CLIENT_CAPSULE_ALLOW_PLAINTEXT", raising=False)
    monkeypatch.setenv("ELITEEW_CAPSULE_DEV_KEYS", "1")
    monkeypatch.setenv("DESKTOP_CLIENT_CAPSULE_SIGNING_KEY", DEV_SIGNING_SK_HEX)
    from api.services.desktop_client.capsule_seal import maybe_seal_for_issue

    with pytest.raises(RuntimeError, match="device_request_recipient_required"):
        maybe_seal_for_issue({"kind": "eliteew_desktop_seat", "v": 1})
