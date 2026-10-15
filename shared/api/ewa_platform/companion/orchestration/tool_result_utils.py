# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Normalize companion tool handler envelopes (``ToolResult`` is a TypedDict — no isinstance) and augment SPA
# ``actions`` for the desktop actions tray (failed/blocked outcome badges).
# Invariants:
# - Handlers return plain dicts at runtime; never use ``isinstance(x, ToolResult)``.
# - Tray-only ``companion_action_notice`` actions are injected only for terminal ``status="error"`` with an empty
#   ``actions`` list — never mutates non-empty action payloads from tools.
# Related:
# - api/ewa_platform/companion/orchestration/tool_registry.py
# - api/ewa_platform/companion/orchestration/task_orchestrator.py
# ---

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Literal

CompanionActionOutcome = Literal["ok", "blocked", "failed"]


def as_mapping_dict(raw: object) -> dict[str, Any]:
    """Coerce optional JSON/mapping payloads to a dict for safe downstream ``.get()`` (pyright narrowing)."""

    if isinstance(raw, Mapping):
        return dict(raw)
    return {}


def tool_result_as_mapping(result: Mapping[str, Any]) -> Mapping[str, Any]:
    if isinstance(result, Mapping):
        return result
    return {}


def tool_result_data(result: Mapping[str, Any]) -> Mapping[str, Any]:
    raw = tool_result_as_mapping(result).get("data")
    if isinstance(raw, Mapping):
        return raw
    return {}


def tool_result_is_background(result: Mapping[str, Any]) -> bool:
    return bool(tool_result_data(result).get("background"))


_WORKFLOW_STEP_SUCCESS_STATUSES: frozenset[str] = frozenset({"ok", "accepted", "memory_append"})


def tool_result_is_workflow_step_success(status: str) -> bool:
    """True when a declarative workflow step completed without terminal failure."""

    return str(status or "").strip().lower() in _WORKFLOW_STEP_SUCCESS_STATUSES


def augment_tool_result_actions_for_tray(
    *,
    status: str,
    actions: list[dict[str, Any]],
    rationale: str,
    resume_conditions: list[str] | None = None,
    task_run: Mapping[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Inject tray-only ``companion_action_notice`` for terminal failures without SPA actions."""

    if actions:
        return attach_task_run_id_to_actions(actions, task_run)
    if status == "error":
        outcome: CompanionActionOutcome = "failed"
    elif status in ("unavailable", "needs_confirm", "needs_open_editor"):
        outcome = "blocked"
    elif status == "partial":
        outcome = "failed"
    else:
        return actions

    notice: dict[str, Any] = {
        "type": "companion_action_notice",
        "outcome": outcome,
    }
    rat = str(rationale or "").strip()
    if rat:
        notice["rationale"] = rat[:500]
    if resume_conditions:
        notice["resume_conditions"] = [str(x)[:200] for x in resume_conditions if str(x).strip()][:5]
    if status == "needs_confirm" and not rat:
        notice["rationale"] = "Требуется подтверждение."[:500]
    return attach_task_run_id_to_actions([notice], task_run)


def attach_task_run_id_to_actions(
    actions: list[dict[str, Any]],
    task_run: Mapping[str, Any] | None,
) -> list[dict[str, Any]]:
    """Stamp ``task_run_id`` on SPA actions when orchestrator attached a durable run (Phase 5.2)."""

    if not actions:
        return actions
    run_id = ""
    if isinstance(task_run, Mapping):
        run_id = str(task_run.get("id") or "").strip()
    if not run_id:
        return actions
    out: list[dict[str, Any]] = []
    for row in actions:
        stamped = dict(row)
        if not str(stamped.get("task_run_id") or "").strip():
            stamped["task_run_id"] = run_id
        out.append(stamped)
    return out


__all__ = (
    "CompanionActionOutcome",
    "attach_task_run_id_to_actions",
    "augment_tool_result_actions_for_tray",
    "tool_result_as_mapping",
    "tool_result_data",
    "tool_result_is_background",
    "tool_result_is_workflow_step_success",
)
