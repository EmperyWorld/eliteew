# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Verify artifact-aware validation, one-shot repair, and deterministic fallback semantics.
# Invariants:
# - Repair is attempted no more than once.
# - Unknown citations and internal RAG coordinates never survive into persisted fallback text.
# Related:
# - api/services/desktop_chat_ensemble/blueprint/artifact_finalizer.py
# ---
"""Tests for Desktop AI Chat artifact finalization."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from api.services.desktop_chat_ensemble.blueprint.artifact_finalizer import (
    ArtifactFinalizationResult,
    apply_finalization_status,
    ensure_web_evidence_section,
    finalize_artifact,
    sanitize_artifact_markdown,
    validate_artifact_markdown,
)

_SOURCES = [
    {
        "citation_id": "P1",
        "kind": "project_document",
        "authority": "project_material",
        "title": "Исследование",
    }
]


def _valid_audit() -> str:
    return """## Вывод и основание

Подтверждено материалом проекта: спрос описан в исследовании 【P1】.
Гипотеза: сегмент готов к пилоту; нужно добрать конверсию.

## Диагностика проекта

Факт: ценностное предложение сформулировано 【P1】.
Неизвестно: фактическая готовность платить.

## Риски, приоритеты и решения

Гипотеза риска: канал может быть дорогим. Что проверить: пилот.
"""


@pytest.mark.asyncio
async def test_valid_artifact_skips_repair() -> None:
    repairer = AsyncMock(return_value="should not run")
    result = await finalize_artifact(
        draft=_valid_audit(),
        user_request="Проведите аудит",
        artifact_type="project_audit",
        required_sections=[
            "Вывод и основание",
            "Диагностика проекта",
            "Риски, приоритеты и решения",
        ],
        quality_rubric=[],
        source_registry=_SOURCES,
        model="test",
        defaults={},
        repairer=repairer,
    )
    assert result.status == "verified"
    assert result.markdown == _valid_audit().strip()
    repairer.assert_not_awaited()


def test_sanitizer_removes_raw_coordinates_and_unknown_citations() -> None:
    content = (
        "## Основание\n\nФакт 【P1】 и выдумка 【P9】 [research.md — RAG, фр. 4] content_id=123 chunk_index=7 score=0.9"
    )
    cleaned = sanitize_artifact_markdown(content, source_registry=_SOURCES)
    assert "【P1】" in cleaned
    assert "【P9】" not in cleaned
    assert "RAG" not in cleaned
    assert "content_id" not in cleaned
    assert "chunk_index" not in cleaned
    assert "score=" not in cleaned


@pytest.mark.asyncio
async def test_finalizer_performs_exactly_one_successful_repair() -> None:
    repaired = _valid_audit()
    repairer = AsyncMock(return_value=repaired)
    with patch(
        "api.services.desktop_chat_ensemble.blueprint.artifact_finalizer.ensemble_audit_log.log_llm_chat",
        AsyncMock(),
    ):
        result = await finalize_artifact(
            draft="## Вывод и основание\n\nФакт без остальных секций 【P1】.",
            user_request="Проведите аудит проекта",
            artifact_type="project_audit",
            required_sections=[
                "Вывод и основание",
                "Диагностика проекта",
                "Риски, приоритеты и решения",
            ],
            quality_rubric=["Не выдумывать факты"],
            source_registry=_SOURCES,
            model="test",
            defaults={},
            repairer=repairer,
        )
    assert result.status == "repaired"
    assert result.markdown == repaired.strip()
    assert result.repair_attempted is True
    assert result.fallback_used is False
    repairer.assert_awaited_once()
    repair_call = repairer.await_args
    assert repair_call is not None
    messages, _max_tokens = repair_call.args
    assert "Проведите аудит проекта" in messages[1]["content"]
    assert "content_id" not in messages[1]["content"]


@pytest.mark.asyncio
async def test_incomplete_repair_falls_back_to_cleaned_source_draft() -> None:
    repairer = AsyncMock(return_value="## Всё ещё неверно\n\nRAG fragment=2 【P99】")
    draft = "## Вывод\n\nФакт [RAG, фр. 2] и гипотеза 【P99】"
    with patch(
        "api.services.desktop_chat_ensemble.blueprint.artifact_finalizer.ensemble_audit_log.log_llm_chat",
        AsyncMock(),
    ):
        result = await finalize_artifact(
            draft=draft,
            user_request="Соберите документ",
            artifact_type="project_audit",
            required_sections=["Вывод", "Диагностика"],
            quality_rubric=[],
            source_registry=_SOURCES,
            model="test",
            defaults={},
            repairer=repairer,
        )
    assert result.status == "needs_review"
    assert result.fallback_used is True
    assert "RAG" not in result.markdown
    assert "【P99】" not in result.markdown
    repairer.assert_awaited_once()


def test_strategy_contract_requires_three_to_five_options_and_calculated_ice() -> None:
    invalid = """## Рамка решения
Факт 【P1】. Гипотеза: проверить.
## Стратегические варианты
### Вариант 1
Первый.
### Вариант 2
Второй.
## Сравнение и рекомендация
Выбор.
"""
    violations = validate_artifact_markdown(
        invalid,
        artifact_type="strategy_options",
        required_sections=[
            "Рамка решения",
            "Стратегические варианты",
            "Сравнение и рекомендация",
        ],
        source_registry=_SOURCES,
    )
    assert "strategy_option_count:2" in violations
    assert "ice_calculation_missing" in violations


def test_quality_status_keeps_grounding_separate_from_validation() -> None:
    result = apply_finalization_status(
        {
            "status": "draft",
            "label": "Формируется",
            "grounding_status": "derived_context",
            "grounding_label": "Опора на AI-документ",
        },
        ArtifactFinalizationResult(
            markdown="## Вывод",
            status="needs_review",
            violations=("unknown_citation:P9",),
            repair_attempted=True,
            fallback_used=True,
        ),
    )
    assert result["status"] == "needs_review"
    assert result["grounding_status"] == "derived_context"
    assert result["fallback_used"] is True


def test_ice_arithmetic_mismatch_is_flagged_for_any_artifact() -> None:
    text = """## Варианты
Факт 【P1】. Гипотеза: проверить канал.
ICE: 3 × 4 × 5 = 48
"""
    violations = validate_artifact_markdown(
        text,
        artifact_type="campaign_plan",
        required_sections=[],
        source_registry=_SOURCES,
        user_request="Кампания для консервов",
    )
    assert any(v.startswith("ice_arithmetic_mismatch:") for v in violations)


def test_invented_brand_with_digits_is_flagged() -> None:
    text = """## Цель
Факт 【P1】. Бренд Ulov16 выходит в ритейл.
Гипотеза: нужен пилот.
"""
    violations = validate_artifact_markdown(
        text,
        artifact_type="marketing_brief",
        required_sections=[],
        source_registry=_SOURCES,
        user_request="Соберите маркетинговый бриф для сельди",
    )
    assert "invented_brand:Ulov16" in violations


def test_derived_source_title_does_not_allowlist_invented_brand() -> None:
    """Prior AI docs must not poison the brand allowlist (Ulov16 loop)."""
    sources = [
        *_SOURCES,
        {
            "citation_id": "D1",
            "kind": "derived_ai_artifact",
            "authority": "derived",
            "title": "План с брендом Ulov16",
        },
    ]
    text = """## Цель
Факт 【P1】. Бренд Ulov16 в ритейле.
Гипотеза: пилот.
"""
    violations = validate_artifact_markdown(
        text,
        artifact_type="team_response",
        required_sections=[],
        source_registry=sources,
        user_request="Протокол встречи по сельди",
    )
    assert "invented_brand:Ulov16" in violations
    cleaned = sanitize_artifact_markdown(
        text,
        source_registry=sources,
        user_request="Протокол встречи по сельди",
        artifact_type="team_response",
        scrub_brands=True,
    )
    assert "Ulov16" not in cleaned
    assert "[Brand TBD]" in cleaned


def test_incomplete_ice_score_without_formula_is_flagged() -> None:
    text = """## Варианты
Факт 【P1】. Гипотеза: канал A.
ICE: 30
"""
    violations = validate_artifact_markdown(
        text,
        artifact_type="strategy_options",
        required_sections=[],
        source_registry=_SOURCES,
        user_request="Стратегии",
    )
    assert "ice_incomplete:30" in violations


def test_placeholder_markers_are_flagged_and_sanitized() -> None:
    text = """## Цель
Дата: [Текущая дата]
Факт 【P1】. Гипотеза: [Расчет в процессе]
"""
    violations = validate_artifact_markdown(
        text,
        artifact_type="business_plan",
        required_sections=[],
        source_registry=_SOURCES,
        user_request="Бизнес-план",
    )
    assert any(v.startswith("placeholder_marker:") for v in violations)
    cleaned = sanitize_artifact_markdown(text, source_registry=_SOURCES)
    assert "[Текущая дата]" not in cleaned
    assert "[Расчет в процессе]" not in cleaned
    assert "[уточнить]" in cleaned


def test_fuzzy_heading_match_ignores_emoji_and_markdown() -> None:
    text = """## **🎯 Вывод и основание**

Факт 【P1】. Гипотеза: пилот.

## Диагностика проекта

Факт: сегмент описан 【P1】.
Неизвестно: готовность платить.

## Риски, приоритеты и решения

Гипотеза риска: канал дорогой. Что проверить: пилот.
"""
    violations = validate_artifact_markdown(
        text,
        artifact_type="project_audit",
        required_sections=[
            "Вывод и основание",
            "Диагностика проекта",
            "Риски, приоритеты и решения",
        ],
        source_registry=_SOURCES,
        user_request="аудит",
    )
    assert not any(v.startswith("missing_section:") for v in violations)


def _valid_code_architecture_audit() -> str:
    return """## Поверхность и domain lock

Domain lock: поверхность `ewa_companion` (task_run / WorkflowRuntimeKind). Не путать с `desktop_ai_chat` ensemble blueprint — out of scope.

## Инвентарь кода

| символ | статус | основание | заметка |
| --- | --- | --- | --- |
| WorkflowRuntimeKind | EXISTS | 【P1】 | в companion |
| music_full_cycle_v1 | EXISTS | 【P1】 | tool registry |
| fidelity UI chip | MISSING | запрос | нет в FE |
| dual-path docs | PARTIAL | 【P1】 | канон неполный |

Факт: runtime kind уже в коде 【P1】. Гипотеза: UI scorecard ещё нет — нужно добрать.

## Gap vs Done и Keep/Change/Kill

Keep: WorkflowRuntimeKind. Change: dual-path docs. Kill: не изобретать новый runtime. Reinvent claims: нет.

## MVP только по пробелам

1. Fidelity chip (MISSING) — Done: Checks tab показывает score. Verify: vitest.
"""


def test_code_architecture_audit_valid_passes() -> None:
    violations = validate_artifact_markdown(
        _valid_code_architecture_audit(),
        artifact_type="code_architecture_audit",
        required_sections=[
            "Поверхность и domain lock",
            "Инвентарь кода",
            "Gap vs Done и Keep/Change/Kill",
            "MVP только по пробелам",
        ],
        source_registry=_SOURCES,
        user_request="Сверьте архитектурный каркас с кодом",
    )
    assert "inventory_status_missing" not in violations
    assert "domain_surface_lock_missing" not in violations
    assert "keep_change_kill_missing" not in violations
    assert "reinvents_existing" not in violations
    assert "fact_hypothesis_boundary_missing" not in violations
    assert "source_citation_missing" not in violations


def test_code_architecture_audit_flags_reinvent_and_missing_inventory() -> None:
    weak = """## Поверхность и domain lock

Нужен общий план.

## Инвентарь кода

Построить с нуля новый runtime для companion.

## Gap vs Done и Keep/Change/Kill

Создать всё заново.

## MVP только по пробелам

Этап 1: внедрить новый runtime.
"""
    violations = validate_artifact_markdown(
        weak,
        artifact_type="code_architecture_audit",
        required_sections=[
            "Поверхность и domain lock",
            "Инвентарь кода",
            "Gap vs Done и Keep/Change/Kill",
            "MVP только по пробелам",
        ],
        source_registry=[],
        user_request="архитектура",
    )
    assert "inventory_status_missing" in violations
    assert "domain_surface_lock_missing" in violations
    assert "keep_change_kill_missing" in violations

    reinvent = """## Поверхность и domain lock

Domain lock: ewa_companion. Не смешивать с desktop ensemble.

## Инвентарь кода

WorkflowRuntimeKind | EXISTS | код | ok
fidelity chip | MISSING | запрос | нет

Факт: kind существует. Гипотеза: UI нет.

## Gap vs Done и Keep/Change/Kill

Keep WorkflowRuntimeKind. Change docs. Kill fake dual path.
Но также: построить с нуля новый runtime.

## MVP только по пробелам

Только chip.
"""
    reinvent_violations = validate_artifact_markdown(
        reinvent,
        artifact_type="code_architecture_audit",
        required_sections=[
            "Поверхность и domain lock",
            "Инвентарь кода",
            "Gap vs Done и Keep/Change/Kill",
            "MVP только по пробелам",
        ],
        source_registry=[],
        user_request="сверка",
    )
    assert "reinvents_existing" in reinvent_violations


def test_code_architecture_audit_negated_invent_is_not_reinvent() -> None:
    text = """## Поверхность и domain lock

Domain lock: ewa_companion. Не смешивать с desktop_ai_chat.

## Инвентарь кода

WorkflowRuntimeKind | EXISTS | код
chip | MISSING | запрос
Факт: kind есть. Гипотеза: chip нет.

## Gap vs Done и Keep/Change/Kill

Keep kind. Change docs. Kill: не построить с нуля runtime; нельзя создать с нуля registry.

## MVP только по пробелам

Только chip.
"""
    violations = validate_artifact_markdown(
        text,
        artifact_type="code_architecture_audit",
        required_sections=[
            "Поверхность и domain lock",
            "Инвентарь кода",
            "Gap vs Done и Keep/Change/Kill",
            "MVP только по пробелам",
        ],
        source_registry=[],
        user_request="сверка",
    )
    assert "reinvents_existing" not in violations


def test_code_architecture_audit_plain_title_does_not_satisfy_domain_lock() -> None:
    text = """Поверхность и domain lock

Нужен общий план без surface id.

## Инвентарь кода

x | EXISTS | a
y | MISSING | b
Факт: a. Гипотеза: b.

## Gap vs Done и Keep/Change/Kill

Keep x. Change y. Kill fake path.

## MVP только по пробелам

y only.
"""
    violations = validate_artifact_markdown(
        text,
        artifact_type="code_architecture_audit",
        required_sections=[
            "Поверхность и domain lock",
            "Инвентарь кода",
            "Gap vs Done и Keep/Change/Kill",
            "MVP только по пробелам",
        ],
        source_registry=[],
        user_request="сверка",
    )
    assert "domain_surface_lock_missing" in violations


def test_code_architecture_audit_support_needles_alone_do_not_override() -> None:
    from api.services.desktop_chat_ensemble.conversational_route import (
        user_requests_code_architecture_audit,
    )

    assert not user_requests_code_architecture_audit("already done keep change kill")
    assert user_requests_code_architecture_audit("архитектурный каркас: сверка с кодом already done keep change kill")


def test_ungrounded_research_claim_without_citation() -> None:
    text = """## Research focus

Мы нашли в сети актуальный рынок сельди.

## Method and sample

Гипотеза: нужен N=30. Факт: данных нет.
"""
    violations = validate_artifact_markdown(
        text,
        artifact_type="research_plan",
        required_sections=["Research focus", "Method and sample"],
        source_registry=[],
        user_request="план исследования",
    )
    assert "ungrounded_research_claim" in violations


def test_web_sources_require_web_citation() -> None:
    text = """## Research focus

Факт: рынок растёт. Гипотеза: канал X.

## Method and sample

Что проверить: выборка.
"""
    violations = validate_artifact_markdown(
        text,
        artifact_type="research_plan",
        required_sections=["Research focus", "Method and sample"],
        source_registry=[{"citation_id": "W1", "kind": "web", "title": "hit"}],
        user_request="исследование",
    )
    assert "web_citation_missing" in violations
    assert "source_citation_missing" in violations


def test_ensure_web_evidence_section_appends_registry_only() -> None:
    draft = """## Research focus

Факт: рынок растёт. Гипотеза: канал X.

## Method and sample

Что проверить: выборка.
"""
    grounded = ensure_web_evidence_section(
        draft,
        [
            {
                "citation_id": "W1",
                "kind": "web",
                "title": "Market note",
                "url": "https://example.com/m",
            }
        ],
    )
    assert "## Evidence" in grounded
    assert "【W1】" in grounded
    assert "https://example.com/m" in grounded
    assert "Market note" in grounded
    # Idempotent when already cited.
    again = ensure_web_evidence_section(grounded, [{"citation_id": "W1", "title": "Market note"}])
    assert again.count("## Evidence") == 1


@pytest.mark.asyncio
async def test_finalize_grounds_unused_web_citations_without_repair() -> None:
    draft = """## Research focus

Факт: рынок растёт. Гипотеза: канал X.

## Method and sample

Что проверить: выборка.
"""
    result = await finalize_artifact(
        draft=draft,
        user_request="исследование рынка",
        artifact_type="research_plan",
        required_sections=["Research focus", "Method and sample"],
        quality_rubric=[],
        source_registry=[
            {
                "citation_id": "W1",
                "kind": "web",
                "title": "Market note",
                "url": "https://example.com/m",
            }
        ],
        model="dummy",
        defaults={"ensemble_artifact_repair_enabled": False},
    )
    assert "【W1】" in result.markdown
    assert "## Evidence" in result.markdown
    assert "web_citation_missing" not in result.violations
    assert "source_citation_missing" not in result.violations
    assert result.status == "verified"


def test_bare_rag_product_term_not_raw_marker() -> None:
    text = """## Research focus

Факт: используем RAG-пайплайн в продукте 【W1】.
Гипотеза: нужен rerank.

## Method and sample

Что проверить: latency.
"""
    violations = validate_artifact_markdown(
        text,
        artifact_type="research_plan",
        required_sections=["Research focus", "Method and sample"],
        source_registry=[{"citation_id": "W1", "kind": "web", "title": "hit"}],
        user_request="исследование",
    )
    assert "raw_rag_marker" not in violations
    assert "web_citation_missing" not in violations
