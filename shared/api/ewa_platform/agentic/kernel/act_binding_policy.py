# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Loop-act binding rules — which tools may run without a task-tree node in Think→Act path.
# Invariants:
# - Companion confirm tools (file_create, file_save_text) always require a tree node + HITL bind.
# - Mutating file tools require a scheduled or explicit runnable node when the scheduler is idle.
# - Redundant read-only explore acts trigger replanning instead of silent LLM loops.
# Related:
# - api/ewa_platform/agentic/kernel/loop.py
# - api/ewa_platform/agentic/hitl_companion_finalize.py
# ---

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from api.ewa_platform.agentic.context.memory_tiers import read_active_slice
from api.ewa_platform.agentic.kernel.circuit_breaker import working_memory_from_session
from api.ewa_platform.agentic.kernel.types import AgenticContext

COMPANION_CONFIRM_TOOLS: frozenset[str] = frozenset({"file_create", "file_save_text"})

FILE_TARGET_TOOLS: frozenset[str] = frozenset({"file_create", "file_save_text"})

MUTATING_FILE_TOOLS: frozenset[str] = frozenset(
    {
        "file_create",
        "file_save_text",
        "file_delete",
        "file_rename",
        "file_rewrite",
        "doc_append_block",
    }
)

READONLY_EXPLORE_TOOLS: frozenset[str] = frozenset(
    {
        "catalog_list",
        "recall_memory",
        "operations_status",
        "check_task_status",
    }
)

_REDUNDANT_EXPLORE_STREAK = 3


def _normalized_file_name(args: Mapping[str, Any] | None) -> str:
    if not isinstance(args, Mapping):
        return ""
    return str(args.get("name") or "").strip().lower()


def _active_node_ids(ctx: AgenticContext) -> frozenset[str]:
    return frozenset(str(n.get("id") or "").strip() for n in ctx.active_nodes if str(n.get("id") or "").strip())


def _redundant_explore_streak(ctx: AgenticContext, tool_name: str) -> bool:
    wm = working_memory_from_session(ctx.session)
    summaries = read_active_slice(wm).get("last_act_summaries") or []
    if len(summaries) < _REDUNDANT_EXPLORE_STREAK:
        return False
    recent = summaries[-_REDUNDANT_EXPLORE_STREAK:]
    return all(str(entry.get("tool") or "") == tool_name and str(entry.get("status") or "") == "ok" for entry in recent)


def loop_act_binding_verdict(
    *,
    act_node_id: str | None,
    tool_name: str,
    ctx: AgenticContext | None,
    think_act_node_id: str | None = None,
    tool_args: Mapping[str, Any] | None = None,
) -> tuple[bool, str]:
    """Return (allowed, reject_reason). reject_reason is empty when allowed."""

    name = str(tool_name or "").strip()
    if not name:
        return False, "missing_tool_name"

    if ctx is None:
        if act_node_id is None and name in COMPANION_CONFIRM_TOOLS:
            return False, "companion_hitl_requires_tree_node"
        return True, ""

    active_ids = _active_node_ids(ctx)

    if act_node_id is not None and act_node_id not in active_ids:
        return False, "act_node_not_active"

    if act_node_id is None and name in COMPANION_CONFIRM_TOOLS:
        return False, "companion_hitl_requires_tree_node"

    scheduled = ctx.scheduled_node
    if scheduled is not None and think_act_node_id is None and act_node_id is not None:
        sched_id = str(scheduled.get("id") or "").strip()
        sched_tool = str(scheduled.get("tool_name") or "").strip()
        if sched_id and act_node_id == sched_id and sched_tool and name != sched_tool:
            return False, "scheduler_tool_mismatch"
        if sched_id and act_node_id == sched_id and name in FILE_TARGET_TOOLS:
            think_name = _normalized_file_name(tool_args)
            sched_args = scheduled.get("tool_args_json")
            sched_name = _normalized_file_name(sched_args if isinstance(sched_args, Mapping) else None)
            if think_name and sched_name and think_name != sched_name:
                return False, "scheduler_file_target_mismatch"

    scheduler_idle = ctx.scheduled_node is None
    if act_node_id is None and scheduler_idle and name in MUTATING_FILE_TOOLS:
        return False, "act_requires_tree_node"

    if (
        act_node_id is None
        and scheduler_idle
        and name in READONLY_EXPLORE_TOOLS
        and _redundant_explore_streak(ctx, name)
    ):
        return False, "redundant_explore_act"

    return True, ""


def replanning_steering_when_scheduler_idle(ctx: AgenticContext) -> str | None:
    """User-visible Think steering when the tree has no runnable node."""

    if ctx.scheduled_node is not None:
        return None
    counts = ctx.tree_summary
    if not counts:
        return None
    total = sum(int(v) for v in counts.values())
    if total <= 0:
        return None
    completed = int(counts.get("completed") or 0)
    if completed <= 0:
        return None
    counts_line = ", ".join(f"{k}={v}" for k, v in sorted(counts.items()))
    return (
        "Плановые узлы дерева завершены или не назначены (нет runnable node). "
        "Используй decision_type=mutate с новыми plan_nodes для оставшихся целей миссии "
        "или decision_type=terminate, если результат достигнут. "
        "Не вызывай file_create/file_save_text/catalog_list через continue без node_id и без нового плана. "
        f"Сводка дерева: {counts_line}."
    )


__all__ = (
    "COMPANION_CONFIRM_TOOLS",
    "MUTATING_FILE_TOOLS",
    "READONLY_EXPLORE_TOOLS",
    "loop_act_binding_verdict",
    "replanning_steering_when_scheduler_idle",
)
