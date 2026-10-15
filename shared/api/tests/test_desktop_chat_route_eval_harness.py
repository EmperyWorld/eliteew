# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Pytest gate for desktop ensemble routing heuristic golden-set accuracy.
# Invariants:
# - Golden fixtures must stay in sync with heuristic contract in conversational_route.py.
# Related:
# - api/services/desktop_chat_ensemble/route_eval.py
# - api/tests/fixtures/desktop_chat_route_eval_golden.jsonl
# ---

"""Desktop AI Chat route eval harness tests."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

pytest.importorskip("sqlalchemy")

from api.services.desktop_chat_ensemble.route_eval import (
    evaluate_route_heuristics,
    load_route_eval_cases,
)

_GOLDEN_PATH = Path(__file__).parent / "fixtures" / "desktop_chat_route_eval_golden.jsonl"


def test_route_eval_golden_schema() -> None:
    rows = [json.loads(line) for line in _GOLDEN_PATH.read_text(encoding="utf-8").splitlines() if line.strip()]
    assert len(rows) >= 10
    for row in rows:
        assert isinstance(row.get("id"), str) and row["id"].strip()
        assert isinstance(row.get("user_text"), str)
        assert row.get("expect_phase") in {"blueprint", "legacy", "uncertain"}


def test_route_eval_golden_heuristics_accuracy() -> None:
    cases = load_route_eval_cases(_GOLDEN_PATH)
    report = evaluate_route_heuristics(cases, defaults={})
    if report.mismatches:
        details = "\n".join(
            f"- {m.case_id}: expected={m.expected} actual={m.actual} text={m.user_text[:120]!r}"
            for m in report.mismatches
        )
        pytest.fail(f"route eval mismatches ({report.passed}/{report.total} passed):\n{details}")
    assert report.accuracy == 1.0


def test_route_eval_reports_mismatch_shape_on_drift() -> None:
    from api.services.desktop_chat_ensemble.route_eval import RouteEvalCase

    cases = [
        RouteEvalCase(
            id="forced-mismatch",
            user_text="Привет",
            expect_phase="blueprint",
            tags=(),
            history=(),
        )
    ]
    report = evaluate_route_heuristics(cases)
    assert report.passed == 0
    assert len(report.mismatches) == 1
    assert report.mismatches[0].actual == "legacy"
