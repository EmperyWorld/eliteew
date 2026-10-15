"""Unit tests: ИМК RAG оркестрация — парсинг секций и merge-промпт."""

from __future__ import annotations

from api.services.ugs.providers.imc_rag_research_provider import (
    _concat_orchestrated_sections,
    _strip_leaked_merge_instructions,
    _strip_trailing_identical_bold_loop,
    build_merge_prompt,
    build_polish_concat_report_prompt,
    build_rag_research_prompt,
    imc_output_sections_list,
    normalize_imc_markdown_delivery,
)


def test_imc_output_sections_list_filters_empty() -> None:
    assert imc_output_sections_list(["A", "", " B "]) == ["A", "B"]
    assert imc_output_sections_list([]) == []
    assert imc_output_sections_list("not a list") == []


def test_build_merge_prompt_contains_drafts_and_constraints() -> None:
    p = build_merge_prompt(
        [("Раздел 1", "## Текст\nфакт [fragment=1]")],
        research_query="запрос",
        imc_type_key="imc_rag_trends_signals",
        prompt_instructions=None,
    )
    assert "Раздел 1" in p
    assert "## Текст" in p
    assert "fragment=1" in p
    assert "новые факты" in p
    assert "imc_rag_trends_signals" in p


def test_strip_leaked_merge_instructions() -> None:
    body = "## Рынок\n\nФакт [fragment=1]."
    leak = "\n\n*Перед отправкой:* в ответе не должно быть заголовка\n\n**Тип deep_market_showcase:** сохрани глубину"
    trimmed, ok = _strip_leaked_merge_instructions(body + leak)
    assert ok is True
    assert trimmed == body
    assert "Перед отправкой" not in trimmed


def test_strip_trailing_identical_bold_loop() -> None:
    filler = "word " * 120
    spam = " и ".join(["**секре**"] * 25)
    text = f"{filler}\n\n{spam}"
    trimmed, changed = _strip_trailing_identical_bold_loop(text, min_repeat=18)
    assert changed is True
    assert "секре" not in trimmed.split("_Хвост")[0][-400:] or "обрезан" in trimmed
    assert "зацикливание" in trimmed


def test_build_merge_prompt_deep_market_showcase_tail() -> None:
    p = build_merge_prompt(
        [("A", "body")],
        research_query="q",
        imc_type_key="imc_rag_deep_market_showcase",
        prompt_instructions=None,
    )
    assert "deep_market_showcase" in p
    assert "Уточнение для deep_market_showcase" in p
    assert "**Перед отправкой:**" not in p.split("Черновики по разделам")[-1]


def test_build_polish_concat_report_prompt_requires_preservation() -> None:
    p = build_polish_concat_report_prompt(
        "## Раздел\n\nТекст [fragment=1]",
        research_query="бриф",
        imc_type_key="imc_rag_deep_market_showcase",
    )
    assert "85%" in p
    assert "fragment=" in p
    assert "## Раздел" in p


def test_normalize_imc_markdown_unwraps_table_fence() -> None:
    raw = "Текст\n```markdown\n| A | B |\n| 1 | 2 |\n```\nКонец"
    out = normalize_imc_markdown_delivery(raw)
    assert "```" not in out
    assert "| A | B |" in out


def test_normalize_imc_markdown_strips_hr_disclaimer_note() -> None:
    raw = (
        "## Таблица\n| a |\n|---|\n| 1 |\n\n"
        "---\n\n"
        "**Примечание:** Примерные строки; нужно дополнительное исследование.\n\n"
        "## Далее\n\nСодержание."
    )
    out = normalize_imc_markdown_delivery(raw)
    assert "Примечание" not in out
    assert "## Далее" in out
    assert "Содержание" in out


def test_normalize_imc_markdown_demotes_duplicate_h2_in_section() -> None:
    stitched = _concat_orchestrated_sections(
        [
            ("Executive summary: рынок", "## Executive Summary\n\nПараграф."),
        ]
    )
    out = normalize_imc_markdown_delivery(stitched)
    assert "### Executive Summary" in out
    assert "\n## Executive Summary\n" not in out


def test_concat_orchestrated_sections_preserves_bodies() -> None:
    out = _concat_orchestrated_sections(
        [
            ("A", "para one"),
            ("B", "para two"),
        ]
    )
    assert "## A" in out
    assert "para one" in out
    assert "## B" in out
    assert "para two" in out
    assert "\n---\n" in out


def test_build_rag_research_prompt_section_focus() -> None:
    p = build_rag_research_prompt(
        "бриф",
        prompt_instructions=None,
        project_document_rag="ctx",
        imc_type_key="imc_rag_test",
        output_sections=["A", "B"],
        section_focus="Только этот",
        output_sections_override=["Только этот"],
    )
    assert "Оркестрация" in p
    assert "Только этот" in p
    assert "- Только этот" in p
    assert "ctx" in p


def test_build_rag_deep_showcase_orchestration_volume_hint() -> None:
    p = build_rag_research_prompt(
        "бриф",
        prompt_instructions=None,
        project_document_rag="ctx",
        imc_type_key="imc_rag_deep_market_showcase",
        output_sections=["X"],
        section_focus="Рынок",
        output_sections_override=["Рынок"],
    )
    assert "600" in p or "900" in p
    assert "ОБЪЁМ ЭТОЙ ГЛАВЫ" in p
