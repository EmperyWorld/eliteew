"""Unit tests: marketing cabinet project summary coverage metrics (Overview)."""

from __future__ import annotations

from uuid import uuid4

import pytest

from api.routers.marketing_cabinet.summary import (
    _average_percentage_meta,
    _build_coverage,
    _calc_percentage,
    _compute_readiness_breakdown,
)


def test_calc_percentage_clamps_to_100() -> None:
    assert _calc_percentage(9, 1) == 100


def test_calc_percentage_zero_total() -> None:
    assert _calc_percentage(5, 0) == 0


def test_build_coverage_clips_covered_when_exceeds_total_and_logs(
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level("WARNING")
    pid = uuid4()
    counts = {
        "jtbd": 1,
        "segments": 2,
        "campaigns": 1,
        "researches": 1,
        "funnels": 1,
        "tasks": 5,
        "completed_tasks": 3,
    }
    coverage_stats = {
        "linked_job_story_count": 9,
        "linked_segments_count": 1,
        "linked_campaigns_count": 1,
        "researches_with_output_count": 0,
        "funnels_with_data_count": 1,
    }
    result = _build_coverage(counts, coverage_stats, project_id=pid)
    by_key = {m["key"]: m for m in result}
    jtbd = by_key["jtbd_to_value_props"]
    assert jtbd["covered"] == 1
    assert jtbd["total"] == 1
    assert jtbd["percentage"] == 100
    assert "marketing_cabinet_overview_coverage_invariant" in caplog.text


def test_build_coverage_jtbd_orphan_ids_sanitized_to_match_totals() -> None:
    """When raw SQL would have over-counted, guard layer keeps percent and counts aligned."""
    pid = uuid4()
    counts = {
        "jtbd": 2,
        "segments": 0,
        "campaigns": 0,
        "researches": 0,
        "funnels": 0,
        "tasks": 0,
        "completed_tasks": 0,
    }
    coverage_stats = {
        "linked_job_story_count": 2,
        "linked_segments_count": 0,
        "linked_campaigns_count": 0,
        "researches_with_output_count": 0,
        "funnels_with_data_count": 0,
    }
    out = _build_coverage(counts, coverage_stats, project_id=pid)
    jtbd = next(m for m in out if m["key"] == "jtbd_to_value_props")
    assert jtbd["covered"] <= jtbd["total"]
    assert jtbd["percentage"] == _calc_percentage(jtbd["covered"], jtbd["total"])


def test_average_percentage_meta_ignores_zero_denominator_slots() -> None:
    cov = [
        {"key": "a", "percentage": 40, "total": 10, "covered": 4},
        {"key": "b", "percentage": 0, "total": 0, "covered": 0},
        {"key": "c", "percentage": 60, "total": 5, "covered": 3},
    ]
    avg, rows_used, slots = _average_percentage_meta(cov)
    assert slots == 3
    assert rows_used == 2
    assert avg == 50


def test_compute_readiness_breakdown_meta_points_sum_to_score() -> None:
    counts = {
        "jtbd": 1,
        "value_propositions": 1,
        "swot": 1,
        "competitors": 1,
        "researches": 1,
        "content": 1,
        "segments": 1,
        "campaigns": 1,
        "funnels": 1,
        "tasks": 1,
        "ai_runs": 1,
        "completed_tasks": 1,
        "alerts": 0,
    }
    coverage_stats = {
        "linked_job_story_count": 1,
        "linked_segments_count": 1,
        "linked_campaigns_count": 1,
        "researches_with_output_count": 1,
        "funnels_with_data_count": 1,
    }
    coverage = _build_coverage(counts, coverage_stats, project_id=uuid4())
    freshness = [
        {"state": "fresh"},
        {"state": "fresh"},
        {"state": "fresh"},
        {"state": "fresh"},
    ]
    score, _bd, meta = _compute_readiness_breakdown(
        counts,
        coverage,
        freshness,
        strategy_integrity_score=100,
    )
    pts = meta["contribution_points"]
    assert sum(pts.values()) == score
    assert meta["coverage_average_slots_total"] == len(coverage)
    assert meta["coverage_average_rows_used"] >= 1
    assert set(meta["weights"].keys()) == set(pts.keys())
