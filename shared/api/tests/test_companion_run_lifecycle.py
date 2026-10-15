# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for companion task-run lifecycle guards (executor skip, confirm query ordering).
# Invariants:
# - No live Postgres for lifecycle assertions; SQL ordering tested via query text only.
# Related:
# - api/ewa_platform/companion/orchestration/run_lifecycle.py
# - api/ewa_platform/persistence_pg/companion_asyncpg.py
# ---

from __future__ import annotations

import inspect

import pytest

from api.ewa_platform.companion.jobs import executor
from api.ewa_platform.companion.orchestration import run_lifecycle
from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg


@pytest.mark.unit
@pytest.mark.parametrize(
    ("status", "expected_executable", "reason_prefix"),
    [
        ("running", True, None),
        ("pending", True, None),
        ("awaiting_confirmation", True, None),
        ("cancelled", False, "run_cancelled"),
        ("completed", False, "run_terminal"),
        ("failed", False, "run_terminal"),
    ],
)
def test_assert_run_executable(status: str, expected_executable: bool, reason_prefix: str | None) -> None:
    run = {"id": "r1", "status": status, "run_revision": 1}
    ok, reason = run_lifecycle.assert_run_executable(run)
    assert ok is expected_executable
    if reason_prefix:
        assert reason is not None
        assert reason.startswith(reason_prefix)
    else:
        assert reason is None


@pytest.mark.unit
def test_find_latest_active_orders_awaiting_confirmation_first() -> None:
    src = inspect.getsource(companion_pg.companion_task_find_latest_active)
    assert "awaiting_confirmation" in src
    assert "CASE status" in src


@pytest.mark.unit
def test_find_latest_awaiting_confirmation_filters_status() -> None:
    src = inspect.getsource(companion_pg.companion_task_find_latest_awaiting_confirmation)
    assert "status = 'awaiting_confirmation'" in src


@pytest.mark.unit
def test_first_incomplete_prior_step_blocks_out_of_order() -> None:
    steps = [
        {"step_index": 1, "status": "in_progress"},
        {"step_index": 2, "status": "pending"},
    ]
    assert executor._first_incomplete_prior_step(steps, target_index=2) == 1


@pytest.mark.unit
def test_first_incomplete_prior_step_allows_when_prior_done() -> None:
    steps = [
        {"step_index": 1, "status": "completed"},
        {"step_index": 2, "status": "pending"},
    ]
    assert executor._first_incomplete_prior_step(steps, target_index=2) is None
