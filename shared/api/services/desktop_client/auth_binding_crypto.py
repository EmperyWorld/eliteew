# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Canonical auth-ticket transcript hashing and Ed25519 verify for atomic conditional access.
# Invariants:
# - Plaintext tickets never stored; only SHA-256 hex digest.
# Related:
# - auth_binding.py
# - documentation/product/desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md
# ---

from __future__ import annotations

import hashlib
import json
from typing import Any

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

from api.services.desktop_client import DesktopClientError


def hash_ticket_plaintext(plaintext: str) -> str:
    return hashlib.sha256(plaintext.encode("utf-8")).hexdigest()


def hash_redirect_uri(redirect_uri: str) -> str:
    normalized = redirect_uri.strip()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def build_ticket_transcript(payload: dict[str, Any]) -> bytes:
    """Deterministic JSON transcript for device Ed25519 signature."""
    ordered = {
        "nonce": str(payload["nonce"]),
        "license_id": str(payload["license_id"]),
        "device_id": payload.get("device_id"),
        "client_id": str(payload["client_id"]),
        "channel": str(payload["channel"]),
        "dpop_jkt": str(payload["dpop_jkt"]),
        "pkce_challenge": str(payload["pkce_challenge"]),
        "redirect_uri": payload.get("redirect_uri"),
        "jti": str(payload["jti"]),
        "issued_at": int(payload["issued_at"]),
    }
    return json.dumps(ordered, sort_keys=True, separators=(",", ":")).encode("utf-8")


def verify_device_ed25519_signature(
    *,
    device_pubkey_hex: str,
    message: bytes,
    signature_hex: str,
) -> None:
    pk_hex = device_pubkey_hex.strip().lower()
    sig_hex = signature_hex.strip().lower()
    try:
        Ed25519PublicKey.from_public_bytes(bytes.fromhex(pk_hex)).verify(
            bytes.fromhex(sig_hex),
            message,
        )
    except Exception as exc:
        raise DesktopClientError(
            "auth_policy_denied",
            "Authentication could not be completed",
            http_status=403,
        ) from exc
