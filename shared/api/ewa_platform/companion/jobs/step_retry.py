# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Optional step-level retry for action workflow steps after transient failures (WF-4.2).
# Invariants:
# - Retries only when workflow step definition includes ``retry`` and error matches ``retry_on``.
# - Re-enqueues Celery with ``backoff_ms``; does not retry confirm gates or unknown steps.
# Related:
# - api/ewa_platform/companion/jobs/enqueue.py
# - api/ewa_platform/companion/jobs/executor.py
# ---

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

import asyncpg

from api.ewa_platform.companion.jobs.enqueue import enqueue_companion_run
from api.ewa_platform.companion.workflows.action.registry import get_builtin_workflow
from api.ewa_platform.persistence_pg.companion_asyncpg import (
    companion_task_run_update,
    companion_task_step_update,
    companion_task_steps_list,
)
from api.ewa_platform.schemas.pydantic.companion_workflow import (
    CompanionWorkflowStepRetryV1,
    CompanionWorkflowStepV1,
)

logger = logging.getLogger(__name__)


def _error_matches_retry_policy(
    error_payload: Mapping[str, Any],
    retry_on: tuple[str, ...],
) -> bool:
    if not retry_on:
        return False
    haystack = " ".join(
        [
            str(error_payload.get("stage") or ""),
            str(error_payload.get("message") or ""),
            str(error_payload.get("exception") or ""),
            str(error_payload.get("body_prefix") or ""),
            str(error_payload.get("http_status") or ""),
        ],
    ).lower()
    for token in retry_on:
        needle = str(token or "").strip().lower()
        if needle and needle in haystack:
            return True
    return False


def _resolve_workflow_step_def(
    run: Mapping[str, Any],
    step: Mapping[str, Any],
) -> CompanionWorkflowStepV1 | None:
    workflow_id = str(run.get("workflow_id") or "").strip()
    if not workflow_id:
        return None
    definition = get_builtin_workflow(workflow_id)
    if definition is None:
        return None
    input_payload = step.get("input_payload")
    step_key = ""
    if isinstance(input_payload, Mapping):
        step_key = str(input_payload.get("step_key") or "").strip()
    if not step_key:
        step_index = int(step.get("step_index") or 0)
        if 1 <= step_index <= len(definition.steps):
            return definition.steps[step_index - 1]
        return None
    for step_def in definition.steps:
        if step_def.step_key == step_key:
            return step_def
    return None


async def maybe_retry_failed_step(
    pool: asyncpg.Pool,
    *,
    run: Mapping[str, Any],
    step: Mapping[str, Any],
    job_payload: Mapping[str, Any],
) -> bool:
    """Schedule one Celery retry when step policy allows; return True if re-enqueued."""

    run_id = str(run.get("id") or "").strip()
    principal_id = str(run.get("principal_id") or "").strip()
    step_id = str(step.get("id") or "").strip()
    if not run_id or not principal_id or not step_id:
        return False
    if str(step.get("status") or "").strip().lower() != "failed":
        return False

    step_def = _resolve_workflow_step_def(run, step)
    if step_def is None or step_def.retry is None:
        return False
    retry_policy: CompanionWorkflowStepRetryV1 = step_def.retry

    error_raw = step.get("error_payload")
    error_payload = dict(error_raw) if isinstance(error_raw, Mapping) else {}
    if not _error_matches_retry_policy(error_payload, retry_policy.retry_on):
        return False

    input_raw = step.get("input_payload")
    input_payload = dict(input_raw) if isinstance(input_raw, Mapping) else {}
    attempt = int(input_payload.get("retry_attempt") or 0) + 1
    if attempt >= retry_policy.max_attempts:
        logger.info(
            "[STEP] companion_step_retry_exhausted run_id=%s step_id=%s attempt=%s max=%s",
            run_id,
            step_id,
            attempt,
            retry_policy.max_attempts,
        )
        return False

    input_payload["retry_attempt"] = attempt
    await companion_task_step_update(
        pool,
        step_id=step_id,
        status="pending",
        input_payload=input_payload,
        error_payload={},
    )
    await companion_task_run_update(
        pool,
        run_id=run_id,
        principal_id=principal_id,
        status="running",
        error_payload={},
    )

    countdown_sec = max(0, int(retry_policy.backoff_ms // 1000))
    step_index = int(step.get("step_index") or 0) or None
    celery_id = enqueue_companion_run(
        run_id=run_id,
        step_index=step_index,
        job_payload=dict(job_payload),
        countdown_sec=countdown_sec,
    )
    if celery_id is None:
        await companion_task_step_update(
            pool,
            step_id=step_id,
            status="failed",
            error_payload={"message": "companion_step_retry_enqueue_failed", "stage": "retry"},
        )
        await companion_task_run_update(
            pool,
            run_id=run_id,
            principal_id=principal_id,
            status="failed",
            error_payload={"message": "companion_step_retry_enqueue_failed", "stage": "retry"},
        )
        return False

    logger.info(
        "[STEP] companion_step_retry_scheduled run_id=%s step_id=%s attempt=%s celery_task_id=%s",
        run_id,
        step_id,
        attempt,
        celery_id,
    )
    return True


async def refresh_step_for_run(
    pool: asyncpg.Pool,
    *,
    run_id: str,
    step_id: str,
) -> dict[str, Any] | None:
    steps = await companion_task_steps_list(pool, run_id=run_id)
    for row in steps:
        if str(row.get("id") or "") == step_id:
            return row
    return None


__all__ = (
    "maybe_retry_failed_step",
    "refresh_step_for_run",
)
