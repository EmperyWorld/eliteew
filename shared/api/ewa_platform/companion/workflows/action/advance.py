# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Advance multi-step action workflows after a durable step completes (WF-2 confirm gate for music pilot).
# Invariants:
# - When returning True, caller must **not** mark the run terminal-completed.
# - ``music_full_cycle_v1`` with autoplay skips confirm and completes with ``background_play`` in result.
# Related:
# - api/ewa_platform/companion/orchestration/tool_registry.py
# - api/ewa_platform/companion/workflows/action/starter.py
# ---

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

import asyncpg

from api.ewa_platform.companion.jobs.task_events import publish_task_event_async
from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg

logger = logging.getLogger(__name__)


def _autoplay_requested_for_run(
    run: Mapping[str, Any],
    result_payload: Mapping[str, Any],
) -> bool:
    if bool(result_payload.get("autoplay_requested")):
        return True
    plan = run.get("plan_payload")
    return isinstance(plan, Mapping) and bool(plan.get("autoplay_requested"))


async def _advance_music_workflow_autoplay(
    pool: asyncpg.Pool,
    *,
    run: Mapping[str, Any],
    run_id: str,
    principal_id: str,
    workflow_id: str,
    confirm_step: Mapping[str, Any],
    result_payload: Mapping[str, Any],
) -> bool:
    content_id = str(result_payload.get("content_id") or "").strip()
    final_result = {
        **dict(result_payload),
        "background_play": True,
        "unified_content_id": content_id,
        "autoplay_requested": True,
    }

    await companion_pg.companion_task_step_update(
        pool,
        step_id=str(confirm_step.get("id") or ""),
        status="completed",
        output_payload={"background_play": True, "unified_content_id": content_id},
    )
    updated = await companion_pg.companion_task_run_update(
        pool,
        run_id=run_id,
        principal_id=principal_id,
        status="completed",
        result_payload=final_result,
        confirmation_state={},
    )
    await publish_task_event_async(
        principal_id=principal_id,
        event_name="task_completed",
        payload={
            "run_id": run_id,
            "status": "completed",
            "intent_kind": str((updated or run).get("intent_kind") or "action_workflow"),
            "workflow_id": workflow_id,
            "result_payload": final_result,
        },
    )
    logger.info(
        "[STEP] action_workflow_autoplay_completed run_id=%s workflow_id=%s content_id=%s",
        run_id,
        workflow_id,
        content_id,
    )
    return True


async def maybe_advance_workflow_after_music_step(
    pool: asyncpg.Pool,
    *,
    run_id: str,
    principal_id: str,
    result_payload: Mapping[str, Any],
    ru_locale: bool,
) -> bool:
    """If ``run_id`` belongs to ``music_full_cycle_v1``, pause at confirm gate or autoplay."""

    run = await companion_pg.companion_task_run_fetch(pool, run_id=run_id)
    if run is None:
        return False
    workflow_id = str(run.get("workflow_id") or "").strip()
    if workflow_id != "music_full_cycle_v1":
        return False

    content_id = str(result_payload.get("content_id") or "").strip()
    if not content_id:
        return False

    steps = await companion_pg.companion_task_steps_list(pool, run_id=run_id)
    confirm_step = next(
        (s for s in steps if str(s.get("step_kind") or "") == "confirm_gate"),
        None,
    )
    if confirm_step is None:
        confirm_step = next((s for s in steps if int(s.get("step_index") or 0) == 2), None)
    if confirm_step is None:
        logger.warning("[STEP] action_workflow_advance_missing_confirm_step run_id=%s", run_id)
        return False

    track_name = str(result_payload.get("track_name") or content_id).strip() or content_id
    desc_ru = str(result_payload.get("description_ru") or track_name)
    desc_en = str(result_payload.get("description_en") or track_name)

    if _autoplay_requested_for_run(run, result_payload):
        return await _advance_music_workflow_autoplay(
            pool,
            run=run,
            run_id=run_id,
            principal_id=principal_id,
            workflow_id=workflow_id,
            confirm_step=confirm_step,
            result_payload=result_payload,
        )

    existing_plan = run.get("plan_payload")
    merged_plan: dict[str, Any] = dict(existing_plan) if isinstance(existing_plan, Mapping) else {}
    merged_plan.update(
        {
            "kind": "music_play_after_generation",
            "workflow_id": workflow_id,
            "content_id": content_id,
            "track_name": track_name,
            "description_ru": desc_ru,
            "description_en": desc_en,
        },
    )

    await companion_pg.companion_task_step_update(
        pool,
        step_id=str(confirm_step.get("id") or ""),
        status="awaiting_confirmation",
    )
    updated = await companion_pg.companion_task_run_update(
        pool,
        run_id=run_id,
        principal_id=principal_id,
        status="awaiting_confirmation",
        result_payload=dict(result_payload),
        confirmation_state={"step_key": "confirm_play", "workflow_id": workflow_id},
        plan_payload=merged_plan,
    )
    await publish_task_event_async(
        principal_id=principal_id,
        event_name="task_awaiting_confirmation",
        payload={
            "run_id": run_id,
            "status": "awaiting_confirmation",
            "intent_kind": str((updated or run).get("intent_kind") or "action_workflow"),
            "workflow_id": workflow_id,
            "plan_kind": "music_play_after_generation",
        },
    )
    logger.info(
        "[STEP] action_workflow_advanced_to_confirm run_id=%s workflow_id=%s content_id=%s",
        run_id,
        workflow_id,
        content_id,
    )
    return True


__all__ = ("maybe_advance_workflow_after_music_step",)
