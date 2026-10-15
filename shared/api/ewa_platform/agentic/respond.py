# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# HITL respond/cancel for agentic sessions (confirm API + chat delegation).
# Invariants:
# - Consumes inbox; transitions awaiting_human → executing via FSM human_respond event.
# - Clears replanning circuit counters on human_respond so loop tick can run Think again.
# Related:
# - api/ewa_platform/gateways/routers/agentic_sessions.py
# ---

from __future__ import annotations

import logging
from typing import Any, Literal

import asyncpg

from api.ewa_platform.agentic.adapters.task_run_events import sync_and_publish_task_run_from_session
from api.ewa_platform.agentic.gate_contract import validate_gate_response
from api.ewa_platform.agentic.hitl_companion_finalize import finalize_hitl_companion_pending
from api.ewa_platform.agentic.jobs.enqueue import enqueue_agentic_loop_tick, enqueue_agentic_step
from api.ewa_platform.agentic.kernel import state_machine as fsm
from api.ewa_platform.agentic.kernel.circuit_breaker import reset_circuit_on_success, working_memory_from_session
from api.ewa_platform.persistence_pg import agentic_asyncpg as agentic_pg

logger = logging.getLogger(__name__)

Decision = Literal["confirm", "cancel"]
_BOUND_GATE_ACTIVE_NODE_STATUSES = ("pending", "claimed", "running", "retry_wait", "awaiting_human")
_SCHEDULER_OWNED_STATUSES = ("pending", "claimed", "running", "retry_wait")


async def _scheduler_has_runnable_steps(pool: asyncpg.Pool, *, session_id: str) -> bool:
    counts = await agentic_pg.agentic_task_tree_status_counts(pool, session_id=session_id)
    return sum(int(counts.get(status) or 0) for status in _SCHEDULER_OWNED_STATUSES) > 0


def _enqueue_post_hitl_execution(
    *,
    session_id: str,
    principal_id: str,
    expected_revision: int,
    scheduler_pending: bool,
) -> None:
    if scheduler_pending:
        enqueue_agentic_step(
            session_id=session_id,
            principal_id=principal_id,
            worker_payload={"expected_revision": expected_revision},
        )
        return
    enqueue_agentic_loop_tick(
        session_id=session_id,
        principal_id=principal_id,
        expected_revision=expected_revision,
    )


async def apply_agentic_human_response(
    pool: asyncpg.Pool,
    *,
    session_id: str,
    principal_id: str,
    decision: Decision,
    message_text: str = "",
    client_turn_id: str | None = None,
    source: str = "confirm_api",
    expect_session_revision: int | None = None,
) -> dict[str, Any]:
    session = await agentic_pg.agentic_session_fetch_for_principal(
        pool,
        session_id=session_id,
        principal_id=principal_id,
    )
    if session is None:
        return {"ok": False, "reason": "session_not_found"}

    rev = int(session.get("session_revision") or 0)
    if expect_session_revision is not None and expect_session_revision != rev:
        return {"ok": False, "reason": "revision_conflict", "revision_conflict": True}

    status = str(session.get("status") or "")
    if decision == "cancel":
        from api.ewa_platform.agentic.kernel.state_machine import apply_session_transition

        if status == fsm.STATUS_AWAITING_HUMAN:
            active_nodes = await agentic_pg.agentic_task_tree_list(
                pool,
                session_id=session_id,
                statuses=_BOUND_GATE_ACTIVE_NODE_STATUSES,
            )
            finalize_out = await finalize_hitl_companion_pending(
                pool,
                session=session,
                principal_id=principal_id,
                decision=decision,
                active_nodes=active_nodes,
            )
            if not finalize_out.get("ok"):
                return {
                    "ok": False,
                    "reason": finalize_out.get("reason") or "companion_cancel_failed",
                    "revision_conflict": bool(finalize_out.get("revision_conflict")),
                }

        tr = await apply_session_transition(
            pool,
            session_id=session_id,
            principal_id=principal_id,
            event="human_cancel" if status == fsm.STATUS_AWAITING_HUMAN else "cancel",
            expect_revision=rev,
            clear_lease=True,
        )
        if tr.session:
            task_run = await sync_and_publish_task_run_from_session(pool, session=tr.session)
        else:
            task_run = None
        return {"ok": tr.ok, "session": tr.session, "task_run": task_run, "reply": "Задача отменена."}

    if status != fsm.STATUS_AWAITING_HUMAN:
        await agentic_pg.agentic_inbound_insert(
            pool,
            session_id=session_id,
            principal_id=principal_id,
            source=source[:32],
            message_json={"text": message_text, "decision": decision},
            client_turn_id=client_turn_id,
        )
        enqueue_agentic_loop_tick(session_id=session_id, principal_id=principal_id, expected_revision=rev)
        return {"ok": True, "reason": "queued", "session": session}

    active_nodes = await agentic_pg.agentic_task_tree_list(
        pool,
        session_id=session_id,
        statuses=_BOUND_GATE_ACTIVE_NODE_STATUSES,
    )
    gate_ok, gate_reason = validate_gate_response(
        session,
        expect_session_revision=expect_session_revision,
        active_nodes=active_nodes,
    )
    if not gate_ok:
        return {
            "ok": False,
            "reason": gate_reason or "gate_validation_failed",
            "revision_conflict": gate_reason == "revision_conflict",
        }

    finalize_out = await finalize_hitl_companion_pending(
        pool,
        session=session,
        principal_id=principal_id,
        decision=decision,
        active_nodes=active_nodes,
    )
    if not finalize_out.get("ok"):
        return {
            "ok": False,
            "reason": finalize_out.get("reason") or "companion_finalize_failed",
            "revision_conflict": bool(finalize_out.get("revision_conflict")),
        }

    await agentic_pg.agentic_inbound_insert(
        pool,
        session_id=session_id,
        principal_id=principal_id,
        source=source[:32],
        message_json={"text": message_text, "decision": decision},
        client_turn_id=client_turn_id,
    )

    from api.ewa_platform.agentic.kernel.state_machine import apply_session_transition

    tr = await apply_session_transition(
        pool,
        session_id=session_id,
        principal_id=principal_id,
        event="human_respond",
        expect_revision=rev,
        gate_json={},
    )
    if not tr.ok or tr.session is None:
        return {"ok": False, "reason": tr.reason or "transition_failed"}

    session_out = tr.session
    wm = reset_circuit_on_success(working_memory_from_session(session_out))
    policy_patch = finalize_out.get("policy_json")
    patched = await agentic_pg.agentic_session_update(
        pool,
        session_id=session_id,
        principal_id=principal_id,
        working_memory_json=wm,
        policy_json=policy_patch if isinstance(policy_patch, dict) else None,
        expect_revision=int(session_out["session_revision"]),
    )
    if patched is not None:
        session_out = patched

    scheduler_pending = await _scheduler_has_runnable_steps(pool, session_id=session_id)
    _enqueue_post_hitl_execution(
        session_id=session_id,
        principal_id=principal_id,
        expected_revision=int(session_out["session_revision"]),
        scheduler_pending=scheduler_pending,
    )
    task_run = await sync_and_publish_task_run_from_session(pool, session=session_out)
    logger.info("[STEP] agentic_hitl_respond session_id=%s decision=%s", session_id, decision)
    return {"ok": True, "session": session_out, "task_run": task_run, "reply": "Продолжаю выполнение."}


async def apply_agentic_task_run_confirm(
    pool: asyncpg.Pool,
    *,
    run: dict[str, Any],
    principal_id: str,
    decision: Decision,
    expect_run_revision: int | None = None,
) -> dict[str, Any]:
    if str(run.get("intent_kind") or "") != "agentic_session":
        return {"ok": False, "reason": "not_agentic_run"}

    if expect_run_revision is not None and int(run.get("run_revision") or 1) != int(expect_run_revision):
        return {"ok": False, "revision_conflict": True, "task_run": run}

    plan = run.get("plan_payload")
    session_id = ""
    if isinstance(plan, dict):
        session_id = str(plan.get("agentic_session_id") or "").strip()
    if not session_id:
        return {"ok": False, "reason": "missing_agentic_session_id"}

    session = await agentic_pg.agentic_session_fetch_for_principal(
        pool,
        session_id=session_id,
        principal_id=principal_id,
    )
    expect_sess_rev = int(session["session_revision"]) if session else None

    outcome = await apply_agentic_human_response(
        pool,
        session_id=session_id,
        principal_id=principal_id,
        decision=decision,
        source="confirm_api",
        expect_session_revision=expect_sess_rev,
    )
    if outcome.get("revision_conflict"):
        return {"revision_conflict": True, "ok": False}
    return outcome
