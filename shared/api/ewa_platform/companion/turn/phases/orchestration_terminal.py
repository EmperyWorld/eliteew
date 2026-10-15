# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Build terminal orchestrator short-circuit response payload (sync + SSE shared).
# Invariants:
# - Only for orchestrator paths that return immediately (not ``continue_main_llm``).
# - Turn-plan and output_surface fields copied from orchestrated dict when present.
# Related:
# - api/ewa_platform/companion/turn/chat_turn.py
# - documentation/product/ewa/EWA-COMPANION-CHAT-TURN-PHASES.md
# ---

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from api.ewa_platform.companion.orchestration.tool_result_utils import (
    attach_task_run_id_to_actions,
)


def build_orchestration_terminal_final_payload(
    orchestrated: Mapping[str, Any],
    *,
    reply: str,
    companion_revision: int,
    parsed_actions: list[dict[str, Any]],
    desktop_config_patch_applied: bool,
    transformed_this_turn: bool,
    transform_event_kind: str | None,
) -> dict[str, Any]:
    """Assemble the ``final`` / sync response dict after orchestrator terminal short-circuit."""

    task_run = orchestrated.get("task_run")
    stamped_actions = attach_task_run_id_to_actions(
        parsed_actions,
        task_run if isinstance(task_run, Mapping) else None,
    )
    payload: dict[str, Any] = {
        "reply": reply,
        "companion_revision": int(companion_revision),
        "actions": stamped_actions,
        "task_run": task_run,
        "transformed_this_turn": transformed_this_turn,
        "transform_event_kind": transform_event_kind,
        "desktop_config_patch_applied": desktop_config_patch_applied,
    }
    turn_plan_hint = str(orchestrated.get("turn_plan_hint") or "").strip()
    turn_plan_tool = str(orchestrated.get("turn_plan_next_tool") or "").strip()
    turn_plan_source = str(orchestrated.get("turn_plan_source") or "").strip()
    if turn_plan_hint:
        payload["turn_plan_hint"] = turn_plan_hint
    if turn_plan_tool:
        payload["turn_plan_next_tool"] = turn_plan_tool
    if turn_plan_source:
        payload["turn_plan_source"] = turn_plan_source
    output_surface = orchestrated.get("output_surface")
    if isinstance(output_surface, dict) and output_surface.get("mode"):
        payload["output_surface"] = output_surface
    return payload


__all__ = ("build_orchestration_terminal_final_payload",)
