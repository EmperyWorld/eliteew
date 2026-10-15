# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Boundary tests for AMKA execute_section dispatch and execute-time metrics.
# Invariants:
# - Tests verify runtime branch behavior, not only plan normalization.
# - Autofill-capable sections must expose before/after counts in step metrics.
# Related:
# - api/services/marketing_cabinet/amka_phase_execute_section.py
# - documentation/product/marketing/AMKA-AUDIT-WORKFLOW.md
# ---
"""AMKA execute_section boundary tests."""

from __future__ import annotations

from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest

from api.services.marketing_cabinet.amka_phase_execute_section import run_execute_section_step


class _AsyncContext:
    def __init__(self, value: object) -> None:
        self.value = value

    async def __aenter__(self) -> object:
        return self.value

    async def __aexit__(self, *args: object) -> None:
        return None


class _CountConn:
    def __init__(self, values: list[int]) -> None:
        self.values = list(values)

    async def fetchval(self, _query: str, *_args: object) -> int:
        return self.values.pop(0)


class _CountPool:
    def __init__(self, values: list[int]) -> None:
        self.conn = _CountConn(values)

    def acquire(self) -> _AsyncContext:
        return _AsyncContext(self.conn)


@pytest.mark.asyncio
async def test_execute_section_apply_if_empty_reaches_async_autofill_with_counts() -> None:
    run_id = uuid4()
    user_id = uuid4()
    project_id = uuid4()
    step = {
        "id": str(uuid4()),
        "title": "JTBD",
        "section_key": "jtbd",
        "plan_payload": {
            "section_key": "jtbd",
            "write_policy": "apply_if_empty",
            "execution_mode": "project_generate_async",
            "operations": [],
        },
    }
    svc = Mock()
    svc._db_pool = _CountPool([0, 1])
    svc._get_run_checked = AsyncMock(return_value={"project_id": str(project_id), "company_id": str(uuid4())})
    svc._fetch_run_value = AsyncMock(
        return_value={
            "section_audits": [
                {
                    "section_key": "jtbd",
                    "score": 40,
                    "count": 0,
                    "work_needed": ["Заполнить JTBD"],
                }
            ]
        }
    )
    svc._normalize_operation_payloads = Mock(return_value=[])
    svc._run_project_generate_async_for_section = AsyncMock(
        return_value={
            "report_markdown": "done",
            "report_payload": {"mode": "apply_if_empty", "execution_mode": "project_generate_async"},
            "applied_entities": [{"entity_type": "job_story", "title": "JTBD"}],
            "metrics_before": {"score": 40},
            "metrics_after": {"applied_count": 1, "child_jobs_count": 1},
        }
    )
    snapshot = {
        "project_context_text": "context",
        "user_instruction": "",
        "operator_amka": {},
    }

    result = await run_execute_section_step(svc, run_id=run_id, step=step, user_id=user_id, snapshot=snapshot)

    svc._run_project_generate_async_for_section.assert_awaited_once()
    assert result["metrics_before"]["count_before"] == 0
    assert result["metrics_after"]["count_before"] == 0
    assert result["metrics_after"]["count_after"] == 1
    assert result["metrics_after"]["count_delta"] == 1
