# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Celery task registration for scheduler-owned agentic steps (queue ``ewa_agentic_step``).
# Invariants:
# - One task executes at most one durable step; no Think loop is run here.
# - Gate G1: IntegrityError / schema faults are non-retryable; session is terminalized.
# - SoftTimeLimitExceeded uses structured recovery (no blind Celery retry storm).
# Related:
# - api/ewa_platform/agentic/jobs/step_executor.py
# - api/ewa_platform/agentic/jobs/reliability.py
# - documentation/product/ewa/EWA-COMPANION-STABILITY-PERF-CONTRACT.md
# ---

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

from api.core.celery_async import run_celery_async
from api.ewa_platform.agentic.config import (
    agentic_step_soft_time_limit_sec,
    agentic_step_time_limit_sec,
)
from api.ewa_platform.agentic.jobs.reliability import (
    is_agentic_celery_soft_timeout,
    is_nonretryable_agentic_error,
    terminalize_session_nonretryable,
)
from api.ewa_platform.agentic.jobs.step_executor import (
    execute_agentic_step,
    recover_agentic_step_soft_timeout,
)
from api.ewa_platform.workers.ewa_pool import open_initialized_ewa_worker_pool
from api.ewa_platform.workers.orchestration_tasks import EwaOrchestrationTaskSpec
from api.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


async def _terminalize_step_nonretryable(
    *,
    session_id: str,
    job_payload: Mapping[str, Any],
    exc: BaseException,
) -> dict[str, Any]:
    sid = str(session_id or "").strip()
    principal_id = str(job_payload.get("principal_id") or "").strip()
    if not sid or not principal_id:
        return {
            "ok": False,
            "reason": "nonretryable_missing_ids",
            "session_id": sid,
            "error": str(exc)[:500],
        }
    try:
        pool = await open_initialized_ewa_worker_pool(min_size=1, max_size=2)
    except RuntimeError:
        logger.error(
            "[STEP] agentic_step_terminalize_skip reason=EWA_DATABASE_URL_unset session_id=%s",
            sid,
        )
        return {"ok": False, "reason": "EWA_DATABASE_URL_unset", "session_id": sid}
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
        "status": (session or {}).get("status"),
        "error": str(exc)[:500],
    }


@celery_app.task(
    name=EwaOrchestrationTaskSpec.AGENTIC_STEP_TASK.value,
    bind=True,
    max_retries=3,
    soft_time_limit=agentic_step_soft_time_limit_sec(),
    time_limit=agentic_step_time_limit_sec(),
    acks_late=True,
    reject_on_worker_lost=True,
)
def agentic_step_task(
    self: Any,
    *,
    session_id: str,
    job_payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Execute one scheduler-owned agentic step."""

    payload = dict(job_payload) if isinstance(job_payload, Mapping) else {}
    try:
        return run_celery_async(
            execute_agentic_step(
                session_id=str(session_id or ""),
                job_payload=payload,
            ),
        )
    except Exception as exc:  # noqa: BLE001
        if is_agentic_celery_soft_timeout(exc):
            logger.warning(
                "[STEP] agentic_step_soft_timeout session_id=%s err=%s action=structured_recovery",
                session_id,
                exc,
            )
            return run_celery_async(
                recover_agentic_step_soft_timeout(
                    session_id=str(session_id or ""),
                    principal_id=str(payload.get("principal_id") or ""),
                    node_id=str(payload.get("node_id") or "") or None,
                    job_payload=payload,
                ),
            )
        logger.exception("[STEP] agentic_step_task_failed session_id=%s err=%s", session_id, exc)
        if is_nonretryable_agentic_error(exc):
            logger.error(
                "[STEP] agentic_step_nonretryable session_id=%s err=%s action=terminalize",
                session_id,
                exc,
            )
            return run_celery_async(
                _terminalize_step_nonretryable(
                    session_id=str(session_id or ""),
                    job_payload=payload,
                    exc=exc,
                ),
            )
        raise self.retry(
            exc=exc,
            countdown=min(60, 2 ** int(getattr(self.request, "retries", 0) or 0)),
        ) from exc
