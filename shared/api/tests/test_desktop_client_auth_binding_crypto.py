# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for auth binding crypto helpers (transcript + Ed25519 verify).
# Related:
# - api/services/desktop_client/auth_binding_crypto.py
# ---

from __future__ import annotations

import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from api.services.desktop_client import DesktopClientError
from api.services.desktop_client.auth_binding_crypto import (
    build_ticket_transcript,
    hash_redirect_uri,
    hash_ticket_plaintext,
    verify_device_ed25519_signature,
)


def test_hash_ticket_plaintext_deterministic() -> None:
    assert hash_ticket_plaintext("atkt_example") == hash_ticket_plaintext("atkt_example")
    assert len(hash_ticket_plaintext("x")) == 64


def test_build_ticket_transcript_canonical() -> None:
    payload = {
        "nonce": "n1",
        "license_id": "lic-uuid",
        "device_id": None,
        "client_id": "empery-desktop",
        "channel": "desktop",
        "dpop_jkt": "jkt1",
        "pkce_challenge": "pkce1",
        "redirect_uri": None,
        "jti": "jti1",
        "issued_at": 1700000000,
    }
    first = build_ticket_transcript(payload)
    second = build_ticket_transcript(payload)
    assert first == second
    assert b'"channel":"desktop"' in first


def test_verify_device_ed25519_signature_ok() -> None:
    signing = Ed25519PrivateKey.generate()
    pubkey = signing.public_key().public_bytes_raw().hex()
    message = b"ticket-transcript-bytes"
    signature = signing.sign(message).hex()
    verify_device_ed25519_signature(
        device_pubkey_hex=pubkey,
        message=message,
        signature_hex=signature,
    )


def test_verify_device_ed25519_signature_bad_sig() -> None:
    signing = Ed25519PrivateKey.generate()
    pubkey = signing.public_key().public_bytes_raw().hex()
    with pytest.raises(DesktopClientError) as exc:
        verify_device_ed25519_signature(
            device_pubkey_hex=pubkey,
            message=b"msg",
            signature_hex="00" * 64,
        )
    assert exc.value.code == "auth_policy_denied"


def test_hash_redirect_uri_normalizes() -> None:
    assert hash_redirect_uri("  https://example/cb  ") == hash_redirect_uri("https://example/cb")
