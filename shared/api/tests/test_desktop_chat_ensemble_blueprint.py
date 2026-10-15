# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Verify blueprint catalog contracts, semantic template selection, and slot assignment.
# Invariants:
# - Built-in templates load from the manifest and keep non-overlapping document outlines.
# Related:
# - api/services/desktop_chat_ensemble/plan_templates/
# - api/services/desktop_chat_ensemble/blueprint/catalog.py
# ---
"""Unit tests: blueprint plan catalog and slot assignment (no Llama)."""

from __future__ import annotations

from pathlib import Path

import pytest

pytest.importorskip("sqlalchemy")

from api.services.desktop_chat_ensemble.blueprint.assign import (
    assign_steps_to_roster,
    filter_outline_for_steps,
    rebalance_assignments_for_coverage,
    select_steps_for_roster,
)
from api.services.desktop_chat_ensemble.blueprint.catalog import PlanStep, load_plan_catalog
from api.services.desktop_chat_ensemble.blueprint.picker import (
    compound_deferred_templates,
    heuristic_pick_template_id,
)
from api.services.desktop_chat_ensemble.blueprint.stream_turn import _blueprint_quality_status
from api.services.desktop_chat_ensemble.heroes import HERO_SLOT_PROFILE
from api.services.desktop_chat_ensemble.settings import ENSEMBLE_MAX_ROSTER_HEROES


def _templates_dir() -> Path:
    return Path(__file__).resolve().parents[1] / "services" / "desktop_chat_ensemble" / "plan_templates"


def test_load_plan_catalog_manifest_and_templates() -> None:
    d = _templates_dir()
    cat = load_plan_catalog(d)
    assert "tech_plan_v1" in cat.templates_by_id
    assert "marketing_brief_v1" in cat.templates_by_id
    assert "project_audit_v1" in cat.templates_by_id
    assert "strategy_options_v1" in cat.templates_by_id
    assert "business_plan_v1" in cat.templates_by_id
    assert "marketing_arta_v1" not in cat.templates_by_id
    for it_id in (
        "it_adr_v1",
        "it_api_change_v1",
        "it_ui_states_v1",
        "it_release_runbook_v1",
        "it_threat_model_v1",
        "it_incident_brief_v1",
    ):
        assert it_id in cat.templates_by_id
    tpl = cat.templates_by_id["tech_plan_v1"]
    assert len(tpl.steps) == 3
    assert tpl.document_outline[0].heading
    marketing = cat.templates_by_id["marketing_brief_v1"]
    assert marketing.artifact_type == "marketing_brief"
    assert "interview_prep_v1" in cat.templates_by_id
    interview_prep = cat.templates_by_id["interview_prep_v1"]
    assert interview_prep.artifact_type == "interview_prep"
    assert "business_goal" in marketing.required_context
    core_headings = [section.heading for section in marketing.document_outline[:3]]
    assert core_headings == [
        "Цель и основание",
        "Аудитория и JTBD",
        "Ценность, риски и проверка",
    ]
    assert len(marketing.steps) >= 6
    assert {s.step_id for s in marketing.steps if s.min_roster >= 4} >= {"m4", "m5", "m6"}


def test_select_steps_for_roster_scales_marketing_brief() -> None:
    cat = load_plan_catalog(_templates_dir())
    tpl = cat.templates_by_id["marketing_brief_v1"]
    for n, expected_ids in (
        (3, ["m1", "m2", "m3"]),
        (4, ["m1", "m2", "m3", "m4"]),
        (5, ["m1", "m2", "m3", "m4", "m5"]),
        (6, ["m1", "m2", "m3", "m4", "m5", "m6"]),
    ):
        steps = select_steps_for_roster(tpl.steps, n)
        assert [s.step_id for s in steps] == expected_ids
        outline = filter_outline_for_steps(tpl.document_outline, {s.step_id for s in steps})
        assert len(outline) == n


def test_select_steps_for_roster_keeps_business_plan_core_at_trio() -> None:
    cat = load_plan_catalog(_templates_dir())
    tpl = cat.templates_by_id["business_plan_v1"]
    core = select_steps_for_roster(tpl.steps, 3)
    assert [s.step_id for s in core] == ["bp1", "bp2", "bp3", "bp4"]
    full = select_steps_for_roster(tpl.steps, ENSEMBLE_MAX_ROSTER_HEROES)
    assert [s.step_id for s in full] == ["bp1", "bp2", "bp3", "bp4", "bp5", "bp6", "bp7"]


def test_heuristic_picker_prefers_project_audit_for_colloquial_audit_start() -> None:
    cat = load_plan_catalog(_templates_dir())
    template_id, score = heuristic_pick_template_id("давайте с аудита начнём", cat)
    assert score > 0
    assert template_id == "project_audit_v1"


def test_compound_request_defers_secondary_templates() -> None:
    cat = load_plan_catalog(_templates_dir())
    user = "Соберите план кампании, стратегические варианты с ICE и research plan для запуска сельди в ритейле"
    primary, score = heuristic_pick_template_id(user, cat)
    assert score > 0
    assert primary
    deferred = compound_deferred_templates(user, cat, primary_id=primary)
    deferred_ids = {row["plan_template_id"] for row in deferred}
    assert primary not in deferred_ids
    assert len(deferred_ids) >= 1
    assert deferred_ids & {
        "campaign_plan_v1",
        "strategy_options_v1",
        "research_plan_v1",
        "marketing_brief_v1",
    }


def test_heuristic_picker_prefers_business_plan_template_for_business_plan_query() -> None:
    cat = load_plan_catalog(_templates_dir())
    template_id, score = heuristic_pick_template_id(
        "давайте мне полный бизнес план проекта и go-to-market",
        cat,
    )
    assert score > 0
    assert template_id == "business_plan_v1"


def test_heuristic_picker_prefers_business_plan_for_30_60_90_request() -> None:
    cat = load_plan_catalog(_templates_dir())
    template_id, score = heuristic_pick_template_id("Сделайте 30 60 90", cat)
    assert template_id == "business_plan_v1"
    assert score >= 99


def test_heuristic_picker_does_not_default_zero_match_to_tech_plan() -> None:
    cat = load_plan_catalog(_templates_dir())
    template_id, score = heuristic_pick_template_id("что думаете по этому поводу?", cat)
    assert template_id == ""
    assert score <= 0


def test_heuristic_picker_uses_marketing_brief_artifact_phrase() -> None:
    cat = load_plan_catalog(_templates_dir())
    template_id, score = heuristic_pick_template_id("нужен маркетинговый бриф для нового оффера", cat)
    assert score > 0
    assert template_id == "marketing_brief_v1"


def test_heuristic_picker_web_armed_research_prefers_research_plan() -> None:
    cat = load_plan_catalog(_templates_dir())
    template_id, score = heuristic_pick_template_id(
        "Найди мировые практики desktop agent research tools",
        cat,
        use_web_search=True,
    )
    assert template_id == "research_plan_v1"
    assert score >= 98


def test_heuristic_picker_suppress_blocks_research_plan_even_with_web() -> None:
    """Agentic empty-blueprint turns must not reopen research_plan_v1 via score=98."""
    cat = load_plan_catalog(_templates_dir())
    template_id, score = heuristic_pick_template_id(
        "Найди мировые практики desktop agent research tools",
        cat,
        use_web_search=True,
        suppress_research_plan_heuristic=True,
    )
    assert template_id != "research_plan_v1"
    assert score < 98


def test_heuristic_picker_interview_room_card_beats_research_plan() -> None:
    cat = load_plan_catalog(_templates_dir())
    template_id, score = heuristic_pick_template_id(
        "Нужны тема интервью и цель интервью, чтобы открыть комнату",
        cat,
    )
    assert template_id == "interview_prep_v1"
    assert score >= 99


def test_heuristic_picker_generic_research_interview_stays_research_plan() -> None:
    cat = load_plan_catalog(_templates_dir())
    template_id, score = heuristic_pick_template_id(
        "Подготовьте план исследования: вопросы, гипотезы, метод, выборка, скрипт интервью и критерии решения.",
        cat,
        use_web_search=True,
    )
    assert template_id == "research_plan_v1"
    assert score >= 98


def test_heuristic_picker_web_armed_issleduy_beats_ui_states() -> None:
    """RU imperative «исследуй» must not lose to long it_ui_states_v1 phrases."""
    cat = load_plan_catalog(_templates_dir())
    template_id, score = heuristic_pick_template_id(
        "исследуй empty loading error offline UI states",
        cat,
        use_web_search=True,
    )
    assert template_id == "research_plan_v1"
    assert score >= 98


def test_heuristic_picker_research_plan_phrase_beats_ui_states_without_web() -> None:
    cat = load_plan_catalog(_templates_dir())
    template_id, score = heuristic_pick_template_id(
        "нужен research plan по UI states empty loading error offline",
        cat,
        use_web_search=False,
    )
    assert template_id == "research_plan_v1"
    assert score >= 98


def test_heuristic_picker_pure_ui_journey_stays_it_ui_states() -> None:
    cat = load_plan_catalog(_templates_dir())
    template_id, score = heuristic_pick_template_id(
        "Опишите user journey и честные UI-состояния empty loading error offline",
        cat,
        use_web_search=False,
    )
    assert score > 0
    assert template_id == "it_ui_states_v1"


def test_heuristic_picker_prefers_meeting_notes_for_protocol_request() -> None:
    cat = load_plan_catalog(_templates_dir())
    template_id, score = heuristic_pick_template_id(
        "Соберите протокол встречи: решения, владельцы и follow-up",
        cat,
    )
    assert score > 0
    assert template_id == "meeting_notes_v1"


@pytest.mark.parametrize(
    ("user_text", "expected_template"),
    [
        ("Проведите полноценный аудит проекта", "project_audit_v1"),
        ("Предложите 3–5 стратегических гипотез и посчитайте ICE", "strategy_options_v1"),
    ],
)
def test_heuristic_picker_selects_quality_artifact_templates(
    user_text: str,
    expected_template: str,
) -> None:
    cat = load_plan_catalog(_templates_dir())
    template_id, score = heuristic_pick_template_id(user_text, cat)
    assert score > 0
    assert template_id == expected_template


def test_strategy_options_contract_requires_real_ice_calculation() -> None:
    cat = load_plan_catalog(_templates_dir())
    template = cat.templates_by_id["strategy_options_v1"]
    variants_step = next(step for step in template.steps if step.step_id == "so2")
    assert "3–5" in variants_step.instruction_for_model
    assert "ICE = Impact × Confidence × Ease" in variants_step.instruction_for_model
    assert [section.heading for section in template.document_outline[:3]] == [
        "Рамка решения",
        "Стратегические варианты",
        "Сравнение и рекомендация",
    ]
    assert [section.heading for section in template.document_outline[3:]] == [
        "Capital lens",
        "Expansion lens",
        "Talent and operating fit",
    ]


def test_business_template_without_rag_is_marked_hypothesis_only() -> None:
    cat = load_plan_catalog(_templates_dir())
    tpl = cat.templates_by_id["marketing_brief_v1"]
    status = _blueprint_quality_status(
        tpl,
        {"chat_rag_chunks": 0, "project_vault_chunks": 0},
        user_text="Маркетинговый бриф",
    )
    assert status["status"] == "draft"
    assert status["grounding_status"] == "hypothesis_only"


def test_business_template_with_rag_is_marked_grounded() -> None:
    cat = load_plan_catalog(_templates_dir())
    tpl = cat.templates_by_id["marketing_brief_v1"]
    status = _blueprint_quality_status(
        tpl,
        {
            "chat_rag_chunks": 2,
            "project_vault_chunks": 1,
            "context_sources": [
                {
                    "citation_id": "P1",
                    "kind": "project_document",
                    "authority": "project_material",
                    "title": "Research",
                }
            ],
        },
        user_text="Маркетинговый бриф",
    )
    assert status["status"] == "draft"
    assert status["grounding_status"] == "grounded"


def test_business_template_with_web_search_is_marked_grounded() -> None:
    cat = load_plan_catalog(_templates_dir())
    tpl = cat.templates_by_id["marketing_brief_v1"]
    status = _blueprint_quality_status(
        tpl,
        {
            "chat_rag_chunks": 0,
            "project_vault_chunks": 0,
            "web_search_used": True,
            "web_search_sources": [{"url": "https://example.com/news", "title": "News"}],
        },
        user_text="Новости Владивостока за вчера",
    )
    assert status["status"] == "draft"
    assert status["grounding_status"] == "grounded"
    assert status["web_search_used"] is True
    assert status["web_search_sources"] == 1


def test_business_template_with_only_derived_artifact_is_not_grounded() -> None:
    cat = load_plan_catalog(_templates_dir())
    tpl = cat.templates_by_id["marketing_brief_v1"]
    status = _blueprint_quality_status(
        tpl,
        {
            "chat_rag_chunks": 0,
            "project_vault_chunks": 2,
            "context_sources": [
                {
                    "citation_id": "D1",
                    "kind": "derived_ai_artifact",
                    "authority": "derived",
                    "title": "Earlier AI brief",
                }
            ],
        },
        user_text="Маркетинговый бриф",
    )
    assert status["grounding_status"] == "derived_context"


def test_assign_prefers_exact_slot_match() -> None:
    steps = [
        PlanStep(
            step_id="a",
            title="Legal",
            instruction_for_model="x",
            required_slots={"legal_edge": 3},
        )
    ]
    roster = ["viktor_engineer", "arlekino_pravoz"]
    profiles = {h: dict(HERO_SLOT_PROFILE.get(h, {})) for h in roster}
    out = assign_steps_to_roster(steps, roster, profiles, max_steps_per_hero=2)
    assert len(out) == 1
    assert out[0].hero_id == "arlekino_pravoz"
    assert out[0].fallback is False


def test_assign_streak_respects_max_per_hero() -> None:
    steps = [
        PlanStep(step_id="1", title="t1", instruction_for_model="i", required_slots={"engineering": 3}),
        PlanStep(step_id="2", title="t2", instruction_for_model="i", required_slots={"engineering": 3}),
        PlanStep(step_id="3", title="t3", instruction_for_model="i", required_slots={"engineering": 3}),
    ]
    roster = ["viktor_engineer", "arlekino_pravoz"]
    profiles = {h: dict(HERO_SLOT_PROFILE.get(h, {})) for h in roster}
    out = assign_steps_to_roster(steps, roster, profiles, max_steps_per_hero=2)
    assert len(out) == 3
    assert out[0].hero_id == "viktor_engineer"
    assert out[1].hero_id == "viktor_engineer"
    assert out[2].hero_id == "arlekino_pravoz"
    assert out[2].fallback is True


def test_marketing_brief_assigns_default_trio_across_three_steps() -> None:
    cat = load_plan_catalog(_templates_dir())
    tpl = cat.templates_by_id["marketing_brief_v1"]
    roster = ["likiy_sorrento", "arlyqueen", "akimbo"]
    profiles = {h: dict(HERO_SLOT_PROFILE.get(h, {})) for h in roster}
    steps = select_steps_for_roster(tpl.steps, len(roster))
    out = assign_steps_to_roster(
        steps,
        roster,
        profiles,
        max_steps_per_hero=tpl.max_steps_per_hero,
    )
    assert [a.step.step_id for a in out] == ["m1", "m2", "m3"]
    assert [a.hero_id for a in out] == ["arlyqueen", "arlyqueen", "likiy_sorrento"]


def test_business_plan_assigns_growth_hero_to_go_to_market_step() -> None:
    cat = load_plan_catalog(_templates_dir())
    tpl = cat.templates_by_id["business_plan_v1"]
    roster = ["likiy_sorrento", "arlyqueen", "akimbo"]
    profiles = {h: dict(HERO_SLOT_PROFILE.get(h, {})) for h in roster}
    steps = select_steps_for_roster(tpl.steps, len(roster))
    out = assign_steps_to_roster(
        steps,
        roster,
        profiles,
        max_steps_per_hero=tpl.max_steps_per_hero,
    )
    by_step = {a.step.step_id: a.hero_id for a in out}
    assert by_step["bp3"] == "arlyqueen"


def test_marketing_brief_expanded_roster_prefers_new_cohort_on_extension_steps() -> None:
    cat = load_plan_catalog(_templates_dir())
    tpl = cat.templates_by_id["marketing_brief_v1"]
    roster = [
        "likiy_sorrento",
        "arlyqueen",
        "akimbo",
        "kristian_romanovich",
        "artur_sergeevich",
        "elena_valeryevna",
    ]
    profiles = {h: dict(HERO_SLOT_PROFILE.get(h, {})) for h in roster}
    steps = select_steps_for_roster(tpl.steps, len(roster))
    assert [s.step_id for s in steps] == ["m1", "m2", "m3", "m4", "m5", "m6"]
    out = assign_steps_to_roster(
        steps,
        roster,
        profiles,
        max_steps_per_hero=1,
    )
    by_step = {a.step.step_id: a.hero_id for a in out}
    assert by_step["m4"] == "kristian_romanovich"
    assert by_step["m5"] == "artur_sergeevich"
    assert by_step["m6"] == "elena_valeryevna"


def test_rebalance_assignments_can_force_missing_hero_coverage() -> None:
    steps = [
        PlanStep(step_id="1", title="t1", instruction_for_model="i", required_slots={"brand_voice": 2}),
        PlanStep(step_id="2", title="t2", instruction_for_model="i", required_slots={"brand_voice": 2}),
        PlanStep(step_id="3", title="t3", instruction_for_model="i", required_slots={"brand_voice": 3}),
    ]
    roster = ["likiy_sorrento", "arlyqueen", "akimbo"]
    profiles = {h: dict(HERO_SLOT_PROFILE.get(h, {})) for h in roster}
    initial = assign_steps_to_roster(steps, roster, profiles, max_steps_per_hero=2)
    assert [a.hero_id for a in initial] == ["likiy_sorrento", "likiy_sorrento", "arlyqueen"]
    rebalanced = rebalance_assignments_for_coverage(
        initial,
        roster,
        profiles,
        required_heroes=["akimbo"],
        max_distance=2,
    )
    assert {a.hero_id for a in rebalanced} == {"likiy_sorrento", "arlyqueen", "akimbo"}


def test_assign_prefers_finance_axis_for_financial_step() -> None:
    steps = [
        PlanStep(
            step_id="fin",
            title="Finance",
            instruction_for_model="x",
            required_slots={"finance": 3, "rigor": 3},
        )
    ]
    roster = ["likiy_sorrento", "dr_vereskov"]
    profiles = {h: dict(HERO_SLOT_PROFILE.get(h, {})) for h in roster}
    out = assign_steps_to_roster(steps, roster, profiles, max_steps_per_hero=2)
    assert len(out) == 1
    assert out[0].hero_id == "dr_vereskov"
    assert out[0].fallback is False


def test_assign_prefers_operations_axis_for_operational_step() -> None:
    steps = [
        PlanStep(
            step_id="ops",
            title="Ops",
            instruction_for_model="x",
            required_slots={"operations": 3},
        )
    ]
    roster = ["likiy_sorrento", "suno_songwriter"]
    profiles = {h: dict(HERO_SLOT_PROFILE.get(h, {})) for h in roster}
    out = assign_steps_to_roster(steps, roster, profiles, max_steps_per_hero=2)
    assert len(out) == 1
    assert out[0].hero_id == "suno_songwriter"
    assert out[0].fallback is False


def test_stream_blueprint_turn_typed_except_budget() -> None:
    """Lock: extra typed except on this async gen → basedpyright false unused cascade.

    Only ``except Exception`` (plus bare) is allowed; narrow types via isinstance
    inside that handler. Historical ≤3 budget still triggered reportUnused* on
    current basedpyright once SQLAlchemyError + OSError were both present.
    """
    import ast

    path = Path(__file__).resolve().parents[1] / "services" / "desktop_chat_ensemble" / "blueprint" / "stream_turn.py"
    tree = ast.parse(path.read_text(encoding="utf-8"))
    fn = next(n for n in tree.body if isinstance(n, ast.AsyncFunctionDef) and n.name == "stream_blueprint_turn")
    try_stmt = next(s for s in fn.body if isinstance(s, ast.Try))
    typed = [
        h
        for h in try_stmt.handlers
        if h.type is not None and not (isinstance(h.type, ast.Name) and h.type.id == "Exception")
    ]
    assert len(typed) == 0, (
        f"stream_blueprint_turn has {len(typed)} non-Exception typed except handlers; "
        "keep a single except Exception (+ isinstance) or basedpyright reportUnused* "
        "cascades across the async generator"
    )


_IT_TEMPLATE_IDS = (
    "it_adr_v1",
    "it_api_change_v1",
    "it_ui_states_v1",
    "it_release_runbook_v1",
    "it_threat_model_v1",
    "it_incident_brief_v1",
)

_IT_ROSTER = (
    "it_kernel",
    "it_schema",
    "it_canvas",
    "it_pipeliner",
    "it_sentinel",
    "it_relay",
)


@pytest.mark.parametrize("template_id", _IT_TEMPLATE_IDS)
def test_it_template_loads_and_outline_refs_steps(template_id: str) -> None:
    cat = load_plan_catalog(_templates_dir())
    assert template_id in cat.templates_by_id
    assert template_id in cat.entries_by_id
    tpl = cat.templates_by_id[template_id]
    assert tpl.artifact_type.startswith("it_")
    assert tpl.artifact_type not in {
        "marketing_brief",
        "business_plan",
        "research_plan",
        "strategy_options",
    }
    step_ids = {s.step_id for s in tpl.steps}
    for sec in tpl.document_outline:
        assert sec.step_ids
        assert set(sec.step_ids) <= step_ids
    assert all(s.instruction_for_model.strip() for s in tpl.steps)
    assert tpl.max_steps_per_hero == 2


def test_it_api_change_and_release_scale_min_roster_four() -> None:
    cat = load_plan_catalog(_templates_dir())
    api = cat.templates_by_id["it_api_change_v1"]
    assert [s.step_id for s in select_steps_for_roster(api.steps, 3)] == [
        "api1",
        "api2",
        "api3",
    ]
    assert [s.step_id for s in select_steps_for_roster(api.steps, 4)] == [
        "api1",
        "api2",
        "api3",
        "api4",
    ]
    rel = cat.templates_by_id["it_release_runbook_v1"]
    assert "rel4" not in {s.step_id for s in select_steps_for_roster(rel.steps, 3)}
    assert "rel4" in {s.step_id for s in select_steps_for_roster(rel.steps, 4)}


def test_it_templates_assign_on_it_roster() -> None:
    cat = load_plan_catalog(_templates_dir())
    profiles = {h: dict(HERO_SLOT_PROFILE[h]) for h in _IT_ROSTER}
    for template_id in _IT_TEMPLATE_IDS:
        tpl = cat.templates_by_id[template_id]
        steps = select_steps_for_roster(tpl.steps, len(_IT_ROSTER))
        out = assign_steps_to_roster(
            steps,
            list(_IT_ROSTER),
            profiles,
            max_steps_per_hero=tpl.max_steps_per_hero,
        )
        assert len(out) == len(steps)
        assert all(a.hero_id in _IT_ROSTER for a in out)
        assert all(a.step.instruction_for_model.strip() for a in out)


def test_it_keyword_picks_do_not_steal_tech_plan() -> None:
    cat = load_plan_catalog(_templates_dir())
    cases = (
        ("Напишите ADR: зафиксируйте архитектурное решение со вариантами", "it_adr_v1"),
        (
            "Соберите пакет изменения API: was→will контракт, клиентский impact api",
            "it_api_change_v1",
        ),
        ("Опишите user journey и честные UI-состояния empty loading error offline", "it_ui_states_v1"),
        ("Составьте release/hotfix runbook: шаги rollback и go no-go выкат", "it_release_runbook_v1"),
        ("Сделайте threat model lite: активы и client trust boundary", "it_threat_model_v1"),
        (
            "Соберите recovery brief инцидента: timeline инцидента, слой отказа, mitigation blast radius",
            "it_incident_brief_v1",
        ),
    )
    for text, expected in cases:
        tid, score = heuristic_pick_template_id(text, cat)
        assert score > 0
        assert tid == expected
    tech_id, tech_score = heuristic_pick_template_id(
        "Соберите технический план для backend/API: целевая архитектура",
        cat,
    )
    assert tech_score > 0
    assert tech_id == "tech_plan_v1"


def test_it_keywords_do_not_steal_integration_or_postmortem() -> None:
    cat = load_plan_catalog(_templates_dir())
    integ_id, integ_score = heuristic_pick_template_id(
        "Подготовьте спецификацию интеграции: стороны обмена, API-контракт, webhook, ошибки и идемпотентность.",
        cat,
    )
    assert integ_score > 0
    assert integ_id == "integration_spec_v1"
    # Former collision: IT must not own bare «openapi diff» (may still hit other non-IT packs).
    steal_api, _ = heuristic_pick_template_id(
        "Подготовьте спецификацию интеграции: openapi diff",
        cat,
    )
    assert steal_api != "it_api_change_v1"
    steal_api_rich, _ = heuristic_pick_template_id(
        "Подготовьте спецификацию интеграции: стороны обмена, webhook, идемпотентность; openapi diff",
        cat,
    )
    assert steal_api_rich == "integration_spec_v1"
    pm_id, pm_score = heuristic_pick_template_id(
        "Подготовьте postmortem инцидента: таймлайн, root cause, влияние и предотвращающие меры.",
        cat,
    )
    assert pm_score > 0
    assert pm_id == "incident_postmortem_v1"
    # Former collision: bare English recovery phrases must not beat postmortem.
    steal_pm, _ = heuristic_pick_template_id(
        "Подготовьте postmortem: incident recovery brief",
        cat,
    )
    assert steal_pm == "incident_postmortem_v1"


def test_code_architecture_audit_template_loads() -> None:
    cat = load_plan_catalog(_templates_dir())
    assert "code_architecture_audit_v1" in cat.templates_by_id
    tpl = cat.templates_by_id["code_architecture_audit_v1"]
    assert tpl.artifact_type == "code_architecture_audit"
    step_ids = {s.step_id for s in tpl.steps}
    assert {"caa1", "caa2", "caa3", "caa4", "caa5"} <= step_ids
    assert [s.step_id for s in select_steps_for_roster(tpl.steps, 3)] == [
        "caa1",
        "caa2",
        "caa3",
        "caa4",
    ]
    assert "caa5" in {s.step_id for s in select_steps_for_roster(tpl.steps, 4)}


def test_code_architecture_audit_beats_product_spec_on_companion_tz() -> None:
    cat = load_plan_catalog(_templates_dir())
    user = (
        "Архитектурный каркас (ТЗ): Execution Paths Stable Path Experimental Path "
        "WorkflowRuntimeKind dual runtime companion vs ensemble. "
        "Сверка с кодом: inventory before invent, Already Done, Keep/Change/Kill. "
        "MVP acceptance критерии и спецификация не как greenfield PRD."
    )
    tid, score = heuristic_pick_template_id(user, cat)
    assert score == 99
    assert tid == "code_architecture_audit_v1"
    # Plain PRD still lands on product_spec, not code audit.
    prd_id, prd_score = heuristic_pick_template_id(
        "Подготовьте PRD для MVP: пользовательские сценарии, границы scope и критерии приёмки.",
        cat,
    )
    assert prd_score > 0
    assert prd_id == "product_spec_v1"
    tech_id, _ = heuristic_pick_template_id(
        "Соберите технический план для backend/API: целевая архитектура",
        cat,
    )
    assert tech_id == "tech_plan_v1"
