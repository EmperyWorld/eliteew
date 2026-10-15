# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Durable PostgreSQL-backed worker loop for KBSEW ingestion jobs.
# Invariants:
# - Claims jobs through Postgres leases; no in-flight task is trusted after restart.
# - During execute_persisted_job, periodic heartbeats refresh locked_at; miss aborts work.
# - Terminal complete/fail/reschedule are CAS on status=running + locked_by.
# - Search path is not touched except auto-requeue of stale pipeline indexes.
# Related:
# - documentation/product/KBSEW.md
# ---

from __future__ import annotations

import asyncio
import json
import logging
import os
import socket
import time
from contextlib import suppress
from typing import Any

import api.services.barrel_service as barrel_service
import api.services.ingestion_service as ingestion_service
from api.core.config import get_settings
from api.core.ingest_errors import JobLeaseLostError, format_ingestion_error
from api.monitoring.metrics import (
    observe_ingest_failure,
    observe_ingest_success,
    set_active_jobs,
)

logger = logging.getLogger(__name__)

_worker_task: asyncio.Task[None] | None = None
_active_tasks: set[asyncio.Task[None]] = set()
_last_stale_pipeline_enqueue_at = 0.0
_STALE_PIPELINE_ENQUEUE_INTERVAL_SEC = 300.0
_STALE_PIPELINE_ENQUEUE_LIMIT = 50


def _worker_id() -> str:
    return f"{socket.gethostname()}:{os.getpid()}"


def _job_log(job: dict[str, Any], *, stage: str, status: str, message: str = "") -> None:
    payload = {
        "event": "kbsew_ingestion_worker",
        "trace_id": job.get("trace_id"),
        "job_id": str(job.get("id") or ""),
        "asset_id": str(job.get("asset_id") or ""),
        "barrel_id": str(job.get("barrel_id") or ""),
        "source_kind": str(job.get("source_kind") or "unknown"),
        "stage": stage,
        "status": status,
        "attempts": int(job.get("attempts") or 0),
        "max_attempts": int(job.get("max_attempts") or 0),
        "message": message[:500],
    }
    logger.info(json.dumps(payload, ensure_ascii=False, sort_keys=True))


def _retry_delay_seconds(attempts: int) -> float:
    return min(900.0, max(2.0, float(2 ** max(0, attempts - 1))))


async def recover_stale_jobs() -> int:
    settings = get_settings()
    recovered = await barrel_service.recover_stale_jobs(lease_timeout_seconds=settings.worker_lease_timeout_clamped)
    if recovered:
        logger.warning("[STEP] kbsew_ingestion_recovered_stale_jobs count=%s", recovered)
    return recovered


async def enqueue_stale_pipeline_reindexes(*, force: bool = False) -> dict[str, int]:
    """Periodically queue force-reindex for assets behind PIPELINE_VERSION."""

    global _last_stale_pipeline_enqueue_at  # noqa: PLW0603
    now = time.monotonic()
    if (
        not force
        and _last_stale_pipeline_enqueue_at > 0
        and (now - _last_stale_pipeline_enqueue_at) < _STALE_PIPELINE_ENQUEUE_INTERVAL_SEC
    ):
        return {"scanned": 0, "queued": 0, "skipped_active": 0, "failed": 0}
    _last_stale_pipeline_enqueue_at = now
    try:
        return await ingestion_service.enqueue_stale_pipeline_reindexes(limit=_STALE_PIPELINE_ENQUEUE_LIMIT)
    except Exception as exc:  # noqa: BLE001 — worker must keep polling jobs
        logger.warning("[STEP] kbsew_stale_pipeline_requeue_error reason=%r", exc)
        return {"scanned": 0, "queued": 0, "skipped_active": 0, "failed": 1}


async def _update_active_job_gauge() -> None:
    with suppress(Exception):
        set_active_jobs(await barrel_service.count_active_jobs())


async def _lease_heartbeat_loop(
    job_id: str,
    *,
    worker_id: str,
    interval_sec: float,
    lease_lost: asyncio.Event,
) -> None:
    while True:
        await asyncio.sleep(interval_sec)
        try:
            refreshed = await barrel_service.heartbeat_job_lease(job_id, worker_id=worker_id)
            if not refreshed:
                logger.warning(
                    "[STEP] kbsew_ingestion_heartbeat_miss job_id=%s worker_id=%s",
                    job_id,
                    worker_id,
                )
                lease_lost.set()
                return
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "[STEP] kbsew_ingestion_heartbeat_fail job_id=%s reason=%s",
                job_id,
                exc,
            )


async def _execute_while_holding_lease(
    job: dict[str, Any],
    *,
    lease_lost: asyncio.Event,
) -> int:
    """Run ingest; abort with JobLeaseLostError if the lease heartbeat fails."""
    execute_task = asyncio.create_task(ingestion_service.execute_persisted_job(job))
    lost_task = asyncio.create_task(lease_lost.wait())
    try:
        done, _pending = await asyncio.wait(
            {execute_task, lost_task},
            return_when=asyncio.FIRST_COMPLETED,
        )
        if lease_lost.is_set() and execute_task not in done:
            execute_task.cancel()
            with suppress(asyncio.CancelledError):
                await execute_task
            raise JobLeaseLostError(str(job["id"]), reason="heartbeat_miss")
        if execute_task.done():
            return int(execute_task.result())
        raise JobLeaseLostError(str(job["id"]), reason="heartbeat_miss")
    finally:
        if not lost_task.done():
            lost_task.cancel()
            with suppress(asyncio.CancelledError):
                await lost_task
        if not execute_task.done():
            execute_task.cancel()
            with suppress(asyncio.CancelledError):
                await execute_task


async def _process_claimed_job(job: dict[str, Any]) -> None:
    source_kind = str(job.get("source_kind") or "unknown")
    job_id = str(job["id"])
    asset_id = str(job.get("asset_id") or "")
    worker_id = str(job.get("locked_by") or _worker_id())
    heartbeat_task: asyncio.Task[None] | None = None
    lease_lost = asyncio.Event()
    interval = get_settings().worker_heartbeat_interval_clamped
    _job_log(job, stage="claimed", status="running")
    try:
        if interval > 0:
            heartbeat_task = asyncio.create_task(
                _lease_heartbeat_loop(
                    job_id,
                    worker_id=worker_id,
                    interval_sec=interval,
                    lease_lost=lease_lost,
                )
            )
            indexed = await _execute_while_holding_lease(job, lease_lost=lease_lost)
        else:
            indexed = await ingestion_service.execute_persisted_job(job)

        if lease_lost.is_set():
            raise JobLeaseLostError(job_id, reason="heartbeat_miss")

        won = await barrel_service.mark_job_completed(
            job_id,
            message=f"Indexed {indexed} chunks",
            worker_id=worker_id,
        )
        if not won:
            raise JobLeaseLostError(job_id, reason="complete_cas_miss")

        observe_ingest_success(source_kind)
        _job_log(
            job,
            stage="completed",
            status="completed",
            message=f"Indexed {indexed} chunks",
        )
    except JobLeaseLostError as exc:
        _job_log(
            job,
            stage="lease_lost",
            status="aborted",
            message=exc.reason,
        )
        logger.warning(
            "[STEP] kbsew_ingestion_lease_lost job_id=%s worker_id=%s reason=%s",
            job_id,
            worker_id,
            exc.reason,
        )
        return
    except asyncio.CancelledError:
        won = await barrel_service.reschedule_job(
            job_id,
            message="Worker shutdown requeue",
            delay_seconds=0,
            worker_id=worker_id,
        )
        if won:
            await barrel_service.update_asset(asset_id, status="pending", error_message="Worker shutdown requeue")
            _job_log(
                job,
                stage="shutdown",
                status="queued",
                message="Worker shutdown requeue",
            )
        else:
            _job_log(
                job,
                stage="shutdown",
                status="aborted",
                message="shutdown_cas_miss",
            )
        raise
    except Exception as exc:  # noqa: BLE001
        reason = format_ingestion_error(exc)
        attempts = int(job.get("attempts") or 1)
        max_attempts = int(job.get("max_attempts") or get_settings().worker_max_attempts_clamped)
        observe_ingest_failure(source_kind)
        if attempts >= max_attempts:
            won = await barrel_service.mark_job_failed(job_id, message=reason, worker_id=worker_id)
            if won:
                await barrel_service.update_asset(asset_id, status="failed", error_message=reason)
                _job_log(job, stage="failed", status="failed", message=reason)
            else:
                _job_log(
                    job,
                    stage="lease_lost",
                    status="aborted",
                    message="fail_cas_miss",
                )
            if won:
                logger.warning(
                    "[STEP] kbsew_ingestion_job_failed job_id=%s reason=%s",
                    job_id,
                    reason,
                    exc_info=True,
                )
            return
        delay = _retry_delay_seconds(attempts)
        won = await barrel_service.reschedule_job(
            job_id,
            message=f"Retry scheduled after failure: {reason}",
            delay_seconds=delay,
            worker_id=worker_id,
        )
        if won:
            await barrel_service.update_asset(asset_id, status="pending", error_message=reason)
            _job_log(
                job,
                stage="retry",
                status="queued",
                message=f"{reason}; retry_in={delay:.1f}s",
            )
            logger.warning(
                "[STEP] kbsew_ingestion_job_retry job_id=%s delay=%.1fs reason=%s",
                job_id,
                delay,
                reason,
            )
        else:
            _job_log(
                job,
                stage="lease_lost",
                status="aborted",
                message="retry_cas_miss",
            )
            logger.warning(
                "[STEP] kbsew_ingestion_lease_lost job_id=%s worker_id=%s reason=retry_cas_miss",
                job_id,
                worker_id,
            )
    finally:
        if heartbeat_task is not None:
            heartbeat_task.cancel()
            with suppress(asyncio.CancelledError):
                await heartbeat_task
        await _update_active_job_gauge()


async def _worker_loop() -> None:
    settings = get_settings()
    worker_id = _worker_id()
    concurrency = settings.worker_concurrency_clamped
    poll_interval = settings.worker_poll_interval_clamped
    logger.info(
        "[STEP] kbsew_ingestion_worker_started worker_id=%s concurrency=%s poll=%.2fs",
        worker_id,
        concurrency,
        poll_interval,
    )
    try:
        while True:
            await enqueue_stale_pipeline_reindexes(force=False)
            while len(_active_tasks) < concurrency:
                job = await barrel_service.claim_next_job(worker_id)
                if job is None:
                    break
                task = asyncio.create_task(_process_claimed_job(job))
                _active_tasks.add(task)
                task.add_done_callback(_active_tasks.discard)
            await _update_active_job_gauge()
            await asyncio.sleep(poll_interval)
    except asyncio.CancelledError:
        logger.info("[STEP] kbsew_ingestion_worker_stopping active=%s", len(_active_tasks))
        for task in list(_active_tasks):
            task.cancel()
        for task in list(_active_tasks):
            with suppress(asyncio.CancelledError):
                await task
        raise


async def start_ingestion_worker() -> asyncio.Task[None] | None:
    global _worker_task  # noqa: PLW0603
    settings = get_settings()
    if not settings.worker_enabled:
        logger.info("[STEP] kbsew_ingestion_worker_disabled")
        return None
    await recover_stale_jobs()
    await enqueue_stale_pipeline_reindexes(force=True)
    if _worker_task is None or _worker_task.done():
        _worker_task = asyncio.create_task(_worker_loop())
    return _worker_task


async def stop_ingestion_worker() -> None:
    global _worker_task  # noqa: PLW0603
    if _worker_task is None:
        return
    _worker_task.cancel()
    with suppress(asyncio.CancelledError):
        await _worker_task
    _worker_task = None
