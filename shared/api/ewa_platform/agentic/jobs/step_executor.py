# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Execute one scheduler-owned agentic task-tree step per Celery invocation.
# Invariants:
# - A claimed step is the authority for Act; Think is not called on this path.
# - Retryable tool failures become step retry_wait/failed states, not replanning loops.
# - Empty tree in replanning/planning re-enqueues loop tick (Think), never orphans the session.
# - System/plan errors abort running claims; no node may remain stuck in running.
# - Gate G1: mirror sync is best-effort; non-retryable DB faults terminalize the session.
# - Gate G5: awaiting_child binds child_run_id and reconciles before soft-poll.
# - E5: accepted child-run boundary updates awaiting_child + claim release atomically.
# Related:
# - api/ewa_platform/agentic/kernel/tree_scheduler.py
# - api/ewa_platform/agentic/jobs/child_reconcile.py
# - api/ewa_platform/persistence_pg/agentic_asyncpg.py
# - documentation/product/ewa/EWA-FORENSIC-AUDIT-RECOVERY-PLAN-2026-07-09.md (Gate G1/G5)
# - documentation/product/ewa/EWA-ECOSYSTEM-VULNERABILITY-MAP-2026-07-09.md (E5)
# ---

from __future__ import annotations

import logging
import os
import socket
import time
from collections.abc import Mapping
from typing import Any

from api.ewa_platform.agentic.adapters.tool_context import build_agentic_tool_context
from api.ewa_platform.agentic.auto_accept_hitl import ARGS_FLAG, resolve_auto_accept_hitl
from api.ewa_platform.agentic.config import (
    agentic_awaiting_child_poll_sec,
    agentic_llm_admission_poll_sec,
    agentic_soft_timeout_max_per_node,
    agentic_step_claim_seconds,
    agentic_step_retry_delay_sec,
)
from api.ewa_platform.agentic.driver.tick_integration import act_error_is_version_conflict, observe_after_act
from api.ewa_platform.agentic.gate_contract import build_gate_json
from api.ewa_platform.agentic.jobs.child_reconcile import (
    child_run_id_from_act_raw,
    metadata_with_child_run_bind,
    reconcile_awaiting_child_nodes_for_session,
)
from api.ewa_platform.agentic.jobs.enqueue import enqueue_agentic_loop_tick, enqueue_agentic_step
from api.ewa_platform.agentic.jobs.llm_admission import (
    release_heavy_llm_lease,
    try_acquire_heavy_llm_lease,
)
from api.ewa_platform.agentic.jobs.reliability import (
    is_agentic_celery_soft_timeout,
    is_nonretryable_agentic_error,
    safe_sync_and_publish_task_run_from_session,
    terminalize_session_nonretryable,
)
from api.ewa_platform.agentic.kernel import state_machine as fsm
from api.ewa_platform.agentic.kernel.circuit_breaker import working_memory_from_session
from api.ewa_platform.agentic.kernel.tool_args_enrich import goal_text_from_session
from api.ewa_platform.agentic.kernel.tool_args_validate import validate_tool_args_for_registry
from api.ewa_platform.agentic.tools.bridge import agentic_dispatch_tool
from api.ewa_platform.persistence_pg import agentic_asyncpg as agentic_pg
from api.ewa_platform.workers.ewa_pool import open_initialized_ewa_worker_pool

logger = logging.getLogger(__name__)

_ACTIVE_STEP_STATUSES = {"pending", "claimed", "running", "retry_wait", "awaiting_human", "awaiting_child"}


def _worker_id() -> str:
    return f"{socket.gethostname()}:{os.getpid()}"


def _has_more_active_steps(counts: Mapping[str, int]) -> bool:
    return any(int(counts.get(status) or 0) > 0 for status in _ACTIVE_STEP_STATUSES)


def _tree_status_counts_snapshot(counts: Mapping[str, int]) -> dict[str, int]:
    return {
        status: int(counts.get(status) or 0)
        for status in sorted(set(counts) | _ACTIVE_STEP_STATUSES | {"completed", "failed"})
    }


async def _resolve_executing_no_claimable(
    pool: Any,
    *,
    session: Mapping[str, Any],
    principal_id: str,
    counts: Mapping[str, int],
    reason_prefix: str,
) -> dict[str, Any]:
    """Resolve executing sessions where scheduler rows exist but claim_next found nothing."""

    session_id = str(session.get("id") or "")
    session_status = str(session.get("status") or "")
    linked_task_run_id = session.get("linked_task_run_id")
    snapshot = _tree_status_counts_snapshot(counts)
    awaiting_human = int(counts.get("awaiting_human") or 0)
    retry_wait = int(counts.get("retry_wait") or 0)
    awaiting_child = int(counts.get("awaiting_child") or 0)
    pending = int(counts.get("pending") or 0)
    running = int(counts.get("running") or 0) + int(counts.get("claimed") or 0)

    logger.info(
        "[STEP] agentic_step_no_runnable session_id=%s linked_task_run_id=%s status=%s counts=%s",
        session_id,
        linked_task_run_id,
        session_status,
        snapshot,
    )

    if awaiting_human > 0 and running == 0 and pending == 0 and retry_wait == 0:
        gate_payload: dict[str, Any] = {}
        gate = session.get("gate_json")
        if isinstance(gate, Mapping):
            gate_payload = dict(gate)
        if not gate_payload:
            nodes = await agentic_pg.agentic_task_tree_list(
                pool,
                session_id=session_id,
                statuses=["awaiting_human"],
            )
            for node in nodes:
                node_gate = node.get("gate_json")
                if isinstance(node_gate, Mapping) and node_gate:
                    gate_payload = dict(node_gate)
                    break
        tr = await fsm.apply_session_transition(
            pool,
            session_id=session_id,
            principal_id=principal_id,
            event="gate_required",
            expect_revision=int(session.get("session_revision") or 0),
            gate_json=gate_payload or None,
        )
        final_session = tr.session or dict(session)
        if not tr.ok and str(final_session.get("status")) != fsm.STATUS_AWAITING_HUMAN:
            logger.warning(
                "[STEP] agentic_step_awaiting_human_transition_failed session_id=%s reason=%s",
                session_id,
                tr.reason,
            )
        await safe_sync_and_publish_task_run_from_session(pool, session=final_session)
        return {
            "ok": True,
            "reason": f"{reason_prefix}:awaiting_human",
            "status": final_session.get("status"),
            "counts": snapshot,
        }

    if retry_wait > 0 and running == 0 and pending == 0:
        delay = agentic_step_retry_delay_sec()
        enqueue_agentic_step(
            session_id=session_id,
            principal_id=principal_id,
            countdown_sec=delay,
        )
        logger.info(
            "[STEP] agentic_step_retry_wait_scheduled session_id=%s retry_wait=%s delay_sec=%s",
            session_id,
            retry_wait,
            delay,
        )
        return {
            "ok": True,
            "reason": f"{reason_prefix}:retry_wait_scheduled",
            "status": session_status,
            "counts": snapshot,
        }

    if awaiting_child > 0 and running == 0 and pending == 0 and retry_wait == 0:
        progressed = await reconcile_awaiting_child_nodes_for_session(pool, session=session)
        if progressed > 0:
            await safe_sync_and_publish_task_run_from_session(pool, session=session)
            enqueue_agentic_step(session_id=session_id, principal_id=principal_id)
            return {
                "ok": True,
                "reason": f"{reason_prefix}:awaiting_child_reconciled",
                "status": session_status,
                "counts": snapshot,
                "reconciled_nodes": progressed,
            }
        delay = agentic_awaiting_child_poll_sec()
        enqueue_agentic_step(
            session_id=session_id,
            principal_id=principal_id,
            countdown_sec=delay,
        )
        logger.info(
            "[STEP] agentic_step_awaiting_child_poll session_id=%s awaiting_child=%s delay_sec=%s",
            session_id,
            awaiting_child,
            delay,
        )
        return {
            "ok": True,
            "reason": f"{reason_prefix}:awaiting_child_poll",
            "status": session_status,
            "counts": snapshot,
        }

    if pending > 0 and running == 0:
        reconciled = await agentic_pg.agentic_task_tree_fail_empty_tool_pending(
            pool,
            session_id=session_id,
        )
        if reconciled > 0:
            logger.info(
                "[STEP] agentic_step_reconciled_empty_tool_pending session_id=%s failed_nodes=%s",
                session_id,
                reconciled,
            )
        enqueue_agentic_step(session_id=session_id, principal_id=principal_id)
        return {
            "ok": True,
            "reason": f"{reason_prefix}:pending_reconcile",
            "status": session_status,
            "counts": snapshot,
            "reconciled_nodes": reconciled,
        }

    enqueue_agentic_loop_tick(
        session_id=session_id,
        principal_id=principal_id,
        expected_revision=int(session.get("session_revision") or 0),
    )
    logger.info(
        "[STEP] agentic_step_handoff_loop session_id=%s status=%s reason=no_scheduler_work counts=%s",
        session_id,
        session_status,
        snapshot,
    )
    return {
        "ok": True,
        "reason": f"{reason_prefix}:handoff_loop_tick",
        "status": session_status,
        "counts": snapshot,
    }


async def _finish_session_if_done(
    pool: Any,
    *,
    session: Mapping[str, Any],
    reason_prefix: str,
) -> dict[str, Any]:
    session_id = str(session.get("id") or "")
    principal_id = str(session.get("principal_id") or "")
    counts = await agentic_pg.agentic_task_tree_status_counts(pool, session_id=session_id)
    if int(counts.get("failed") or 0) > 0:
        tr = await fsm.apply_session_transition(
            pool,
            session_id=session_id,
            principal_id=principal_id,
            event="fatal_error",
            expect_revision=int(session.get("session_revision") or 0),
        )
        final_session = tr.session or dict(session)
        await safe_sync_and_publish_task_run_from_session(pool, session=final_session)
        return {"ok": True, "reason": f"{reason_prefix}:failed_step", "status": final_session.get("status")}

    session_status = str(session.get("status") or "")
    if not _has_more_active_steps(counts) and session_status == fsm.STATUS_EXECUTING:
        from api.ewa_platform.agentic.kernel.mid_mission_replan import try_mid_mission_replan_handoff

        handled, session_out, replan_reason = await try_mid_mission_replan_handoff(
            pool,
            session=session,
            completed_steps=int(counts.get("completed") or 0),
        )
        if handled:
            if session_out is not None:
                await safe_sync_and_publish_task_run_from_session(pool, session=session_out)
            ok = not str(replan_reason).startswith("replan_transition_failed")
            return {
                "ok": ok,
                "reason": (
                    f"{reason_prefix}:replan_transition_failed" if not ok else f"{reason_prefix}:handoff_replan"
                ),
                "status": (session_out or session).get("status"),
                "replan_reason": replan_reason,
            }

        tr = await fsm.apply_session_transition(
            pool,
            session_id=session_id,
            principal_id=principal_id,
            event="step_ok_done",
            expect_revision=int(session.get("session_revision") or 0),
        )
        final_session = tr.session or dict(session)
        await safe_sync_and_publish_task_run_from_session(pool, session=final_session)
        return {"ok": True, "reason": f"{reason_prefix}:completed", "status": final_session.get("status")}

    if not _has_more_active_steps(counts) and session_status in {
        fsm.STATUS_REPLANNING,
        fsm.STATUS_PLANNING,
    }:
        enqueue_agentic_loop_tick(
            session_id=session_id,
            principal_id=principal_id,
            expected_revision=int(session.get("session_revision") or 0),
        )
        logger.info(
            "[STEP] agentic_step_handoff_loop session_id=%s status=%s reason=no_runnable_steps",
            session_id,
            session_status,
        )
        return {
            "ok": True,
            "reason": f"{reason_prefix}:handoff_loop_tick",
            "status": session_status,
        }

    if session_status == fsm.STATUS_EXECUTING and _has_more_active_steps(counts):
        return await _resolve_executing_no_claimable(
            pool,
            session=session,
            principal_id=principal_id,
            counts=counts,
            reason_prefix=reason_prefix,
        )

    logger.info(
        "[STEP] agentic_step_no_runnable session_id=%s linked_task_run_id=%s status=%s counts=%s",
        session_id,
        session.get("linked_task_run_id"),
        session_status,
        _tree_status_counts_snapshot(counts),
    )
    return {"ok": True, "reason": f"{reason_prefix}:no_runnable", "status": session.get("status")}


async def _recover_orphaned_running_steps(
    pool: Any,
    *,
    session: Mapping[str, Any],
    principal_id: str,
    reason_prefix: str,
) -> dict[str, Any] | None:
    """Re-enqueue step work after failing scheduler-owned rows stuck in running."""

    session_id = str(session.get("id") or "")
    counts = await agentic_pg.agentic_task_tree_status_counts(pool, session_id=session_id)
    running = int(counts.get("running") or 0) + int(counts.get("claimed") or 0)
    if running <= 0:
        return None

    reaped = await agentic_pg.agentic_task_tree_abort_orphaned_running(
        pool,
        session_id=session_id,
        reason=f"{reason_prefix}:orphan_recovery",
    )
    if reaped <= 0:
        return None

    logger.warning(
        "[STEP] agentic_step_orphan_recovery session_id=%s reaped=%s",
        session_id,
        reaped,
    )
    enqueue_agentic_step(session_id=session_id, principal_id=principal_id)
    return {
        "ok": True,
        "reason": f"{reason_prefix}:orphan_recovery",
        "status": session.get("status"),
        "reaped_nodes": reaped,
    }


async def _handle_missing_tool_name(
    pool: Any,
    *,
    session: Mapping[str, Any],
    session_id: str,
    principal_id: str,
    node_id: str,
) -> dict[str, Any]:
    """Invalid plan node: fail the step and continue scheduler — not a replanning circuit event."""

    await agentic_pg.agentic_task_tree_abort_running_step(
        pool,
        node_id=node_id,
        session_id=session_id,
        reason="step_missing_tool_name",
        terminal_status="failed",
    )
    await agentic_pg.agentic_checkpoint_append(
        pool,
        session_id=session_id,
        node_id=node_id,
        kind="error",
        payload_json={"summary": "step_missing_tool_name", "event": "invalid_plan_node"},
    )
    refreshed = await agentic_pg.agentic_session_fetch_for_principal(
        pool,
        session_id=session_id,
        principal_id=principal_id,
    )
    final_session = refreshed or dict(session)
    await safe_sync_and_publish_task_run_from_session(pool, session=final_session)
    counts = await agentic_pg.agentic_task_tree_status_counts(pool, session_id=session_id)
    if _has_more_active_steps(counts):
        enqueue_agentic_step(session_id=session_id, principal_id=principal_id)
        return {
            "ok": False,
            "reason": "step_missing_tool_name",
            "session_id": session_id,
            "node_id": node_id,
            "status": final_session.get("status"),
        }
    return await _finish_session_if_done(pool, session=final_session, reason_prefix="agentic_step")


async def _abort_claimed_step_on_system_error(
    pool: Any,
    *,
    session_id: str,
    node_id: str | None,
    exc: BaseException,
) -> None:
    if not node_id:
        return
    await agentic_pg.agentic_task_tree_abort_running_step(
        pool,
        node_id=node_id,
        session_id=session_id,
        reason=f"system_error:{exc}"[:2000],
        terminal_status="failed",
    )


async def recover_agentic_step_soft_timeout(
    *,
    session_id: str,
    principal_id: str,
    node_id: str | None = None,
    job_payload: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Structured SoftTimeLimit recovery: retry_wait (or terminal) without Celery blind retry."""

    sid = str(session_id or "").strip()
    pid = str(principal_id or "").strip()
    if not sid or not pid:
        return {"ok": False, "reason": "soft_timeout_missing_ids", "session_id": sid}

    try:
        pool = await open_initialized_ewa_worker_pool(min_size=1, max_size=2)
    except RuntimeError:
        return {"ok": False, "reason": "EWA_DATABASE_URL_unset", "session_id": sid}

    nid = str(node_id or (job_payload or {}).get("node_id") or "").strip() or None
    if not nid:
        # Best-effort: abort any orphaned running rows for this session.
        await agentic_pg.agentic_task_tree_abort_orphaned_running(
            pool,
            session_id=sid,
            reason="celery_soft_time_limit:orphan_recovery",
        )
        enqueue_agentic_step(
            session_id=sid,
            principal_id=pid,
            countdown_sec=agentic_step_retry_delay_sec(),
        )
        return {"ok": True, "reason": "soft_timeout_recovered_no_node", "session_id": sid}

    node = await agentic_pg.agentic_task_tree_get(pool, node_id=nid, session_id=sid)
    meta_raw = (node or {}).get("metadata_json") if node else None
    meta: dict[str, Any] = dict(meta_raw) if isinstance(meta_raw, Mapping) else {}
    soft_count = int(meta.get("soft_timeout_count") or 0) + 1
    meta["soft_timeout_count"] = soft_count
    max_soft = agentic_soft_timeout_max_per_node()

    if soft_count > max_soft:
        await agentic_pg.agentic_task_tree_abort_running_step(
            pool,
            node_id=nid,
            session_id=sid,
            reason=f"celery_soft_time_limit:exhausted count={soft_count}",
            terminal_status="failed",
        )
        session = await agentic_pg.agentic_session_fetch_for_principal(
            pool,
            session_id=sid,
            principal_id=pid,
        )
        if session is not None:
            await safe_sync_and_publish_task_run_from_session(pool, session=session)
        await conn_execute_release_lease(pool, session_id=sid)
        logger.error(
            "[STEP] agentic_soft_timeout_exhausted session_id=%s node_id=%s count=%s",
            sid,
            nid,
            soft_count,
        )
        return {
            "ok": False,
            "reason": "soft_timeout_exhausted",
            "session_id": sid,
            "node_id": nid,
            "soft_timeout_count": soft_count,
        }

    await agentic_pg.agentic_task_tree_schedule_continue(
        pool,
        node_id=nid,
        session_id=sid,
        reason=f"celery_soft_time_limit count={soft_count}",
        retry_delay_sec=agentic_step_retry_delay_sec(),
        metadata_json=meta,
    )
    await conn_execute_release_lease(pool, session_id=sid)
    session = await agentic_pg.agentic_session_fetch_for_principal(
        pool,
        session_id=sid,
        principal_id=pid,
    )
    if session is not None:
        await safe_sync_and_publish_task_run_from_session(pool, session=session)
    enqueue_agentic_step(
        session_id=sid,
        principal_id=pid,
        countdown_sec=agentic_step_retry_delay_sec(),
    )
    logger.warning(
        "[STEP] agentic_soft_timeout_recovered session_id=%s node_id=%s count=%s",
        sid,
        nid,
        soft_count,
    )
    return {
        "ok": True,
        "reason": "soft_timeout_retry_wait",
        "session_id": sid,
        "node_id": nid,
        "soft_timeout_count": soft_count,
    }


async def execute_agentic_step(
    *,
    session_id: str,
    job_payload: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Execute exactly one runnable agentic step and enqueue the next step when appropriate."""

    started = time.perf_counter()
    sid = str(session_id or "").strip()
    if not sid:
        return {"ok": False, "reason": "missing_session_id"}

    payload = dict(job_payload or {})
    principal_id = str(payload.get("principal_id") or "").strip()
    if not principal_id:
        return {"ok": False, "reason": "missing_principal_id", "session_id": sid}

    try:
        pool = await open_initialized_ewa_worker_pool(min_size=1, max_size=4)
    except RuntimeError:
        logger.error("[STEP] agentic_step_executor_skip reason=EWA_DATABASE_URL_unset session_id=%s", sid)
        return {"ok": False, "reason": "EWA_DATABASE_URL_unset", "session_id": sid}

    node_id: str | None = None
    try:
        session = await agentic_pg.agentic_session_fetch_for_principal(
            pool,
            session_id=sid,
            principal_id=principal_id,
        )
        if session is None:
            return {"ok": False, "reason": "session_not_found", "session_id": sid}
        if str(session.get("status") or "") in agentic_pg.TERMINAL_SESSION_STATUSES:
            return {"ok": True, "reason": "terminal", "session_id": sid, "status": session.get("status")}
        if str(session.get("status") or "") == fsm.STATUS_AWAITING_HUMAN:
            return {"ok": True, "reason": "awaiting_human", "session_id": sid}

        node = await agentic_pg.agentic_task_tree_claim_next(
            pool,
            session_id=sid,
            principal_id=principal_id,
            claim_holder=_worker_id(),
            claim_seconds=agentic_step_claim_seconds(),
        )
        if node is None:
            recovered = await _recover_orphaned_running_steps(
                pool,
                session=session,
                principal_id=principal_id,
                reason_prefix="agentic_step",
            )
            if recovered is not None:
                return recovered
            return await _finish_session_if_done(pool, session=session, reason_prefix="agentic_step")

        node_id = str(node.get("id") or "")
        # Gate G3: scheduler-visible progress so session budget / orphan heuristics see Act work.
        bumped = await agentic_pg.agentic_session_update(
            pool,
            session_id=sid,
            principal_id=principal_id,
            iteration_count=int(session.get("iteration_count") or 0) + 1,
            expect_revision=None,
        )
        if bumped is not None:
            session = bumped
        tool_name = str(node.get("tool_name") or "").strip()
        if not tool_name:
            return await _handle_missing_tool_name(
                pool,
                session=session,
                session_id=sid,
                principal_id=principal_id,
                node_id=node_id,
            )

        args = dict(node.get("tool_args_json") or {})
        try:
            args = validate_tool_args_for_registry(
                tool_name,
                args,
                user_line=goal_text_from_session(session),
                node_instruction=str(node.get("instruction") or ""),
                session=session,
            )
        except ValueError as exc:
            failed = await agentic_pg.agentic_task_tree_mark_retry_or_failed(
                pool,
                node_id=node_id,
                session_id=sid,
                reason=f"tool_args_invalid:{exc}",
                retry_delay_sec=agentic_step_retry_delay_sec(),
            )
            if failed and str(failed.get("status")) == "retry_wait":
                enqueue_agentic_step(
                    session_id=sid,
                    principal_id=principal_id,
                    countdown_sec=agentic_step_retry_delay_sec(),
                )
            return {"ok": False, "reason": "tool_args_invalid", "session_id": sid, "node_id": node_id}

        args["_agentic_session_id"] = sid
        args["_agentic_node_id"] = node_id
        wm_pre = working_memory_from_session(session)
        draft_pre = wm_pre.get("doc_create_draft_v1")
        if isinstance(draft_pre, Mapping):
            args["_agentic_doc_create_draft"] = dict(draft_pre)
        tool_ctx = await build_agentic_tool_context(pool, session=session, principal_id=principal_id)

        profile_raw = getattr(tool_ctx, "profile", None) if tool_ctx is not None else None
        if await resolve_auto_accept_hitl(
            pool,
            principal_id=principal_id,
            policy_json=session.get("policy_json") if isinstance(session.get("policy_json"), Mapping) else None,
            profile=profile_raw if isinstance(profile_raw, Mapping) else None,
        ):
            args[ARGS_FLAG] = True

        admission_ok, admission_token = await try_acquire_heavy_llm_lease(session_id=sid, tool_name=tool_name)
        if not admission_ok:
            await agentic_pg.agentic_task_tree_schedule_continue(
                pool,
                node_id=node_id,
                session_id=sid,
                reason="llm_admission_busy",
                retry_delay_sec=agentic_llm_admission_poll_sec(),
            )
            enqueue_agentic_step(
                session_id=sid,
                principal_id=principal_id,
                countdown_sec=agentic_llm_admission_poll_sec(),
            )
            return {
                "ok": True,
                "reason": "llm_admission_wait",
                "session_id": sid,
                "node_id": node_id,
            }

        try:
            act = await agentic_dispatch_tool(tool_name, args, tool_ctx, session=session)
        finally:
            await release_heavy_llm_lease(token=admission_token)
        from api.ewa_platform.agentic.tools.bridge import extract_created_content_from_act_raw

        created_id, created_name = extract_created_content_from_act_raw(
            act.raw if isinstance(act.raw, Mapping) else None
        )
        from api.ewa_platform.agentic.kernel.visible_text import (
            laconic_agentic_act_summary,
            sanitize_agentic_visible_text,
        )

        act_summary = laconic_agentic_act_summary(str(act.summary or ""))
        act_payload: dict[str, Any] = {
            "summary": act_summary,
            "status": act.status,
            "tool": tool_name,
            "node_id": node_id,
            "scheduler_owned": True,
        }
        if created_id:
            act_payload["unified_content_id"] = created_id
            act_payload["created_unified_content_id"] = created_id
            if created_name:
                act_payload["document_name"] = created_name
        checkpoint = await agentic_pg.agentic_checkpoint_append(
            pool,
            session_id=sid,
            kind="act",
            node_id=node_id,
            payload_json=act_payload,
        )
        result_ref = str(checkpoint.get("id")) if checkpoint else None

        if act.status == "needs_confirm":
            rev = int(session.get("session_revision") or 0)
            checkpoint_seq = int(checkpoint.get("seq")) if checkpoint and checkpoint.get("seq") is not None else None
            from api.ewa_platform.agentic.auto_accept_hitl import try_auto_finalize_needs_confirm
            from api.ewa_platform.agentic.hitl_companion_finalize import companion_pending_task_run_id_from_act_raw

            gate_payload = build_gate_json(
                kind="confirm",
                prompt=act_summary,
                session_revision=rev,
                bound_node_id=node_id,
                bound_checkpoint_seq=checkpoint_seq,
                companion_pending_task_run_id=companion_pending_task_run_id_from_act_raw(act.raw),
                pending_tool=tool_name,
                ttl_hours=48.0,
            )
            auto_out = await try_auto_finalize_needs_confirm(
                pool,
                session=session,
                principal_id=principal_id,
                gate_payload=gate_payload,
                act_node_id=node_id,
            )
            if auto_out is not None:
                policy_patch = auto_out.get("policy_json")
                if isinstance(policy_patch, dict):
                    patched = await agentic_pg.agentic_session_update(
                        pool,
                        session_id=sid,
                        principal_id=principal_id,
                        policy_json=policy_patch,
                        expect_revision=rev,
                    )
                    if patched is not None:
                        session = patched
                        rev = int(session.get("session_revision") or rev)
                await agentic_pg.agentic_task_tree_clear_claim(
                    pool,
                    node_id=node_id,
                    session_id=sid,
                    status="completed",
                )
                await agentic_pg.agentic_task_tree_update(
                    pool,
                    node_id=node_id,
                    session_id=sid,
                    status="completed",
                    result_ref=result_ref,
                    result_summary=act_summary[:4000],
                    mark_completed=True,
                )
                await safe_sync_and_publish_task_run_from_session(pool, session=session)
                enqueue_agentic_step(
                    session_id=sid,
                    principal_id=principal_id,
                    worker_payload={"expected_revision": int(session.get("session_revision") or rev)},
                )
                return {"ok": True, "reason": "auto_accepted", "session_id": sid, "node_id": node_id}

            await agentic_pg.agentic_task_tree_clear_claim(
                pool,
                node_id=node_id,
                session_id=sid,
                status="awaiting_human",
            )
            await agentic_pg.agentic_task_tree_update(
                pool,
                node_id=node_id,
                session_id=sid,
                status=fsm.STATUS_AWAITING_HUMAN,
                result_ref=result_ref,
                result_summary=act_summary[:4000],
                gate_json=gate_payload,
            )
            tr = await fsm.apply_session_transition(
                pool,
                session_id=sid,
                principal_id=principal_id,
                event="gate_required",
                expect_revision=rev,
                gate_json=gate_payload,
            )
            final_session = tr.session or session
            await safe_sync_and_publish_task_run_from_session(pool, session=final_session)
            return {"ok": True, "reason": "awaiting_human", "session_id": sid, "node_id": node_id}

        if act.status in {"error", "unhandled", "denied", "unregistered"}:
            if act_error_is_version_conflict(act):
                logger.info(
                    "[STEP] agentic_step_version_conflict_replan session_id=%s tool=%s node_id=%s",
                    sid,
                    tool_name,
                    node_id,
                )
                await agentic_pg.agentic_task_tree_clear_claim(
                    pool,
                    node_id=node_id,
                    session_id=sid,
                    status="pending",
                )
                _, session_after = await agentic_pg.agentic_record_replanning_atomic(
                    pool,
                    session_id=sid,
                    principal_id=principal_id,
                    expect_revision=int(session.get("session_revision") or 0),
                    reason="content_version_conflict",
                )
                if session_after is not None:
                    enqueue_agentic_loop_tick(session_id=sid, principal_id=principal_id)
                return {
                    "ok": True,
                    "reason": "content_version_conflict_replan",
                    "session_id": sid,
                    "node_id": node_id,
                }
            failed = await agentic_pg.agentic_task_tree_mark_retry_or_failed(
                pool,
                node_id=node_id,
                session_id=sid,
                reason=f"tool_act_error:{act_summary[:500]}",
                retry_delay_sec=agentic_step_retry_delay_sec(),
            )
            if failed and str(failed.get("status")) == "retry_wait":
                enqueue_agentic_step(
                    session_id=sid,
                    principal_id=principal_id,
                    countdown_sec=agentic_step_retry_delay_sec(),
                )
                return {"ok": True, "reason": "retry_wait", "session_id": sid, "node_id": node_id}
            return await _finish_session_if_done(pool, session=session, reason_prefix="agentic_step")

        if act.status == "continue":
            raw_act = act.raw if isinstance(act.raw, Mapping) else {}
            data_raw = raw_act.get("data")
            data_map: Mapping[str, Any] = data_raw if isinstance(data_raw, Mapping) else {}
            draft = data_map.get("doc_create_draft_v1")
            wm = working_memory_from_session(session)
            if isinstance(draft, Mapping):
                wm["doc_create_draft_v1"] = dict(draft)
            refreshed_wm = await agentic_pg.agentic_session_update(
                pool,
                session_id=sid,
                principal_id=principal_id,
                working_memory_json=wm,
                expect_revision=None,
            )
            if refreshed_wm is not None:
                session = refreshed_wm
            await agentic_pg.agentic_task_tree_schedule_continue(
                pool,
                node_id=node_id,
                session_id=sid,
                reason="compose_continue",
                retry_delay_sec=max(2, min(agentic_step_retry_delay_sec(), 10)),
            )
            await safe_sync_and_publish_task_run_from_session(pool, session=session)
            enqueue_agentic_step(
                session_id=sid,
                principal_id=principal_id,
                countdown_sec=max(2, min(agentic_step_retry_delay_sec(), 10)),
            )
            logger.info(
                "[STEP] agentic_step_compose_continue session_id=%s node_id=%s draft_chars=%s",
                sid,
                node_id,
                len(str((draft or {}).get("body") or "")) if isinstance(draft, Mapping) else 0,
            )
            return {"ok": True, "reason": "compose_continue", "session_id": sid, "node_id": node_id}

        if act.status == "accepted":
            child_run_id = child_run_id_from_act_raw(act.raw)
            await agentic_pg.agentic_task_tree_mark_awaiting_child(
                pool,
                node_id=node_id,
                session_id=sid,
                result_ref=result_ref,
                result_summary=act_summary[:4000],
                metadata_json=metadata_with_child_run_bind(
                    node,
                    child_run_id=child_run_id,
                    tool_name=tool_name,
                ),
            )
            await safe_sync_and_publish_task_run_from_session(pool, session=session)
            delay = agentic_awaiting_child_poll_sec()
            enqueue_agentic_step(
                session_id=sid,
                principal_id=principal_id,
                countdown_sec=delay,
            )
            logger.info(
                "[STEP] agentic_step_awaiting_child session_id=%s node_id=%s tool=%s child_run_id=%s",
                sid,
                node_id,
                tool_name,
                child_run_id or "",
            )
            return {"ok": True, "reason": "awaiting_child", "session_id": sid, "node_id": node_id}

        await agentic_pg.agentic_task_tree_mark_completed(
            pool,
            node_id=node_id,
            session_id=sid,
            result_ref=result_ref,
            result_summary=act_summary,
        )
        if act.status == "ok" and created_id:
            from api.ewa_platform.agentic.policy_content_bind import policy_json_with_created_content

            policy_bound = policy_json_with_created_content(
                session.get("policy_json") if isinstance(session.get("policy_json"), Mapping) else None,
                created_content_id=created_id,
            )
            patched_policy = await agentic_pg.agentic_session_update(
                pool,
                session_id=sid,
                principal_id=principal_id,
                policy_json=policy_bound,
                expect_revision=int(session.get("session_revision") or 0),
            )
            if patched_policy is not None:
                session = patched_policy
                logger.info(
                    "[STEP] agentic_policy_content_bound session_id=%s unified_content_id=%s",
                    sid,
                    created_id[:48],
                )
        session = await observe_after_act(
            pool,
            session=session,
            ctx=None,
            principal_id=principal_id,
            act_tool=tool_name,
            act_summary=act_summary,
        )
        wm = agentic_pg.working_memory_after_successful_act(
            working_memory_from_session(session),
        )
        if tool_name == "call_expert_chat" and act.status == "ok":
            raw_act = act.raw if isinstance(act.raw, Mapping) else {}
            expert_data_raw = raw_act.get("data")
            expert_data: Mapping[str, Any] = expert_data_raw if isinstance(expert_data_raw, Mapping) else {}
            blob = sanitize_agentic_visible_text(
                str(expert_data.get("output_text") or "").strip()
                or act_summary
                or str(expert_data.get("output_preview") or "").strip()
            )
            if blob:
                wm["last_expert_research_text"] = blob[:24_000]
                wm["awaiting_expert_consultation"] = False
            web_flag = args.get("use_web_search")
            if web_flag is True or str(web_flag or "").strip().lower() in (
                "1",
                "true",
                "yes",
                "on",
            ):
                # Expert turn was web-armed; treat as internet attempt for replan gate.
                wm["last_web_search_ok"] = True
        if tool_name == "file_create" and act.status == "ok":
            # Successful compose — drop resume draft; count for mid-mission replan gate.
            wm.pop("doc_create_draft_v1", None)
            try:
                wm["completed_file_create_count"] = int(wm.get("completed_file_create_count") or 0) + 1
            except TypeError, ValueError:
                wm["completed_file_create_count"] = 1
        if tool_name == "catalog_list" and act.status == "ok":
            raw_act = act.raw if isinstance(act.raw, Mapping) else {}
            catalog_data_raw = raw_act.get("data")
            catalog_data: Mapping[str, Any] = catalog_data_raw if isinstance(catalog_data_raw, Mapping) else {}
            hits_raw = catalog_data.get("catalog_hits")
            if isinstance(hits_raw, list) and hits_raw:
                compact: list[dict[str, str]] = []
                for item in hits_raw[:10]:
                    if not isinstance(item, Mapping):
                        continue
                    uid = str(item.get("unified_content_id") or item.get("id") or "").strip()
                    if not uid:
                        continue
                    compact.append(
                        {
                            "unified_content_id": uid,
                            "name": str(item.get("name") or "").strip()[:200],
                        }
                    )
                if compact:
                    wm["last_catalog_hits"] = compact
        refreshed = await agentic_pg.agentic_session_update(
            pool,
            session_id=sid,
            principal_id=principal_id,
            working_memory_json=wm,
            expect_revision=int(session.get("session_revision") or 0),
        )
        if refreshed is not None:
            session = refreshed
        elapsed_ms = int((time.perf_counter() - started) * 1000)
        logger.info(
            "[STEP] agentic_step_completed session_id=%s node_id=%s tool=%s elapsed_ms=%s",
            sid,
            node_id,
            tool_name,
            elapsed_ms,
        )
        counts = await agentic_pg.agentic_task_tree_status_counts(pool, session_id=sid)
        if _has_more_active_steps(counts):
            enqueue_agentic_step(session_id=sid, principal_id=principal_id)
            return {"ok": True, "reason": "step_completed_more", "session_id": sid, "node_id": node_id}
        return await _finish_session_if_done(pool, session=session, reason_prefix="agentic_step")
    except Exception as exc:
        if is_agentic_celery_soft_timeout(exc):
            return await recover_agentic_step_soft_timeout(
                session_id=sid,
                principal_id=principal_id,
                node_id=node_id,
            )
        await _abort_claimed_step_on_system_error(pool, session_id=sid, node_id=node_id, exc=exc)
        logger.exception(
            "[STEP] agentic_step_system_error session_id=%s node_id=%s err=%s",
            sid,
            node_id,
            exc,
        )
        # G1: non-retryable DB faults must leave a terminal, reaper/HITL-visible session.
        if is_nonretryable_agentic_error(exc):
            session = await terminalize_session_nonretryable(
                pool,
                session_id=sid,
                principal_id=principal_id,
                exc=exc,
                expect_revision=None,
            )
            return {
                "ok": False,
                "reason": "nonretryable_terminalized",
                "session_id": sid,
                "node_id": node_id,
                "status": (session or {}).get("status"),
                "error": str(exc)[:500],
            }
        # Transient system error: clear lease so reaper/HITL can see the session.
        await conn_execute_release_lease(pool, session_id=sid)
        refreshed = await agentic_pg.agentic_session_fetch_for_principal(
            pool,
            session_id=sid,
            principal_id=principal_id,
        )
        if refreshed is not None:
            await safe_sync_and_publish_task_run_from_session(pool, session=refreshed)
        return {
            "ok": False,
            "reason": "system_error",
            "session_id": sid,
            "node_id": node_id,
            "error": str(exc)[:500],
        }
    # Process-level pool (E4): do not close after each task.


async def conn_execute_release_lease(pool: Any, *, session_id: str) -> None:
    """Clear session lease so orphaned executing work is visible to reaper/HITL."""

    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE ewa_agentic_sessions
            SET lease_holder = NULL, leased_until = NULL, updated_at = now()
            WHERE id = $1
            """,
            session_id,
        )
