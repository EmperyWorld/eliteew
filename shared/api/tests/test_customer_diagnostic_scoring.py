# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Golden unit tests for Customer Diagnostic server-side scoring.
# Invariants:
# - Uniform archetype answers yield a dominant with percentage > 0.
# Related:
# - api/services/marketing_cabinet/customer_diagnostic_scoring.py
# ---

from __future__ import annotations

from api.services.marketing_cabinet.customer_diagnostic_scoring import (
    compute_all_results,
    compute_module_metrics,
    score_archetype,
)


def test_score_archetype_uniform_answers() -> None:
    answers = {str(i): 3 for i in range(1, 25)}
    result = score_archetype(answers)
    assert result is not None
    assert result["dominant"]["percentage"] > 0
    assert result["secondary"]["percentage"] >= 0
    assert sum(result["percentages"].values()) > 0


def test_score_archetype_empty() -> None:
    assert score_archetype({}) is None
    assert score_archetype(None) is None


def test_compute_module_metrics_archetype() -> None:
    answers = {"archetype": {str(i): 3 for i in range(1, 25)}}
    metrics = compute_module_metrics("archetype", answers)
    assert "archetype" in metrics
    assert metrics["archetype"] is not None
    assert metrics["archetype"]["dominant"]["id"]


def test_compute_all_results_shape() -> None:
    answers = {
        "archetype": {str(i): 3 for i in range(1, 25)},
        "values": {},
        "business": {},
        "service": {},
        "emotions": {},
    }
    out = compute_all_results(answers)
    assert set(out.keys()) == {
        "archetype",
        "values",
        "business",
        "service",
        "emotions",
    }
    assert out["archetype"] is not None
    assert out["values"] is None
