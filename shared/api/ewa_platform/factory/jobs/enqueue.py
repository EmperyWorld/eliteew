# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Enqueue factory Intention ticks onto Celery queue ``ewa_factory``.
# Invariants:
# - Returns None when ELITEEW_FACTORY_ASYNC_JOBS is off; caller uses sync tick.
# - Never raises to Admin request path — log + None on broker failure.
# Related:
# - api/ewa_platform/workers/factory_task_runner.py
# - documentation/platform/docker-re_doc/ADMIN-FACTORY-OPS.md
# ---

from __future__ import annotations

import logging

from api.ewa_platform.factory.config import factory_async_jobs_enabled, factory_enabled

logger = logging.getLogger(__name__)

FACTORY_CELERY_QUEUE = "ewa_factory"


def enqueue_factory_tick(
    *,
    intention_id: str,
    verify_passed: bool = True,
    remaining_ticks: int = 1,
    countdown_sec: int = 0,
) -> str | None:
    """Schedule one factory tick (optionally chained via remaining_ticks)."""

    iid = str(intention_id or "").strip()
    if not iid:
        return None
    if not factory_enabled() or not factory_async_jobs_enabled():
        logger.info(
            "[STEP] factory_job_enqueue_skipped intention_id=%s reason=async_disabled",
            iid,
        )
        return None

    rem = max(1, int(remaining_ticks or 1))
    try:
        from api.ewa_platform.workers.factory_task_runner import factory_intention_tick_task

        kwargs = {
            "intention_id": iid,
            "verify_passed": bool(verify_passed),
            "remaining_ticks": rem,
        }
        delay_sec = max(0, int(countdown_sec or 0))
        if delay_sec > 0:
            async_result = factory_intention_tick_task.apply_async(
                kwargs=kwargs,
                countdown=delay_sec,
                queue=FACTORY_CELERY_QUEUE,
            )
        else:
            async_result = factory_intention_tick_task.apply_async(
                kwargs=kwargs,
                queue=FACTORY_CELERY_QUEUE,
            )
        task_id = str(getattr(async_result, "id", "") or "").strip() or None
        logger.info(
            "[STEP] factory_job_enqueued intention_id=%s remaining=%s celery_task_id=%s",
            iid,
            rem,
            task_id,
        )
        return task_id
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "[STEP] factory_job_enqueue_failed intention_id=%s err=%s",
            iid,
            exc,
        )
        return None
