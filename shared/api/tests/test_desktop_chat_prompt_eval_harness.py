# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Pytest gate for desktop prompt composition golden-set contracts.
# Invariants:
# - Golden fixtures must stay aligned with prompt_compose.py mode matrix.
# Related:
# - api/services/desktop_chat/prompt_eval.py
# - api/tests/fixtures/desktop_chat_prompt_eval_golden.jsonl
# ---

"""Desktop AI Chat prompt eval harness tests."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

pytest.importorskip("sqlalchemy")

from api.services.desktop_chat.prompt_eval import (
    PromptEvalCase,
    evaluate_prompt_compose,
    load_prompt_eval_cases,
)

_GOLDEN_PATH = Path(__file__).parent / "fixtures" / "desktop_chat_prompt_eval_golden.jsonl"


def test_prompt_eval_golden_schema() -> None:
    rows = [json.loads(line) for line in _GOLDEN_PATH.read_text(encoding="utf-8").splitlines() if line.strip()]
    assert len(rows) >= 8
    for row in rows:
        assert isinstance(row.get("id"), str) and row["id"].strip()
        assert row.get("mode") in {"solo", "ensemble_speaker", "ensemble_short", "blueprint"}
        assert isinstance(row.get("must_contain"), list) and row["must_contain"]


def test_prompt_eval_golden_compose_accuracy() -> None:
    cases = load_prompt_eval_cases(_GOLDEN_PATH)
    report = evaluate_prompt_compose(cases)
    if report.mismatches:
        details = "\n".join(f"- {m.case_id}: {m.reason}" for m in report.mismatches)
        pytest.fail(f"prompt eval mismatches ({report.passed}/{report.total} passed):\n{details}")
    assert report.accuracy == 1.0


def test_prompt_eval_reports_mismatch_shape_on_drift() -> None:
    cases = [
        PromptEvalCase(
            id="forced-mismatch",
            hero_id="akimbo",
            mode="solo",
            defaults={},
            use_tools=False,
            chat_override=None,
            structured_reply=False,
            post_tool=False,
            must_contain=("nonexistent_substring_xyz",),
            must_not_contain=(),
            expect_source=None,
            expect_mode=None,
            tags=(),
        )
    ]
    report = evaluate_prompt_compose(cases)
    assert report.passed == 0
    assert len(report.mismatches) == 1
    assert "missing substring" in report.mismatches[0].reason
