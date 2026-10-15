# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Durable lifecycle job and worker heartbeat helpers for Site Studio runtimes.
# Keeps task status, stage evidence, and worker readiness queryable by API/UI without ORM coupling.
# Invariants:
# - Public storefront/admin routing is not decided here; this module only records lifecycle evidence.
# - Timestamps are UTC naive via datetime_helpers.
# - Startup preflight may fail the API when queued Site Studio runtime actions require a fresh worker heartbeat.
# Related:
# - api/routers/desktop_sites.py
# - api/routers/kirs.py
# - api/services/site_studio_runtime_service.py
# ---
from __future__ import annotations

import asyncio
import json
import os
import socket
import time
from contextlib import suppress
from datetime import datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import text  # type: ignore[import-not-found]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.utils.datetime_helpers import utc_now_naive

SITE_STUDIO_QUEUE_NAME = "site_studio"
SITE_STUDIO_PENDING_JOB_STATUSES = {"created", "queued", "running"}
SITE_STUDIO_WORKER_READY_WINDOW_SECONDS = int(
    (os.environ.get("SITE_STUDIO_WORKER_READY_WINDOW_SECONDS") or "180").strip() or "180"
)
SITE_STUDIO_STALE_JOB_SECONDS = int((os.environ.get("SITE_STUDIO_STALE_JOB_SECONDS") or "900").strip() or "900")
SITE_STUDIO_STARTUP_PREFLIGHT_ENV = "ELITEEW_REQUIRE_SITE_STUDIO_WORKER_AT_STARTUP"
SITE_STUDIO_QUEUE_ENABLED_ENV = "ENABLE_QUEUE_SITE_STUDIO"
SITE_STUDIO_INLINE_FALLBACK_ENV = "ELITEEW_SITE_STUDIO_ALLOW_INLINE_FALLBACK"
SITE_STUDIO_STARTUP_WAIT_SECONDS_ENV = "STACK0_SITE_STUDIO_STARTUP_WAIT_SECONDS"
SITE_STUDIO_STARTUP_POLL_SECONDS_ENV = "STACK0_SITE_STUDIO_STARTUP_POLL_SECONDS"


def _env_bool(name: str, *, default: bool = False) -> bool:
    raw = (os.environ.get(name) or "").strip().lower()
    if not raw:
        return default
    return raw in {"1", "true", "yes", "on"}


def _positive_int_env(name: str, default: int) -> int:
    raw = (os.environ.get(name) or "").strip()
    if not raw:
        return default
    return max(1, int(raw))


def site_studio_startup_preflight_required() -> bool:
    """Return whether API startup must fail when the Site Studio worker is not ready."""
    if not _env_bool(SITE_STUDIO_STARTUP_PREFLIGHT_ENV, default=False):
        return False
    if not _env_bool(SITE_STUDIO_QUEUE_ENABLED_ENV, default=True):
        return False
    return not _env_bool(SITE_STUDIO_INLINE_FALLBACK_ENV, default=False)


def build_site_studio_worker_startup_error(readiness: dict[str, Any] | None = None) -> str:
    worker_id = readiness.get("worker_id") if readiness else None
    age = readiness.get("worker_last_seen_age_seconds") if readiness else None
    window = readiness.get("worker_ready_window_seconds") if readiness else SITE_STUDIO_WORKER_READY_WINDOW_SECONDS
    last_seen = readiness.get("worker_last_seen_at") if readiness else None
    if worker_id:
        observed = f"worker_id={worker_id}, last_seen_at={last_seen}, age_seconds={age}, window_seconds={window}"
    else:
        observed = f"no heartbeat row for queue_name={SITE_STUDIO_QUEUE_NAME}, window_seconds={window}"
    return (
        "Site Studio startup preflight failed: worker heartbeat is not ready "
        f"({observed}). Start stack0-backend with profile site-studio-worker "
        "or disable ELITEEW_REQUIRE_SITE_STUDIO_WORKER_AT_STARTUP only for an intentional maintenance window."
    )


def resolve_site_studio_worker_id() -> str:
    configured = (os.environ.get("SITE_STUDIO_WORKER_ID") or "").strip()
    if configured:
        return configured[:160]
    hostname = (os.environ.get("HOSTNAME") or socket.gethostname() or "site-studio-worker").strip()
    return hostname[:160]


def _normalize_scope(instance_scope: str | None) -> str:
    normalized = (instance_scope or "user").strip().lower()
    return "project" if normalized == "project" else "user"


def _row_to_dict(row: Any) -> dict[str, Any] | None:
    if row is None:
        return None
    data = dict(row)
    metadata = data.get("metadata_json")
    data["metadata_json"] = metadata if isinstance(metadata, dict) else {}
    return data


def _jsonb_param(value: dict[str, Any] | None) -> str:
    return json.dumps(value or {}, ensure_ascii=False, default=str)


async def create_lifecycle_job(
    db: AsyncSession,
    *,
    instance: Any,
    instance_scope: str,
    task_type: str,
    metadata: dict[str, Any] | None = None,
) -> UUID:
    job_id = uuid4()
    await db.execute(
        text(
            """
            INSERT INTO site_studio_lifecycle_jobs (
                id, instance_scope, instance_id, site_slug, task_type, status, stage, metadata_json
            )
            VALUES (
                :id, :instance_scope, :instance_id, :site_slug, :task_type, 'created', 'accepted', :metadata_json
            )
            """
        ),
        {
            "id": str(job_id),
            "instance_scope": _normalize_scope(instance_scope),
            "instance_id": str(instance.id),
            "site_slug": str(getattr(instance, "site_slug", "") or ""),
            "task_type": task_type,
            "metadata_json": _jsonb_param(metadata),
        },
    )
    return job_id


async def mark_lifecycle_job_queued(db: AsyncSession, job_id: UUID | str, *, queued: bool = True) -> None:
    await db.execute(
        text(
            """
            UPDATE site_studio_lifecycle_jobs
            SET status = :status,
                queued = :queued,
                queued_at = COALESCE(queued_at, :now),
                stage = :stage,
                updated_at = :now
            WHERE id = :job_id
            """
        ),
        {
            "job_id": str(job_id),
            "status": "queued" if queued else "running",
            "queued": queued,
            "stage": "queued" if queued else "inline",
            "now": utc_now_naive(),
        },
    )


async def mark_lifecycle_job_running(
    db: AsyncSession,
    job_id: UUID | str | None,
    *,
    worker_id: str,
    stage: str = "worker_started",
) -> None:
    if not job_id:
        return
    await db.execute(
        text(
            """
            UPDATE site_studio_lifecycle_jobs
            SET status = 'running',
                stage = :stage,
                worker_id = :worker_id,
                attempts = attempts + 1,
                started_at = COALESCE(started_at, :now),
                updated_at = :now
            WHERE id = :job_id
            """
        ),
        {"job_id": str(job_id), "stage": stage, "worker_id": worker_id, "now": utc_now_naive()},
    )


async def mark_lifecycle_job_stage(
    db: AsyncSession,
    job_id: UUID | str | None,
    *,
    stage: str,
    metadata: dict[str, Any] | None = None,
) -> None:
    if not job_id:
        return
    await db.execute(
        text(
            """
            UPDATE site_studio_lifecycle_jobs
            SET stage = :stage,
                metadata_json = metadata_json || CAST(:metadata_json AS jsonb),
                updated_at = :now
            WHERE id = :job_id
            """
        ),
        {"job_id": str(job_id), "stage": stage, "metadata_json": _jsonb_param(metadata), "now": utc_now_naive()},
    )


async def mark_lifecycle_job_succeeded(
    db: AsyncSession,
    job_id: UUID | str | None,
    *,
    stage: str = "succeeded",
    duration_ms: int | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    if not job_id:
        return
    await db.execute(
        text(
            """
            UPDATE site_studio_lifecycle_jobs
            SET status = 'succeeded',
                stage = :stage,
                last_error = NULL,
                finished_at = :now,
                updated_at = :now,
                duration_ms = :duration_ms,
                metadata_json = metadata_json || CAST(:metadata_json AS jsonb)
            WHERE id = :job_id
            """
        ),
        {
            "job_id": str(job_id),
            "stage": stage,
            "duration_ms": duration_ms,
            "metadata_json": _jsonb_param(metadata),
            "now": utc_now_naive(),
        },
    )
    with suppress(Exception):
        from api.monitoring.metrics import observe_site_studio_lifecycle_job

        observe_site_studio_lifecycle_job(task_type="site_studio", status="succeeded", duration_ms=duration_ms)


async def mark_lifecycle_job_failed(
    db: AsyncSession,
    job_id: UUID | str | None,
    *,
    stage: str,
    error: str,
    duration_ms: int | None = None,
) -> None:
    if not job_id:
        return
    await db.execute(
        text(
            """
            UPDATE site_studio_lifecycle_jobs
            SET status = 'failed',
                stage = :stage,
                last_error = :error,
                finished_at = :now,
                updated_at = :now,
                duration_ms = :duration_ms
            WHERE id = :job_id
            """
        ),
        {
            "job_id": str(job_id),
            "stage": stage,
            "error": error[:2000],
            "duration_ms": duration_ms,
            "now": utc_now_naive(),
        },
    )
    with suppress(Exception):
        from api.monitoring.metrics import observe_site_studio_lifecycle_job

        observe_site_studio_lifecycle_job(task_type="site_studio", status="failed", duration_ms=duration_ms)


async def record_worker_heartbeat(
    db: AsyncSession,
    *,
    worker_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> str:
    resolved_worker_id = (worker_id or resolve_site_studio_worker_id()).strip()[:160]
    await db.execute(
        text(
            """
            INSERT INTO site_studio_worker_heartbeats (worker_id, queue_name, last_seen_at, metadata_json, updated_at)
            VALUES (:worker_id, :queue_name, :now, :metadata_json, :now)
            ON CONFLICT (worker_id) DO UPDATE
            SET queue_name = EXCLUDED.queue_name,
                last_seen_at = EXCLUDED.last_seen_at,
                metadata_json = EXCLUDED.metadata_json,
                updated_at = EXCLUDED.updated_at
            """
        ),
        {
            "worker_id": resolved_worker_id,
            "queue_name": SITE_STUDIO_QUEUE_NAME,
            "metadata_json": _jsonb_param(metadata),
            "now": utc_now_naive(),
        },
    )
    return resolved_worker_id


async def get_worker_readiness(db: AsyncSession) -> dict[str, Any]:
    row = (
        (
            await db.execute(
                text(
                    """
                    SELECT worker_id, queue_name, last_seen_at, metadata_json, updated_at
                    FROM site_studio_worker_heartbeats
                    WHERE queue_name = :queue_name
                    ORDER BY last_seen_at DESC
                    LIMIT 1
                    """
                ),
                {"queue_name": SITE_STUDIO_QUEUE_NAME},
            )
        )
        .mappings()
        .first()
    )
    data = _row_to_dict(row)
    now = utc_now_naive()
    last_seen_at = data.get("last_seen_at") if data else None
    age_seconds: int | None = None
    ready = False
    if isinstance(last_seen_at, datetime):
        age_seconds = max(0, int((now - last_seen_at).total_seconds()))
        ready = age_seconds <= SITE_STUDIO_WORKER_READY_WINDOW_SECONDS
    with suppress(Exception):
        from api.monitoring.metrics import set_site_studio_worker_ready

        set_site_studio_worker_ready(ready=ready)
    return {
        "worker_ready": ready,
        "worker_id": data.get("worker_id") if data else None,
        "worker_last_seen_at": last_seen_at,
        "worker_last_seen_age_seconds": age_seconds,
        "worker_ready_window_seconds": SITE_STUDIO_WORKER_READY_WINDOW_SECONDS,
    }


async def require_site_studio_worker_ready_at_startup(db: AsyncSession) -> dict[str, Any] | None:
    """Fail-fast guard for API startup when queued Site Studio runtime actions are enabled."""
    if not site_studio_startup_preflight_required():
        return None
    readiness = await get_worker_readiness(db)
    if not readiness["worker_ready"]:
        raise RuntimeError(build_site_studio_worker_startup_error(readiness))
    return readiness


async def wait_for_site_studio_worker_ready_at_startup(db: AsyncSession) -> dict[str, Any] | None:
    """Poll worker heartbeat until ready or startup wait budget expires."""
    if not site_studio_startup_preflight_required():
        return None
    wait_seconds = _positive_int_env(SITE_STUDIO_STARTUP_WAIT_SECONDS_ENV, 90)
    poll_seconds = _positive_int_env(SITE_STUDIO_STARTUP_POLL_SECONDS_ENV, 5)
    deadline = time.monotonic() + wait_seconds
    last_readiness: dict[str, Any] | None = None
    while True:
        readiness = await get_worker_readiness(db)
        if readiness["worker_ready"]:
            return readiness
        last_readiness = readiness
        if time.monotonic() >= deadline:
            raise RuntimeError(build_site_studio_worker_startup_error(last_readiness))
        await asyncio.sleep(poll_seconds)


async def get_lifecycle_diagnostics(
    db: AsyncSession,
    *,
    instance_scope: str,
    instance_id: UUID | str,
) -> dict[str, Any]:
    params = {"instance_scope": _normalize_scope(instance_scope), "instance_id": str(instance_id)}
    last_job = (
        (
            await db.execute(
                text(
                    """
                    SELECT *
                    FROM site_studio_lifecycle_jobs
                    WHERE instance_scope = :instance_scope
                      AND instance_id = :instance_id
                    ORDER BY created_at DESC
                    LIMIT 1
                    """
                ),
                params,
            )
        )
        .mappings()
        .first()
    )
    pending_job = (
        (
            await db.execute(
                text(
                    """
                    SELECT *
                    FROM site_studio_lifecycle_jobs
                    WHERE instance_scope = :instance_scope
                      AND instance_id = :instance_id
                      AND status IN ('created', 'queued', 'running')
                    ORDER BY created_at DESC
                    LIMIT 1
                    """
                ),
                params,
            )
        )
        .mappings()
        .first()
    )
    worker = await get_worker_readiness(db)
    return {
        **worker,
        "last_job": _row_to_dict(last_job),
        "pending_job": _row_to_dict(pending_job),
    }


async def get_lifecycle_job(
    db: AsyncSession,
    *,
    job_id: UUID | str,
    instance_scope: str,
    instance_id: UUID | str,
) -> dict[str, Any] | None:
    row = (
        (
            await db.execute(
                text(
                    """
                    SELECT *
                    FROM site_studio_lifecycle_jobs
                    WHERE id = :job_id
                      AND instance_scope = :instance_scope
                      AND instance_id = :instance_id
                    """
                ),
                {
                    "job_id": str(job_id),
                    "instance_scope": _normalize_scope(instance_scope),
                    "instance_id": str(instance_id),
                },
            )
        )
        .mappings()
        .first()
    )
    return _row_to_dict(row)


async def cancel_lifecycle_job(
    db: AsyncSession,
    *,
    job_id: UUID | str,
    instance_scope: str,
    instance_id: UUID | str,
    reason: str = "cancelled_by_operator",
) -> dict[str, Any] | None:
    row = (
        (
            await db.execute(
                text(
                    """
                    UPDATE site_studio_lifecycle_jobs
                    SET status = 'cancelled',
                        stage = :reason,
                        finished_at = :now,
                        updated_at = :now
                    WHERE id = :job_id
                      AND instance_scope = :instance_scope
                      AND instance_id = :instance_id
                      AND status IN ('created', 'queued', 'running')
                    RETURNING *
                    """
                ),
                {
                    "job_id": str(job_id),
                    "instance_scope": _normalize_scope(instance_scope),
                    "instance_id": str(instance_id),
                    "reason": reason,
                    "now": utc_now_naive(),
                },
            )
        )
        .mappings()
        .first()
    )
    return _row_to_dict(row)


async def reap_stale_lifecycle_jobs(db: AsyncSession) -> int:
    worker = await get_worker_readiness(db)
    if worker["worker_ready"]:
        return 0
    now = utc_now_naive()
    cutoff = now - timedelta(seconds=SITE_STUDIO_STALE_JOB_SECONDS)
    result = await db.execute(
        text(
            """
            UPDATE site_studio_lifecycle_jobs
            SET status = 'failed',
                stage = 'stale_worker_heartbeat',
                last_error = :error,
                finished_at = :now,
                updated_at = :now
            WHERE status IN ('created', 'queued', 'running')
              AND updated_at < :cutoff
            """
        ),
        {
            "error": "Site Studio worker heartbeat expired while job was pending",
            "now": now,
            "cutoff": cutoff,
        },
    )
    return int(getattr(result, "rowcount", 0) or 0)
