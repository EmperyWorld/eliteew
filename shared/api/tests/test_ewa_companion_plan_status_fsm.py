# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for companion plan status FSM (wait / progress / finish).
# Related:
# - api/ewa_platform/persistence_pg/companion_plans_asyncpg.py
# ---

from __future__ import annotations

from api.ewa_platform.companion.plans.fsm import compute_plan_status


def test_plan_status_wait_without_tasks() -> None:
    assert compute_plan_status(goal_count=2, task_count=0, completed_task_count=0) == "wait"


def test_plan_status_progress_with_open_tasks() -> None:
    assert compute_plan_status(goal_count=1, task_count=3, completed_task_count=1) == "progress"


def test_plan_status_finish_when_all_tasks_done() -> None:
    assert compute_plan_status(goal_count=2, task_count=4, completed_task_count=4) == "finish"


def test_plan_status_wait_without_goals() -> None:
    assert compute_plan_status(goal_count=0, task_count=2, completed_task_count=0) == "wait"
