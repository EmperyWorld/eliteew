# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for server-derived Poemma profit plan percent/status.
# Invariants:
# - Client planPercent/planStatus are overwritten from plan/fact.
# Related:
# - api/services/poemma_profit_plan.py
# ---

from __future__ import annotations

from api.services.poemma_profit_plan import (
    compute_poemma_profit_plan_fields,
    enrich_poemma_finance_snapshots_in_payload,
)


def test_compute_poemma_profit_plan_fields_matrix() -> None:
    assert compute_poemma_profit_plan_fields(target_profit=1_000_000, fact_profit=None) == {
        "planPercent": None,
        "planStatus": "empty",
    }
    assert compute_poemma_profit_plan_fields(target_profit=None, fact_profit=100.0) == {
        "planPercent": None,
        "planStatus": "ok",
    }
    below = compute_poemma_profit_plan_fields(target_profit=1_000_000, fact_profit=400_000)
    assert below["planPercent"] == 40
    assert below["planStatus"] == "below"
    ok = compute_poemma_profit_plan_fields(target_profit=500_000, fact_profit=600_000)
    assert ok["planPercent"] == 120
    assert ok["planStatus"] == "ok"


def test_enrich_overwrites_client_plan_fields() -> None:
    user = "poemma:v1:user-1"
    payload = {
        f"{user}:goal:p1": {"targetProfit": 1_000_000},
        f"{user}:finance:p1": {
            "profit": 400_000,
            "planPercent": 999,
            "planStatus": "ok",
            "percent": 1,
            "status": "noise",
        },
        f"{user}:other:x": {"keep": True},
    }
    out = enrich_poemma_finance_snapshots_in_payload(payload)
    snap = out[f"{user}:finance:p1"]
    assert snap["planPercent"] == 40
    assert snap["planStatus"] == "below"
    assert "percent" not in snap
    assert "status" not in snap
    assert out[f"{user}:other:x"] == {"keep": True}
