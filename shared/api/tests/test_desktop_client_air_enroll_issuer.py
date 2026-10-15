# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract locks for FoFline Air mint requiring payload.ota_artifact_pk.
# Related:
# - api/services/desktop_client/air_enroll_issuer.py
# - documentation/product/desktop/DESKTOP-CLIENT-AIR-ENROLL.md
# ---

from __future__ import annotations

from pathlib import Path
from uuid import uuid4

import pytest

from api.services.desktop_client.air_enroll_issuer import require_fofline_ota_artifact_pk
from api.services.desktop_client.entitlement_sign import (
    ENV_OTA_ARTIFACT_PK,
    ENV_OTA_ARTIFACT_PK_FILE,
    build_payload,
    generate_keypair_hex,
    sign_payload,
    try_mint_entitlement,
    verify_document,
)
from api.services.desktop_client.license_models import DesktopClientError

_LIVING_OTA_PK = "813cfc81a78de51b9cfe03802b8433497810b814c43558ad068235b14c32796f"


def _clear_ota_pk_env(monkeypatch) -> None:
    monkeypatch.delenv(ENV_OTA_ARTIFACT_PK, raising=False)
    monkeypatch.delenv(ENV_OTA_ARTIFACT_PK_FILE, raising=False)


def test_fofline_air_without_ota_pk_raises_named_error(monkeypatch) -> None:
    _clear_ota_pk_env(monkeypatch)
    seed, _pub = generate_keypair_hex()
    monkeypatch.setenv("DESKTOP_CLIENT_ENTITLEMENT_SIGNING_KEY", seed)
    entitlement = try_mint_entitlement(
        license_id=uuid4(),
        edition="client",
        profile_id="client-offline-ai",
        apps=["NotificationsApp"],
        machine_fingerprint=None,
        device_id=None,
        expires_at=None,
        allow_fofline=True,
        allow_online=True,
    )
    assert entitlement is not None
    assert "ota_artifact_pk" not in entitlement["payload"]
    with pytest.raises(DesktopClientError) as exc:
        require_fofline_ota_artifact_pk(
            allow_fofline=True,
            entitlement=entitlement,
        )
    assert exc.value.code == "ota_artifact_pk_missing"
    assert exc.value.http_status == 503


def test_fofline_air_with_ota_pk_keeps_minted_hex(monkeypatch) -> None:
    _clear_ota_pk_env(monkeypatch)
    seed, pub = generate_keypair_hex()
    monkeypatch.setenv("DESKTOP_CLIENT_ENTITLEMENT_SIGNING_KEY", seed)
    monkeypatch.setenv(ENV_OTA_ARTIFACT_PK, _LIVING_OTA_PK)
    entitlement = try_mint_entitlement(
        license_id=uuid4(),
        edition="client",
        profile_id="client-offline-ai",
        apps=["NotificationsApp"],
        machine_fingerprint=None,
        device_id=None,
        expires_at=None,
        allow_fofline=True,
        allow_online=True,
    )
    assert entitlement is not None
    require_fofline_ota_artifact_pk(
        allow_fofline=True,
        entitlement=entitlement,
    )
    assert entitlement["payload"]["ota_artifact_pk"] == _LIVING_OTA_PK
    assert verify_document(entitlement, pubkey_hex=pub)["ota_artifact_pk"] == _LIVING_OTA_PK


def test_air_issuer_checks_ota_pk_before_seal() -> None:
    src = Path("services/desktop_client/air_enroll_issuer.py").read_text(encoding="utf-8")
    mint = src.index("entitlement = try_mint_entitlement(")
    check = src.index("require_fofline_ota_artifact_pk(", mint)
    seal = src.index("maybe_seal_for_issue(", check)
    assert mint < check < seal


def test_require_skips_when_entitlement_missing() -> None:
    require_fofline_ota_artifact_pk(allow_fofline=True, entitlement=None)


def test_signed_payload_without_env_has_no_null_key(monkeypatch) -> None:
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
    doc = sign_payload(payload, seed=bytes.fromhex(generate_keypair_hex()[0]))
    assert "ota_artifact_pk" not in doc["payload"]
