# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Minimal offline replay of the «Селёдка» quality path: audit → strategy options → marketing brief.
# Invariants:
# - Document-shaped turns route to blueprint before short-message chat fallback.
# - Finalizer contracts reject unknown citations, raw RAG markers, and incomplete ICE.
# Related:
# - api/services/desktop_chat_ensemble/blueprint/artifact_finalizer.py
# - documentation/product/DESKTOP-LLAMA-CHAT.md
# ---
"""Offline replay locks for Desktop AI Chat quality deliverables."""

from __future__ import annotations

from pathlib import Path

import pytest

pytest.importorskip("sqlalchemy")

from api.services.desktop_chat_ensemble.blueprint.artifact_finalizer import (
    sanitize_artifact_markdown,
    validate_artifact_markdown,
)
from api.services.desktop_chat_ensemble.blueprint.catalog import load_plan_catalog
from api.services.desktop_chat_ensemble.blueprint.picker import heuristic_pick_template_id
from api.services.desktop_chat_ensemble.conversational_route import heuristic_ensemble_route_phase


def _templates_dir() -> Path:
    return Path(__file__).resolve().parents[1] / "services" / "desktop_chat_ensemble" / "plan_templates"


@pytest.mark.parametrize(
    ("user_text", "expected_template"),
    [
        ("Проведите полноценный аудит проекта", "project_audit_v1"),
        ("Предложите 3–5 стратегических гипотез", "strategy_options_v1"),
        ("Соберите маркетинговый бриф по выбранной гипотезе", "marketing_brief_v1"),
    ],
)
def test_replay_selodka_turns_route_to_quality_templates(
    user_text: str,
    expected_template: str,
) -> None:
    phase = heuristic_ensemble_route_phase(
        user_text=user_text,
        defaults={},
        history=[],
    )
    assert phase == "blueprint"
    catalog = load_plan_catalog(_templates_dir())
    template_id, score = heuristic_pick_template_id(user_text, catalog)
    assert score > 0
    assert template_id == expected_template


def _outline_headings(template) -> list[str]:
    return [section.heading for section in template.document_outline]


def test_replay_selodka_templates_keep_non_overlapping_outlines() -> None:
    catalog = load_plan_catalog(_templates_dir())
    audit = catalog.templates_by_id["project_audit_v1"]
    strategy = catalog.templates_by_id["strategy_options_v1"]
    brief = catalog.templates_by_id["marketing_brief_v1"]
    assert audit.artifact_type == "project_audit"
    assert strategy.artifact_type == "strategy_options"
    assert brief.artifact_type == "marketing_brief"
    brief_headings = _outline_headings(brief)
    assert "Цель и основание" in brief_headings
    assert "Аудитория и JTBD" in brief_headings
    assert "Ценность, риски и проверка" in brief_headings
    assert len(brief_headings) >= 3
    # Core path (first three outline sections) must stay distinct across the
    # Селёдка chain. Optional roster lenses (ROI/Talent/Expansion/…) may share
    # vocabulary across templates by design.
    audit_core = set(_outline_headings(audit)[:3])
    strategy_core = set(_outline_headings(strategy)[:3])
    brief_core = set(brief_headings[:3])
    assert not (audit_core & strategy_core)
    assert not (audit_core & brief_core)
    assert not (strategy_core & brief_core)


def test_replay_rejects_raw_rag_and_unknown_citations() -> None:
    catalog = load_plan_catalog(_templates_dir())
    tpl = catalog.templates_by_id["project_audit_v1"]
    required = [section.heading for section in tpl.document_outline]
    dirty = "\n\n".join(
        [
            f"## {required[0]}\nФакт: спрос подтверждён 【P9】.\nГипотеза: нужен пилот.",
            f"## {required[1]}\nИсточник: [Копия — Чат — RAG, фр. 2].",
            f"## {required[2]}\nЧто проверить: юнит-экономика.",
        ]
    )
    cleaned = sanitize_artifact_markdown(
        dirty,
        source_registry=[
            {
                "citation_id": "P1",
                "kind": "project_document",
                "authority": "project_material",
                "title": "Research",
            }
        ],
    )
    assert "RAG" not in cleaned
    assert "фр." not in cleaned.lower()
    violations = validate_artifact_markdown(
        dirty,
        artifact_type=tpl.artifact_type,
        required_sections=required,
        source_registry=[{"citation_id": "P1"}],
    )
    assert "raw_rag_marker" in violations or "raw_fragment_marker" in violations
    assert "unknown_citation:P9" in violations


def _strategy_section_body(heading: str, *, with_ice: bool) -> str:
    """Build one outline section body that matches live strategy_options contracts."""
    if heading == "Рамка решения":
        return (
            f"## {heading}\nФакт из 【P1】: есть подтверждённый спрос.\nГипотеза: премиальный сегмент готов к пилоту."
        )
    if heading == "Стратегические варианты":
        if with_ice:
            return (
                f"## {heading}\n"
                "Вариант 1 — локальная доставка. ICE = Impact × Confidence × Ease = 5 × 4 × 3 = 60.\n"
                "Вариант 2 — подписка на наборы. ICE = 4 × 3 × 4 = 48.\n"
                "Вариант 3 — B2B корпоративные заказы. ICE = 3 × 4 × 2 = 24."
            )
        return f"## {heading}\nВариант 1 — локальная доставка.\nВариант 2 — подписка.\nВариант 3 — B2B."
    if heading == "Сравнение и рекомендация":
        return f"## {heading}\nРекомендация: начать с варианта 1.\nЧто проверить за 48 часов: конверсия первого заказа."
    return (
        f"## {heading}\n"
        "Факт: контур уточнён по 【P1】.\n"
        "Гипотеза: блок нужен для полного outline; что проверить — чувствительность к CAPEX."
    )


def test_replay_valid_strategy_options_pass_contract() -> None:
    catalog = load_plan_catalog(_templates_dir())
    tpl = catalog.templates_by_id["strategy_options_v1"]
    required = _outline_headings(tpl)
    body = "\n\n".join(_strategy_section_body(heading, with_ice=True) for heading in required)
    violations = validate_artifact_markdown(
        body,
        artifact_type=tpl.artifact_type,
        required_sections=required,
        source_registry=[
            {
                "citation_id": "P1",
                "kind": "project_document",
                "authority": "project_material",
                "title": "Research",
            }
        ],
    )
    assert violations == []


def test_replay_strategy_options_without_ice_fail() -> None:
    catalog = load_plan_catalog(_templates_dir())
    tpl = catalog.templates_by_id["strategy_options_v1"]
    required = _outline_headings(tpl)
    body = "\n\n".join(_strategy_section_body(heading, with_ice=False) for heading in required)
    violations = validate_artifact_markdown(
        body,
        artifact_type=tpl.artifact_type,
        required_sections=required,
        source_registry=[{"citation_id": "P1"}],
    )
    assert "ice_calculation_missing" in violations
