# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for companion plan FSM helpers (plan + goal progress).
# Related:
# - api/ewa_platform/companion/plans/fsm.py
# ---

from __future__ import annotations

from api.ewa_platform.companion.plans.fsm import compute_goal_progress, compute_plan_status


def test_compute_goal_progress_from_tasks() -> None:
    assert compute_goal_progress(task_count=0, completed_task_count=0) == (0.0, "active")
    assert compute_goal_progress(task_count=4, completed_task_count=2) == (50.0, "active")
    assert compute_goal_progress(task_count=3, completed_task_count=3) == (100.0, "completed")


def test_compute_plan_status_finish_requires_all_tasks() -> None:
    assert compute_plan_status(goal_count=1, task_count=3, completed_task_count=3) == "finish"
    assert compute_plan_status(goal_count=1, task_count=3, completed_task_count=2) == "progress"
