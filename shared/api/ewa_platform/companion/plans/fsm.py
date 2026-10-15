# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Pure plan status FSM (wait / progress / finish) shared by persistence and tests.
# Related:
# - api/ewa_platform/persistence_pg/companion_plans_asyncpg.py
# ---

from __future__ import annotations


def compute_plan_status(
    *,
    goal_count: int,
    task_count: int,
    completed_task_count: int,
) -> str:
    """Return wait | progress | finish per ADR FSM."""

    if goal_count < 1:
        return "wait"
    if task_count < 1:
        return "wait"
    if completed_task_count >= task_count:
        return "finish"
    return "progress"


def compute_goal_progress(
    *,
    task_count: int,
    completed_task_count: int,
) -> tuple[float, str]:
    """Return (progress 0–100, goal status active|completed) from linked tasks."""

    if task_count < 1:
        return 0.0, "active"
    progress = round(100.0 * completed_task_count / task_count, 1)
    status = "completed" if completed_task_count >= task_count else "active"
    return progress, status


__all__ = ("compute_goal_progress", "compute_plan_status")
