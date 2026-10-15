# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Enqueue durable companion task runs onto Celery (``companion_run_task``).
# Invariants:
# - Returns ``None`` when async jobs disabled or broker enqueue fails (caller may fall back to in-process).
# - Celery payload must not include raw Bearer token; enqueue replaces it with short-lived opaque worker token.
# Related:
# - api/ewa_platform/workers/companion_task_runner.py
# ---

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

from api.ewa_platform.companion.jobs.config import companion_async_jobs_enabled
from api.ewa_platform.companion.jobs.worker_auth_token import (
    WORKER_AUTH_AUDIENCE,
    bearer_token_from_headers,
    issue_worker_auth_token_sync,
)
from api.monitoring.metrics import observe_ewa_companion_job_enqueue

logger = logging.getLogger(__name__)


def _observe_enqueue_outcome(outcome: str) -> None:
    observe_ewa_companion_job_enqueue(outcome=outcome)


def enqueue_companion_run(
    *,
    run_id: str,
    step_index: int | None = None,
    job_payload: Mapping[str, Any] | None = None,
    countdown_sec: int = 0,
) -> str | None:
    """Schedule ``companion_run_task``; return Celery task id or ``None`` on skip/failure."""

    rid = str(run_id or "").strip()
    if not rid:
        _observe_enqueue_outcome("skipped")
        return None
    if not companion_async_jobs_enabled():
        logger.info("[STEP] companion_job_enqueue_skipped run_id=%s reason=async_jobs_disabled", rid)
        _observe_enqueue_outcome("skipped")
        return None
    source_payload = dict(job_payload or {})
    source_payload.pop("worker_auth_token", None)
    source_payload.pop("worker_auth_audience", None)
    payload: dict[str, Any] = {}
    for key in ("idempotency_key", "request_id", "correlation_id"):
        value = source_payload.get(key)
        if value:
            payload[key] = str(value)
    headers_raw = source_payload.get("headers")
    headers = dict(headers_raw) if isinstance(headers_raw, Mapping) else {}
    bearer_token = bearer_token_from_headers(headers)
    if bearer_token:
        principal_id = str(source_payload.get("principal_id") or "").strip()
        if not principal_id:
            logger.warning(
                "[STEP] companion_job_enqueue_failed run_id=%s reason=missing_principal_for_worker_auth",
                rid,
            )
            _observe_enqueue_outcome("failed")
            return None
        worker_auth_token = issue_worker_auth_token_sync(
            run_id=rid,
            principal_id=principal_id,
            bearer_token=bearer_token,
            audience=WORKER_AUTH_AUDIENCE,
        )
        if not worker_auth_token:
            logger.warning(
                "[STEP] companion_job_enqueue_failed run_id=%s reason=worker_auth_issue_failed",
                rid,
            )
            _observe_enqueue_outcome("failed")
            return None
        payload["worker_auth_token"] = worker_auth_token
        payload["worker_auth_audience"] = WORKER_AUTH_AUDIENCE
        logger.info(
            "[STEP] companion_job_enqueue_worker_auth run_id=%s principal_id=%s audience=%s",
            rid,
            principal_id,
            WORKER_AUTH_AUDIENCE,
        )
    try:
        from api.ewa_platform.workers.companion_task_runner import companion_run_task

        kwargs = {
            "run_id": rid,
            "step_index": step_index,
            "job_payload": payload,
        }
        delay_sec = max(0, int(countdown_sec or 0))
        if delay_sec > 0:
            async_result = companion_run_task.apply_async(kwargs=kwargs, countdown=delay_sec, queue="ewa_companion")
        else:
            async_result = companion_run_task.apply_async(kwargs=kwargs, queue="ewa_companion")
        task_id = str(getattr(async_result, "id", "") or "").strip() or None
        logger.info(
            "[STEP] companion_job_enqueued run_id=%s step_index=%s celery_task_id=%s",
            rid,
            step_index,
            task_id or "?",
        )
        _observe_enqueue_outcome("enqueued")
        return task_id
    except Exception as exc:  # noqa: BLE001 — enqueue is best-effort; caller decides fallback
        logger.warning("[STEP] companion_job_enqueue_failed run_id=%s err=%s", rid, exc)
        _observe_enqueue_outcome("failed")
        return None
