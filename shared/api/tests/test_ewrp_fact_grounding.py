# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Tests for EWRP fact grounding queries and prompt blocks.
# Invariants:
# - Entity-focused queries must not collapse to marketing fluff tokens only.
# Related:
# - api.services.ewrp_fact_grounding
# ---

from __future__ import annotations

from api.services.ewrp_fact_grounding import (
    EWRP_FACT_GROUNDING_SEARCH_EMPTY,
    EWRP_FACT_GROUNDING_WITH_SEARCH,
    build_ewrp_fact_grounding_block,
    build_ewrp_web_search_prompt_section,
    build_ewrp_web_search_queries,
    ewrp_grounded_llm_temperatures,
    extract_ewrp_entity_focus,
)


def test_extract_ewrp_entity_focus_strips_marketing_fluff() -> None:
    topic = (
        "Orion Plaza бизнес-центр в центре города — "
        "положительная оценка и рекомендация эксперта по коммерческой недвижимости."
    )
    focus = extract_ewrp_entity_focus(topic=topic, title=topic)
    lowered = focus.casefold()
    assert "orion" in lowered
    assert "plaza" in lowered
    assert "положительная" not in lowered
    assert "рекомендация" not in lowered


def test_build_ewrp_web_search_queries_entity_focused() -> None:
    topic = "Orion Plaza бизнес-центр положительная оценка и рекомендация эксперта"
    queries = build_ewrp_web_search_queries(
        topic=topic,
        title=topic,
        extra_context=None,
        quality="deep",
    )
    assert len(queries) == 3
    joined = " ".join(queries).casefold()
    assert "orion" in joined
    assert "официальный" in joined or "характеристики" in joined
    assert "положительная" not in joined


def test_build_ewrp_fact_grounding_block_modes() -> None:
    assert "Источники" in build_ewrp_fact_grounding_block(
        web_search_enabled=True,
        web_block="[1] Example\n    text\n    URL: https://example.com",
    )
    assert build_ewrp_fact_grounding_block(web_search_enabled=True, web_block="") == (EWRP_FACT_GROUNDING_SEARCH_EMPTY)
    assert (
        "без веб-поиска"
        in build_ewrp_fact_grounding_block(
            web_search_enabled=False,
            web_block="",
        ).casefold()
    )


def test_build_ewrp_web_search_prompt_section_requires_body() -> None:
    assert build_ewrp_web_search_prompt_section("") == ""
    section = build_ewrp_web_search_prompt_section("[1] t\n    c\n    URL: u")
    assert "не объединяй разные сущности" in section.casefold()


def test_ewrp_grounded_llm_temperatures_lower_with_search() -> None:
    outline, slide = ewrp_grounded_llm_temperatures(web_search_enabled=True)
    assert outline < 0.4
    assert slide < 0.7
    assert EWRP_FACT_GROUNDING_WITH_SEARCH.startswith("ПРАВИЛА ДОСТОВЕРНОСТИ")
