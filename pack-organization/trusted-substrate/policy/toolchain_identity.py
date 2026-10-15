# Purpose: Toolchain pin digest + rebuild identity comparison (W3).
# Related: toolchain/PINS · plan W3 exit proof

"""Content identity for EliteEW-built toolchain (pins + recorded artifact digest)."""

from __future__ import annotations

import hashlib
from pathlib import Path


def digest_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def digest_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def pins_digest(pins_path: Path) -> str:
    """Stable digest of pin file ignoring blank/# comment-only line noise via normalized body."""
    lines: list[str] = []
    for raw in pins_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        lines.append(" ".join(line.split()))
    return digest_text("\n".join(lines) + "\n")


def combine_identity(*, pins_sha256: str, artifact_sha256: str) -> str:
    return digest_text(f"pins={pins_sha256}\nartifact={artifact_sha256}\n")


def assert_identity_match(expected: str, actual: str) -> None:
    if expected != actual:
        raise ValueError(
            f"toolchain_identity_mismatch: expected={expected} actual={actual}"
        )
