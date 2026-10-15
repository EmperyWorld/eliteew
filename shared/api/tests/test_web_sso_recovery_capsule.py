# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Continuity W3 unit locks for recovery-capsule encrypt/size/TTL helpers
# (no DB). Fernet round-trip via SECRET_KEY derive path.
# Related:
# - api.services.web_sso_recovery_capsule
# - documentation/platform/WEB-SSO-SESSION-CONTINUITY-PLAN.md §W3
# ---

from __future__ import annotations

import os

import pytest

# Ensure derive path has material before importing service helpers that read settings.
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-recovery-capsule-unit")


def test_encrypt_decrypt_round_trip(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SECRET_KEY", "test-secret-key-for-recovery-capsule-unit")
    monkeypatch.delenv("ENCRYPTION_MASTER_KEY", raising=False)
    from api.services import web_sso_recovery_capsule as mod

    payload = {"schema_version": 1, "intended_route": "desktop", "drafts": {"a": 1}}
    cipher = mod._encrypt_payload(payload)
    assert isinstance(cipher, (bytes, bytearray))
    assert mod._decrypt_payload(bytes(cipher)) == payload


def test_payload_too_large(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SECRET_KEY", "test-secret-key-for-recovery-capsule-unit")
    from api.services import web_sso_recovery_capsule as mod

    huge = {"blob": "x" * (mod.MAX_PAYLOAD_BYTES + 10)}
    with pytest.raises(mod.RecoveryCapsuleError) as exc:
        mod._encrypt_payload(huge)
    assert exc.value.code == "payload_too_large"


def test_ttl_is_seven_days() -> None:
    from api.services.web_sso_recovery_capsule import CAPSULE_TTL

    assert CAPSULE_TTL.days == 7
