# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Allowlists for Realtor Pro showing and publication-channel status fields.
# Leaf module (not under services.professional_worlds) to avoid schema↔service circular imports.
# Invariants:
# - Unknown status strings are rejected (HTTP 422 at schema / service boundary).
# - Vocabulary matches FE i18n / EXPECTED_REALTOR_STATUS_VOCABULARY.
# Related:
# - api/schemas/professional_worlds.py
# - documentation/product/PROFESSIONAL-WORLDS.md
# ---

from __future__ import annotations

from typing import Literal

RealtorShowingStatus = Literal["planned", "interested", "follow_up", "declined"]
RealtorPublicationChannelStatus = Literal["pending", "published", "failed"]

REALTOR_SHOWING_STATUSES: frozenset[str] = frozenset({"planned", "interested", "follow_up", "declined"})
REALTOR_PUBLICATION_CHANNEL_STATUSES: frozenset[str] = frozenset({"pending", "published", "failed"})


def normalize_realtor_showing_status(raw: str | None) -> str | None:
    if raw is None:
        return None
    value = str(raw).strip().lower()
    if not value:
        return None
    if value not in REALTOR_SHOWING_STATUSES:
        raise ValueError("invalid realtor showing status")
    return value


def normalize_realtor_publication_channel_status(raw: str | None) -> str | None:
    if raw is None:
        return None
    value = str(raw).strip().lower()
    if not value:
        return None
    if value not in REALTOR_PUBLICATION_CHANNEL_STATUSES:
        raise ValueError("invalid realtor publication channel status")
    return value
