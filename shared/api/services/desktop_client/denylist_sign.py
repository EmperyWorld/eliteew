# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Soft-revoke denylist for desktop-client (O4) — signed like entitlement blobs.
# Invariants:
# - Dedicated Ed25519 seed (DESKTOP_CLIENT_DENYLIST_SIGNING_KEY) — Wave 8 role split.
# - Never reuse DESKTOP_CLIENT_ENTITLEMENT_SIGNING_KEY for denylist.
# - Canonical bytes = json.dumps(payload, sort_keys=True, separators=(',', ':')).
# Related:
# - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md §7
# - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md §8.1
# ---

from __future__ import annotations

import logging
import os
from datetime import UTC, datetime
from typing import Any

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from api.services.desktop_client.entitlement_sign import (
    ENV_ISSUER,
    canonical_payload_bytes,
    verify_document,
)

logger = logging.getLogger(__name__)

ENV_DENYLIST_SEED = "DESKTOP_CLIENT_DENYLIST_SIGNING_KEY"


def load_denylist_signing_key_seed() -> bytes | None:
    raw = (os.environ.get(ENV_DENYLIST_SEED) or "").strip()
    if not raw or "REPLACE_WITH" in raw:
        return None
    if len(raw) != 64 or any(c not in "0123456789abcdefABCDEF" for c in raw):
        return None
    return bytes.fromhex(raw)


def build_denylist_payload(
    *,
    revoked_license_ids: list[str],
    issuer: str | None = None,
    iat: int | None = None,
    note: str | None = None,
) -> dict[str, Any]:
    ids: list[str] = []
    seen: set[str] = set()
    for raw in revoked_license_ids:
        lid = str(raw or "").strip()
        if not lid or lid in seen:
            continue
        seen.add(lid)
        ids.append(lid)
    ids.sort()
    issuer_val = (issuer or os.environ.get(ENV_ISSUER, "") or "eliteew-ops").strip()
    payload: dict[str, Any] = {
        "iat": iat if iat is not None else int(datetime.now(UTC).timestamp()),
        "issuer": issuer_val,
        "revoked_license_ids": ids,
    }
    if note and str(note).strip():
        payload["note"] = str(note).strip()
    return payload


def sign_denylist(payload: dict[str, Any], *, seed: bytes | None = None) -> dict[str, Any]:
    key_bytes = seed if seed is not None else load_denylist_signing_key_seed()
    if key_bytes is None:
        raise RuntimeError("denylist_signing_key_missing")
    private = Ed25519PrivateKey.from_private_bytes(key_bytes)
    msg = canonical_payload_bytes(payload)
    sig = private.sign(msg).hex()
    return {"v": 1, "payload": payload, "sig": sig}


def verify_denylist(doc: dict[str, Any], *, pubkey_hex: str) -> dict[str, Any]:
    """Reuse entitlement document verifier (same v/payload/sig shape)."""
    payload = verify_document(doc, pubkey_hex=pubkey_hex)
    ids = payload.get("revoked_license_ids")
    if not isinstance(ids, list):
        raise ValueError("payload_incomplete")
    return payload


def is_license_revoked(payload: dict[str, Any], license_id: str) -> bool:
    lid = (license_id or "").strip()
    if not lid:
        return False
    ids = payload.get("revoked_license_ids") or []
    return any(str(x).strip() == lid for x in ids if x is not None)
