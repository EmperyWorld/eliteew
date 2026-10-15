# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for legacy deal↔listing inference and backfill counters.
# Related:
# - api/services/professional_worlds/deal_property_linkage.py
# ---

from __future__ import annotations

from api.services.professional_worlds.deal_property_linkage import (
    count_backfillable_deals,
    infer_unique_property_id_by_deal_title,
    resolve_deal_property_id,
    resolve_effective_deal_property_id,
)


def test_resolve_deal_property_id_reads_fk() -> None:
    assert resolve_deal_property_id({"property_id": " prop-1 "}) == "prop-1"
    assert resolve_deal_property_id({}) is None


def test_infer_unique_property_id_requires_single_match() -> None:
    properties = [
        {"id": "p1", "title": "Sea View"},
        {"id": "p2", "title": "Sea View Loft"},
    ]
    assert infer_unique_property_id_by_deal_title("Offer · Sea View", properties) == "p1"
    assert infer_unique_property_id_by_deal_title("Sea View vs Sea View Loft", properties) is None


def test_resolve_effective_deal_property_id_prefers_fk() -> None:
    deal = {
        "title": "Other",
        "deal_data": {"property_id": "p9"},
    }
    properties = [{"id": "p1", "title": "Sea View"}]
    assert resolve_effective_deal_property_id(deal, properties) == "p9"


def test_count_backfillable_deals() -> None:
    properties = [
        {"id": "p1", "title": "Sea View"},
        {"id": "p2", "title": "Sea View Loft"},
    ]
    deals = [
        {"title": "Late · Sea View", "deal_data": {}},
        {"title": "Already linked", "deal_data": {"property_id": "p1"}},
        {"title": "Sea View vs Sea View Loft", "deal_data": {}},
    ]
    assert count_backfillable_deals(deals, properties) == 1
