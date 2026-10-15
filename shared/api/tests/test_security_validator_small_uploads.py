# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Magic-byte validation for tiny text uploads (desktop empty .md).
# Invariants:
# - Small text/code files pass; binary payloads below 8 bytes still fail.
# Related:
# - api/services/unified_content/security_validator.py
# ---

from api.services.unified_content.security_validator import SecurityValidator


def test_small_markdown_newline_passes_magic_bytes() -> None:
    validator = SecurityValidator()
    ok, err, mime = validator.validate_magic_bytes(
        b"\n",
        "Новый документ.md",
        "text/markdown",
    )
    assert ok is True
    assert err is None
    assert mime == "text/markdown"


def test_small_binary_without_text_extension_still_rejected() -> None:
    validator = SecurityValidator()
    ok, err, mime = validator.validate_magic_bytes(
        b"\x00",
        "payload.bin",
        "application/octet-stream",
    )
    assert ok is False
    assert err == "File too small for validation"
    assert mime is None


def test_small_file_with_executable_signature_rejected() -> None:
    validator = SecurityValidator()
    ok, err, mime = validator.validate_magic_bytes(
        b"MZ",
        "note.md",
        "text/markdown",
    )
    assert ok is False
    assert err == "File contains executable signatures"
    assert mime is None
