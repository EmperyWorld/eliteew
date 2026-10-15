# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for Marketing Cabinet funnel stage conversion_rate derivation.
# Invariants:
# - Client-supplied conversion_rate must not be required for correct persisted rate.
# Related:
# - api/routers/marketing_cabinet/funnels.py
# ---

from __future__ import annotations

from api.routers.marketing_cabinet.funnels import (
    FunnelStageInput,
    compute_funnel_stage_conversion_rate,
)


def test_compute_funnel_stage_conversion_rate_basic() -> None:
    assert compute_funnel_stage_conversion_rate(100, 25) == 0.25
    assert compute_funnel_stage_conversion_rate(0, 5) == 0.0
    assert compute_funnel_stage_conversion_rate(10, 0) == 0.0


def test_funnel_stage_input_client_rate_is_ignored_by_helper() -> None:
    item = FunnelStageInput(
        stage_name="Visit",
        visitors=50,
        conversions=10,
        conversion_rate=0.99,
    )
    assert compute_funnel_stage_conversion_rate(item.visitors, item.conversions) == 0.2
