# Purpose: Forbidden relative path globs for secrets inside an image/rootfs tree.
# Related: ELITEEW-TRUSTED-SUBSTRATE.md §3/§7 — no secrets in ISO

"""Scan a filesystem tree for paths that must never ship in a public image."""

from __future__ import annotations

import fnmatch
from pathlib import Path

# Relative to image root. Kept simple (fnmatch) for W0 — expand in later waves.
FORBIDDEN_REL_GLOBS: tuple[str, ...] = (
    "**/wg*.conf",
    "**/*wg-portal*.conf",
    "**/wireguard/*.key",
    "**/privatekey",
    "**/private_key",
    "**/*.pem",
    "**/*id_rsa*",
    "**/*id_ed25519*",
    "**/payload-electron.env",
    "**/image-profile.env",
    "**/.env",
    "**/.env.*",
    "**/secrets/**",
    "**/credentials.json",
)


def _rel_matches(rel_posix: str, pattern: str) -> bool:
    """Match ``rel_posix`` against a glob that may contain ``**/``."""
    normalized = rel_posix.lstrip("./")
    if pattern.startswith("**/"):
        suffix = pattern[3:]
        if fnmatch.fnmatch(normalized, suffix):
            return True
        parts = normalized.split("/")
        for i in range(len(parts)):
            if fnmatch.fnmatch("/".join(parts[i:]), suffix):
                return True
        return False
    return fnmatch.fnmatch(normalized, pattern)


def path_is_forbidden(rel_posix: str) -> str | None:
    """Return matching glob if relative path is forbidden, else None."""
    normalized = rel_posix.lstrip("./")
    if not normalized:
        return None
    for pattern in FORBIDDEN_REL_GLOBS:
        if _rel_matches(normalized, pattern):
            return pattern
    return None


def scan_forbidden_paths(root: Path) -> list[tuple[str, str]]:
    """
    Walk ``root`` and return (rel_posix, matched_glob) for each forbidden file.

    Directories alone are not violations; only file paths.
    """
    root = root.resolve()
    hits: list[tuple[str, str]] = []
    if not root.is_dir():
        raise FileNotFoundError(f"image_root_missing: {root}")
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(root).as_posix()
        matched = path_is_forbidden(rel)
        if matched is not None:
            hits.append((rel, matched))
    return sorted(hits)
