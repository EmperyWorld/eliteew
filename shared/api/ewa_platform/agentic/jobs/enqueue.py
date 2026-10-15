# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Enqueue agentic loop ticks onto Celery queue ``ewa_agentic``.
# Invariants:
# - Returns None when async jobs disabled; caller may run sync tick in tests only.
# Related:
# - api/ewa_platform/workers/agentic_task_runner.py
# ---

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

from api.ewa_platform.agentic.config import agentic_async_jobs_enabled

logger = logging.getLogger(__name__)


def enqueue_agentic_loop_tick(
    *,
    session_id: str,
    principal_id: str,
    expected_revision: int | None = None,
    worker_payload: Mapping[str, Any] | None = None,
    countdown_sec: int = 0,
) -> str | None:
    sid = str(session_id or "").strip()
    pid = str(principal_id or "").strip()
    if not sid or not pid:
        return None
    if not agentic_async_jobs_enabled():
        logger.info("[STEP] agentic_job_enqueue_skipped session_id=%s reason=async_disabled", sid)
        return None

    payload: dict[str, Any] = {"principal_id": pid}
    if expected_revision is not None:
        payload["expected_revision"] = int(expected_revision)
    payload.update(dict(worker_payload or {}))

    try:
        from api.ewa_platform.workers.agentic_task_runner import agentic_loop_tick_task

        kwargs = {
            "session_id": sid,
            "job_payload": payload,
        }
        delay_sec = max(0, int(countdown_sec or 0))
        if delay_sec > 0:
            async_result = agentic_loop_tick_task.apply_async(kwargs=kwargs, countdown=delay_sec, queue="ewa_agentic")
        else:
            async_result = agentic_loop_tick_task.apply_async(kwargs=kwargs, queue="ewa_agentic")
        task_id = str(getattr(async_result, "id", "") or "").strip() or None
        logger.info(
            "[STEP] agentic_job_enqueued session_id=%s revision=%s celery_task_id=%s",
            sid,
            expected_revision,
            task_id,
        )
        return task_id
    except Exception as exc:  # noqa: BLE001
        logger.warning("[STEP] agentic_job_enqueue_failed session_id=%s err=%s", sid, exc)
        return None


def enqueue_agentic_step(
    *,
    session_id: str,
    principal_id: str,
    worker_payload: Mapping[str, Any] | None = None,
    countdown_sec: int = 0,
) -> str | None:
    """Schedule one scheduler-owned agentic step task."""

    sid = str(session_id or "").strip()
    pid = str(principal_id or "").strip()
    if not sid or not pid:
        return None
    if not agentic_async_jobs_enabled():
        logger.info("[STEP] agentic_step_enqueue_skipped session_id=%s reason=async_disabled", sid)
        return None

    payload: dict[str, Any] = {"principal_id": pid}
    payload.update(dict(worker_payload or {}))

    try:
        from api.ewa_platform.workers.agentic_step_runner import agentic_step_task

        kwargs = {
            "session_id": sid,
            "job_payload": payload,
        }
        delay_sec = max(0, int(countdown_sec or 0))
        if delay_sec > 0:
            async_result = agentic_step_task.apply_async(kwargs=kwargs, countdown=delay_sec, queue="ewa_agentic_step")
        else:
            async_result = agentic_step_task.apply_async(kwargs=kwargs, queue="ewa_agentic_step")
        task_id = str(getattr(async_result, "id", "") or "").strip() or None
        logger.info("[STEP] agentic_step_enqueued session_id=%s celery_task_id=%s", sid, task_id or "?")
        return task_id
    except Exception as exc:  # noqa: BLE001
        logger.warning("[STEP] agentic_step_enqueue_failed session_id=%s err=%s", sid, exc)
        return None
