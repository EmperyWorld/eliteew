"""Качество AMKA: валидация master plan, repair-флаги, фильтр цитат в аудите."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from api.services.marketing_cabinet.amka_llm_plan import (
    enrich_master_plan_imc_type_keys_from_summary,
    extract_imc_type_keys_order_from_plan_summary,
    run_llm_plan_with_meta,
    validate_master_plan_tasks_shape,
)
from api.services.marketing_cabinet.amka_phase_audit import (
    _filter_work_needed_with_evidence,
    merge_section_audit_payload,
)


def _jtbd_candidate() -> dict:
    return {
        "section_key": "jtbd",
        "title": "ct",
        "rationale": "cr",
        "depends_on": [],
        "write_policy": "apply_if_empty",
        "execution_mode": "project_generate_async",
        "operations": [],
    }


@pytest.mark.unit
def test_validate_master_plan_rejects_duplicate_sections() -> None:
    c = [_jtbd_candidate()]
    ok, errs = validate_master_plan_tasks_shape(
        {"plan_summary": "x", "tasks": [{"section_key": "jtbd"}, {"section_key": "jtbd"}]},
        c,
    )
    assert ok is False
    assert any("duplicate" in e for e in errs)


@pytest.mark.unit
def test_validate_master_plan_rejects_unknown_section() -> None:
    c = [_jtbd_candidate()]
    ok, errs = validate_master_plan_tasks_shape(
        {"plan_summary": "x", "tasks": [{"section_key": "not_a_section"}]},
        c,
    )
    assert ok is False
    assert any("unknown_section" in e for e in errs)


def _imc_candidate() -> dict:
    return {
        "section_key": "imc",
        "title": "ct",
        "rationale": "cr",
        "depends_on": ["evidence"],
        "write_policy": "apply_if_empty",
        "execution_mode": "imc_research",
        "operations": [],
    }


@pytest.mark.unit
def test_validate_master_plan_allows_multiple_imc_distinct_types() -> None:
    c = [_jtbd_candidate(), _imc_candidate()]
    ok, errs = validate_master_plan_tasks_shape(
        {
            "plan_summary": "x",
            "tasks": [
                {"section_key": "imc", "imc_type_key": "imc_rag_swot"},
                {"section_key": "imc", "imc_type_key": "imc_rag_jtbd"},
            ],
        },
        c,
    )
    assert ok is True
    assert errs == []


@pytest.mark.unit
def test_validate_master_plan_rejects_duplicate_imc_type_keys() -> None:
    c = [_jtbd_candidate(), _imc_candidate()]
    ok, errs = validate_master_plan_tasks_shape(
        {
            "plan_summary": "x",
            "tasks": [
                {"section_key": "imc", "imc_type_key": "imc_rag_jtbd"},
                {"section_key": "imc", "imc_type_key": "imc_rag_jtbd"},
            ],
        },
        c,
    )
    assert ok is False
    assert any("duplicate_imc_type_key" in e for e in errs)


@pytest.mark.unit
def test_validate_master_plan_single_imc_requires_type_key() -> None:
    c = [_jtbd_candidate(), _imc_candidate()]
    ok, errs = validate_master_plan_tasks_shape(
        {"plan_summary": "x", "tasks": [{"section_key": "imc"}]},
        c,
    )
    assert ok is False
    assert any("imc_type_required" in e for e in errs)


@pytest.mark.unit
def test_validate_master_plan_multiple_imc_requires_type_keys() -> None:
    c = [_jtbd_candidate(), _imc_candidate()]
    ok, errs = validate_master_plan_tasks_shape(
        {
            "plan_summary": "x",
            "tasks": [
                {"section_key": "imc", "imc_type_key": "imc_rag_swot"},
                {"section_key": "imc"},
            ],
        },
        c,
    )
    assert ok is False
    assert any("imc_type_required" in e for e in errs)


@pytest.mark.unit
def test_enrich_imc_type_from_plan_summary_fills_tasks() -> None:
    payload = {
        "plan_summary": "{'imc_steps': [{'type_key': 'imc_rag_cx_journey'}, 'imc_rag_jtbd']}",
        "tasks": [{"section_key": "imc"}, {"section_key": "jtbd", "title": "t", "rationale": "r"}],
    }
    n = enrich_master_plan_imc_type_keys_from_summary(payload)
    assert n == 1
    assert payload["tasks"][0]["imc_type_key"] == "imc_rag_cx_journey"


@pytest.mark.unit
def test_extract_imc_type_keys_order_unique() -> None:
    s = "imc_rag_jtbd then imc_rag_swot and imc_rag_jtbd again"
    assert extract_imc_type_keys_order_from_plan_summary(s) == ["imc_rag_jtbd", "imc_rag_swot"]


@pytest.mark.unit
def test_heuristic_imc_not_trends_on_attention_signals_metric() -> None:
    from api.services.marketing_cabinet.amka_service_support import _heuristic_imc_type_key_for_amka_auto

    audit = {"work_needed": [], "current_state": ""}
    plan = {"rationale": "", "title": ""}
    tk = _heuristic_imc_type_key_for_amka_auto(
        audit,
        plan,
        cabinet_haystack="[overview]\nСигналов внимания: 5",
    )
    assert tk != "imc_rag_trends_signals"


@pytest.mark.unit
def test_heuristic_imc_trends_on_macro_markers() -> None:
    from api.services.marketing_cabinet.amka_service_support import _heuristic_imc_type_key_for_amka_auto

    audit = {"work_needed": [], "current_state": ""}
    plan = {"rationale": "", "title": ""}
    tk = _heuristic_imc_type_key_for_amka_auto(
        audit,
        plan,
        cabinet_haystack="макроэкономический контекст отрасли",
    )
    assert tk == "imc_rag_trends_signals"


@pytest.mark.unit
def test_normalize_operation_payloads_dedupes_reindex_by_content_id() -> None:
    from api.services.marketing_cabinet.amka_plan_candidates import normalize_operation_payloads

    base: list = []
    raw = [
        {
            "kind": "reindex_marketing_rag_content",
            "entity_type": "content_source",
            "payload": {"content_id": "c1"},
            "title": "a",
        },
        {
            "kind": "reindex_marketing_rag_content",
            "entity_type": "content_source",
            "payload": {"content_id": "c1"},
            "title": "b",
        },
        {"kind": "reindex_marketing_rag_content", "entity_type": "content_source", "payload": {"content_id": "c2"}},
    ]
    out = normalize_operation_payloads(raw, section_key="project_rag", base_operations=base)
    assert len(out) == 2
    cids = {str((o.get("payload") or {}).get("content_id") or "") for o in out if isinstance(o.get("payload"), dict)}
    assert cids == {"c1", "c2"}


@pytest.mark.unit
def test_filter_work_needed_keeps_verified_quotes() -> None:
    ctx = "В проекте мало связей между JTBD и ценностным предложением."
    lines = [
        "Добавить связи «мало связей между JTBD» в данных.",
        "Общая фраза без опоры.",
    ]
    out = _filter_work_needed_with_evidence(lines, ctx)
    assert len(out) == 1
    assert "связей" in out[0]


@pytest.mark.unit
def test_merge_section_audit_payload_dedupes_similar_work() -> None:
    base = {
        "section_key": "jtbd",
        "score": 50,
        "status": "attention",
        "current_state": [],
        "work_needed": ["Первая задача"],
        "dependencies": [],
    }
    override = {
        "section_key": "jtbd",
        "score": 40,
        "work_needed": ["первая задача", "Вторая уникальная"],
        "dependencies": [],
    }
    merged = merge_section_audit_payload(base, override)
    assert len(merged["work_needed"]) <= 4
    assert "Вторая уникальная" in merged["work_needed"]


@pytest.mark.unit
def test_merge_effective_operator_config_repair_json_env() -> None:
    from api.core.unified_config import unified_settings
    from api.schemas.marketing_cabinet.amka_operator_config import AmkaOperatorConfigV1
    from api.services.marketing_cabinet.amka_operator_config import merge_effective_operator_config

    eff = merge_effective_operator_config(AmkaOperatorConfigV1())
    assert eff.master_plan.get("repair_json_on_parse_failure") is False

    stored = AmkaOperatorConfigV1()
    stored.master_plan.repair_json_on_parse_failure = True
    assert merge_effective_operator_config(stored).master_plan.get("repair_json_on_parse_failure") is True

    with patch.object(unified_settings, "amka_master_plan_repair_json", True):
        eff_env = merge_effective_operator_config(AmkaOperatorConfigV1())
    assert eff_env.master_plan.get("repair_json_on_parse_failure") is True


@pytest.mark.unit
def test_run_llm_plan_structure_invalid_sets_parse_error() -> None:
    async def _run() -> None:
        rid = uuid4()

        async def fake_llm(*_a: object, **_k: object):
            return (
                {"plan_summary": "s", "tasks": [{"section_key": "nope"}]},
                "ok",
                10,
                '{"tasks":[{"section_key":"nope"}]}',
            )

        snapshot = {
            "run": {"id": rid},
            "health": {},
            "user_instruction": "",
            "operator_amka": {"master_plan": {"max_tokens": 512, "retry_on_parse_failure": False}},
            "section_entities": {},
            "source_catalog": {},
            "recent_amka_runs_digest_markdown": "",
        }
        audit_steps = [
            {
                "report_payload": {
                    "section_key": "jtbd",
                    "score": 50,
                    "work_needed": ["x"],
                    "dependencies": [],
                },
            },
        ]
        candidate_tasks = [_jtbd_candidate()]
        with patch(
            "api.services.marketing_cabinet.amka_llm_plan.amka_llm_json_with_parse_meta",
            new_callable=AsyncMock,
            side_effect=fake_llm,
        ):
            _payload, meta = await run_llm_plan_with_meta(
                snapshot=snapshot,
                audit_steps=audit_steps,
                candidate_tasks=candidate_tasks,
            )
        assert meta.get("plan_llm_status") == "parse_error"
        assert meta.get("structure_valid") is False
        assert meta.get("structure_errors")

    asyncio.run(_run())
