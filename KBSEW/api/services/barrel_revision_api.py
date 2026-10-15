# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Map kbsew.asset_revisions rows onto barrel list/status API fields for admin FE badges.
# Invariants:
# - `revision` is a short display label (content_sha256 prefix preferred).
# - Missing active revision yields null fields (FE shows n/a).
# Related:
# - api/services/barrel_service.py
# - api/services/revision_service.py
# - documentation/product/KBSEW.md
# ---

from __future__ import annotations

from typing import Any


def revision_badge_label(
    content_sha256: str | None, revision_id: object | None = None
) -> str | None:
    """FE-facing short revision label (sha prefix preferred, else revision id prefix)."""
    sha = (content_sha256 or "").strip()
    if sha:
        return sha[:12]
    if revision_id is None:
        return None
    rid = str(revision_id).strip()
    return rid[:8] if rid else None


def revision_summary_fields(rev: dict[str, Any] | None) -> dict[str, Any]:
    """Map asset_revisions row (or None) to barrel API revision fields."""
    if not rev:
        return {
            "revision": None,
            "active_revision_id": None,
            "revision_indexed_at": None,
            "revision_chunk_count": None,
        }
    rev_id = rev.get("id") or rev.get("active_revision_id")
    sha = rev.get("content_sha256")
    chunk = rev.get("chunk_count")
    return {
        "revision": revision_badge_label(str(sha) if sha is not None else None, rev_id),
        "active_revision_id": rev_id,
        "revision_indexed_at": rev.get("indexed_at"),
        "revision_chunk_count": int(chunk) if chunk is not None else None,
    }
