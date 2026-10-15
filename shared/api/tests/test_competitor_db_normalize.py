"""Competitor VARCHAR normalization for marketing autofill / AMKA apply."""

from __future__ import annotations

from api.routers.marketing_cabinet.competitors import (
    COMPETITOR_PRICING_STRATEGY_MAX_LEN,
    normalize_competitor_pricing_strategy_for_db,
    normalize_competitor_type_for_db,
    prepare_competitor_write_fields,
    truncate_competitor_db_varchar,
)


def test_normalize_competitor_type_maps_substring() -> None:
    assert normalize_competitor_type_for_db("Direct B2B SaaS rival") == "direct"
    assert normalize_competitor_type_for_db("косвенный конкурент") == "indirect"


def test_normalize_competitor_type_default() -> None:
    assert normalize_competitor_type_for_db("") == "direct"
    assert normalize_competitor_type_for_db(None) == "direct"


def test_pricing_strategy_truncated_to_db_limit() -> None:
    long_text = "x" * (COMPETITOR_PRICING_STRATEGY_MAX_LEN + 20)
    out = normalize_competitor_pricing_strategy_for_db(long_text)
    assert out is not None
    assert len(out) == COMPETITOR_PRICING_STRATEGY_MAX_LEN


def test_prepare_competitor_write_fields_fits_legacy_type() -> None:
    ctype, mpos, pstrat = prepare_competitor_write_fields(
        competitor_type="direct competitor with long label " * 3,
        market_position="pos",
        pricing_strategy="tiered",
    )
    assert ctype == "direct"
    assert len(ctype) <= 50
    assert mpos == "pos"
    assert pstrat == "tiered"


def test_truncate_competitor_db_varchar_empty() -> None:
    assert truncate_competitor_db_varchar("   ", max_len=50) is None
