# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Daily sprint schedule parsing and structure for companion plans.
# Related:
# - api/ewa_platform/companion/plans/schedule.py
# ---

from __future__ import annotations

from datetime import date

from api.ewa_platform.companion.plans.refine_intent import user_line_requests_plan_refine
from api.ewa_platform.companion.plans.schedule import (
    parse_plan_date_range,
    try_daily_sprint_schedule_structure,
)


def test_parse_plan_date_range_from_today_to_august_25() -> None:
    ref = date(2026, 8, 19)
    line = "Нет, просто с сегодняшней даты по 25 августа, каждый день исследование с выводами"
    parsed = parse_plan_date_range(line, reference_today=ref)
    assert parsed == (date(2026, 8, 19), date(2026, 8, 25))


def test_daily_sprint_structure_builds_dated_tasks() -> None:
    ref = date(2026, 8, 19)
    line = (
        "Составь план с датами с 19 по 25 августа: исследование ИИ в браузерных играх, "
        "каждый день исследование + выводы"
    )
    structured = try_daily_sprint_schedule_structure(line, reference_today=ref)
    assert structured is not None
    title, goals, tasks = structured
    assert "2026-08-19" in title
    assert len(goals) == 1
    assert len(tasks) == 7
    assert tasks[0]["due_date"] == "2026-08-19"
    assert tasks[-1]["due_date"] == "2026-08-25"
    assert "исследование" in tasks[0]["title"].lower()


def test_plan_refine_intent_matches_short_schedule_clarification() -> None:
    assert user_line_requests_plan_refine("с сегодня по 25 августа, каждый день исследование")


def test_rule_based_structure_prefers_daily_sprint_over_generic() -> None:
    from api.ewa_platform.companion.plans.service import _rule_based_structure

    ref_line = (
        "Нет, просто с сегодняшней даты по 25 августа, каждый день нужно по исследованию делать с выводами , "
        "ИИ в браузерных играх"
    )
    _title, _goals, tasks = _rule_based_structure(ref_line)
    assert len(tasks) == 7
    assert all(task.get("due_date") for task in tasks)
    assert "критерии успеха" not in tasks[0]["title"].lower()
