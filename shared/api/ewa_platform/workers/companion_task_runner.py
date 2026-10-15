# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Celery entry for durable companion task run execution (Phase 1 job skeleton + music migration).
# Invariants:
# - Task name equals ``EwaOrchestrationTaskSpec.COMPANION_RUN_TASK``.
# - Worker resolves opaque auth token to Bearer at execution time; raw Bearer must not ride queue payload.
# - Legacy Bearer in queue payload is hard-rejected (``worker_auth_error=legacy_bearer_rejected``).
# Related:
# - api/ewa_platform/companion/jobs/executor.py
# - api/ewa_platform/workers/orchestration_tasks.py
# ---

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

from api.core.celery_async import run_celery_async
from api.ewa_platform.companion.jobs.executor import execute_companion_run
from api.ewa_platform.companion.jobs.worker_auth_token import (
    WORKER_AUTH_AUDIENCE,
    bearer_token_from_headers,
    consume_worker_auth_token_sync,
)
from api.ewa_platform.workers.orchestration_tasks import EwaOrchestrationTaskSpec
from api.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


def _resolve_worker_auth_payload(run_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Resolve queue-safe auth token to Bearer for runtime HTTP calls."""

    resolved = dict(payload)
    token_ref = str(resolved.get("worker_auth_token") or "").strip()
    audience = str(resolved.get("worker_auth_audience") or WORKER_AUTH_AUDIENCE).strip() or WORKER_AUTH_AUDIENCE
    principal_id = str(resolved.get("principal_id") or "").strip()
    if token_ref and principal_id:
        snapshot = consume_worker_auth_token_sync(
            token_ref=token_ref,
            run_id=str(run_id or "").strip(),
            principal_id=principal_id,
            audience=audience,
        )
        resolved.pop("worker_auth_token", None)
        resolved.pop("worker_auth_audience", None)
        if snapshot is None:
            resolved["worker_auth_error"] = "token_invalid_or_expired"
            logger.warning(
                "[STEP] companion_worker_auth_consume_failed run_id=%s principal_id=%s audience=%s",
                run_id,
                principal_id,
                audience,
            )
            return resolved
        resolved["headers"] = {"Authorization": f"Bearer {snapshot.bearer_token}"}
        logger.info(
            "[STEP] companion_worker_auth_resolved run_id=%s principal_id=%s audience=%s",
            run_id,
            principal_id,
            audience,
        )
        return resolved

    if bearer_token_from_headers(resolved.get("headers")):
        logger.warning(
            "[STEP] companion_worker_auth_legacy_payload_detected run_id=%s principal_id=%s",
            run_id,
            principal_id or "?",
        )
        resolved.pop("headers", None)
        resolved["worker_auth_error"] = "legacy_bearer_rejected"
    return resolved


@celery_app.task(
    name=EwaOrchestrationTaskSpec.COMPANION_RUN_TASK.value,
    bind=True,
    max_retries=3,
)
def companion_run_task(
    self: Any,
    *,
    run_id: str,
    step_index: int | None = None,
    job_payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Execute one or all pending steps for a companion task run."""

    raw_payload: dict[str, Any] = dict(job_payload) if isinstance(job_payload, Mapping) else {}
    resolved_payload = _resolve_worker_auth_payload(str(run_id or ""), raw_payload)
    try:
        return run_celery_async(
            execute_companion_run(
                run_id=str(run_id or ""),
                step_index=step_index,
                job_payload=resolved_payload,
            ),
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception(
            "[STEP] companion_run_task_failed run_id=%s step_index=%s err=%s",
            run_id,
            step_index,
            exc,
        )
        raise self.retry(exc=exc, countdown=min(60, 2 ** int(getattr(self.request, "retries", 0) or 0))) from exc
