# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lock MusicForge draft version allocation (no nested draft-draft-…).
# Invariants:
# - Active draft-* / e2e-* labels canonicalize before allocating the next draft.
# Related:
# - api/services/music_forge/config/revision_version.py
# ---
"""MusicForge config revision_version helpers."""

from __future__ import annotations

from api.services.music_forge.config.revision_version import (
    CANONICAL_PLATFORM_VERSION,
    allocate_draft_version,
    canonical_revision_base,
)


def test_canonical_revision_base_strips_nested_drafts() -> None:
    assert canonical_revision_base("draft-draft-v1-platform-d8bc2449-cfbbb9d7") == "v1-platform"
    assert canonical_revision_base("draft-v1-platform-d8bc2449") == "v1-platform"
    assert canonical_revision_base("draft-e2e-20260720022402-51287ec9") == CANONICAL_PLATFORM_VERSION
    assert canonical_revision_base("e2e-20260720022402") == CANONICAL_PLATFORM_VERSION
    assert canonical_revision_base("platform") == "platform"
    assert canonical_revision_base("") == CANONICAL_PLATFORM_VERSION


def test_allocate_draft_version_no_nested_draft_prefix() -> None:
    assert (
        allocate_draft_version(
            "draft-draft-v1-platform-d8bc2449-cfbbb9d7",
            suffix="aabbccdd",
        )
        == "draft-v1-platform-aabbccdd"
    )
    assert allocate_draft_version("e2e-20260720022402", suffix="11223344") == "draft-platform-11223344"
    assert allocate_draft_version("platform", explicit="  my-draft  ") == "my-draft"
