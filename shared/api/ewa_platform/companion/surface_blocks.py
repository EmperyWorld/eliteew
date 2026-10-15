# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Build universal Output Surface V2 blocks from durable companion task runs and chat payloads.
# Invariants:
# - Pure shaping only; no side effects or task state changes.
# - Blocks mirror existing task-run state and must not grant new client-side execution powers.
# Related:
# - api/ewa_platform/schemas/pydantic/companion_chat.py
# - shared/web/frontend/src/features/ewa/companionOutputSurface/
# ---

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

_TERMINAL_STATUSES = frozenset({"completed", "failed", "cancelled"})
_ACTIVE_STATUSES = frozenset({"pending", "running", "awaiting_confirmation"})


def _as_dict(raw: Any) -> dict[str, Any]:
    return dict(raw) if isinstance(raw, Mapping) else {}


def _as_str(raw: Any) -> str:
    return str(raw or "").strip()


def _run_title(run: Mapping[str, Any]) -> str:
    plan = _as_dict(run.get("plan_payload"))
    for key in ("workflow_title_ru", "workflow_title_en", "title_ru", "title_en"):
        text = _as_str(plan.get(key))
        if text:
            return text
    user_message = _as_str(run.get("user_message"))
    if user_message:
        return user_message[:120]
    intent = _as_str(run.get("intent_kind"))
    return intent or "companion_task"


def _block_kind(run: Mapping[str, Any], steps: list[Mapping[str, Any]]) -> str:
    status = _as_str(run.get("status")).lower()
    if status == "awaiting_confirmation":
        return "confirm"
    if steps:
        return "workflow_timeline"
    return "result" if status in _TERMINAL_STATUSES else "workflow_timeline"


def _step_payload(steps_raw: Any) -> list[dict[str, Any]]:
    if not isinstance(steps_raw, list):
        return []
    out: list[dict[str, Any]] = []
    for raw in steps_raw:
        if not isinstance(raw, Mapping):
            continue
        out.append(
            {
                "id": _as_str(raw.get("id")),
                "step_index": int(raw.get("step_index") or 0),
                "step_kind": _as_str(raw.get("step_kind")),
                "status": _as_str(raw.get("status")),
                "title": _as_str(raw.get("title")),
                "input_payload": _as_dict(raw.get("input_payload")),
                "output_payload": _as_dict(raw.get("output_payload")),
                "error_payload": _as_dict(raw.get("error_payload")),
                "created_at": _as_str(raw.get("created_at")) or None,
                "updated_at": _as_str(raw.get("updated_at")) or None,
                "completed_at": _as_str(raw.get("completed_at")) or None,
            }
        )
    return sorted(out, key=lambda row: int(row.get("step_index") or 0))


def surface_blocks_for_task_run(run: Mapping[str, Any]) -> list[dict[str, Any]]:
    """Return V2 surface blocks derived from one task run row."""

    run_id = _as_str(run.get("id"))
    if not run_id:
        return []
    status = _as_str(run.get("status")).lower()
    intent_kind = _as_str(run.get("intent_kind"))
    steps = _step_payload(run.get("steps"))
    kind = _block_kind(run, steps)
    title = _run_title(run)
    result_payload = _as_dict(run.get("result_payload"))
    error_payload = _as_dict(run.get("error_payload"))
    confirmation_state = _as_dict(run.get("confirmation_state"))
    actions: list[dict[str, Any]] = []
    if kind == "confirm":
        actions = [
            {
                "type": "task_run_confirm",
                "label_ru": "Подтвердить",
                "label_en": "Confirm",
                "payload": {"run_id": run_id, "decision": "confirm"},
            },
            {
                "type": "task_run_confirm",
                "label_ru": "Отменить",
                "label_en": "Cancel",
                "payload": {"run_id": run_id, "decision": "cancel"},
            },
            {
                "type": "chat_follow_up",
                "label_ru": "Разобрать с EWA",
                "label_en": "Discuss with EWA",
                "payload": {"run_id": run_id, "intent_kind": intent_kind},
            },
        ]
    block_status = status if status else ("completed" if result_payload else "pending")
    subtitle = ""
    if block_status in _TERMINAL_STATUSES:
        subtitle = block_status
    elif block_status in _ACTIVE_STATUSES:
        subtitle = "В процессе"
    return [
        {
            "id": f"task_run:{run_id}:{kind}",
            "kind": kind,
            "title": title,
            "subtitle": subtitle,
            "status": block_status,
            "run_id": run_id,
            "created_at": _as_str(run.get("created_at")) or None,
            "actions": actions,
            "payload": {
                "run_id": run_id,
                "intent_kind": intent_kind,
                "execution_mode": _as_str(run.get("execution_mode")),
                "run_revision": int(run.get("run_revision") or 1),
                "plan_payload": _as_dict(run.get("plan_payload")),
                "confirmation_state": confirmation_state,
                "result_payload": result_payload,
                "error_payload": error_payload,
                "steps": steps,
            },
        }
    ]


def attach_surface_blocks_to_run(run: Mapping[str, Any]) -> dict[str, Any]:
    """Return a task run dict with ``surface_blocks`` populated when absent."""

    out = dict(run)
    existing = out.get("surface_blocks")
    if isinstance(existing, list) and existing:
        return out
    out["surface_blocks"] = surface_blocks_for_task_run(out)
    return out


def attach_surface_blocks_to_chat_payload(payload: Mapping[str, Any]) -> dict[str, Any]:
    """Return a chat final payload with blocks derived from ``task_run`` when available."""

    out = dict(payload)
    existing = out.get("surface_blocks")
    if isinstance(existing, list) and existing:
        return out
    task_run = out.get("task_run")
    if isinstance(task_run, Mapping):
        run_with_blocks = attach_surface_blocks_to_run(task_run)
        out["task_run"] = run_with_blocks
        out["surface_blocks"] = surface_blocks_for_task_run(run_with_blocks)
    return out


__all__ = (
    "attach_surface_blocks_to_chat_payload",
    "attach_surface_blocks_to_run",
    "surface_blocks_for_task_run",
)
