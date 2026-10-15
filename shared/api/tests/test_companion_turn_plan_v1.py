# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Pure contract tests for TurnPlan v1 proceed/cancel heuristics and profile parsing.
# Invariants:
# - No HTTP / asyncpg.
# Related:
# - api/ewa_platform/companion/orchestration/turn_plan_v1.py
# ---

from __future__ import annotations

from api.ewa_platform.companion.orchestration.turn_plan_v1 import (
    COMPANION_TURN_PLAN_KEY,
    TurnPlanStep,
    turn_plan_from_profile,
    user_line_cancels_turn_plan,
    user_line_proceeds_turn_plan,
)


def test_turn_plan_from_profile_reads_steps() -> None:
    profile = {
        "learned_preferences": {
            COMPANION_TURN_PLAN_KEY: {
                "steps": [
                    {"tool": "file_open", "args": {"user_line": "открой в редакторе", "unified_content_id": "uc-1"}},
                ],
                "source": "compound_discuss_then_open",
            },
        },
    }
    steps = turn_plan_from_profile(profile)
    assert len(steps) == 1
    assert steps[0] == TurnPlanStep(
        tool="file_open", args={"user_line": "открой в редакторе", "unified_content_id": "uc-1"}
    )


def test_user_line_proceeds_turn_plan() -> None:
    assert user_line_proceeds_turn_plan("да")
    assert user_line_proceeds_turn_plan("продолжай")
    assert user_line_proceeds_turn_plan("открой в редакторе")
    assert user_line_proceeds_turn_plan("continue")
    assert user_line_proceeds_turn_plan("запускай")
    assert user_line_proceeds_turn_plan("дальше")
    assert not user_line_proceeds_turn_plan("что ты думаешь о нём?")


def test_user_line_cancels_turn_plan() -> None:
    assert user_line_cancels_turn_plan("отмена")
    assert user_line_cancels_turn_plan("cancel plan")
    assert not user_line_cancels_turn_plan("прочитай notes.md")


def test_music_retry_regex_does_not_match_ne_povtoryat() -> None:
    """Regression: PRIMER glossary line must not look like «retry music generation»."""

    import re

    music_retry = re.compile(
        r"(?ix)(?:"
        r"(?:перезап(?:уск(?:а|и|ить|у)?|усти(?:ть)?)|заново|снова|повтор(?:и(?:ть|те)?|ить)\b|"
        r"ещё\s+раз|еще\s+раз|retry|regenerate|try\s+again)"
        r"(?:\s+(?:генера\w*|песн\w*|тр[еэ]к\w*|музык\w*|generation|song|track|music))?"
        r"|(?:сгенер(?:ируй|i)|запусти|начни)\s+(?:заново|снова|ещё\s+раз|еще\s+раз|again|retry)"
        r"|генерац\w*\s+(?:упала|упал|сбо(?:й|ила)|ошибк\w*|failed|не\s+получил\w*)"
        r"|(?:та|она|он)\s+упала\s+(?:с\s+)?(?:ошибк\w*|error)"
        r")",
    )
    glossary = "и не повторять одно и то же, если есть более эффективный способ"
    assert music_retry.search(glossary) is None
    assert music_retry.search("повтори генерацию с темой Empery World") is not None
