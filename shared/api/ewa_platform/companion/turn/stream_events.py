# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# SSE helpers for companion task lifecycle events on the chat stream (Phase 2).
# Invariants:
# - Task events are additive; clients that ignore unknown ``event:`` names keep working.
# Related:
# - api/ewa_platform/companion/jobs/task_events.py
# - api/ewa_platform/companion/turn/chat_turn.py
# ---

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from api.ewa_platform.companion.jobs.task_events import format_task_sse_event


def sse_task_accepted_from_orchestrated(orchestrated: Mapping[str, Any] | None) -> str | None:
    """Build ``task_accepted`` SSE when orchestrator deferred async work."""

    if orchestrated is None:
        return None
    task_run = orchestrated.get("task_run")
    if not isinstance(task_run, Mapping):
        return None
    run_id = str(task_run.get("id") or "").strip()
    if not run_id:
        return None
    intent_kind = str(task_run.get("intent_kind") or "").strip()
    execution_mode = str(task_run.get("execution_mode") or "sync").strip()
    if intent_kind != "music_generation_background" and execution_mode != "async":
        return None
    payload: dict[str, Any] = {
        "run_id": run_id,
        "status": str(task_run.get("status") or "running"),
        "intent_kind": intent_kind,
        "execution_mode": execution_mode,
    }
    orch_branch = str(orchestrated.get("orchestration_branch") or "").strip()
    if orch_branch:
        payload["orchestration_branch"] = orch_branch
    return format_task_sse_event("task_accepted", payload)


def sse_task_awaiting_confirmation_from_orchestrated(
    orchestrated: Mapping[str, Any] | None,
) -> str | None:
    """Build ``task_awaiting_confirmation`` SSE when a run needs explicit confirm."""

    if orchestrated is None:
        return None
    task_run = orchestrated.get("task_run")
    if not isinstance(task_run, Mapping):
        return None
    if str(task_run.get("status") or "").strip() != "awaiting_confirmation":
        return None
    run_id = str(task_run.get("id") or "").strip()
    if not run_id:
        return None
    payload: dict[str, Any] = {
        "run_id": run_id,
        "status": "awaiting_confirmation",
        "intent_kind": str(task_run.get("intent_kind") or ""),
    }
    plan = task_run.get("plan_payload")
    if isinstance(plan, Mapping) and plan:
        payload["plan_kind"] = str(plan.get("kind") or "")
    return format_task_sse_event("task_awaiting_confirmation", payload)


__all__ = (
    "format_task_sse_event",
    "sse_task_accepted_from_orchestrated",
    "sse_task_awaiting_confirmation_from_orchestrated",
)
