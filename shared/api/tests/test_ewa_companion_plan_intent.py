# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Regex intent gate for plan creation lines (silent reject boundaries).
# Related:
# - api/ewa_platform/companion/plans/intent.py
# ---

from __future__ import annotations

from api.ewa_platform.companion.plans.intent import user_line_requests_plan


def test_plan_intent_positive_ru() -> None:
    assert user_line_requests_plan("Составь план на две недели по продукту")


def test_plan_intent_positive_with_dates_ru() -> None:
    assert user_line_requests_plan("Сделай план с указанием дат на месяц по релизу")


def test_plan_intent_positive_with_dates_en() -> None:
    assert user_line_requests_plan("Create a plan with due dates for the product launch")


def test_plan_intent_negative_memory_question() -> None:
    assert not user_line_requests_plan("Что ты помнишь про мой проект?")


def test_plan_intent_negative_short() -> None:
    assert not user_line_requests_plan("план")


def test_plan_request_needs_clarification_on_vague_line() -> None:
    from api.ewa_platform.companion.plans.service import plan_request_needs_clarification

    assert plan_request_needs_clarification("Составь план на две недели")
    assert not plan_request_needs_clarification("Составь план на 2 недели: запуск companion plans в прод")


def test_plan_intent_rejects_wrong_plan_with_dark_theme() -> None:
    assert not user_line_requests_plan(
        "Неправильный план.\nПоменяй тему рабочего стола на тёмную. Мне не видно текста."
    )
