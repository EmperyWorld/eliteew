# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Seal desktop-client Capsule (v3 opaque binary default; v2 JSON Known Vulnerability).
# Invariants:
# - Recipient pubkey only from verified device_request (Wave 3/4); no global shared recipient.
# - Inner payload is capsule_payload_v2 — no reusable license_key.
# - Capsule v3 outer bytes must not contain ASCII license meta (expires_at/product_id/…).
# - Plaintext issue only when BOTH DESKTOP_CLIENT_CAPSULE_ALLOW_PLAINTEXT=1 AND
#   ELITEEW_CAPSULE_DEV_KEYS=1 (production ALLOW_PLAINTEXT alone = False).
# Related:
# - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md §4 / §12g
# - api/services/desktop_client/seat_package.py
# ---

from __future__ import annotations

import base64
import hashlib
import json
import logging
import os
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)
from cryptography.hazmat.primitives.asymmetric.x25519 import (
    X25519PrivateKey,
    X25519PublicKey,
)
from cryptography.hazmat.primitives.ciphers.aead import ChaCha20Poly1305
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

logger = logging.getLogger(__name__)

CAPSULE_KIND = "eliteew_desktop_capsule"
CAPSULE_SCHEMA_VERSION = 2  # v2 JSON envelope — Known Vulnerability (metadata ID)
CAPSULE_SCHEMA_VERSION_V3 = 3
CAPSULE_ALG = "x25519-chacha20poly1305-ed25519"
HKDF_INFO = b"eliteew-desktop-capsule-v2"
HKDF_INFO_V3 = b"eliteew-desktop-capsule-v3"
PAYLOAD_KIND = "eliteew_desktop_capsule_payload"
PAYLOAD_SCHEMA_VERSION = 2
# Opaque binary framing (Full Security). Magic is not license metadata.
CAPSULE_V3_MAGIC = b"EECAP3\0\0"
CAPSULE_V3_ALG_ID = 1
ENCODING_ECAP_V3 = "ecap_v3"
# Substrings that must NEVER appear as ASCII in sealed v3 outer bytes.
FORBIDDEN_META_ASCII = (b"expires_at", b"product_id", b"request_id", b"license_id")

CHANNEL_BY_PRODUCT = {
    "eliteew-desktop-connected": "connected",
    "eliteew-fofline": "fofline",
}

ENV_SIGNING_KEY = "DESKTOP_CLIENT_CAPSULE_SIGNING_KEY"
ENV_ALLOW_PLAINTEXT = "DESKTOP_CLIENT_CAPSULE_ALLOW_PLAINTEXT"

# Dev/test vectors only — used when ELITEEW_CAPSULE_DEV_KEYS=1 (explicit). Never default.
DEV_RECIPIENT_SK_HEX = "11" * 32
DEV_RECIPIENT_PK_HEX = "7b4e909bbe7ffe44c465a220037d608ee35897d31ef972f07f74892cb0f73f13"
DEV_SIGNING_SK_HEX = "22" * 32
DEV_SIGNING_PK_HEX = "a09aa5f47a6759802ff955f8dc2d2a14a5c99d23be97f864127ff9383455a4f0"

ALLOWED_ENVELOPE_FIELDS = frozenset(
    {
        "kind",
        "v",
        "alg",
        "product_id",
        "channel",
        "request_id",
        "recipient_key_id",
        "ephemeral_pk",
        "created_at",
        "expires_at",
        "nonce",
        "ciphertext_sha256",
        "ciphertext",
        "sig",
    }
)


def _dev_keys_allowed() -> bool:
    """Fail-closed: public DEV vectors only when explicitly enabled."""
    return os.environ.get("ELITEEW_CAPSULE_DEV_KEYS", "").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )


def _hex32(raw: str, *, label: str) -> bytes | None:
    t = (raw or "").strip()
    if not t or "REPLACE_WITH" in t:
        return None
    try:
        b = bytes.fromhex(t)
    except ValueError:
        logger.warning("[STEP] capsule_key_invalid label=%s reason=hex", label)
        return None
    if len(b) != 32:
        logger.warning("[STEP] capsule_key_invalid label=%s reason=length", label)
        return None
    return b


def _load_signing_private() -> bytes | None:
    raw = os.environ.get(ENV_SIGNING_KEY, "").strip()
    if not raw:
        try:
            from api.core.unified_config import settings

            raw = (getattr(settings, "desktop_client_capsule_signing_key", None) or "").strip()
        except Exception:
            logger.debug(
                "[STEP] capsule_signing_settings_skip reason=import_or_unset",
                exc_info=True,
            )
            raw = ""
    got = _hex32(raw, label="signing_sk")
    if got:
        return got
    if _dev_keys_allowed():
        logger.warning("[STEP] capsule_dev_keys_active material=signing_sk")
        return bytes.fromhex(DEV_SIGNING_SK_HEX)
    return None


def allow_plaintext_issue() -> bool:
    """Plaintext seat issue: dual fail-closed (ALLOW_PLAINTEXT ∧ DEV_KEYS)."""
    allow = os.environ.get(ENV_ALLOW_PLAINTEXT, "").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )
    return allow and _dev_keys_allowed()


def channel_for_product(product_id: str) -> str:
    channel = CHANNEL_BY_PRODUCT.get(product_id)
    if not channel:
        raise RuntimeError("capsule_product_unsupported")
    return channel


def mint_activation_token() -> tuple[str, str]:
    """Return (token_plaintext, sha256_hex) — plaintext only enters sealed payload once."""
    token = secrets.token_urlsafe(32)
    digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
    return token, digest


def build_capsule_payload_v2(
    seat: dict[str, Any],
    *,
    verified_request: dict[str, str],
    activation_token: str,
) -> dict[str, Any]:
    """Strip reusable license_key; bind to device request + one-time activation token."""
    if seat.get("kind") != "eliteew_desktop_seat":
        raise RuntimeError("capsule_inner_seat_kind")
    return {
        "v": PAYLOAD_SCHEMA_VERSION,
        "kind": PAYLOAD_KIND,
        "mode": seat.get("mode"),
        "mode_label_ru": seat.get("mode_label_ru"),
        "mode_hint_ru": seat.get("mode_hint_ru"),
        "allow_offline": bool(seat.get("allow_offline")),
        "allow_online": bool(seat.get("allow_online")),
        "allow_fofline": bool(seat.get("allow_fofline")),
        "allowed_email": seat.get("allowed_email"),
        "issued_at": seat.get("issued_at") or datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        "label": seat.get("label"),
        "license_id": seat.get("license_id"),
        "edition": seat.get("edition"),
        "profile_id": seat.get("profile_id"),
        "apps": list(seat.get("apps") or []),
        "entitlement": seat.get("entitlement"),
        "wg_conf": seat.get("wg_conf"),
        "peer": seat.get("peer"),
        "notes_ru": seat.get("notes_ru"),
        "request_id": verified_request["request_id"],
        "recipient_key_id": verified_request["recipient_key_id"],
        "machine_fingerprint_hash": verified_request["machine_fingerprint_hash"],
        "product_id": verified_request["product_id"],
        "activation_token": activation_token,
    }


def _sign_bytes(message: bytes, signing_sk: bytes) -> str:
    key = Ed25519PrivateKey.from_private_bytes(signing_sk)
    return key.sign(message).hex()


def _verify_bytes(message: bytes, sig_hex: str, signing_pk: bytes) -> bool:
    try:
        sig = bytes.fromhex(sig_hex)
        Ed25519PublicKey.from_public_bytes(signing_pk).verify(sig, message)
        return True
    except Exception:
        return False


def signature_transcript_v2(
    *,
    product_id: str,
    channel: str,
    request_id: str,
    recipient_key_id: str,
    ephemeral_pk: bytes,
    created_at: str,
    expires_at: str,
    nonce: bytes,
    ciphertext_sha256: bytes,
    ciphertext: bytes,
) -> bytes:
    """Length-delimited transcript covering header fields + ciphertext (SoT §4)."""
    parts = [
        b"capsule_v2",
        product_id.encode("utf-8"),
        channel.encode("utf-8"),
        request_id.encode("utf-8"),
        recipient_key_id.encode("utf-8"),
        ephemeral_pk,
        created_at.encode("ascii"),
        expires_at.encode("ascii"),
        nonce,
        ciphertext_sha256,
        ciphertext,
    ]
    return b"\0".join(parts)


def seal_capsule_v2(
    payload: dict[str, Any],
    *,
    recipient_public_key_hex: str,
    product_id: str,
    channel: str,
    request_id: str,
    recipient_key_id: str,
    expires_at: str,
) -> dict[str, Any]:
    """Encrypt+sign Capsule v2 to an explicit device recipient pubkey."""
    if not recipient_public_key_hex:
        raise RuntimeError("device_request_recipient_required")
    recipient_pk = _hex32(recipient_public_key_hex, label="recipient_pk")
    if recipient_pk is None:
        raise RuntimeError("capsule_recipient_invalid")
    signing_sk = _load_signing_private()
    if signing_sk is None:
        raise RuntimeError("capsule_keys_missing")
    if payload.get("kind") != PAYLOAD_KIND:
        raise RuntimeError("capsule_payload_kind")
    if "license_key" in payload:
        raise RuntimeError("capsule_payload_has_license_key")

    plaintext = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    eph = X25519PrivateKey.generate()
    eph_pk = eph.public_key().public_bytes_raw()
    shared = eph.exchange(X25519PublicKey.from_public_bytes(recipient_pk))
    key = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=None,
        info=HKDF_INFO,
    ).derive(shared)
    nonce = os.urandom(12)
    # AAD binds header fields without ciphertext_sha256 (chicken/egg with AEAD).
    # Ed25519 transcript includes ciphertext_sha256 + ciphertext (SoT §4 binding).
    created_at = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    aad_enc = _aad_encrypt_v2(
        product_id=product_id,
        channel=channel,
        request_id=request_id,
        recipient_key_id=recipient_key_id,
        ephemeral_pk=eph_pk,
        created_at=created_at,
        expires_at=expires_at,
        nonce=nonce,
    )
    ct = ChaCha20Poly1305(key).encrypt(nonce, plaintext, aad_enc)
    ct_hash = hashlib.sha256(ct).digest()
    msg = signature_transcript_v2(
        product_id=product_id,
        channel=channel,
        request_id=request_id,
        recipient_key_id=recipient_key_id,
        ephemeral_pk=eph_pk,
        created_at=created_at,
        expires_at=expires_at,
        nonce=nonce,
        ciphertext_sha256=ct_hash,
        ciphertext=ct,
    )
    sig = _sign_bytes(msg, signing_sk)
    return {
        "kind": CAPSULE_KIND,
        "v": CAPSULE_SCHEMA_VERSION,
        "alg": CAPSULE_ALG,
        "product_id": product_id,
        "channel": channel,
        "request_id": request_id,
        "recipient_key_id": recipient_key_id,
        "ephemeral_pk": eph_pk.hex(),
        "created_at": created_at,
        "expires_at": expires_at,
        "nonce": nonce.hex(),
        "ciphertext_sha256": ct_hash.hex(),
        "ciphertext": base64.b64encode(ct).decode("ascii"),
        "sig": sig,
    }


def _aad_encrypt_v2(
    *,
    product_id: str,
    channel: str,
    request_id: str,
    recipient_key_id: str,
    ephemeral_pk: bytes,
    created_at: str,
    expires_at: str,
    nonce: bytes,
) -> bytes:
    parts = [
        b"capsule_v2_aad",
        product_id.encode("utf-8"),
        channel.encode("utf-8"),
        request_id.encode("utf-8"),
        recipient_key_id.encode("utf-8"),
        ephemeral_pk,
        created_at.encode("ascii"),
        expires_at.encode("ascii"),
        nonce,
    ]
    return b"\0".join(parts)


def open_capsule_dict(
    envelope: dict[str, Any],
    *,
    recipient_sk: bytes,
    signing_pk: bytes,
) -> dict[str, Any]:
    """Verify+decrypt Capsule v2 → payload dict (tests / server tooling)."""
    unknown = sorted(set(envelope.keys()) - ALLOWED_ENVELOPE_FIELDS)
    if unknown:
        raise ValueError(f"unknown_capsule_field:{','.join(unknown)}")
    if envelope.get("kind") != CAPSULE_KIND:
        raise ValueError("invalid_capsule_kind")
    if int(envelope.get("v") or 0) != CAPSULE_SCHEMA_VERSION:
        raise ValueError("unsupported_capsule_v")
    if envelope.get("alg") != CAPSULE_ALG:
        raise ValueError("unsupported_capsule_alg")

    product_id = str(envelope["product_id"])
    channel = str(envelope["channel"])
    request_id = str(envelope["request_id"])
    recipient_key_id = str(envelope["recipient_key_id"])
    created_at = str(envelope["created_at"])
    expires_at = str(envelope["expires_at"])
    eph_pk = bytes.fromhex(str(envelope["ephemeral_pk"]))
    nonce = bytes.fromhex(str(envelope["nonce"]))
    ct = base64.b64decode(str(envelope["ciphertext"]))
    ct_hash = bytes.fromhex(str(envelope["ciphertext_sha256"]))
    if hashlib.sha256(ct).digest() != ct_hash:
        raise ValueError("bad_ciphertext_hash")
    sig = str(envelope["sig"])

    expires = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=UTC)
    if datetime.now(UTC) > expires + timedelta(minutes=5):
        raise ValueError("capsule_expired")

    msg = signature_transcript_v2(
        product_id=product_id,
        channel=channel,
        request_id=request_id,
        recipient_key_id=recipient_key_id,
        ephemeral_pk=eph_pk,
        created_at=created_at,
        expires_at=expires_at,
        nonce=nonce,
        ciphertext_sha256=ct_hash,
        ciphertext=ct,
    )
    if not _verify_bytes(msg, sig, signing_pk):
        raise ValueError("bad_capsule_signature")

    aad_enc = _aad_encrypt_v2(
        product_id=product_id,
        channel=channel,
        request_id=request_id,
        recipient_key_id=recipient_key_id,
        ephemeral_pk=eph_pk,
        created_at=created_at,
        expires_at=expires_at,
        nonce=nonce,
    )
    sk = X25519PrivateKey.from_private_bytes(recipient_sk)
    shared = sk.exchange(X25519PublicKey.from_public_bytes(eph_pk))
    key = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=None,
        info=HKDF_INFO,
    ).derive(shared)
    pt = ChaCha20Poly1305(key).decrypt(nonce, ct, aad_enc)
    payload = json.loads(pt.decode("utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("capsule_inner_not_object")
    if payload.get("kind") != PAYLOAD_KIND:
        raise ValueError("capsule_inner_kind")
    if "license_key" in payload:
        raise ValueError("capsule_inner_has_license_key")
    return payload


def seal_seat_dict(
    seat: dict[str, Any],
    *,
    recipient_public_key_hex: str,
    verified_request: dict[str, str] | None = None,
    activation_token: str | None = None,
) -> dict[str, Any]:
    """
    Legacy Capsule v2 JSON envelope (Known Vulnerability — metadata disclosure).
    Prefer seal_seat_bytes_v3 / maybe_seal_for_issue for new issues.
    """
    if verified_request is None or activation_token is None:
        raise RuntimeError("capsule_v2_context_required")
    payload = build_capsule_payload_v2(
        seat,
        verified_request=verified_request,
        activation_token=activation_token,
    )
    channel = channel_for_product(verified_request["product_id"])
    expires_at = verified_request.get("expires_at") or (datetime.now(UTC) + timedelta(days=7)).isoformat()
    if expires_at.endswith("+00:00"):
        expires_at = expires_at.replace("+00:00", "Z")
    return seal_capsule_v2(
        payload,
        recipient_public_key_hex=recipient_public_key_hex,
        product_id=verified_request["product_id"],
        channel=channel,
        request_id=verified_request["request_id"],
        recipient_key_id=verified_request["recipient_key_id"],
        expires_at=expires_at,
    )


def _aad_encrypt_v3(*, ephemeral_pk: bytes, nonce: bytes) -> bytes:
    return b"".join(
        [
            CAPSULE_V3_MAGIC,
            bytes([CAPSULE_SCHEMA_VERSION_V3, CAPSULE_V3_ALG_ID]),
            ephemeral_pk,
            nonce,
        ]
    )


def signature_transcript_v3(
    *,
    ephemeral_pk: bytes,
    nonce: bytes,
    ciphertext_sha256: bytes,
    ciphertext: bytes,
) -> bytes:
    return b"\0".join(
        [
            b"capsule_v3",
            CAPSULE_V3_MAGIC,
            bytes([CAPSULE_SCHEMA_VERSION_V3, CAPSULE_V3_ALG_ID]),
            ephemeral_pk,
            nonce,
            ciphertext_sha256,
            ciphertext,
        ]
    )


def seal_capsule_v3_bytes(
    payload: dict[str, Any],
    *,
    recipient_public_key_hex: str,
    product_id: str,
    channel: str,
    request_id: str,
    recipient_key_id: str,
    expires_at: str,
) -> bytes:
    """Encrypt+sign Capsule v3 opaque binary (license meta only inside AEAD)."""
    if not recipient_public_key_hex:
        raise RuntimeError("device_request_recipient_required")
    recipient_pk = _hex32(recipient_public_key_hex, label="recipient_pk")
    if recipient_pk is None:
        raise RuntimeError("capsule_recipient_invalid")
    signing_sk = _load_signing_private()
    if signing_sk is None:
        raise RuntimeError("capsule_keys_missing")
    if payload.get("kind") != PAYLOAD_KIND:
        raise RuntimeError("capsule_payload_kind")
    if "license_key" in payload:
        raise RuntimeError("capsule_payload_has_license_key")

    created_at = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    inner = {
        "product_id": product_id,
        "channel": channel,
        "request_id": request_id,
        "recipient_key_id": recipient_key_id,
        "created_at": created_at,
        "expires_at": expires_at,
        "payload": payload,
    }
    plaintext = json.dumps(inner, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    eph = X25519PrivateKey.generate()
    eph_pk = eph.public_key().public_bytes_raw()
    shared = eph.exchange(X25519PublicKey.from_public_bytes(recipient_pk))
    key = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=None,
        info=HKDF_INFO_V3,
    ).derive(shared)
    nonce = os.urandom(12)
    aad = _aad_encrypt_v3(ephemeral_pk=eph_pk, nonce=nonce)
    ct = ChaCha20Poly1305(key).encrypt(nonce, plaintext, aad)
    ct_hash = hashlib.sha256(ct).digest()
    msg = signature_transcript_v3(
        ephemeral_pk=eph_pk,
        nonce=nonce,
        ciphertext_sha256=ct_hash,
        ciphertext=ct,
    )
    sig_hex = _sign_bytes(msg, signing_sk)
    sig = bytes.fromhex(sig_hex)
    if len(sig) != 64:
        raise RuntimeError("capsule_sig_len")
    blob = b"".join(
        [
            CAPSULE_V3_MAGIC,
            bytes([CAPSULE_SCHEMA_VERSION_V3, CAPSULE_V3_ALG_ID]),
            eph_pk,
            nonce,
            len(ct).to_bytes(4, "big"),
            ct,
            sig,
        ]
    )
    for needle in FORBIDDEN_META_ASCII:
        if needle in blob:
            raise RuntimeError(f"capsule_v3_meta_leak:{needle.decode('ascii')}")
    return blob


def open_capsule_v3_bytes(
    blob: bytes,
    *,
    recipient_sk: bytes,
    signing_pk: bytes,
) -> dict[str, Any]:
    """Verify+decrypt Capsule v3 → inner capsule_payload_v2 dict."""
    if len(blob) < 8 + 1 + 1 + 32 + 12 + 4 + 64:
        raise ValueError("capsule_v3_short")
    if blob[:8] != CAPSULE_V3_MAGIC:
        raise ValueError("capsule_v3_magic")
    ver = blob[8]
    alg = blob[9]
    if ver != CAPSULE_SCHEMA_VERSION_V3:
        raise ValueError("unsupported_capsule_v")
    if alg != CAPSULE_V3_ALG_ID:
        raise ValueError("unsupported_capsule_alg")
    eph_pk = blob[10:42]
    nonce = blob[42:54]
    ct_len = int.from_bytes(blob[54:58], "big")
    ct_end = 58 + ct_len
    if ct_end + 64 != len(blob):
        raise ValueError("capsule_v3_len")
    ct = blob[58:ct_end]
    sig = blob[ct_end:]
    ct_hash = hashlib.sha256(ct).digest()
    msg = signature_transcript_v3(
        ephemeral_pk=eph_pk,
        nonce=nonce,
        ciphertext_sha256=ct_hash,
        ciphertext=ct,
    )
    if not _verify_bytes(msg, sig.hex(), signing_pk):
        raise ValueError("bad_capsule_signature")
    aad = _aad_encrypt_v3(ephemeral_pk=eph_pk, nonce=nonce)
    sk = X25519PrivateKey.from_private_bytes(recipient_sk)
    shared = sk.exchange(X25519PublicKey.from_public_bytes(eph_pk))
    key = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=None,
        info=HKDF_INFO_V3,
    ).derive(shared)
    pt = ChaCha20Poly1305(key).decrypt(nonce, ct, aad)
    inner = json.loads(pt.decode("utf-8"))
    if not isinstance(inner, dict):
        raise ValueError("capsule_inner_not_object")
    expires_at = str(inner.get("expires_at") or "")
    if expires_at:
        expires = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=UTC)
        if datetime.now(UTC) > expires + timedelta(minutes=5):
            raise ValueError("capsule_expired")
    payload = inner.get("payload")
    if not isinstance(payload, dict):
        raise ValueError("capsule_inner_payload")
    if payload.get("kind") != PAYLOAD_KIND:
        raise ValueError("capsule_inner_kind")
    if "license_key" in payload:
        raise ValueError("capsule_inner_has_license_key")
    return payload


def seal_seat_bytes_v3(
    seat: dict[str, Any],
    *,
    recipient_public_key_hex: str,
    verified_request: dict[str, str],
    activation_token: str,
) -> bytes:
    payload = build_capsule_payload_v2(
        seat,
        verified_request=verified_request,
        activation_token=activation_token,
    )
    channel = channel_for_product(verified_request["product_id"])
    expires_at = verified_request.get("expires_at") or (datetime.now(UTC) + timedelta(days=7)).isoformat()
    if expires_at.endswith("+00:00"):
        expires_at = expires_at.replace("+00:00", "Z")
    return seal_capsule_v3_bytes(
        payload,
        recipient_public_key_hex=recipient_public_key_hex,
        product_id=verified_request["product_id"],
        channel=channel,
        request_id=verified_request["request_id"],
        recipient_key_id=verified_request["recipient_key_id"],
        expires_at=expires_at,
    )


def package_dict_for_ecap_v3(blob: bytes) -> dict[str, Any]:
    """Wire wrapper for JSON APIs (not the download artifact)."""
    return {
        "encoding": ENCODING_ECAP_V3,
        "package_b64": base64.b64encode(blob).decode("ascii"),
    }


def maybe_seal_for_issue(
    seat: dict[str, Any],
    *,
    recipient_public_key_hex: str | None = None,
    verified_request: dict[str, str] | None = None,
) -> tuple[dict[str, Any], str, str | None]:
    """
    Returns (package, filename_suffix_hint, activation_token_hash_or_none).
    Default: Capsule v3 opaque (encoding=ecap_v3 + package_b64).
    Plaintext only when ALLOW_PLAINTEXT=1 and ELITEEW_CAPSULE_DEV_KEYS=1.
    """
    if allow_plaintext_issue():
        logger.info("[STEP] capsule_issue_plaintext reason=allow_and_dev_keys")
        return seat, ".json", None
    if not recipient_public_key_hex or verified_request is None:
        raise RuntimeError("device_request_recipient_required")
    token, token_hash = mint_activation_token()
    try:
        blob = seal_seat_bytes_v3(
            seat,
            recipient_public_key_hex=recipient_public_key_hex,
            verified_request=verified_request,
            activation_token=token,
        )
        sealed = package_dict_for_ecap_v3(blob)
    except Exception:
        logger.exception("[STEP] capsule_seal_fail")
        raise
    logger.info(
        "[STEP] capsule_issue_sealed encoding=%s v=%s",
        ENCODING_ECAP_V3,
        CAPSULE_SCHEMA_VERSION_V3,
    )
    return sealed, ".ecap", token_hash
