# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for Evidence research brief type catalog and run prompts.
# Related:
# - api/services/marketing_cabinet/research_type_catalog.py
# ---

from __future__ import annotations

import pytest

from api.services.marketing_cabinet.research_type_catalog import (
    build_evidence_research_run_prompt,
    coerce_research_type_value,
    list_research_types_for_cabinet,
    normalize_research_type_key,
    validate_research_type_enum,
)


@pytest.mark.unit
def test_list_research_types_excludes_legacy_junk() -> None:
    ids = {item["id"] for item in list_research_types_for_cabinet()}
    assert "porter" not in ids
    assert "business" not in ids
    assert "opportunity_analysis" not in ids
    assert "risk_assessment" not in ids
    assert "market" in ids
    assert len(ids) == 9


@pytest.mark.unit
def test_legacy_aliases_normalize_on_write() -> None:
    assert coerce_research_type_value("Porter") == "competitive"
    assert validate_research_type_enum("business") == "market"
    assert validate_research_type_enum("risk") == "trend_analysis"


@pytest.mark.unit
def test_build_prompt_is_rag_only_and_type_specific() -> None:
    prompt = build_evidence_research_run_prompt(
        {
            "title": "Конкуренты SaaS",
            "research_type": "competitive",
            "research_query": "Кто основные игроки?",
            "description": None,
            "goals": ["Список конкурентов"],
        },
        "## Контекст проекта\n- факт из vault",
    )
    assert "веб-поиск" in prompt.casefold() or "Веб-поиск" in prompt
    assert "Конкуренты" in prompt or "конкурент" in prompt.casefold()
    assert "Кто основные игроки?" in prompt
    assert "Недостаточно материалов" in prompt


@pytest.mark.unit
def test_normalize_unknown_to_custom() -> None:
    assert normalize_research_type_key("totally_unknown") == "custom"
    assert validate_research_type_enum("totally_unknown") == "custom"
