# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Behavioural tests for companion plan topic extraction and rule-based structure (Phase D).
# Related:
# - api/ewa_platform/companion/plans/service.py
# ---

from __future__ import annotations

from api.ewa_platform.companion.plans.service import (
    extract_plan_topic_from_user_line,
    plan_request_needs_clarification,
)


def test_extract_plan_topic_strips_boilerplate_ru() -> None:
    topic = extract_plan_topic_from_user_line("Составь план на 2 недели: запуск companion plans в прод")
    assert "companion plans" in topic.lower()
    assert "составь" not in topic.lower()
    assert topic.lower().startswith("запуск")


def test_plan_request_needs_clarification_on_vague_line() -> None:
    assert plan_request_needs_clarification("Составь план на две недели")
    assert not plan_request_needs_clarification("Составь план на 2 недели: запуск companion plans в прод")


def test_rule_based_structure_uses_topic_not_generic_goals() -> None:
    from api.ewa_platform.companion.plans.service import _rule_based_structure

    line = "Составь план на 2 недели: запуск companion plans в прод"
    title, goals, tasks = _rule_based_structure(line)
    assert "companion plans" in title.lower()
    assert goals[0]["title"].lower().startswith("запуск companion")
    assert goals[0]["title"] != "Главная цель"
    assert any("критерии успеха" in str(t.get("title", "")).lower() for t in tasks)


def test_rule_based_structure_daily_doc_study_plan() -> None:
    from api.ewa_platform.companion.plans.service import _rule_based_structure

    line = "создай цели и документам бассейна чтобы я их изучил 1 документ в день, всего будет 5 доков"
    title, goals, tasks = _rule_based_structure(line)
    assert "бассейна" in title.lower()
    assert len(goals) == 1
    assert len(tasks) == 5
    assert tasks[0]["goal_index"] == 0
    assert tasks[0].get("due_date")
    assert "день 1" in tasks[0]["title"].lower()
