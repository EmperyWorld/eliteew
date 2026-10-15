# Purpose: Detached image signature verify contract (Trusted Substrate W5).
# Related: docs/KEYS-CEREMONY.md · docs/IMAGE-INTEGRITY.md · SoT §9

"""Fail-closed authenticity checks for release images (detached OpenSSL Ed25519)."""

from __future__ import annotations

from enum import StrEnum
from pathlib import Path


class ImageSigningError(ValueError):
    """Missing inputs or failed authenticity check."""


class VerifyOutcome(StrEnum):
    OK = "ok"
    MISSING_IMAGE = "missing_image"
    MISSING_SIGNATURE = "missing_signature"
    MISSING_PUBKEY = "missing_pubkey"
    TAMPER_OR_BAD_SIG = "tamper_or_bad_sig"


def classify_verify_inputs(
    *,
    image: Path,
    signature: Path,
    pubkey: Path,
) -> VerifyOutcome | None:
    """Return a failure outcome if inputs are missing; None if all present."""
    if not image.is_file():
        return VerifyOutcome.MISSING_IMAGE
    if not signature.is_file():
        return VerifyOutcome.MISSING_SIGNATURE
    if not pubkey.is_file():
        return VerifyOutcome.MISSING_PUBKEY
    return None


def outcome_from_openssl_verify(exit_code: int) -> VerifyOutcome:
    if exit_code == 0:
        return VerifyOutcome.OK
    return VerifyOutcome.TAMPER_OR_BAD_SIG


def assert_verify_ok(outcome: VerifyOutcome) -> None:
    if outcome is not VerifyOutcome.OK:
        raise ImageSigningError(f"image_verify_failed: {outcome.value}")


def assert_private_key_material_absent(text: str) -> None:
    """Refuse PEM private key blobs in committed/config text scans."""
    markers = (
        "BEGIN PRIVATE KEY",
        "BEGIN RSA PRIVATE KEY",
        "BEGIN OPENSSH PRIVATE KEY",
        "BEGIN EC PRIVATE KEY",
    )
    upper = text.upper()
    for marker in markers:
        if marker in upper:
            raise ImageSigningError(f"private_key_material_present: {marker}")
