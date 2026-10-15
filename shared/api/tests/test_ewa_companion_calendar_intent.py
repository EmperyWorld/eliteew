# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for companion calendar intent gates (list vs create vs plan).
# Related:
# - api/ewa_platform/companion/calendar/intent.py
# ---

from __future__ import annotations

from api.ewa_platform.companion.calendar.intent import (
    user_line_requests_calendar_create,
    user_line_requests_calendar_list,
)


def test_calendar_list_intent_matches_today_query() -> None:
    assert user_line_requests_calendar_list("Что у меня сегодня в календаре?")
    assert user_line_requests_calendar_list("what's on my calendar today")
    assert not user_line_requests_calendar_list("привет")


def test_calendar_create_intent_matches_add_event() -> None:
    assert user_line_requests_calendar_create("Добавь в календарь встречу завтра в 12:00")
    assert user_line_requests_calendar_create("add a meeting to the calendar at 09:30")
    assert not user_line_requests_calendar_create("Составь план на две недели по запуску")
    assert not user_line_requests_calendar_create("привет")
