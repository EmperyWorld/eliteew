# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Parent/child linkage keys between declarative workflow runs and async tool runs.
# Invariants:
# - Pure helpers; no DB imports (safe for unit tests without asyncpg).
# Related:
# - api/ewa_platform/companion/workflows/user/declarative_advance.py
# ---

from __future__ import annotations

from collections.abc import Mapping
from typing import Any


def merge_workflow_parent_plan(plan: dict[str, Any], args: Mapping[str, Any]) -> None:
    """Copy parent workflow linkage from tool args into a child task-run plan."""

    parent_run_id = str(args.get("_workflow_parent_run_id") or "").strip()
    if not parent_run_id:
        return
    plan["workflow_parent_run_id"] = parent_run_id
    step_raw = args.get("_workflow_parent_step_index", args.get("_workflow_step_index"))
    try:
        plan["workflow_parent_step_index"] = int(step_raw or 0)
    except (TypeError, ValueError):  # fmt: skip
        plan["workflow_parent_step_index"] = 0


def inject_workflow_parent_args(
    tool_args: dict[str, Any],
    *,
    parent_run_id: str,
    step_index: int,
) -> dict[str, Any]:
    tool_args["_workflow_parent_run_id"] = parent_run_id
    tool_args["_workflow_step_index"] = step_index
    return tool_args


__all__ = ("inject_workflow_parent_args", "merge_workflow_parent_plan")
