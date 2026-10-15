# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for plan task-complete chat intent (phrase gate + title matching).
# Related:
# - api/ewa_platform/companion/plans/task_complete_intent.py
# ---

from __future__ import annotations

import pytest

from api.ewa_platform.companion.plans import task_complete_intent as tci


@pytest.mark.unit
@pytest.mark.parametrize(
    ("line", "expected"),
    [
        ("Отметь выполненным: настроить CI", True),
        ("шаг написать тесты готов", True),
        ("готово", True),
        ("Mark as done: deploy staging", True),
        ("check off release notes", True),
        ("Привет, как дела?", False),
        ("Составь план на 2 недели", False),
    ],
)
def test_user_line_requests_plan_task_complete(line: str, expected: bool) -> None:
    assert tci.user_line_requests_plan_task_complete(line) is expected


@pytest.mark.unit
def test_task_title_needle_from_ru_colon_phrase() -> None:
    assert tci.task_title_needle_from_user_line("Отметь выполненным: настроить CI") == "настроить CI"


@pytest.mark.unit
def test_task_title_needle_from_en_mark_done() -> None:
    assert tci.task_title_needle_from_user_line("Mark as done: deploy staging") == "deploy staging"


@pytest.mark.unit
def test_match_open_plan_task_by_substring() -> None:
    tasks = [
        {"id": "t1", "title": "Настроить CI для companion plans"},
        {"id": "t2", "title": "Smoke-тест в браузере"},
    ]
    matched = tci.match_open_plan_task(tasks, "Отметь выполненным: настроить CI")
    assert matched is not None
    assert matched["id"] == "t1"


@pytest.mark.unit
def test_match_open_plan_task_single_open_fallback() -> None:
    tasks = [{"id": "only", "title": "Единственный шаг"}]
    matched = tci.match_open_plan_task(tasks, "готово")
    assert matched is not None
    assert matched["id"] == "only"


@pytest.mark.unit
def test_match_open_plan_task_ambiguous_returns_none() -> None:
    tasks = [
        {"id": "a", "title": "Шаг A"},
        {"id": "b", "title": "Шаг B"},
    ]
    assert tci.match_open_plan_task(tasks, "готово") is None
