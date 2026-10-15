# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for AMKA master-plan JSON parsing and parse-status metadata.
# Invariants:
# - Parse reasons map to stable `plan_llm_status` values used by AMKA planning and UI hints.
# - Auto mode performs one retry/repair pass on malformed LLM output before final heuristic fallback.
# Related:
# - shared/api/services/marketing_cabinet/amka_llm_plan.py
# ---
"""Разбор JSON master plan AMKA и метаданные plan_llm_status."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from api.services.marketing_cabinet.amka_llm_json import amka_parse_model_json_detail
from api.services.marketing_cabinet.amka_llm_plan import run_llm_plan_with_meta


@pytest.mark.unit
@pytest.mark.parametrize(
    ("raw", "expected_reason", "expected_data"),
    [
        ("", "empty_input", {}),
        ("   \n\t  ", "empty_input", {}),
        (
            '{"plan_summary":"a","tasks":[]}',
            "ok",
            {"plan_summary": "a", "tasks": []},
        ),
        (
            '```json\n{"tasks":[{"section_key":"jtbd"}]}\n```',
            "ok",
            {"tasks": [{"section_key": "jtbd"}]},
        ),
        ("not-json-at-all", "no_json_segment", {}),
    ],
)
def test_amka_parse_model_json_detail_reasons(raw: str, expected_reason: str, expected_data: dict) -> None:
    data, reason = amka_parse_model_json_detail(raw)
    assert reason == expected_reason
    assert data == expected_data


@pytest.mark.unit
@pytest.mark.parametrize(
    "raw",
    ["[1,2]", "[{}]"],
    ids=["numeric_array", "object_array"],
)
def test_amka_parse_model_json_detail_non_object_root(raw: str) -> None:
    data, reason = amka_parse_model_json_detail(raw)
    assert data == {}
    assert reason in {"root_non_object", "extract_non_object"}


@pytest.mark.unit
def test_run_llm_plan_with_meta_ok_when_tasks_present() -> None:
    async def _run() -> None:
        rid = uuid4()

        async def fake_llm(*_a: object, **_k: object):
            return (
                {
                    "plan_summary": "s",
                    "tasks": [
                        {
                            "section_key": "jtbd",
                            "title": "t",
                            "rationale": "r",
                            "depends_on": [],
                            "write_policy": "apply_if_empty",
                            "execution_mode": "project_generate_async",
                            "operations": [],
                        }
                    ],
                },
                "ok",
                42,
                '{"plan_summary":"s","tasks":[]}',
            )

        snapshot = {
            "run": {"id": rid},
            "health": {},
            "user_instruction": "",
            "operator_amka": {
                "master_plan": {"max_tokens": 512, "retry_on_parse_failure": False},
            },
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
        candidate_tasks = [
            {
                "section_key": "jtbd",
                "title": "ct",
                "rationale": "cr",
                "depends_on": [],
                "write_policy": "apply_if_empty",
                "execution_mode": "project_generate_async",
                "operations": [],
            },
        ]
        with patch(
            "api.services.marketing_cabinet.amka_llm_plan.amka_llm_json_with_parse_meta",
            new_callable=AsyncMock,
            side_effect=fake_llm,
        ):
            payload, meta = await run_llm_plan_with_meta(
                snapshot=snapshot,
                audit_steps=audit_steps,
                candidate_tasks=candidate_tasks,
            )
        assert meta.get("plan_llm_status") == "ok"
        assert meta.get("parse_reason") == "ok"
        assert meta.get("response_chars") == 42
        assert isinstance(payload.get("tasks"), list)
        assert len(payload["tasks"]) == 1

    asyncio.run(_run())


@pytest.mark.unit
def test_run_llm_plan_with_meta_normalizes_legacy_execute_imc_section_key() -> None:
    async def _run() -> None:
        rid = uuid4()

        async def fake_llm(*_a: object, **_k: object):
            return (
                {
                    "plan_summary": "imc_rag_jtbd: закрывает JTBD",
                    "tasks": [
                        {
                            "section_key": "execute_imc_jtbd",
                            "title": "ИМК JTBD",
                            "rationale": "r",
                            "depends_on": [],
                            "write_policy": "apply_if_empty",
                            "execution_mode": "imc_research",
                            "operations": [],
                        }
                    ],
                },
                "ok",
                42,
                '{"plan_summary":"s","tasks":[{"section_key":"execute_imc_jtbd"}]}',
            )

        snapshot = {
            "run": {"id": rid},
            "health": {},
            "user_instruction": "",
            "operator_amka": {"master_plan": {"max_tokens": 512, "retry_on_parse_failure": False}},
            "section_entities": {},
            "source_catalog": {},
            "recent_amka_runs_digest_markdown": "",
            "imc_types_catalog": [{"type_key": "imc_rag_jtbd", "label": "JTBD"}],
        }
        audit_steps = [
            {
                "report_payload": {
                    "section_key": "imc",
                    "score": 50,
                    "work_needed": ["x"],
                    "dependencies": [],
                },
            },
        ]
        candidate_tasks = [
            {
                "section_key": "imc",
                "title": "ct",
                "rationale": "cr",
                "depends_on": [],
                "write_policy": "apply_if_empty",
                "execution_mode": "imc_research",
                "operations": [],
                "imc_type_key": "imc_rag_jtbd",
            },
        ]
        with patch(
            "api.services.marketing_cabinet.amka_llm_plan.amka_llm_json_with_parse_meta",
            new_callable=AsyncMock,
            side_effect=fake_llm,
        ):
            payload, meta = await run_llm_plan_with_meta(
                snapshot=snapshot,
                audit_steps=audit_steps,
                candidate_tasks=candidate_tasks,
            )
        assert meta.get("plan_llm_status") == "ok"
        assert payload["tasks"][0]["section_key"] == "imc"
        assert payload["tasks"][0]["imc_type_key"] == "imc_rag_jtbd"

    asyncio.run(_run())


@pytest.mark.unit
def test_run_llm_plan_with_meta_empty_response_status() -> None:
    async def _run() -> None:
        rid = uuid4()

        async def fake_llm(*_a: object, **_k: object):
            return {}, "empty_model_response", 0, ""

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
        candidate_tasks = [
            {
                "section_key": "jtbd",
                "title": "ct",
                "rationale": "cr",
                "depends_on": [],
                "write_policy": "apply_if_empty",
                "execution_mode": "project_generate_async",
                "operations": [],
            },
        ]
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
        assert meta.get("plan_llm_status") == "empty"
        assert meta.get("parse_reason") == "empty_model_response"

    asyncio.run(_run())


@pytest.mark.unit
def test_run_llm_plan_with_meta_auto_mode_retries_without_constructor_flag() -> None:
    async def _run() -> None:
        rid = uuid4()

        responses: list[tuple[dict[str, object], str, int, str]] = [
            ({}, "no_json_segment", 120, "plain text without json"),
            (
                {
                    "plan_summary": "ok",
                    "tasks": [
                        {
                            "section_key": "jtbd",
                            "title": "t",
                            "rationale": "r",
                            "depends_on": [],
                            "write_policy": "apply_if_empty",
                            "execution_mode": "project_generate_async",
                            "operations": [],
                        }
                    ],
                },
                "ok",
                180,
                '{"plan_summary":"ok","tasks":[{"section_key":"jtbd"}]}',
            ),
        ]

        async def fake_llm(*_a: object, **_k: object):
            return responses.pop(0)

        snapshot = {
            "run": {"id": rid},
            "run_mode": "auto",
            "health": {},
            "user_instruction": "",
            "operator_amka": {
                "master_plan": {
                    "max_tokens": 512,
                    "retry_on_parse_failure": False,
                    "repair_json_on_parse_failure": False,
                },
            },
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
        candidate_tasks = [
            {
                "section_key": "jtbd",
                "title": "ct",
                "rationale": "cr",
                "depends_on": [],
                "write_policy": "apply_if_empty",
                "execution_mode": "project_generate_async",
                "operations": [],
            },
        ]
        with patch(
            "api.services.marketing_cabinet.amka_llm_plan.amka_llm_json_with_parse_meta",
            new_callable=AsyncMock,
            side_effect=fake_llm,
        ):
            payload, meta = await run_llm_plan_with_meta(
                snapshot=snapshot,
                audit_steps=audit_steps,
                candidate_tasks=candidate_tasks,
            )

        assert meta.get("retried") is True
        assert meta.get("plan_llm_status") == "ok"
        assert isinstance(payload.get("tasks"), list)
        assert len(payload["tasks"]) == 1

    asyncio.run(_run())


@pytest.mark.unit
def test_run_llm_plan_with_meta_auto_mode_repairs_without_constructor_flag() -> None:
    async def _run() -> None:
        rid = uuid4()

        responses: list[tuple[dict[str, object], str, int, str]] = [
            ({}, "no_json_segment", 140, "raw text one"),
            ({}, "no_json_segment", 150, "raw text two"),
        ]

        async def fake_llm(*_a: object, **_k: object):
            return responses.pop(0)

        async def fake_repair(*_a: object, **_k: object):
            return (
                {
                    "plan_summary": "repaired",
                    "tasks": [
                        {
                            "section_key": "jtbd",
                            "title": "t",
                            "rationale": "r",
                            "depends_on": [],
                            "write_policy": "apply_if_empty",
                            "execution_mode": "project_generate_async",
                            "operations": [],
                        }
                    ],
                },
                "ok",
                90,
                '{"plan_summary":"repaired","tasks":[{"section_key":"jtbd"}]}',
            )

        snapshot = {
            "run": {"id": rid},
            "run_mode": "auto",
            "health": {},
            "user_instruction": "",
            "operator_amka": {
                "master_plan": {
                    "max_tokens": 512,
                    "retry_on_parse_failure": False,
                    "repair_json_on_parse_failure": False,
                },
            },
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
        candidate_tasks = [
            {
                "section_key": "jtbd",
                "title": "ct",
                "rationale": "cr",
                "depends_on": [],
                "write_policy": "apply_if_empty",
                "execution_mode": "project_generate_async",
                "operations": [],
            },
        ]
        with (
            patch(
                "api.services.marketing_cabinet.amka_llm_plan.amka_llm_json_with_parse_meta",
                new_callable=AsyncMock,
                side_effect=fake_llm,
            ),
            patch(
                "api.services.marketing_cabinet.amka_llm_plan._repair_master_plan_raw_json",
                new_callable=AsyncMock,
                side_effect=fake_repair,
            ),
        ):
            payload, meta = await run_llm_plan_with_meta(
                snapshot=snapshot,
                audit_steps=audit_steps,
                candidate_tasks=candidate_tasks,
            )

        assert meta.get("retried") is True
        assert meta.get("repair_attempted") is True
        assert meta.get("repaired") is True
        assert meta.get("plan_llm_status") == "ok"
        assert isinstance(payload.get("tasks"), list)
        assert len(payload["tasks"]) == 1

    asyncio.run(_run())
