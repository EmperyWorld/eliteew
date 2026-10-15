# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Locks for Kursorina synthesize polish + soft goal coverage.
# Related:
# - api/services/kursorina/synthesize.py
# ---

from __future__ import annotations

from api.services.kursorina.synthesize import (
    goal_coverage_ok,
    polish_product_answer,
)


def test_polish_strips_greeting_persona_and_fake_date() -> None:
    raw = (
        "Приветствую. Я — Курсорина, работник-расследователь.\n"
        "Я — Курсорина.\n"
        "**Дата отчета:** 24 мая 2024 г.\n"
        "**Статус:** Завершено\n"
        "## ## Аналитический отчет: Demo\n"
        "\n"
        "Итог по elab.\n"
    )
    out = polish_product_answer(raw)
    assert "Приветствую" not in out
    assert "Я — Курсорина" not in out
    assert "24 мая 2024" not in out
    assert "Статус" not in out
    assert "## ##" not in out
    assert out.startswith("## Аналитический отчет")
    assert "elab" in out.casefold()


def test_polish_normalizes_mixed_heading_markers() -> None:
    out = polish_product_answer("### ## Краткий итог\n\nТекст.")
    assert out.startswith("### Краткий итог")


def test_goal_coverage_rejects_thin_shell() -> None:
    goal = "Изучи компанию elab.ru , изучи их конкурентов и возможности"
    thin = "## Аналитический отчет\n\nРынок растёт. Рекомендуем партнёрство."
    assert goal_coverage_ok(goal, thin) is False


def test_goal_coverage_accepts_topic_hits_or_gaps() -> None:
    goal = "Изучи компанию elab.ru , изучи их конкурентов и возможности"
    good = "## Итог\n\nПо elab.ru конкуренты слабы; возможности в лабораториях."
    assert goal_coverage_ok(goal, good) is True
    gaps = "## Итог\n\nПробелы: в источниках нет данных по конкурентам elab."
    assert goal_coverage_ok(goal, gaps) is True
