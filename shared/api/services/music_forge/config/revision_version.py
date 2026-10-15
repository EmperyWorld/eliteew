# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Stable MusicForge config revision version strings (no nested draft-draft-…).
# Invariants:
# - Default draft name is draft-{canonical_base}-{8hex}; never prepend draft- onto an
#   already draft-* active label (activate-then-redraft used to grow draft-draft-…).
# - Canonical platform label is ``platform`` (operator-facing; replaces e2e-* junk).
# Related:
# - api/services/music_forge/config/admin_ops.py
# - documentation/product/MUSIC-FORGE-APP.md
# ---
"""MusicForge config revision version helpers."""

from __future__ import annotations

import re
from uuid import uuid4

CANONICAL_PLATFORM_VERSION = "platform"
_DRAFT_PREFIX = "draft-"
_HEX8_SUFFIX = re.compile(r"^(.+)-([0-9a-f]{8})$", re.IGNORECASE)


def canonical_revision_base(version: str | None) -> str:
    """Strip nested ``draft-`` prefixes and trailing draft hex suffixes → stable base."""
    base = (version or "").strip()
    if not base:
        return CANONICAL_PLATFORM_VERSION
    # Peel draft-draft-… wrappers.
    while base.lower().startswith(_DRAFT_PREFIX):
        base = base[len(_DRAFT_PREFIX) :].strip()
        if not base:
            return CANONICAL_PLATFORM_VERSION
        matched = _HEX8_SUFFIX.match(base)
        if matched:
            base = matched.group(1).strip()
    base = base.strip("-") or CANONICAL_PLATFORM_VERSION
    # Historical e2e smoke label → platform.
    if base.lower().startswith("e2e-"):
        return CANONICAL_PLATFORM_VERSION
    return base


def allocate_draft_version(
    active_version: str | None,
    *,
    explicit: str | None = None,
    suffix: str | None = None,
) -> str:
    """Build UNIQUE draft version; ``explicit`` wins when non-empty."""
    if explicit is not None and (cleaned := explicit.strip()):
        return cleaned
    base = canonical_revision_base(active_version)
    hex8 = (suffix or uuid4().hex[:8]).lower()
    if len(hex8) != 8 or any(c not in "0123456789abcdef" for c in hex8):
        hex8 = uuid4().hex[:8]
    return f"{_DRAFT_PREFIX}{base}-{hex8}"
