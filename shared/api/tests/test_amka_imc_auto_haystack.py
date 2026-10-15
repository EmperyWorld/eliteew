# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for AMKA IMC auto-type heuristic and cabinet audit haystack aggregation.
# Invariants:
# - No database; pure string/rule behavior only.
# Related:
# - api/services/marketing_cabinet/amka_imc_auto_heuristic.py
# ---
"""Эвристика выбора imc_type_key в AMKA run_mode=auto и агрегат аудита кабинета."""

from __future__ import annotations

import pytest

from api.services.marketing_cabinet.amka_service_support import (
    AMKA_IMC_AUTO_CABINET_HAYSTACK_MAX_CHARS,
    _heuristic_imc_type_key_for_amka_auto,
    build_imc_auto_cabinet_haystack,
    scrub_text_for_imc_auto_heuristic,
)

_ALL_IMC_TYPE_KEYS: frozenset[str] = frozenset(
    {
        "imc_rag_trends_signals",
        "imc_rag_swot",
        "imc_rag_competitive",
        "imc_rag_target_audience",
        "imc_rag_value_proposition",
        "imc_rag_marketing_gtm_plan",
        "imc_rag_campaign_retrospective",
        "imc_rag_cx_journey",
        "imc_rag_voice_of_customer",
        "imc_rag_channel_partner_rf",
        "imc_rag_positioning_messaging",
        "imc_rag_pricing_packaging_rf",
        "imc_rag_cabinet_analysis",
        "imc_rag_customer_diagnostic",
        "imc_rag_jtbd",
    }
)


@pytest.mark.unit
def test_build_imc_auto_cabinet_haystack_counts_nonempty_sections() -> None:
    audits = {
        "jtbd": {
            "section_key": "jtbd",
            "work_needed": ["Уточнить сегменты"],
            "current_state": "",
        },
        "segments": {
            "section_key": "segments",
            "work_needed": [],
            "current_state": "Мало связей с JTBD.",
        },
        "empty": {"section_key": "evidence", "work_needed": [], "current_state": ""},
    }
    hay, n = build_imc_auto_cabinet_haystack(audits, max_chars=5000)
    assert n == 2
    assert "[jtbd]" in hay
    assert "[segments]" in hay
    assert "сегмент" in hay.casefold()


@pytest.mark.unit
def test_build_imc_auto_cabinet_haystack_truncates() -> None:
    long_line = "x" * 500
    audits = {
        "a": {"section_key": "a", "work_needed": [long_line], "current_state": ""},
        "b": {"section_key": "b", "work_needed": [long_line], "current_state": ""},
    }
    hay, n = build_imc_auto_cabinet_haystack(audits, max_chars=120)
    assert len(hay) <= 120
    assert hay.endswith("…")
    assert n == 2


@pytest.mark.unit
def test_build_imc_auto_cabinet_haystack_default_max_is_documented() -> None:
    assert AMKA_IMC_AUTO_CABINET_HAYSTACK_MAX_CHARS == 10_000


@pytest.mark.unit
def test_heuristic_imc_uses_cabinet_haystack_for_competitive() -> None:
    audit_imc: dict = {"work_needed": [], "current_state": ""}
    plan = {"rationale": "", "title": "IMC step"}
    cabinet = "[jtbd]\nсравнить предложения конкурентов на рынке"
    tk = _heuristic_imc_type_key_for_amka_auto(
        audit_imc,
        plan,
        cabinet_haystack=cabinet,
    )
    assert tk == "imc_rag_competitive"


@pytest.mark.unit
def test_heuristic_imc_swot_from_cabinet_overrides_sparse_step() -> None:
    audit_imc = {"work_needed": ["Обновить отчёт"], "current_state": ""}
    plan = {"rationale": "Дожать стратегию", "title": "IMC"}
    cabinet = "[analysis]\nнужен swot по продукту"
    tk = _heuristic_imc_type_key_for_amka_auto(
        audit_imc,
        plan,
        cabinet_haystack=cabinet,
    )
    assert tk == "imc_rag_swot"


@pytest.mark.unit
def test_heuristic_imc_cx_journey_from_touchpoints() -> None:
    audit_imc: dict = {"work_needed": [], "current_state": ""}
    plan = {"rationale": "Карта касаний и трений", "title": "IMC CX"}
    cabinet = "[imc]\ntouchpoint analysis по воронке"
    tk = _heuristic_imc_type_key_for_amka_auto(
        audit_imc,
        plan,
        cabinet_haystack=cabinet,
    )
    assert tk == "imc_rag_cx_journey"


@pytest.mark.unit
def test_heuristic_imc_voc_from_nps() -> None:
    audit_imc = {"work_needed": ["Разобрать NPS и комментарии"], "current_state": ""}
    plan = {"rationale": "", "title": "VoC"}
    tk = _heuristic_imc_type_key_for_amka_auto(
        audit_imc,
        plan,
        cabinet_haystack="",
    )
    assert tk == "imc_rag_voice_of_customer"


@pytest.mark.unit
def test_heuristic_imc_pricing_from_tariff() -> None:
    audit_imc: dict = {"work_needed": [], "current_state": ""}
    plan = {"rationale": "Сверить тарифную сетку и пакеты", "title": "Коммерция"}
    tk = _heuristic_imc_type_key_for_amka_auto(
        audit_imc,
        plan,
        cabinet_haystack="",
    )
    assert tk == "imc_rag_pricing_packaging_rf"


@pytest.mark.unit
def test_heuristic_imc_brand_guidelines_map_to_positioning() -> None:
    audit_imc: dict = {"work_needed": [], "current_state": ""}
    plan = {"rationale": "Проверить нейминг и гайдлайн бренда", "title": "IMC brand"}
    tk = _heuristic_imc_type_key_for_amka_auto(audit_imc, plan, cabinet_haystack="")
    assert tk == "imc_rag_positioning_messaging"


@pytest.mark.unit
def test_heuristic_imc_gtm_from_launch_plan() -> None:
    audit_imc: dict = {"work_needed": ["Уточнить этапы go-to-market"], "current_state": ""}
    plan = {"rationale": "", "title": "GTM"}
    tk = _heuristic_imc_type_key_for_amka_auto(audit_imc, plan, cabinet_haystack="")
    assert tk == "imc_rag_marketing_gtm_plan"


@pytest.mark.unit
def test_heuristic_imc_stakeholder_from_raci() -> None:
    audit_imc = {"work_needed": ["Обновить RACI по проекту"], "current_state": ""}
    plan = {"rationale": "", "title": "Governance"}
    tk = _heuristic_imc_type_key_for_amka_auto(audit_imc, plan, cabinet_haystack="")
    assert tk == "imc_rag_cabinet_analysis"


@pytest.mark.unit
def test_scrub_text_removes_attention_signals_product_phrasing() -> None:
    raw = "В кабинете 12 сигналов внимания и низкий readiness"
    scrubbed = scrub_text_for_imc_auto_heuristic(raw)
    assert "сигнал" not in scrubbed.casefold()
    assert "attention" not in scrubbed.casefold()


@pytest.mark.unit
def test_heuristic_imc_does_not_pick_trends_signals_for_attention_metrics() -> None:
    audit_imc = {
        "work_needed": ["12 сигналов внимания, readiness низкий"],
        "current_state": "",
    }
    plan = {"rationale": "", "title": "IMC"}
    tk = _heuristic_imc_type_key_for_amka_auto(audit_imc, plan, cabinet_haystack="")
    assert tk != "imc_rag_trends_signals"
    assert tk == "imc_rag_jtbd"


@pytest.mark.unit
def test_heuristic_imc_still_picks_trends_signals_for_market_context() -> None:
    audit_imc = {"work_needed": ["Нужен обзор рыночных трендов и макро"], "current_state": ""}
    plan = {"rationale": "", "title": "IMC trends"}
    tk = _heuristic_imc_type_key_for_amka_auto(audit_imc, plan, cabinet_haystack="")
    assert tk == "imc_rag_trends_signals"


@pytest.mark.unit
def test_heuristic_imc_all_excluded_falls_back_to_jtbd() -> None:
    """Documents exhaustion fallback: even when every rule is excluded, jtbd is returned."""
    tk = _heuristic_imc_type_key_for_amka_auto({}, {}, exclude_imc_type_keys=_ALL_IMC_TYPE_KEYS)
    assert tk == "imc_rag_jtbd"
