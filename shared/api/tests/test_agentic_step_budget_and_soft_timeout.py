# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lock Celery soft/hard budget helpers and SoftTimeLimit classifier / recovery contract.
# Related:
# - documentation/product/ewa/EWA-COMPANION-STABILITY-PERF-CONTRACT.md
# ---

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock

import pytest

from api.ewa_platform.agentic import config as agentic_config
from api.ewa_platform.agentic.jobs import step_executor as se
from api.ewa_platform.agentic.jobs.llm_admission import is_heavy_llm_tool
from api.ewa_platform.agentic.jobs.reliability import is_agentic_celery_soft_timeout


class SoftTimeLimitExceeded(Exception):
    """Stand-in for celery.exceptions.SoftTimeLimitExceeded (name-matched)."""


def test_is_agentic_celery_soft_timeout_name_and_cause() -> None:
    assert is_agentic_celery_soft_timeout(SoftTimeLimitExceeded())
    wrapped = RuntimeError("wrap")
    wrapped.__cause__ = SoftTimeLimitExceeded()
    assert is_agentic_celery_soft_timeout(wrapped)
    assert not is_agentic_celery_soft_timeout(TimeoutError("other"))


def test_step_budget_claim_never_exceeds_soft(monkeypatch: pytest.MonkeyPatch) -> None:
    values = {
        "EWA_AGENTIC_STEP_SOFT_TIME_LIMIT_SEC": 180,
        "EWA_AGENTIC_STEP_TIME_LIMIT_SEC": 240,
        "EWA_AGENTIC_STEP_CLAIM_SECONDS": 900,
    }

    def _getenv_int(key: str, default: int = 0) -> int:
        return int(values.get(key, default))

    monkeypatch.setattr(agentic_config, "ewa_getenv_int", _getenv_int)
    soft = agentic_config.agentic_step_soft_time_limit_sec()
    hard = agentic_config.agentic_step_time_limit_sec()
    claim = agentic_config.agentic_step_claim_seconds()
    assert soft == 180
    assert hard >= soft + 30
    assert claim <= soft


def test_heavy_llm_tool_classifier() -> None:
    assert is_heavy_llm_tool("call_expert_chat")
    assert is_heavy_llm_tool("file_create")
    assert not is_heavy_llm_tool("theme_set")


@pytest.mark.asyncio
async def test_recover_soft_timeout_schedules_continue(monkeypatch: pytest.MonkeyPatch) -> None:
    pool = object()
    monkeypatch.setattr(se, "open_initialized_ewa_worker_pool", AsyncMock(return_value=pool))
    monkeypatch.setattr(
        se.agentic_pg,
        "agentic_task_tree_get",
        AsyncMock(return_value={"id": "n1", "metadata_json": {"soft_timeout_count": 0}}),
    )
    schedule = AsyncMock(return_value={"id": "n1", "status": "retry_wait"})
    monkeypatch.setattr(se.agentic_pg, "agentic_task_tree_schedule_continue", schedule)
    monkeypatch.setattr(se, "conn_execute_release_lease", AsyncMock())
    monkeypatch.setattr(
        se.agentic_pg,
        "agentic_session_fetch_for_principal",
        AsyncMock(return_value={"id": "s1", "status": "executing"}),
    )
    monkeypatch.setattr(se, "safe_sync_and_publish_task_run_from_session", AsyncMock(return_value=True))
    enqueued: list[dict[str, Any]] = []

    def _enqueue(**kwargs: Any) -> str:
        enqueued.append(dict(kwargs))
        return "celery-1"

    monkeypatch.setattr(se, "enqueue_agentic_step", _enqueue)
    monkeypatch.setattr(se, "agentic_soft_timeout_max_per_node", lambda: 5)

    out = await se.recover_agentic_step_soft_timeout(
        session_id="s1",
        principal_id="p1",
        node_id="n1",
    )
    assert out["ok"] is True
    assert out["reason"] == "soft_timeout_retry_wait"
    assert schedule.await_count == 1
    assert enqueued and enqueued[0]["session_id"] == "s1"
