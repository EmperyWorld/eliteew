# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Roundtrip + negative tests for Capsule v2 seal/open.
# Related:
# - api/services/desktop_client/capsule_seal.py
# ---

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from api.services.desktop_client.capsule_seal import (
    CAPSULE_KIND,
    CAPSULE_SCHEMA_VERSION,
    DEV_RECIPIENT_PK_HEX,
    DEV_RECIPIENT_SK_HEX,
    DEV_SIGNING_PK_HEX,
    PAYLOAD_KIND,
    maybe_seal_for_issue,
    open_capsule_dict,
    seal_seat_dict,
)


def _verified_request() -> dict[str, str]:
    created = datetime.now(UTC)
    return {
        "kind": "device_request_v1",
        "request_id": "dr1_test_wave4",
        "product_id": "eliteew-desktop-connected",
        "app_identifier": "world.empery.desktop.client",
        "device_signing_pubkey": "aa" * 32,
        "capsule_recipient_pubkey": DEV_RECIPIENT_PK_HEX,
        "recipient_key_id": "rk1_test",
        "machine_fingerprint_hash": "mfh1_test",
        "created_at": created.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "nonce": "cc" * 16,
        "signature": "dd" * 64,
        "expires_at": (created + timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


@pytest.fixture(autouse=True)
def dev_capsule_keys(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ELITEEW_CAPSULE_DEV_KEYS", "1")
    monkeypatch.delenv("DESKTOP_CLIENT_CAPSULE_ALLOW_PLAINTEXT", raising=False)
    monkeypatch.delenv("DESKTOP_CLIENT_CAPSULE_RECIPIENT_PUBLIC_KEY", raising=False)
    monkeypatch.delenv("DESKTOP_CLIENT_CAPSULE_SIGNING_KEY", raising=False)
    try:
        from api.core import unified_config as uc

        monkeypatch.setattr(uc.settings, "desktop_client_capsule_recipient_public_key", None, raising=False)
        monkeypatch.setattr(uc.settings, "desktop_client_capsule_signing_key", None, raising=False)
    except Exception:
        pass


def test_seal_open_roundtrip_v2() -> None:
    seat = {
        "v": 1,
        "kind": "eliteew_desktop_seat",
        "mode": "offline",
        "license_key": "EE-TEST-AAAA-BBBB-CCCC",
        "license_id": "00000000-0000-0000-0000-000000000001",
        "allow_offline": True,
        "allow_online": False,
        "allow_fofline": False,
        "entitlement": {"v": 1, "payload": {"edition": "client"}, "sig": "x"},
        "apps": ["music"],
    }
    sealed = seal_seat_dict(
        seat,
        recipient_public_key_hex=DEV_RECIPIENT_PK_HEX,
        verified_request=_verified_request(),
        activation_token="tok_test_wave4",
    )
    assert sealed["kind"] == CAPSULE_KIND
    assert sealed["v"] == CAPSULE_SCHEMA_VERSION
    assert sealed["request_id"] == "dr1_test_wave4"
    assert "ciphertext_sha256" in sealed
    assert "product_id" in sealed
    opened = open_capsule_dict(
        sealed,
        recipient_sk=bytes.fromhex(DEV_RECIPIENT_SK_HEX),
        signing_pk=bytes.fromhex(DEV_SIGNING_PK_HEX),
    )
    assert opened["kind"] == PAYLOAD_KIND
    assert "license_key" not in opened
    assert opened["activation_token"] == "tok_test_wave4"
    assert opened["entitlement"]["payload"]["edition"] == "client"


def test_bad_signature_rejected() -> None:
    seat = {
        "v": 1,
        "kind": "eliteew_desktop_seat",
        "mode": "cloud",
        "license_key": "EE-X",
        "license_id": "00000000-0000-0000-0000-000000000002",
    }
    sealed = seal_seat_dict(
        seat,
        recipient_public_key_hex=DEV_RECIPIENT_PK_HEX,
        verified_request=_verified_request(),
        activation_token="tok",
    )
    sealed["sig"] = "00" * 64
    with pytest.raises(ValueError, match="bad_capsule"):
        open_capsule_dict(
            sealed,
            recipient_sk=bytes.fromhex(DEV_RECIPIENT_SK_HEX),
            signing_pk=bytes.fromhex(DEV_SIGNING_PK_HEX),
        )


def test_tampered_ciphertext_hash_rejected() -> None:
    seat = {"v": 1, "kind": "eliteew_desktop_seat", "mode": "offline", "license_key": "EE-T"}
    sealed = seal_seat_dict(
        seat,
        recipient_public_key_hex=DEV_RECIPIENT_PK_HEX,
        verified_request=_verified_request(),
        activation_token="tok",
    )
    sealed["ciphertext_sha256"] = "00" * 32
    with pytest.raises(ValueError, match="bad_ciphertext_hash"):
        open_capsule_dict(
            sealed,
            recipient_sk=bytes.fromhex(DEV_RECIPIENT_SK_HEX),
            signing_pk=bytes.fromhex(DEV_SIGNING_PK_HEX),
        )


def test_maybe_seal_plaintext_flag(monkeypatch: pytest.MonkeyPatch) -> None:
    """Plaintext requires BOTH ALLOW_PLAINTEXT and ELITEEW_CAPSULE_DEV_KEYS."""
    monkeypatch.setenv("DESKTOP_CLIENT_CAPSULE_ALLOW_PLAINTEXT", "1")
    monkeypatch.setenv("ELITEEW_CAPSULE_DEV_KEYS", "1")
    seat = {"v": 1, "kind": "eliteew_desktop_seat", "mode": "offline", "license_key": "EE-Y"}
    out, suffix, token_hash = maybe_seal_for_issue(seat)
    assert out["kind"] == "eliteew_desktop_seat"
    assert suffix == ".json"
    assert token_hash is None


def test_allow_plaintext_alone_does_not_allow(monkeypatch: pytest.MonkeyPatch) -> None:
    """Production ALLOW_PLAINTEXT without DEV_KEYS must not leak plaintext seats."""
    from api.services.desktop_client.capsule_seal import allow_plaintext_issue

    monkeypatch.setenv("DESKTOP_CLIENT_CAPSULE_ALLOW_PLAINTEXT", "1")
    monkeypatch.setenv("ELITEEW_CAPSULE_DEV_KEYS", "0")
    assert allow_plaintext_issue() is False
    seat = {
        "v": 1,
        "kind": "eliteew_desktop_seat",
        "mode": "offline",
        "license_key": "EE-Y",
        "license_id": "00000000-0000-0000-0000-000000000099",
    }
    with pytest.raises(RuntimeError, match="device_request_recipient_required"):
        maybe_seal_for_issue(seat)


def test_maybe_seal_default_capsule_v3() -> None:
    import base64

    from api.services.desktop_client.capsule_seal import (
        CAPSULE_SCHEMA_VERSION_V3,
        ENCODING_ECAP_V3,
        FORBIDDEN_META_ASCII,
        open_capsule_v3_bytes,
    )

    seat = {
        "v": 1,
        "kind": "eliteew_desktop_seat",
        "mode": "offline",
        "license_key": "EE-Z",
        "license_id": "00000000-0000-0000-0000-000000000003",
    }
    out, suffix, token_hash = maybe_seal_for_issue(
        seat,
        recipient_public_key_hex=DEV_RECIPIENT_PK_HEX,
        verified_request=_verified_request(),
    )
    assert out.get("encoding") == ENCODING_ECAP_V3
    assert suffix.endswith(".ecap")
    assert token_hash is not None and len(token_hash) == 64
    blob = base64.b64decode(str(out["package_b64"]))
    for needle in FORBIDDEN_META_ASCII:
        assert needle not in blob, f"meta leak {needle!r}"
    opened = open_capsule_v3_bytes(
        blob,
        recipient_sk=bytes.fromhex(DEV_RECIPIENT_SK_HEX),
        signing_pk=bytes.fromhex(DEV_SIGNING_PK_HEX),
    )
    assert opened["kind"] == PAYLOAD_KIND
    assert "license_key" not in opened
    assert CAPSULE_SCHEMA_VERSION_V3 == 3


def test_seal_open_roundtrip_v3_no_readable_meta() -> None:
    import base64

    from api.services.desktop_client.capsule_seal import (
        FORBIDDEN_META_ASCII,
        open_capsule_v3_bytes,
        seal_seat_bytes_v3,
    )

    seat = {
        "v": 1,
        "kind": "eliteew_desktop_seat",
        "mode": "offline",
        "license_key": "EE-TEST-AAAA-BBBB-CCCC",
        "license_id": "00000000-0000-0000-0000-000000000001",
        "allow_offline": True,
        "allow_online": False,
        "allow_fofline": False,
        "entitlement": {"v": 1, "payload": {"edition": "client"}, "sig": "x"},
        "apps": ["music"],
    }
    blob = seal_seat_bytes_v3(
        seat,
        recipient_public_key_hex=DEV_RECIPIENT_PK_HEX,
        verified_request=_verified_request(),
        activation_token="tok_test_wave4",
    )
    for needle in FORBIDDEN_META_ASCII:
        assert needle not in blob
    # Base64 wire wrapper also must not embed clear ASCII field names in binary sense;
    # the binary artifact itself is the acceptance surface.
    _ = base64.b64encode(blob)
    opened = open_capsule_v3_bytes(
        blob,
        recipient_sk=bytes.fromhex(DEV_RECIPIENT_SK_HEX),
        signing_pk=bytes.fromhex(DEV_SIGNING_PK_HEX),
    )
    assert opened["activation_token"] == "tok_test_wave4"
    assert opened["entitlement"]["payload"]["edition"] == "client"


def test_seal_fail_closed_without_dev_keys(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ELITEEW_CAPSULE_DEV_KEYS", raising=False)
    monkeypatch.setenv("ELITEEW_CAPSULE_DEV_KEYS", "0")
    monkeypatch.delenv("DESKTOP_CLIENT_CAPSULE_RECIPIENT_PUBLIC_KEY", raising=False)
    monkeypatch.delenv("DESKTOP_CLIENT_CAPSULE_SIGNING_KEY", raising=False)
    seat = {"v": 1, "kind": "eliteew_desktop_seat", "mode": "offline", "license_key": "EE-NOKEY"}
    with pytest.raises(RuntimeError, match="capsule_keys_missing"):
        seal_seat_dict(
            seat,
            recipient_public_key_hex=DEV_RECIPIENT_PK_HEX,
            verified_request=_verified_request(),
            activation_token="tok",
        )


def test_v1_envelope_rejected_on_open() -> None:
    envelope = {
        "kind": CAPSULE_KIND,
        "v": 1,
        "alg": "x25519-chacha20poly1305-ed25519",
        "ephemeral_pk": "aa" * 32,
        "nonce": "bb" * 12,
        "ciphertext": "YQ==",
        "sig": "cc" * 64,
    }
    with pytest.raises(ValueError, match="unsupported_capsule_v"):
        open_capsule_dict(
            envelope,
            recipient_sk=bytes.fromhex(DEV_RECIPIENT_SK_HEX),
            signing_pk=bytes.fromhex(DEV_SIGNING_PK_HEX),
        )
