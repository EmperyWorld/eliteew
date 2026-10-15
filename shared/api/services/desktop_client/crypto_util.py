# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Hashing and proof helpers for desktop-client license keys / device prove (Wave 2).
# Invariants:
# - Plaintext license keys are never stored; only sha256 hex digests.
# - Challenge proof is a deterministic binding hash (Ed25519 upgrade later).
# Related:
# - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
# ---

from __future__ import annotations

import hashlib
import hmac
import re
import secrets

_LICENSE_KEY_RE = re.compile(r"^EE-[A-Z0-9]{4}(?:-[A-Z0-9]{4}){3,7}$")


def normalize_license_key(raw: str) -> str:
    return raw.strip().upper().replace(" ", "")


def is_plausible_license_key(raw: str) -> bool:
    return bool(_LICENSE_KEY_RE.match(normalize_license_key(raw)))


def hash_license_key(raw: str) -> str:
    normalized = normalize_license_key(raw)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def generate_license_key(*, groups: int = 5) -> str:
    """Ops-facing key: EE-XXXX-XXXX-… (groups of 4 A-Z0-9)."""
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    parts: list[str] = []
    for _ in range(max(4, groups)):
        parts.append("".join(secrets.choice(alphabet) for _ in range(4)))
    return "EE-" + "-".join(parts)


def new_challenge_nonce() -> str:
    return secrets.token_urlsafe(24)


def challenge_proof(
    *,
    challenge: str,
    device_pubkey: str,
    machine_fingerprint: str,
) -> str:
    material = f"{challenge}:{device_pubkey.strip()}:{machine_fingerprint.strip()}"
    return hashlib.sha256(material.encode("utf-8")).hexdigest()


def verify_challenge_proof(
    *,
    challenge: str,
    device_pubkey: str,
    machine_fingerprint: str,
    proof: str,
) -> bool:
    expected = challenge_proof(
        challenge=challenge,
        device_pubkey=device_pubkey,
        machine_fingerprint=machine_fingerprint,
    )
    return hmac.compare_digest(expected, proof.strip().lower())
