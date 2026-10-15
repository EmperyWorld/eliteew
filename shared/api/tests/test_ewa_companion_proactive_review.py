# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---

from __future__ import annotations

import pytest

from api.ewa_platform.companion.proactive.review_engine import build_proactive_suggestion


@pytest.fixture(autouse=True)
def enable_proactive(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_PROACTIVE_REVIEW_ENABLED", "1")


def test_turn_plan_suggestion_is_question() -> None:
    profile = {
        "learned_preferences": {
            "companion_turn_plan_v1": {
                "steps": [{"tool": "music_generation", "args": {}}],
            },
        },
    }
    suggestion = build_proactive_suggestion(profile=profile, trigger="turn")
    assert suggestion is not None
    assert "?" in (suggestion.question_ru or suggestion.question_en)
    assert "сделала" not in (suggestion.question_ru or "").lower()


def test_failed_run_suggestion() -> None:
    profile = {"learned_preferences": {}}
    suggestion = build_proactive_suggestion(
        profile=profile,
        recent_completed=[{"id": "r1", "status": "failed", "intent_kind": "music_generation_background"}],
        trigger="turn",
        subtask_event="task_failed",
    )
    assert suggestion is not None
    assert suggestion.kind == "risk"
    assert "?" in (suggestion.question_ru or suggestion.question_en)


def test_disabled_returns_none(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_PROACTIVE_REVIEW_ENABLED", "0")
    assert build_proactive_suggestion(profile={"learned_preferences": {}}, trigger="turn") is None
