# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared mid-mission replan handoff when the task tree is idle but the goal may
# still need work (web, partner refine, multi-deliverable, research expand).
# Invariants:
# - Call before step_ok_done / Think complete on executing sessions.
# - Failed need_replan must not fall through to mission complete.
# Related:
# - api/ewa_platform/agentic/jobs/step_executor.py
# - api/ewa_platform/agentic/kernel/think_output_dispatch.py
# - api/ewa_platform/agentic/kernel/research_plan_contract.py
# ---

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

import asyncpg

from api.ewa_platform.agentic.jobs.enqueue import enqueue_agentic_loop_tick
from api.ewa_platform.agentic.kernel import state_machine as fsm_mod
from api.ewa_platform.agentic.kernel.circuit_breaker import working_memory_from_session
from api.ewa_platform.agentic.kernel.research_plan_contract import should_offer_mid_mission_replan
from api.ewa_platform.agentic.kernel.tool_args_enrich import goal_text_from_session
from api.ewa_platform.persistence_pg import agentic_asyncpg as agentic_pg

logger = logging.getLogger("api.ewa_platform.agentic.mid_mission_replan")


async def try_mid_mission_replan_handoff(
    pool: asyncpg.Pool,
    *,
    session: Mapping[str, Any],
    completed_steps: int | None = None,
) -> tuple[bool, dict[str, Any] | None, str]:
    """
    If mid-mission replan is warranted, transition to replanning and enqueue Think.

    Returns:
      (handled, session_out, reason)
      handled=True → caller must not complete the mission.
      session_out is the session after WM patch / transition when available.
    """
    session_id = str(session.get("id") or "")
    principal_id = str(session.get("principal_id") or "")
    if not session_id or not principal_id:
        return False, None, "missing_ids"
    if str(session.get("status") or "") != fsm_mod.STATUS_EXECUTING:
        return False, None, "not_executing"

    steps = completed_steps
    if steps is None:
        counts = await agentic_pg.agentic_task_tree_status_counts(pool, session_id=session_id)
        steps = int(counts.get("completed") or 0)

    wm = working_memory_from_session(session)
    try:
        file_creates = max(0, int(wm.get("completed_file_create_count") or 0))
    except TypeError, ValueError:
        file_creates = 0
    if file_creates < 1:
        try:
            nodes = await agentic_pg.agentic_task_tree_list(pool, session_id=session_id)
            file_creates = sum(
                1
                for n in nodes
                if str((n or {}).get("tool_name") or "").strip() in {"file_create", "file_save_text"}
                and str((n or {}).get("status") or "").strip() == "completed"
            )
        except Exception as exc:
            logger.debug(
                "[STEP] agentic_mid_mission_file_create_count_skip session_id=%s err=%s",
                session_id,
                str(exc)[:160],
            )
            file_creates = 0
    offer, replan_reason = should_offer_mid_mission_replan(
        goal_text=goal_text_from_session(session),
        working_memory=wm,
        completed_steps=steps,
        completed_file_creates=file_creates,
    )
    if not offer:
        return False, None, replan_reason

    next_wm = dict(wm)
    next_wm["mid_mission_replan_count"] = int(wm.get("mid_mission_replan_count") or 0) + 1
    next_wm["mid_mission_replan_reason"] = replan_reason
    patched = await agentic_pg.agentic_session_update(
        pool,
        session_id=session_id,
        principal_id=principal_id,
        working_memory_json=next_wm,
        expect_revision=int(session.get("session_revision") or 0),
    )
    session_cur: Mapping[str, Any] = patched if patched is not None else session
    tr = await fsm_mod.apply_session_transition(
        pool,
        session_id=session_id,
        principal_id=principal_id,
        event="need_replan",
        expect_revision=int(session_cur.get("session_revision") or 0),
    )
    session_out = tr.session or dict(session_cur)
    if tr.ok:
        enqueue_agentic_loop_tick(
            session_id=session_id,
            principal_id=principal_id,
            expected_revision=int(session_out.get("session_revision") or 0),
        )
        logger.info(
            "[STEP] agentic_mid_mission_replan session_id=%s reason=%s rounds=%s",
            session_id,
            replan_reason,
            next_wm.get("mid_mission_replan_count"),
        )
        return True, session_out, replan_reason

    logger.warning(
        "[STEP] agentic_mid_mission_replan_transition_failed session_id=%s reason=%s tr=%s",
        session_id,
        replan_reason,
        tr.reason,
    )
    # Stay executing — orphan/loop retry may recover; never complete.
    enqueue_agentic_loop_tick(
        session_id=session_id,
        principal_id=principal_id,
        expected_revision=int(session_out.get("session_revision") or 0),
    )
    return True, session_out, f"replan_transition_failed:{tr.reason or replan_reason}"


__all__ = ("try_mid_mission_replan_handoff",)
