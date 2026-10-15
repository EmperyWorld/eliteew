# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Canonical cross-app draft lifecycle state labels for Professional Worlds handoffs (EWRP, Site Studio, …).
# Invariants:
# - Payloads remain draft-first: no implicit publish or outbound send semantics in these literals.
# Related:
# - api/services/professional_worlds/cross_app_drafts_service.py
# - documentation/product/PROFESSIONAL-WORLDS.md
# ---

from __future__ import annotations

# Lifecycle for rows in professional_cross_app_draft_links.lifecycle_state (and audit messaging).
DRAFT_LIFECYCLE_CREATED = "created"
DRAFT_LIFECYCLE_OPENED = "opened"
DRAFT_LIFECYCLE_UPDATED = "updated"
DRAFT_LIFECYCLE_PUBLISHED = "published"
DRAFT_LIFECYCLE_CANCELLED = "cancelled"
DRAFT_LIFECYCLE_STALE = "stale"

CANONICAL_DRAFT_LIFECYCLE_STATES: tuple[str, ...] = (
    DRAFT_LIFECYCLE_CREATED,
    DRAFT_LIFECYCLE_OPENED,
    DRAFT_LIFECYCLE_UPDATED,
    DRAFT_LIFECYCLE_PUBLISHED,
    DRAFT_LIFECYCLE_CANCELLED,
    DRAFT_LIFECYCLE_STALE,
)
