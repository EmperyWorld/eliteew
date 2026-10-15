"""build_master_plan: откат на кандидатов после пустой нормализации LLM-задач."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from api.services.marketing_cabinet.amka_phase_plan import build_master_plan


@pytest.mark.unit
def test_build_master_plan_normalize_fallback_sets_status_and_used_flag() -> None:
    async def _run() -> None:
        rid = uuid4()
        svc = MagicMock()
        svc._build_candidate_tasks = MagicMock(
            return_value=[
                {
                    "section_key": "jtbd",
                    "title": "c",
                    "rationale": "r",
                    "depends_on": [],
                    "write_policy": "apply_if_empty",
                    "execution_mode": "project_generate_async",
                    "autofill_targets": [],
                    "operations": [],
                }
            ]
        )
        svc._render_master_plan_markdown = MagicMock(return_value="# md")
        svc._normalize_plan_tasks = MagicMock(return_value=[])

        async def fake_llm_meta(*_a: object, **_k: object):
            return (
                {
                    "plan_summary": "s",
                    "tasks": [{"section_key": "unknown_section_xyz"}],
                },
                {
                    "plan_llm_status": "ok",
                    "parse_reason": "ok",
                    "response_chars": 10,
                    "retried": False,
                    "error": None,
                },
            )

        snapshot = {
            "run": {"id": rid},
            "health": {},
            "operator_amka": {"master_plan": {"llm_enabled": True}},
        }
        audit_steps: list[dict[str, object]] = []

        with patch(
            "api.services.marketing_cabinet.amka_phase_plan.run_llm_plan_with_meta",
            new_callable=AsyncMock,
            side_effect=fake_llm_meta,
        ):
            out = await build_master_plan(svc, snapshot=snapshot, audit_steps=audit_steps)

        assert out["plan_source"] == "heuristic"
        assert out["plan_llm_status"] == "heuristic_fallback"
        assert out["plan_used_llm_tasks"] is False
        assert len(out["tasks"]) == 1
        assert out["tasks"][0]["section_key"] == "jtbd"

    asyncio.run(_run())


@pytest.mark.unit
def test_build_master_plan_uses_llm_tasks_when_normalize_non_empty() -> None:
    async def _run() -> None:
        rid = uuid4()
        normalized = [
            {
                "section_key": "jtbd",
                "title": "n",
                "rationale": "r",
                "depends_on": [],
                "write_policy": "apply_if_empty",
                "execution_mode": "project_generate_async",
                "autofill_targets": [],
                "operations": [],
            }
        ]
        svc = MagicMock()
        svc._build_candidate_tasks = MagicMock(return_value=list(normalized))
        svc._render_master_plan_markdown = MagicMock(return_value="# md")
        svc._normalize_plan_tasks = MagicMock(return_value=list(normalized))

        async def fake_llm_meta(*_a: object, **_k: object):
            return (
                {"plan_summary": "s", "tasks": [{"section_key": "jtbd"}]},
                {
                    "plan_llm_status": "ok",
                    "parse_reason": "ok",
                    "response_chars": 20,
                    "retried": False,
                    "error": None,
                },
            )

        snapshot = {
            "run": {"id": rid},
            "health": {},
            "operator_amka": {"master_plan": {"llm_enabled": True}},
        }

        with patch(
            "api.services.marketing_cabinet.amka_phase_plan.run_llm_plan_with_meta",
            new_callable=AsyncMock,
            side_effect=fake_llm_meta,
        ):
            out = await build_master_plan(svc, snapshot=snapshot, audit_steps=[])

        assert out["plan_source"] == "llm"
        assert out["plan_llm_status"] == "ok"
        assert out["plan_used_llm_tasks"] is True

    asyncio.run(_run())


@pytest.mark.unit
def test_merge_effective_operator_config_retry_or_env() -> None:
    from api.core.unified_config import unified_settings
    from api.schemas.marketing_cabinet.amka_operator_config import AmkaOperatorConfigV1
    from api.services.marketing_cabinet.amka_operator_config import merge_effective_operator_config

    stored = AmkaOperatorConfigV1()
    eff = merge_effective_operator_config(stored)
    assert eff.master_plan.get("retry_on_parse_failure") is False

    stored2 = AmkaOperatorConfigV1()
    stored2.master_plan.retry_on_parse_failure = True
    eff2 = merge_effective_operator_config(stored2)
    assert eff2.master_plan.get("retry_on_parse_failure") is True

    with patch.object(unified_settings, "amka_master_plan_retry_on_parse", True):
        eff3 = merge_effective_operator_config(AmkaOperatorConfigV1())
    assert eff3.master_plan.get("retry_on_parse_failure") is True
