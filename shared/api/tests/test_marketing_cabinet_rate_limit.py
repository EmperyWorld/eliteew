"""Unit tests: clamp для AI rate limit маркетингового кабинета (без БД/Redis/FastAPI)."""

from __future__ import annotations

import pytest

from api.core.marketing_cabinet_rate_limit import clamp_marketing_cabinet_ai_per_minute


@pytest.mark.unit
def test_clamp_low_boundary_10() -> None:
    assert clamp_marketing_cabinet_ai_per_minute(5) == 10
    assert clamp_marketing_cabinet_ai_per_minute(10) == 10


@pytest.mark.unit
def test_clamp_high_boundary_60() -> None:
    assert clamp_marketing_cabinet_ai_per_minute(500) == 60
    assert clamp_marketing_cabinet_ai_per_minute(60) == 60


@pytest.mark.unit
def test_clamp_mid_range_unchanged() -> None:
    assert clamp_marketing_cabinet_ai_per_minute(30) == 30


@pytest.mark.unit
def test_clamp_invalid_falls_back_to_30() -> None:
    assert clamp_marketing_cabinet_ai_per_minute("not-a-number") == 30
    assert clamp_marketing_cabinet_ai_per_minute(None) == 30
