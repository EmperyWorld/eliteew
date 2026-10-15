# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for agentic deliverable classify + filename normalize.
# Related:
# - api/ewa_platform/agentic/kernel/deliverable_classify.py
# ---

from __future__ import annotations

from api.ewa_platform.agentic.kernel.deliverable_classify import (
    classify_file_create_deliverable,
    normalize_agentic_doc_filename,
    resolve_use_expert_research,
)


def test_classify_personal_vs_research() -> None:
    assert (
        classify_file_create_deliverable(
            title="Правила работы",
            instruction="Сонастройка Зеры и Тани",
        )
        == "personal"
    )
    assert (
        classify_file_create_deliverable(
            title="Тезисный план презентации",
            instruction="Платформа EliteEW",
        )
        == "research"
    )


def test_classify_drives_use_expert_research_over_think() -> None:
    """Classify is SoT — Think cannot veto research or force personal bleed."""

    assert (
        resolve_use_expert_research(
            {"use_expert_research": False},
            title="Создание World Bible",
            instruction="на основе методологии и экспертных данных",
            name="World_Bible.md",
            user_line="Создать World Bible на основе методологии",
        )
        is True
    )
    assert (
        resolve_use_expert_research(
            {"use_expert_research": True},
            title="Правила работы",
            instruction="Сонастройка",
        )
        is False
    )


def test_ambiguous_injects_when_expert_research_present() -> None:
    assert (
        resolve_use_expert_research(
            {"use_expert_research": False},
            title="Заметка",
            instruction="короткая заметка",
            name="notes.md",
            has_expert_research=True,
        )
        is True
    )
    assert (
        resolve_use_expert_research(
            {},
            title="Заметка",
            instruction="короткая заметка",
            name="notes.md",
            has_expert_research=False,
        )
        is False
    )


def test_normalize_agentic_doc_filename() -> None:
    assert normalize_agentic_doc_filename("правила_работы.txt") == "правила_работы.md"
    assert normalize_agentic_doc_filename("Создание_тезисного_плана.txt") == "тезисного_плана.md"
    assert normalize_agentic_doc_filename("deck.html") == "deck.html"
    assert normalize_agentic_doc_filename("notes") == "notes.md"


def test_classify_instruction_and_platform_docs_as_research() -> None:
    assert (
        classify_file_create_deliverable(
            title="Инструкция регистрации",
            instruction="Описание платформы EliteEW",
            name="Инструкция_регистрации.md",
        )
        == "research"
    )
    assert (
        resolve_use_expert_research(
            {},
            title="Лонгрид о платформе",
            instruction="Подробное описание EliteEW",
        )
        is True
    )
