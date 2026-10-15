# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Celery worker entry: one bounded agentic loop tick with self-reschedule.
# Invariants:
# - Uses process-level EWA pool (E4); must not close the pool per task; releases lease in loop finally.
# - Replanning/planning continue via loop tick (Think); step scheduler owns Act in executing only.
# - Gate G1: Operations mirror sync must not block enqueue (safe_sync then reschedule).
# - Gate G2: orphan sweeper reclaims no-lease stale active sessions.
# Related:
# - api/ewa_platform/agentic/kernel/loop.py
# - documentation/product/ewa/EWA-FORENSIC-AUDIT-RECOVERY-PLAN-2026-07-09.md (Gates G1–G2)
# ---

from __future__ import annotations

import logging
import os
import socket
from collections.abc import Mapping
from contextlib import suppress
from typing import Any

import asyncpg
from api.ewa_platform.agentic.config import (
    agentic_orphan_max_recoveries,
    agentic_orphan_stale_minutes,
    agentic_step_scheduler_enabled,
)
from api.ewa_platform.agentic.jobs.enqueue import enqueue_agentic_loop_tick, enqueue_agentic_step
from api.ewa_platform.agentic.jobs.reliability import (
    reschedule_after_loop_tick,
    safe_sync_and_publish_task_run_from_session,
    terminalize_session_nonretryable,
)
from api.ewa_platform.agentic.kernel.loop import run_agentic_loop_tick
from api.ewa_platform.workers.ewa_pool import open_initialized_ewa_worker_pool

WM_ORPHAN_SWEEP_COUNT = "orphan_sweep_count"

logger = logging.getLogger(__name__)


def _worker_id() -> str:
    return f"{socket.gethostname()}:{os.getpid()}"


async def execute_agentic_loop_tick(
    *,
    session_id: str,
    job_payload: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    sid = str(session_id or "").strip()
    if not sid:
        return {"ok": False, "reason": "missing_session_id"}

    payload = dict(job_payload or {})
    principal_id = str(payload.get("principal_id") or "").strip()
    if not principal_id:
        return {"ok": False, "reason": "missing_principal_id", "session_id": sid}

    expected_revision = payload.get("expected_revision")
    exp_rev = int(expected_revision) if expected_revision is not None else None

    try:
        pool = await open_initialized_ewa_worker_pool(min_size=1, max_size=4)
    except RuntimeError:
        logger.error("[STEP] agentic_executor_skip reason=EWA_DATABASE_URL_unset session_id=%s", sid)
        return {"ok": False, "reason": "EWA_DATABASE_URL_unset", "session_id": sid}

    # Process-level pool (E4): do not close after each task.
    result = await run_agentic_loop_tick(
        pool,
        session_id=sid,
        principal_id=principal_id,
        worker_id=_worker_id(),
        expected_revision=exp_rev,
    )
    out: dict[str, Any] = {
        "ok": result.ok,
        "session_id": sid,
        "continue_loop": result.continue_loop,
        "reason": result.reason,
        "iterations_ran": result.iterations_ran,
    }
    if result.session is not None:
        out["status"] = result.session.get("status")
        out["session_revision"] = result.session.get("session_revision")
        # G1: mirror failure must not prevent reschedule (death-spiral root cause).
        mirror_ok = await safe_sync_and_publish_task_run_from_session(pool, session=result.session)
        out["mirror_ok"] = mirror_ok
        if result.continue_loop:
            task_id = reschedule_after_loop_tick(
                session_id=sid,
                principal_id=principal_id,
                session=result.session,
                mirror_ok=mirror_ok,
            )
            out["enqueued_task_id"] = task_id
    return out


async def reclaim_stale_agentic_leases(pool: asyncpg.Pool) -> int:
    """Watchdog: clear expired leases and re-enqueue affected sessions."""

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, principal_id, session_revision
            FROM ewa_agentic_sessions
            WHERE leased_until IS NOT NULL
              AND leased_until < now()
              AND status = ANY($1::text[])
            """,
            list(
                {
                    "planning",
                    "executing",
                    "replanning",
                },
            ),
        )
    count = 0
    for row in rows:
        session_id = str(row["id"])
        principal_id = str(row["principal_id"])
        await conn_execute_release(pool, session_id=session_id)
        # No expected_revision: avoid stale_revision drop after lease expiry races.
        enqueue_agentic_loop_tick(
            session_id=session_id,
            principal_id=principal_id,
            expected_revision=None,
        )
        count += 1
        logger.info("[STEP] agentic_lease_reclaimed session_id=%s", session_id)
    return count


async def sweep_orphaned_agentic_sessions(pool: asyncpg.Pool) -> int:
    """Gate G2: reclaim active sessions with no lease that have gone stale.

    Matches the death-spiral leftover shape: status in planning/executing/replanning,
    leased_until IS NULL, updated_at older than the stale window. Re-enqueues without
    expected_revision; after max recoveries → fatal_error + mirror sync.
    """

    from api.ewa_platform.persistence_pg import agentic_asyncpg as agentic_pg

    stale_minutes = agentic_orphan_stale_minutes()
    max_recoveries = agentic_orphan_max_recoveries()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, principal_id, session_revision, status, working_memory_json, updated_at
            FROM ewa_agentic_sessions
            WHERE leased_until IS NULL
              AND status = ANY($1::text[])
              AND updated_at < now() - make_interval(mins => $2::int)
            ORDER BY updated_at ASC
            LIMIT 50
            """,
            ["planning", "executing", "replanning"],
            stale_minutes,
        )

    count = 0
    for row in rows:
        session_id = str(row["id"])
        principal_id = str(row["principal_id"])
        status = str(row["status"] or "")
        wm_raw = row["working_memory_json"]
        wm: dict[str, Any] = dict(wm_raw) if isinstance(wm_raw, dict) else {}
        recoveries = int(wm.get(WM_ORPHAN_SWEEP_COUNT) or 0) + 1
        wm[WM_ORPHAN_SWEEP_COUNT] = recoveries

        if recoveries > max_recoveries:
            await terminalize_session_nonretryable(
                pool,
                session_id=session_id,
                principal_id=principal_id,
                exc=RuntimeError(f"orphan_sweep_exhausted recoveries={recoveries}"),
                expect_revision=None,
            )
            logger.error(
                "[STEP] agentic_orphan_sweep_terminalized session_id=%s recoveries=%s",
                session_id,
                recoveries,
            )
            with suppress(Exception):
                from api.monitoring.metrics import observe_ewa_agentic_orphan_sweep

                observe_ewa_agentic_orphan_sweep(outcome="terminalized")
            count += 1
            continue

        await agentic_pg.agentic_session_update(
            pool,
            session_id=session_id,
            principal_id=principal_id,
            working_memory_json=wm,
            expect_revision=None,
            clear_lease=True,
        )

        if agentic_step_scheduler_enabled() and status == "executing":
            task_id = enqueue_agentic_step(session_id=session_id, principal_id=principal_id)
            kind = "step"
        else:
            task_id = enqueue_agentic_loop_tick(
                session_id=session_id,
                principal_id=principal_id,
                expected_revision=None,
            )
            kind = "loop_tick"

        count += 1
        with suppress(Exception):
            from api.monitoring.metrics import observe_ewa_agentic_orphan_sweep

            observe_ewa_agentic_orphan_sweep(outcome="reenqueued")
        logger.info(
            "[STEP] agentic_orphan_sweep session_id=%s status=%s recoveries=%s kind=%s celery_task_id=%s",
            session_id,
            status,
            recoveries,
            kind,
            task_id,
        )
    with suppress(Exception):
        from api.monitoring.metrics import set_ewa_agentic_orphan_sessions

        set_ewa_agentic_orphan_sessions(count=len(rows))
    return count


async def sweep_expired_agentic_gates(pool: asyncpg.Pool) -> int:
    """Transition awaiting_human sessions whose gate_json.expires_at is in the past."""

    from api.ewa_platform.agentic.gate_contract import gate_is_expired
    from api.ewa_platform.agentic.kernel import state_machine as fsm

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, principal_id, session_revision, gate_json, policy_json
            FROM ewa_agentic_sessions
            WHERE status = $1
            """,
            fsm.STATUS_AWAITING_HUMAN,
        )

    count = 0
    for row in rows:
        gate = row["gate_json"]
        if not isinstance(gate, dict) or not gate_is_expired(gate):
            continue
        session_id = str(row["id"])
        principal_id = str(row["principal_id"])
        policy = row["policy_json"]
        on_timeout = "pause"
        if isinstance(policy, dict):
            on_timeout = str(policy.get("gate_on_timeout") or "pause")
        event = "gate_timeout_abandon" if on_timeout == "abandon" else "gate_timeout_pause"
        tr = await fsm.apply_session_transition(
            pool,
            session_id=session_id,
            principal_id=principal_id,
            event=event,
            expect_revision=int(row["session_revision"]),
        )
        if tr.ok and tr.session is not None:
            await safe_sync_and_publish_task_run_from_session(pool, session=tr.session)
            count += 1
            logger.info("[STEP] agentic_gate_sweep session_id=%s event=%s", session_id, event)
    return count


async def conn_execute_release(pool: asyncpg.Pool, *, session_id: str) -> None:
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE ewa_agentic_sessions
            SET lease_holder = NULL, leased_until = NULL, updated_at = now()
            WHERE id = $1
            """,
            session_id,
        )
