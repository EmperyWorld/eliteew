# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Ed25519 entitlement blob mint/verify for desktop-client offline (O0+O1).
# Invariants:
# - Signing private key never leaves ops/API env; client holds pubkey only.
# - Canonical bytes = json.dumps(payload, sort_keys=True, separators=(',', ':')).
# - Payload includes allow_fofline / allow_online for channel cold-boot restore.
# - Optional payload.ota_artifact_pk is EmpiierOS OTA artifact verify PK only (never an SK).
# Related:
# - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md §8.1
# - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §4.2
# - documentation/product/desktop/DESKTOP-CLIENT-AIR-ENROLL.md
# ---

from __future__ import annotations

import json
import logging
import os
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import UUID

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)

logger = logging.getLogger(__name__)

DEFAULT_CLIENT_OFFLINE_APPS: list[str] = [
    "NotificationsApp",
    "ProjectAboutApp",
    "ClipboardManager",
    "MusicPlayer",
]

ENV_SIGNING_KEY = "DESKTOP_CLIENT_ENTITLEMENT_SIGNING_KEY"
ENV_ISSUER = "DESKTOP_CLIENT_ENTITLEMENT_ISSUER"
ENV_OTA_ARTIFACT_PK = "EMPIERO_OS_OTA_ARTIFACT_PK"
ENV_OTA_ARTIFACT_PK_FILE = "EMPIERO_OS_OTA_ARTIFACT_PK_FILE"
OTA_ARTIFACT_PK_PATTERN = re.compile(r"^[0-9a-f]{64}$")
_OTA_ARTIFACT_PK_FILE_MAX_BYTES = 256


def is_ota_artifact_pk(value: object) -> bool:
    return isinstance(value, str) and OTA_ARTIFACT_PK_PATTERN.fullmatch(value) is not None


def _normalize_ota_artifact_pk(raw: str | None) -> str | None:
    if raw is None:
        return None
    value = raw.strip().lower()
    if value == "redacted" or not is_ota_artifact_pk(value):
        return None
    return value


def resolve_ota_artifact_pk() -> str | None:
    """Return 32-byte lowercase hex artifact verify PK, or None if unset/malformed."""
    from_env = _normalize_ota_artifact_pk(os.environ.get(ENV_OTA_ARTIFACT_PK))
    if from_env is not None:
        return from_env
    path_raw = (os.environ.get(ENV_OTA_ARTIFACT_PK_FILE) or "").strip()
    if not path_raw:
        return None
    path = Path(path_raw)
    try:
        if not path.is_file() or path.stat().st_size > _OTA_ARTIFACT_PK_FILE_MAX_BYTES:
            return None
        return _normalize_ota_artifact_pk(path.read_text(encoding="ascii"))
    except OSError:
        return None


def _unix(dt: datetime | None) -> int | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return int(dt.timestamp())


def normalize_apps(apps: list[Any] | None, *, edition: str, profile_id: str | None) -> list[str]:
    out: list[str] = []
    for item in apps or []:
        if isinstance(item, str) and item.strip():
            out.append(item.strip())
        elif isinstance(item, dict):
            comp = item.get("app_component") or item.get("component") or item.get("id")
            if isinstance(comp, str) and comp.strip():
                out.append(comp.strip())
    if out:
        return out
    if edition == "client" or (profile_id or "") == "client-offline-ai":
        return list(DEFAULT_CLIENT_OFFLINE_APPS)
    return []


def canonical_payload_bytes(payload: dict[str, Any]) -> bytes:
    return json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def _load_signing_key_hex() -> bytes | None:
    raw = os.environ.get(ENV_SIGNING_KEY, "").strip()
    if not raw or "REPLACE_WITH" in raw:
        try:
            from api.core.unified_config import settings

            raw = (getattr(settings, "desktop_client_entitlement_signing_key", None) or "").strip()
        except Exception:
            logger.debug(
                "[STEP] desktop_client_entitlement_settings_skip reason=import_or_unset",
                exc_info=True,
            )
            raw = ""
    if not raw or "REPLACE_WITH" in raw:
        return None
    try:
        seed = bytes.fromhex(raw)
    except ValueError:
        logger.warning("[STEP] desktop_client_entitlement_key_invalid reason=hex")
        return None
    if len(seed) != 32:
        logger.warning("[STEP] desktop_client_entitlement_key_invalid reason=length")
        return None
    return seed


def build_payload(
    *,
    license_id: UUID | str,
    edition: str,
    profile_id: str | None,
    apps: list[Any] | None,
    machine_fingerprint: str | None,
    device_id: UUID | str | None,
    expires_at: datetime | None,
    issuer: str | None = None,
    iat: int | None = None,
    allow_fofline: bool = False,
    allow_online: bool = True,
) -> dict[str, Any]:
    issuer_val = (issuer or os.environ.get(ENV_ISSUER, "") or "eliteew-ops").strip()
    payload: dict[str, Any] = {
        "allow_fofline": bool(allow_fofline),
        "allow_online": bool(allow_online),
        "apps": normalize_apps(apps, edition=edition, profile_id=profile_id),
        "device_id": str(device_id) if device_id else None,
        "edition": edition,
        "exp": _unix(expires_at),
        "iat": iat if iat is not None else int(datetime.now(UTC).timestamp()),
        "issuer": issuer_val,
        "license_id": str(license_id),
        "machine_fingerprint": (machine_fingerprint or "").strip() or None,
        "profile_id": profile_id,
    }
    ota_artifact_pk = resolve_ota_artifact_pk()
    if ota_artifact_pk is not None:
        payload["ota_artifact_pk"] = ota_artifact_pk
    return payload


def load_signing_key_seed() -> bytes | None:
    """Public alias for ops denylist mint (same seed as entitlement)."""
    return _load_signing_key_hex()


def sign_payload(payload: dict[str, Any], *, seed: bytes | None = None) -> dict[str, Any]:
    """Return entitlement document {v, payload, sig} or raise if no key."""
    key_bytes = seed if seed is not None else _load_signing_key_hex()
    if key_bytes is None:
        raise RuntimeError("entitlement_signing_key_missing")
    private = Ed25519PrivateKey.from_private_bytes(key_bytes)
    msg = canonical_payload_bytes(payload)
    sig = private.sign(msg).hex()
    return {"v": 1, "payload": payload, "sig": sig}


def try_mint_entitlement(
    *,
    license_id: UUID | str,
    edition: str,
    profile_id: str | None,
    apps: list[Any] | None,
    machine_fingerprint: str | None,
    device_id: UUID | str | None,
    expires_at: datetime | None,
    allow_fofline: bool = False,
    allow_online: bool = True,
) -> dict[str, Any] | None:
    """Mint signed blob when signing key configured; else None (connected redeem still OK)."""
    if _load_signing_key_hex() is None:
        return None
    payload = build_payload(
        license_id=license_id,
        edition=edition,
        profile_id=profile_id,
        apps=apps,
        machine_fingerprint=machine_fingerprint,
        device_id=device_id,
        expires_at=expires_at,
        allow_fofline=allow_fofline,
        allow_online=allow_online,
    )
    try:
        doc = sign_payload(payload)
    except Exception:
        logger.exception("[STEP] desktop_client_entitlement_sign_fail")
        return None
    logger.info(
        "[STEP] desktop_client_entitlement_minted license_id=%s edition=%s apps=%s",
        license_id,
        edition,
        len(payload.get("apps") or []),
    )
    return doc


def verify_document(doc: dict[str, Any], *, pubkey_hex: str) -> dict[str, Any]:
    """Ops/test helper — verify document against public key hex."""
    if int(doc.get("v") or 0) != 1:
        raise ValueError("unsupported_version")
    payload = doc.get("payload")
    sig_hex = doc.get("sig")
    if not isinstance(payload, dict) or not isinstance(sig_hex, str):
        raise ValueError("payload_incomplete")
    pk = Ed25519PublicKey.from_public_bytes(bytes.fromhex(pubkey_hex.strip()))
    try:
        pk.verify(bytes.fromhex(sig_hex.strip()), canonical_payload_bytes(payload))
    except InvalidSignature as exc:
        raise ValueError("sig_bad") from exc
    exp = payload.get("exp")
    if isinstance(exp, int) and exp <= int(datetime.now(UTC).timestamp()):
        raise ValueError("expired")
    return payload


def generate_keypair_hex() -> tuple[str, str]:
    """Return (private_seed_hex, public_key_hex) for ops bootstrap."""
    private = Ed25519PrivateKey.generate()
    seed = private.private_bytes_raw()
    pub = private.public_key().public_bytes_raw()
    return seed.hex(), pub.hex()
