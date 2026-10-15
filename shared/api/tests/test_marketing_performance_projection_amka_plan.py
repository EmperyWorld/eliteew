# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for Marketing performance projection gates and AMKA plan candidate safeguards.
# Invariants:
# - Projection tests must not require live fact tables.
# - IMC plan expansion must keep unique active imc_type_key values.
# Related:
# - api/services/marketing_cabinet/project_performance_service.py
# - api/services/marketing_cabinet/amka_plan_candidates.py
# ---
"""Unit tests for Marketing performance entity projection and AMKA plan candidate fixes."""

from __future__ import annotations

import pytest

from api.services.marketing_cabinet.amka_plan_candidates import (
    _resolve_plan_write_policy,
    expand_imc_candidate_tasks,
)
from api.services.marketing_cabinet.amka_service_support import _sanitize_amka_imc_plan_tasks
from api.services.marketing_cabinet.project_performance_service import ProjectPerformanceService


@pytest.mark.unit
def test_resolve_plan_write_policy_keeps_apply_if_empty() -> None:
    wp = _resolve_plan_write_policy(
        section_key="jtbd",
        base_write_policy="apply_if_empty",
        llm_write_policy="report_only",
        operations=[],
        base_operations=[],
    )
    assert wp == "apply_if_empty"


@pytest.mark.unit
def test_resolve_plan_write_policy_keeps_operation_based_with_base_ops() -> None:
    base_ops = [{"kind": "create", "entity_type": "jtbd_card", "payload": {}}]
    wp = _resolve_plan_write_policy(
        section_key="jtbd",
        base_write_policy="operation_based",
        llm_write_policy="report_only",
        operations=[],
        base_operations=base_ops,
    )
    assert wp == "operation_based"


@pytest.mark.unit
def test_sanitize_autofill_plan_tasks_uplifts_report_only() -> None:
    out = _sanitize_amka_imc_plan_tasks(
        [
            {
                "section_key": "segments",
                "write_policy": "report_only",
                "execution_mode": "project_generate_async",
                "operations": [],
            }
        ]
    )
    assert out[0]["write_policy"] == "apply_if_empty"


@pytest.mark.unit
def test_sanitize_autofill_preserves_report_only_for_mutation_service() -> None:
    out = _sanitize_amka_imc_plan_tasks(
        [
            {
                "section_key": "jtbd",
                "write_policy": "report_only",
                "execution_mode": "mutation_service",
                "operations": [],
            }
        ]
    )
    assert out[0]["write_policy"] == "report_only"


@pytest.mark.unit
def test_sanitize_autofill_preserves_report_only_when_operations_present() -> None:
    out = _sanitize_amka_imc_plan_tasks(
        [
            {
                "section_key": "segments",
                "write_policy": "report_only",
                "execution_mode": "project_generate_async",
                "operations": [{"kind": "create", "entity_type": "segment", "payload": {}}],
            }
        ]
    )
    assert out[0]["write_policy"] == "report_only"


@pytest.mark.unit
def test_expand_imc_candidate_tasks_assigns_distinct_type_keys() -> None:
    audit_steps = [
        {
            "report_payload": {
                "section_key": "imc",
                "score": 40,
                "work_needed": ["Нужен SWOT"],
            }
        },
        {
            "report_payload": {
                "section_key": "analysis",
                "score": 30,
                "work_needed": ["Нет SWOT и конкурентов"],
            }
        },
        {
            "report_payload": {
                "section_key": "jtbd",
                "score": 20,
                "work_needed": ["Добавить JTBD"],
            }
        },
    ]
    snapshot = {
        "imc_types_catalog": [
            {"type_key": "imc_rag_swot", "display_name": "SWOT"},
            {"type_key": "imc_rag_jtbd", "display_name": "JTBD"},
            {"type_key": "imc_rag_competitive", "display_name": "Competitive"},
        ]
    }
    base_tasks = [
        {
            "step_key": "execute_imc",
            "section_key": "imc",
            "title": "IMC",
            "depends_on": ["evidence"],
            "write_policy": "apply_if_empty",
            "execution_mode": "imc_research",
            "autofill_targets": [],
            "operations": [],
            "rationale": "base",
        }
    ]
    out = expand_imc_candidate_tasks(base_tasks, audit_steps=audit_steps, snapshot=snapshot, max_imc_tasks=3)
    imc_steps = [item for item in out if item["section_key"] == "imc"]
    assert len(imc_steps) >= 2
    keys = [str(item.get("imc_type_key") or "") for item in imc_steps]
    assert len(set(keys)) == len(keys)
    assert all(key.startswith("imc_rag_") for key in keys)


@pytest.mark.unit
def test_expand_imc_candidate_tasks_respects_catalog_exhaustion() -> None:
    audit_steps = [
        {
            "report_payload": {
                "section_key": "imc",
                "score": 30,
                "work_needed": ["Нужен SWOT"],
            }
        },
        {
            "report_payload": {
                "section_key": "jtbd",
                "score": 20,
                "work_needed": ["Добавить JTBD"],
            }
        },
        {
            "report_payload": {
                "section_key": "analysis",
                "score": 20,
                "work_needed": ["Добавить анализ"],
            }
        },
    ]
    snapshot = {"imc_types_catalog": [{"type_key": "imc_rag_swot", "display_name": "SWOT"}]}
    base_tasks = [
        {
            "step_key": "execute_imc",
            "section_key": "imc",
            "title": "IMC",
            "depends_on": ["evidence"],
            "write_policy": "apply_if_empty",
            "execution_mode": "imc_research",
            "autofill_targets": [],
            "operations": [],
            "rationale": "base",
        }
    ]

    out = expand_imc_candidate_tasks(base_tasks, audit_steps=audit_steps, snapshot=snapshot, max_imc_tasks=4)
    imc_steps = [item for item in out if item["section_key"] == "imc"]

    assert len(imc_steps) == 1
    assert imc_steps[0]["imc_type_key"] == "imc_rag_swot"


@pytest.mark.unit
def test_projection_has_signal() -> None:
    assert ProjectPerformanceService._projection_has_signal({"spend": 100, "revenue": 0, "leads": 0, "conversions": 0})
    assert not ProjectPerformanceService._projection_has_signal(
        {"spend": 0, "revenue": 0, "leads": 0, "conversions": 0}
    )
