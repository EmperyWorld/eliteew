# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for desktop-client Ed25519 entitlement mint/verify (O0+O1).
# Invariants:
# - Without signing key, redeem omits entitlement; with key, document verifies.
# - ota_artifact_pk is omitted unless a valid 32-byte hex verify PK resolves.
# Related:
# - api/services/desktop_client/entitlement_sign.py
# - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md §8.1
# ---

from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from api.services.desktop_client.entitlement_sign import (
    DEFAULT_CLIENT_OFFLINE_APPS,
    ENV_OTA_ARTIFACT_PK,
    ENV_OTA_ARTIFACT_PK_FILE,
    build_payload,
    generate_keypair_hex,
    resolve_ota_artifact_pk,
    sign_payload,
    try_mint_entitlement,
    verify_document,
)

_LIVING_OTA_PK = "813cfc81a78de51b9cfe03802b8433497810b814c43558ad068235b14c32796f"


def _clear_ota_pk_env(monkeypatch) -> None:
    monkeypatch.delenv(ENV_OTA_ARTIFACT_PK, raising=False)
    monkeypatch.delenv(ENV_OTA_ARTIFACT_PK_FILE, raising=False)


def test_sign_and_verify_roundtrip(monkeypatch) -> None:
    seed, pub = generate_keypair_hex()
    monkeypatch.setenv("DESKTOP_CLIENT_ENTITLEMENT_SIGNING_KEY", seed)
    payload = build_payload(
        license_id=uuid4(),
        edition="client",
        profile_id="client-offline-ai",
        apps=None,
        machine_fingerprint="fp_testfingerprint01",
        device_id=uuid4(),
        expires_at=datetime.now(UTC) + timedelta(days=30),
    )
    assert payload["apps"] == DEFAULT_CLIENT_OFFLINE_APPS
    doc = sign_payload(payload)
    assert doc["v"] == 1
    assert isinstance(doc["sig"], str) and len(doc["sig"]) == 128
    out = verify_document(doc, pubkey_hex=pub)
    assert out["edition"] == "client"
    assert out["license_id"] == payload["license_id"]


def test_try_mint_omits_without_key(monkeypatch) -> None:
    monkeypatch.delenv("DESKTOP_CLIENT_ENTITLEMENT_SIGNING_KEY", raising=False)
    # Avoid unified_settings leak from env in developer shells
    monkeypatch.setenv("DESKTOP_CLIENT_ENTITLEMENT_SIGNING_KEY", "")
    from api.core.unified_config import settings as unified_settings

    monkeypatch.setattr(
        unified_settings,
        "desktop_client_entitlement_signing_key",
        "",
        raising=False,
    )
    doc = try_mint_entitlement(
        license_id=uuid4(),
        edition="connected",
        profile_id=None,
        apps=[],
        machine_fingerprint="fp_x",
        device_id=uuid4(),
        expires_at=None,
    )
    assert doc is None


def test_try_mint_when_key_set(monkeypatch) -> None:
    seed, pub = generate_keypair_hex()
    monkeypatch.setenv("DESKTOP_CLIENT_ENTITLEMENT_SIGNING_KEY", seed)
    doc = try_mint_entitlement(
        license_id=uuid4(),
        edition="client",
        profile_id="client-offline-ai",
        apps=["NotificationsApp"],
        machine_fingerprint="fp_y",
        device_id=uuid4(),
        expires_at=None,
        allow_fofline=True,
    )
    assert doc is not None
    out = verify_document(doc, pubkey_hex=pub)
    assert out["allow_fofline"] is True
    assert os.environ.get("DESKTOP_CLIENT_ENTITLEMENT_SIGNING_KEY") == seed


def test_build_payload_defaults_allow_fofline_false(monkeypatch) -> None:
    _clear_ota_pk_env(monkeypatch)
    payload = build_payload(
        license_id=uuid4(),
        edition="connected",
        profile_id=None,
        apps=[],
        machine_fingerprint=None,
        device_id=uuid4(),
        expires_at=None,
    )
    assert payload["allow_fofline"] is False
    assert "ota_artifact_pk" not in payload


def test_build_payload_includes_ota_artifact_pk_from_env(monkeypatch) -> None:
    _clear_ota_pk_env(monkeypatch)
    seed, pub = generate_keypair_hex()
    monkeypatch.setenv("DESKTOP_CLIENT_ENTITLEMENT_SIGNING_KEY", seed)
    monkeypatch.setenv(ENV_OTA_ARTIFACT_PK, _LIVING_OTA_PK.upper())
    payload = build_payload(
        license_id=uuid4(),
        edition="client",
        profile_id="client-offline-ai",
        apps=None,
        machine_fingerprint="fp_ota",
        device_id=uuid4(),
        expires_at=datetime.now(UTC) + timedelta(days=7),
        allow_fofline=True,
    )
    assert payload["ota_artifact_pk"] == _LIVING_OTA_PK
    doc = sign_payload(payload)
    out = verify_document(doc, pubkey_hex=pub)
    assert out["ota_artifact_pk"] == _LIVING_OTA_PK


def test_build_payload_omits_ota_artifact_pk_when_unset(monkeypatch) -> None:
    _clear_ota_pk_env(monkeypatch)
    payload = build_payload(
        license_id=uuid4(),
        edition="client",
        profile_id="client-offline-ai",
        apps=None,
        machine_fingerprint=None,
        device_id=None,
        expires_at=None,
        allow_fofline=True,
    )
    assert "ota_artifact_pk" not in payload


def test_resolve_ota_artifact_pk_rejects_redacted_and_short(monkeypatch) -> None:
    _clear_ota_pk_env(monkeypatch)
    monkeypatch.setenv(ENV_OTA_ARTIFACT_PK, "REDACTED")
    assert resolve_ota_artifact_pk() is None
    monkeypatch.setenv(ENV_OTA_ARTIFACT_PK, "813cfc81")
    assert resolve_ota_artifact_pk() is None


def test_resolve_ota_artifact_pk_reads_file(monkeypatch, tmp_path) -> None:
    _clear_ota_pk_env(monkeypatch)
    pk_file = tmp_path / "artifact.pk.hex"
    pk_file.write_text(f"{_LIVING_OTA_PK}\n", encoding="ascii")
    monkeypatch.setenv(ENV_OTA_ARTIFACT_PK_FILE, str(pk_file))
    assert resolve_ota_artifact_pk() == _LIVING_OTA_PK
