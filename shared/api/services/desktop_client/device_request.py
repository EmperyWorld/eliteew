# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Strict device_request_v1 parse + Ed25519 self-signature verify (Wave 3 / F-03).
# Invariants:
# - Unknown fields rejected; key lengths fixed; age window enforced.
# - Signature transcript matches desktop-client Rust device_request.rs.
# Related:
# - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md §4
# ---

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from typing import Any

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

from api.services.desktop_client.license_service import DesktopClientError

logger = logging.getLogger(__name__)

KIND = "device_request_v1"
ALLOWED_PRODUCTS = frozenset({"eliteew-desktop-connected", "eliteew-fofline"})
ALLOWED_APP_IDS = frozenset(
    {
        "world.empery.desktop.client",
        "world.empery.desktop.connected.v1",
        "world.empery.fofline",
    }
)
MAX_AGE = timedelta(days=7)
FUTURE_SKEW = timedelta(minutes=5)
REQUIRED_FIELDS = (
    "kind",
    "request_id",
    "product_id",
    "app_identifier",
    "device_signing_pubkey",
    "capsule_recipient_pubkey",
    "recipient_key_id",
    "machine_fingerprint_hash",
    "created_at",
    "nonce",
    "signature",
)


def signature_transcript(req: dict[str, Any]) -> bytes:
    return (
        "device_request_v1|"
        f"{req['request_id']}|{req['product_id']}|{req['app_identifier']}|"
        f"{req['device_signing_pubkey']}|{req['capsule_recipient_pubkey']}|"
        f"{req['recipient_key_id']}|{req['machine_fingerprint_hash']}|"
        f"{req['created_at']}|{req['nonce']}"
    ).encode()


def _hex_len(value: str, *, want: int, label: str) -> str:
    t = (value or "").strip().lower()
    if len(t) != want or any(c not in "0123456789abcdef" for c in t):
        raise DesktopClientError(
            "device_request_invalid",
            f"invalid {label}",
            http_status=400,
        )
    return t


def parse_and_verify_device_request(raw: dict[str, Any] | None) -> dict[str, str]:
    if not isinstance(raw, dict):
        raise DesktopClientError(
            "device_request_required",
            "device_request is required for sealed seat issue",
            http_status=400,
        )
    unknown = sorted(set(raw.keys()) - set(REQUIRED_FIELDS))
    if unknown:
        raise DesktopClientError(
            "device_request_unknown_field",
            f"unknown fields: {', '.join(unknown)}",
            http_status=400,
        )
    for key in REQUIRED_FIELDS:
        if key not in raw or raw[key] is None or str(raw[key]).strip() == "":
            raise DesktopClientError(
                "device_request_missing_field",
                f"missing {key}",
                http_status=400,
            )

    kind = str(raw["kind"]).strip()
    if kind != KIND:
        raise DesktopClientError("device_request_kind", "kind must be device_request_v1", http_status=400)

    product_id = str(raw["product_id"]).strip()
    app_identifier = str(raw["app_identifier"]).strip()
    if product_id not in ALLOWED_PRODUCTS:
        raise DesktopClientError("device_request_product", "unsupported product_id", http_status=400)
    if app_identifier not in ALLOWED_APP_IDS:
        raise DesktopClientError(
            "device_request_app",
            "unsupported app_identifier",
            http_status=400,
        )

    signing_pk = _hex_len(str(raw["device_signing_pubkey"]), want=64, label="device_signing_pubkey")
    recipient_pk = _hex_len(str(raw["capsule_recipient_pubkey"]), want=64, label="capsule_recipient_pubkey")
    sig_hex = _hex_len(str(raw["signature"]), want=128, label="signature")
    nonce = str(raw["nonce"]).strip().lower()
    if len(nonce) < 32 or any(c not in "0123456789abcdef" for c in nonce):
        raise DesktopClientError("device_request_nonce", "invalid nonce", http_status=400)

    created_raw = str(raw["created_at"]).strip()
    try:
        created = datetime.fromisoformat(created_raw.replace("Z", "+00:00"))
        if created.tzinfo is None:
            created = created.replace(tzinfo=UTC)
        created = created.astimezone(UTC)
    except ValueError as exc:
        raise DesktopClientError(
            "device_request_created_at",
            "invalid created_at",
            http_status=400,
        ) from exc

    now = datetime.now(UTC)
    if created - now > FUTURE_SKEW:
        raise DesktopClientError("device_request_future", "created_at in the future", http_status=400)
    if now - created > MAX_AGE:
        raise DesktopClientError("device_request_expired", "device request expired", http_status=400)

    normalized = {
        "kind": KIND,
        "request_id": str(raw["request_id"]).strip(),
        "product_id": product_id,
        "app_identifier": app_identifier,
        "device_signing_pubkey": signing_pk,
        "capsule_recipient_pubkey": recipient_pk,
        "recipient_key_id": str(raw["recipient_key_id"]).strip(),
        "machine_fingerprint_hash": str(raw["machine_fingerprint_hash"]).strip(),
        "created_at": created_raw if created_raw.endswith("Z") else created.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "nonce": nonce,
        "signature": sig_hex,
    }
    # Re-sign transcript uses the client-provided created_at string as signed.
    normalized["created_at"] = created_raw
    msg = signature_transcript(normalized)
    try:
        Ed25519PublicKey.from_public_bytes(bytes.fromhex(signing_pk)).verify(bytes.fromhex(sig_hex), msg)
    except Exception as exc:
        logger.info("[STEP] device_request_bad_signature")
        raise DesktopClientError(
            "device_request_bad_signature",
            "device request signature invalid",
            http_status=400,
        ) from exc

    expires_at = created + MAX_AGE
    normalized["expires_at"] = expires_at.isoformat()
    return normalized
