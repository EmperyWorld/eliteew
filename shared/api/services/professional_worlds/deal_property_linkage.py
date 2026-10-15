# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Pure helpers for professional deal ↔ listing linkage via deal_data.property_id and legacy title inference.
# Invariants:
# - Title inference returns a property id only when exactly one listing title matches (case-insensitive substring).
# - FK in deal_data always wins over inference.
# Related:
# - api/services/professional_worlds/service.py
# - shared/web/frontend/src/features/professional-worlds/desktop/realtorLogic.ts
# ---

from __future__ import annotations

from typing import Any


def resolve_deal_property_id(deal_data: dict[str, Any] | None) -> str | None:
    """Return normalized property_id from deal_data when present."""
    if not isinstance(deal_data, dict):
        return None
    raw = deal_data.get("property_id")
    if not isinstance(raw, str):
        return None
    normalized = raw.strip()
    return normalized or None


def infer_unique_property_id_by_deal_title(
    deal_title: str,
    properties: list[dict[str, Any]],
) -> str | None:
    """Infer listing id from deal title only when exactly one property title matches."""
    normalized_title = deal_title.strip().casefold()
    if not normalized_title:
        return None
    matches: list[str] = []
    for property_row in properties:
        property_id = property_row.get("id")
        property_title = property_row.get("title")
        if not isinstance(property_id, str) or not property_id.strip():
            continue
        if not isinstance(property_title, str):
            continue
        candidate = property_title.strip()
        if not candidate:
            continue
        if candidate.casefold() in normalized_title:
            matches.append(property_id.strip())
    unique = sorted(set(matches))
    if len(unique) == 1:
        return unique[0]
    return None


def resolve_effective_deal_property_id(
    deal: dict[str, Any],
    properties: list[dict[str, Any]],
) -> str | None:
    """FK property_id or unique legacy title inference."""
    fk = resolve_deal_property_id(deal.get("deal_data") if isinstance(deal.get("deal_data"), dict) else None)
    if fk:
        return fk
    deal_title = deal.get("title")
    if not isinstance(deal_title, str):
        return None
    return infer_unique_property_id_by_deal_title(deal_title, properties)


def count_backfillable_deals(
    deals: list[dict[str, Any]],
    properties: list[dict[str, Any]],
) -> int:
    """Deals missing FK but with a unique inferrable listing."""
    total = 0
    for deal in deals:
        deal_data = deal.get("deal_data") if isinstance(deal.get("deal_data"), dict) else {}
        if resolve_deal_property_id(deal_data):
            continue
        deal_title = deal.get("title")
        if not isinstance(deal_title, str):
            continue
        if infer_unique_property_id_by_deal_title(deal_title, properties):
            total += 1
    return total
