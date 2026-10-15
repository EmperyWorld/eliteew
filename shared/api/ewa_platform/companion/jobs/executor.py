# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Execute one companion task run step (Celery worker entry). WF-1: generic loop via ``step_handlers``.
# Invariants:
# - Uses process-level EWA asyncpg pool (E4); must not close the pool per task.
# - Unknown ``step_kind`` → mark run failed with user-safe payload.
# Related:
# - api/ewa_platform/companion/jobs/step_handlers.py
# - api/ewa_platform/companion/jobs/step_idempotency.py
# - api/ewa_platform/persistence_pg/companion_asyncpg.py
# - api/ewa_platform/workers/ewa_pool.py
# ---

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

import asyncpg

from api.ewa_platform.bootstrap.data_plane import init_ewa_data_plane
from api.ewa_platform.companion.jobs import step_handlers, step_idempotency, step_retry
from api.ewa_platform.companion.orchestration.execution_ledger import record_step_outcome
from api.ewa_platform.companion.orchestration.run_lifecycle import (
    assert_run_executable,
    log_run_skip,
    normalize_run_status,
    run_revision,
)
from api.ewa_platform.persistence_pg.companion_asyncpg import (
    companion_task_run_fetch,
    companion_task_run_update,
    companion_task_step_update,
    companion_task_steps_list,
)
from api.ewa_platform.workers.ewa_pool import open_initialized_ewa_worker_pool
from api.monitoring.metrics import observe_ewa_companion_job_execute, observe_ewa_companion_job_execute_result

logger = logging.getLogger(__name__)


def _lifecycle_run_snapshot(run: Mapping[str, Any]) -> Mapping[str, Any]:
    """Backfill missing status for legacy fixtures before lifecycle guards."""

    if normalize_run_status(run):
        return run
    snapshot = dict(run)
    snapshot["status"] = "running"
    return snapshot


async def init_ewa_orchestration_schema(pool: asyncpg.Pool) -> None:
    """Compatibility wrapper for historical schema bootstrap hook."""

    await init_ewa_data_plane(pool)


async def init_ewa_companion_schema(pool: asyncpg.Pool) -> None:
    """Compatibility wrapper for historical schema bootstrap hook."""

    await init_ewa_data_plane(pool)


async def init_ewa_companion_plans_schema(pool: asyncpg.Pool) -> None:
    """Compatibility wrapper for historical schema bootstrap hook."""

    await init_ewa_data_plane(pool)


async def execute_companion_run(
    *,
    run_id: str,
    step_index: int | None = None,
    job_payload: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Run pending step(s) and emit a coarse execution outcome metric."""

    try:
        result = await _execute_companion_run_inner(
            run_id=run_id,
            step_index=step_index,
            job_payload=job_payload,
        )
    except Exception:
        observe_ewa_companion_job_execute(outcome="failed", reason="exception")
        raise
    observe_ewa_companion_job_execute_result(result)
    return result


async def _execute_companion_run_inner(
    *,
    run_id: str,
    step_index: int | None = None,
    job_payload: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Run pending step(s) for ``run_id``; return structured outcome for Celery logs."""

    rid = str(run_id or "").strip()
    if not rid:
        return {"ok": False, "reason": "missing_run_id"}

    try:
        pool = await open_initialized_ewa_worker_pool(min_size=1, max_size=4)
    except RuntimeError:
        logger.error("[STEP] companion_job_executor_skip reason=EWA_DATABASE_URL_unset run_id=%s", rid)
        return {"ok": False, "reason": "EWA_DATABASE_URL_unset", "run_id": rid}

    # Process-level pool (E4): do not close after each task.
    await init_ewa_orchestration_schema(pool)
    await init_ewa_companion_schema(pool)
    await init_ewa_companion_plans_schema(pool)

    run = await companion_task_run_fetch(pool, run_id=rid)
    if run is None:
        logger.warning("[STEP] companion_job_executor_run_missing run_id=%s", rid)
        return {"ok": False, "reason": "run_not_found", "run_id": rid}

    principal_id = str(run.get("principal_id") or "").strip()
    intent_kind = str(run.get("intent_kind") or "").strip()

    lifecycle_run = _lifecycle_run_snapshot(run)
    executable, skip_reason = assert_run_executable(lifecycle_run)
    if not executable:
        log_run_skip(
            run_id=rid,
            principal_id=principal_id,
            reason=str(skip_reason or "not_executable"),
            context="executor_pre_step",
        )
        return {
            "ok": True,
            "skipped": True,
            "reason": skip_reason,
            "run_id": rid,
            "status": normalize_run_status(lifecycle_run),
        }
    if lifecycle_run is not run:
        run = lifecycle_run

    steps = await companion_task_steps_list(pool, run_id=rid)
    if not steps:
        await _fail_run(pool, run_id=rid, principal_id=principal_id, message="companion_job_no_steps")
        return {"ok": False, "reason": "no_steps", "run_id": rid}

    step = step_idempotency.resolve_target_step(steps, step_index=step_index)
    if step is None:
        await _fail_run(pool, run_id=rid, principal_id=principal_id, message="companion_job_no_steps")
        return {"ok": False, "reason": "no_steps", "run_id": rid}

    target_index = int(step.get("step_index") or 0)
    step_kind = str(step.get("step_kind") or "").strip()
    step_input = step.get("input_payload")
    payload = dict(step_input) if isinstance(step_input, Mapping) else {}
    payload.update(dict(job_payload or {}))

    blocked_index = _first_incomplete_prior_step(steps, target_index=target_index)
    if blocked_index is not None:
        logger.info(
            "[STEP] companion_job_executor_step_blocked run_id=%s target_index=%s blocked_by_index=%s",
            rid,
            target_index,
            blocked_index,
        )
        return {
            "ok": True,
            "skipped": True,
            "reason": "prior_step_incomplete",
            "run_id": rid,
            "blocked_by_step_index": blocked_index,
        }

    refreshed_run = await companion_task_run_fetch(pool, run_id=rid)
    if refreshed_run is not None:
        run = refreshed_run
        lifecycle_run = _lifecycle_run_snapshot(run)
        executable, skip_reason = assert_run_executable(lifecycle_run)
        if not executable:
            log_run_skip(
                run_id=rid,
                principal_id=principal_id,
                reason=str(skip_reason or "not_executable"),
                context="executor_pre_dispatch",
            )
            return {
                "ok": True,
                "skipped": True,
                "reason": skip_reason,
                "run_id": rid,
                "status": normalize_run_status(lifecycle_run),
            }
        if lifecycle_run is not run:
            run = lifecycle_run

    claimed_run = await companion_task_run_update(
        pool,
        run_id=rid,
        principal_id=principal_id,
        status="running",
        expect_revision=run_revision(run),
    )
    if claimed_run is None:
        log_run_skip(
            run_id=rid,
            principal_id=principal_id,
            reason="run_revision_conflict",
            context="executor_claim_before_dispatch",
        )
        return {
            "ok": True,
            "skipped": True,
            "reason": "run_revision_conflict",
            "run_id": rid,
        }
    run = claimed_run

    steps = await companion_task_steps_list(pool, run_id=rid)
    refreshed_step = next(
        (row for row in steps if str(row.get("id") or "") == str(step.get("id") or "")),
        step,
    )
    step = refreshed_step
    dispatch_decision = step_idempotency.evaluate_step_dispatch(step)
    if not dispatch_decision.should_execute:
        step_idempotency.log_task_step_skip(
            run_id=rid,
            step_index=target_index,
            reason=dispatch_decision.reason,
            step_kind=step_kind,
        )
        logger.info(
            "[STEP] companion_job_executor_step_short_circuit run_id=%s step_index=%s reason=%s",
            rid,
            target_index,
            dispatch_decision.reason,
        )
        return {
            "ok": True,
            "skipped": True,
            "reason": dispatch_decision.reason,
            "run_id": rid,
            "step_index": target_index,
            "step_kind": step_kind,
        }

    if step_idempotency.should_mark_step_in_progress(step):
        await step_handlers.mark_step_in_progress(
            pool,
            principal_id=principal_id,
            run=run,
            step=step,
        )

    handled = await step_handlers.dispatch_step(
        pool,
        run=run,
        step=step,
        job_payload=payload,
    )
    if not handled:
        record_step_outcome(
            rid,
            step,
            {"ok": False, "reason_code": "unsupported_step_kind", "message": step_kind},
        )
        await _fail_run(
            pool,
            run_id=rid,
            principal_id=principal_id,
            message=f"companion_job_unsupported intent={intent_kind} step={step_kind}",
            step=step,
            run=run,
        )
        return {"ok": False, "reason": "unsupported", "run_id": rid, "intent_kind": intent_kind}

    refreshed = await companion_task_run_fetch(pool, run_id=rid)
    terminal_status = str((refreshed or run).get("status") or "").strip().lower()
    if terminal_status == "failed":
        fresh_step = await step_retry.refresh_step_for_run(pool, run_id=rid, step_id=str(step.get("id") or ""))
        retry_step = fresh_step if fresh_step is not None else step
        retried = await step_retry.maybe_retry_failed_step(
            pool,
            run=refreshed or run,
            step=retry_step,
            job_payload=payload,
        )
        if retried:
            return {
                "ok": True,
                "run_id": rid,
                "intent_kind": intent_kind,
                "step_kind": step_kind,
                "retry_scheduled": True,
            }
        reason = "music_pipeline_failed" if step_kind == step_handlers.MUSIC_STEP_KIND else "step_failed"
        record_step_outcome(
            rid,
            step,
            {"ok": False, "reason_code": reason, "message": reason},
        )
        return {
            "ok": False,
            "reason": reason,
            "run_id": rid,
            "intent_kind": intent_kind,
            "step_kind": step_kind,
        }
    return {"ok": True, "run_id": rid, "intent_kind": intent_kind, "step_kind": step_kind}


def _first_incomplete_prior_step(steps: list[Mapping[str, Any]], *, target_index: int) -> int | None:
    """Return the lowest ``step_index`` still blocking ``target_index`` (strict ordering)."""

    done = frozenset({"completed", "skipped"})
    blocking: list[int] = []
    for step in steps:
        idx = int(step.get("step_index") or 0)
        if idx <= 0 or idx >= target_index:
            continue
        status = str(step.get("status") or "").strip().lower()
        if status not in done:
            blocking.append(idx)
    return min(blocking) if blocking else None


async def _fail_run(
    pool: asyncpg.Pool,
    *,
    run_id: str,
    principal_id: str,
    message: str,
    step: Mapping[str, Any] | None = None,
    run: Mapping[str, Any] | None = None,
) -> None:
    fail_payload = {"message": message[:500], "stage": "executor"}
    step_id = str((step or {}).get("id") or "").strip()
    if step_id:
        await companion_task_step_update(
            pool,
            step_id=step_id,
            status="failed",
            error_payload=fail_payload,
        )
        await step_handlers.publish_executor_step_event(
            principal_id=principal_id,
            run=run if run is not None else {"id": run_id},
            step=step or {"id": step_id},
            status="failed",
        )
    await companion_task_run_update(
        pool,
        run_id=run_id,
        principal_id=principal_id,
        status="failed",
        error_payload=fail_payload,
    )
