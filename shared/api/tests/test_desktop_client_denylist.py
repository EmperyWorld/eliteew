# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for O4 soft-revoke denylist signing.
# Related:
# - api/services/desktop_client/denylist_sign.py
# ---

from __future__ import annotations

import pytest

from api.services.desktop_client.denylist_sign import (
    build_denylist_payload,
    is_license_revoked,
    sign_denylist,
    verify_denylist,
)
from api.services.desktop_client.entitlement_sign import generate_keypair_hex


def test_denylist_sign_and_verify_roundtrip() -> None:
    seed_hex, pub_hex = generate_keypair_hex()
    seed = bytes.fromhex(seed_hex)
    payload = build_denylist_payload(
        revoked_license_ids=["b-id", "a-id", "a-id"],
        note="soft",
    )
    assert payload["revoked_license_ids"] == ["a-id", "b-id"]
    doc = sign_denylist(payload, seed=seed)
    verified = verify_denylist(doc, pubkey_hex=pub_hex)
    assert is_license_revoked(verified, "a-id") is True
    assert is_license_revoked(verified, "missing") is False


def test_denylist_requires_dedicated_seed_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DESKTOP_CLIENT_DENYLIST_SIGNING_KEY", raising=False)
    monkeypatch.setenv(
        "DESKTOP_CLIENT_ENTITLEMENT_SIGNING_KEY",
        "11" * 32,
    )
    with pytest.raises(RuntimeError, match="denylist_signing_key_missing"):
        sign_denylist(build_denylist_payload(revoked_license_ids=["x"]))


def test_denylist_bad_sig_fails() -> None:
    seed_hex, pub_hex = generate_keypair_hex()
    doc = sign_denylist(
        build_denylist_payload(revoked_license_ids=["x"]),
        seed=bytes.fromhex(seed_hex),
    )
    doc["sig"] = "00" * 64
    with pytest.raises(ValueError, match="sig_bad"):
        verify_denylist(doc, pubkey_hex=pub_hex)
