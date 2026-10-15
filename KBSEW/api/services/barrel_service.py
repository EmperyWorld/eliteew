# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# PostgreSQL persistence for KBSEW barrels, assets, and ingestion jobs.
# Invariants:
# - Worker lease heartbeats refresh locked_at without changing status.
# - Terminal job transitions (complete/fail/reschedule) are CAS on status=running + locked_by.
# - enqueue_job: asset FOR UPDATE + ≤1 queued|running job per asset (DB unique + reuse).
# - Progress updates (touch_job_progress) are CAS on running + locked_by.
# - Asset lineage lookups: idempotency_key and content_sha256.
# - Barrel list/status expose latest active_revision summary for admin FE badges.
# - Barrel status active_jobs include trace_id; completed_jobs are recent terminal jobs.
# - jsonb binds pass dict (pool codecs); row reads coerce metadata/payload via json_codec.
# Related:
# - api/services/ingestion_worker.py
# - api/services/revision_service.py
# - api/core/json_codec.py
# ---

from __future__ import annotations

import logging
import uuid
from typing import Any

import asyncpg

import api.services.revision_service as revision_service
from api.core.config import get_settings
from api.core.database import connection
from api.core.json_codec import coerce_record_json_objects
from api.drivers.registry import get_driver, list_driver_types
from api.services.barrel_revision_api import revision_summary_fields
from api.services.qdrant_store import collection_name_for_barrel, delete_collection

logger = logging.getLogger(__name__)


def _jsonb_value(value: dict[str, Any] | None) -> dict[str, Any]:
    """Bind value for ``::jsonb`` params (pool registers json/jsonb codecs)."""
    return value or {}


def _record_to_dict(row: asyncpg.Record) -> dict[str, Any]:
    """Convert asyncpg.Record to dict; coerce jsonb object columns defensively."""
    return coerce_record_json_objects({str(key): value for key, value in row.items()})


def _row_dict(row: asyncpg.Record | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return _record_to_dict(row)


async def create_barrel(
    *,
    name: str,
    description: str | None,
    driver_type: str,
    enabled: bool,
) -> dict[str, Any]:
    driver_key = driver_type.strip().lower()
    if driver_key not in list_driver_types():
        raise ValueError(f"Unsupported driver_type: {driver_type!r}")
    barrel_id = str(uuid.uuid4())
    collection = collection_name_for_barrel(barrel_id)
    async with connection() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO kbsew.barrels (id, name, description, driver_type, enabled, qdrant_collection)
            VALUES ($1::uuid, $2, $3, $4, $5, $6)
            RETURNING id, name, description, driver_type, enabled, qdrant_collection, created_at, updated_at
            """,
            barrel_id,
            name,
            description,
            driver_key,
            enabled,
            collection,
        )
    logger.info("[STEP] kbsew_barrel_created id=%s driver=%s", barrel_id, driver_key)
    if row is None:
        raise RuntimeError("kbsew barrel insert returned no row")
    return _record_to_dict(row)


async def delete_barrel(barrel_id: str) -> bool:
    async with connection() as conn:
        row = await conn.fetchrow(
            "SELECT qdrant_collection FROM kbsew.barrels WHERE id = $1::uuid",
            barrel_id,
        )
        if row is None:
            return False
        await conn.execute("DELETE FROM kbsew.barrels WHERE id = $1::uuid", barrel_id)
    await delete_collection(str(row["qdrant_collection"]))
    logger.info("[STEP] kbsew_barrel_deleted id=%s", barrel_id)
    return True


async def get_barrel(barrel_id: str) -> dict[str, Any] | None:
    async with connection() as conn:
        row = await conn.fetchrow(
            """
            SELECT b.id, b.name, b.description, b.driver_type, b.enabled, b.qdrant_collection,
                   b.created_at, b.updated_at,
                   (SELECT COUNT(*)::int FROM kbsew.assets a WHERE a.barrel_id = b.id) AS asset_count
            FROM kbsew.barrels b
            WHERE b.id = $1::uuid
            """,
            barrel_id,
        )
    return _row_dict(row)


async def list_barrels() -> list[dict[str, Any]]:
    async with connection() as conn:
        rows = await conn.fetch(
            """
            SELECT b.id, b.name, b.description, b.driver_type, b.enabled, b.qdrant_collection,
                   b.created_at, b.updated_at,
                   (SELECT COUNT(*)::int FROM kbsew.assets a WHERE a.barrel_id = b.id) AS asset_count,
                   rev.active_revision_id,
                   rev.content_sha256 AS revision_content_sha256,
                   rev.indexed_at AS revision_indexed_at,
                   rev.chunk_count AS revision_chunk_count
            FROM kbsew.barrels b
            LEFT JOIN LATERAL (
                SELECT r.id AS active_revision_id, r.content_sha256, r.indexed_at, r.chunk_count
                FROM kbsew.assets a
                JOIN kbsew.asset_revisions r ON r.id = a.active_revision_id
                WHERE a.barrel_id = b.id
                ORDER BY r.indexed_at DESC
                LIMIT 1
            ) rev ON TRUE
            ORDER BY b.created_at DESC
            """
        )
    out: list[dict[str, Any]] = []
    for row in rows:
        item = _record_to_dict(row)
        rev_id = item.pop("active_revision_id", None)
        sha = item.pop("revision_content_sha256", None)
        indexed_at = item.pop("revision_indexed_at", None)
        chunk_count = item.pop("revision_chunk_count", None)
        if rev_id is None and sha is None:
            item.update(revision_summary_fields(None))
        else:
            item.update(
                revision_summary_fields(
                    {
                        "id": rev_id,
                        "content_sha256": sha,
                        "indexed_at": indexed_at,
                        "chunk_count": chunk_count,
                    }
                )
            )
        out.append(item)
    return out


async def set_barrel_enabled(barrel_id: str, enabled: bool) -> dict[str, Any] | None:
    async with connection() as conn:
        row = await conn.fetchrow(
            """
            UPDATE kbsew.barrels
            SET enabled = $2, updated_at = now()
            WHERE id = $1::uuid
            RETURNING id, name, description, driver_type, enabled, qdrant_collection, created_at, updated_at
            """,
            barrel_id,
            enabled,
        )
    result = _row_dict(row)
    if result is None:
        return None
    result["asset_count"] = await _asset_count(barrel_id)
    return result


async def _asset_count(barrel_id: str) -> int:
    async with connection() as conn:
        value = await conn.fetchval(
            "SELECT COUNT(*)::int FROM kbsew.assets WHERE barrel_id = $1::uuid",
            barrel_id,
        )
    return int(value or 0)


async def create_asset(
    *,
    barrel_id: str,
    source_url: str,
    metadata: dict[str, Any] | None = None,
    content_sha256: str | None = None,
    idempotency_key: str | None = None,
) -> dict[str, Any]:
    asset_id = str(uuid.uuid4())
    async with connection() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO kbsew.assets (id, barrel_id, source_url, status, metadata, content_sha256, idempotency_key)
            VALUES ($1::uuid, $2::uuid, $3, 'pending', $4::jsonb, $5, $6)
            RETURNING id, barrel_id, source_url, object_key, status, metadata, chunk_count, error_message, created_at, updated_at
                    , content_sha256, idempotency_key
            """,
            asset_id,
            barrel_id,
            source_url,
            _jsonb_value(metadata),
            content_sha256,
            idempotency_key,
        )
    if row is None:
        raise RuntimeError("kbsew asset insert returned no row")
    return _record_to_dict(row)


async def get_asset(asset_id: str) -> dict[str, Any] | None:
    async with connection() as conn:
        row = await conn.fetchrow(
            """
            SELECT id, barrel_id, source_url, object_key, status, metadata, chunk_count, error_message,
                   created_at, updated_at, content_sha256, idempotency_key
            FROM kbsew.assets
            WHERE id = $1::uuid
            """,
            asset_id,
        )
    return _row_dict(row)


async def list_assets_for_barrel(barrel_id: str) -> list[dict[str, Any]]:
    """All assets in a barrel (oldest first) for barrel-wide force-reindex."""

    async with connection() as conn:
        rows = await conn.fetch(
            """
            SELECT id, barrel_id, source_url, object_key, status, metadata, chunk_count, error_message,
                   created_at, updated_at, content_sha256, idempotency_key
            FROM kbsew.assets
            WHERE barrel_id = $1::uuid
            ORDER BY created_at ASC
            """,
            barrel_id,
        )
    return [_record_to_dict(row) for row in rows]


async def find_asset_by_idempotency_key(barrel_id: str, idempotency_key: str) -> dict[str, Any] | None:
    async with connection() as conn:
        row = await conn.fetchrow(
            """
            SELECT id, barrel_id, source_url, object_key, status, metadata, chunk_count, error_message,
                   created_at, updated_at, content_sha256, idempotency_key
            FROM kbsew.assets
            WHERE barrel_id = $1::uuid AND idempotency_key = $2
            ORDER BY created_at DESC
            LIMIT 1
            """,
            barrel_id,
            idempotency_key,
        )
    return _row_dict(row)


async def find_asset_by_content_sha256(barrel_id: str, content_sha256: str) -> dict[str, Any] | None:
    """Lineage lookup when idempotency_key is missing on legacy rows."""

    sha = (content_sha256 or "").strip()
    if not sha:
        return None
    async with connection() as conn:
        row = await conn.fetchrow(
            """
            SELECT id, barrel_id, source_url, object_key, status, metadata, chunk_count, error_message,
                   created_at, updated_at, content_sha256, idempotency_key
            FROM kbsew.assets
            WHERE barrel_id = $1::uuid AND content_sha256 = $2
            ORDER BY created_at DESC
            LIMIT 1
            """,
            barrel_id,
            sha,
        )
    return _row_dict(row)


async def update_asset(
    asset_id: str,
    *,
    status: str | None = None,
    object_key: str | None = None,
    metadata: dict[str, Any] | None = None,
    chunk_count: int | None = None,
    error_message: str | None = None,
    content_sha256: str | None = None,
    idempotency_key: str | None = None,
) -> None:
    async with connection() as conn:
        await conn.execute(
            """
            UPDATE kbsew.assets
            SET status = COALESCE($2, status),
                object_key = COALESCE($3, object_key),
                metadata = COALESCE($4::jsonb, metadata),
                chunk_count = COALESCE($5, chunk_count),
                error_message = $6,
                content_sha256 = COALESCE($7, content_sha256),
                idempotency_key = COALESCE($8, idempotency_key),
                updated_at = now()
            WHERE id = $1::uuid
            """,
            asset_id,
            status,
            object_key,
            _jsonb_value(metadata) if metadata is not None else None,
            chunk_count,
            error_message,
            content_sha256,
            idempotency_key,
        )


_JOB_RETURNING = """
id, barrel_id, asset_id, status, progress_pct, message, created_at, updated_at,
locked_at, locked_by, attempts, max_attempts, scheduled_at, trace_id, source_kind,
driver_type, payload
"""


async def active_job_for_asset(
    asset_id: str,
    *,
    conn: asyncpg.Connection | None = None,
) -> dict[str, Any] | None:
    """Return the queued/running job for asset if any (at most one by DB invariant)."""

    query = f"""
        SELECT {_JOB_RETURNING}
        FROM kbsew.ingestion_jobs
        WHERE asset_id = $1::uuid
          AND status IN ('queued', 'running')
        ORDER BY created_at ASC
        LIMIT 1
    """

    async def _fetch(active_conn: asyncpg.Connection) -> dict[str, Any] | None:
        row = await active_conn.fetchrow(query, asset_id)
        return _row_dict(row)

    if conn is not None:
        return await _fetch(conn)
    async with connection() as owned:
        return await _fetch(owned)


async def enqueue_job(
    *,
    barrel_id: str,
    asset_id: str,
    source_kind: str,
    driver_type: str | None,
    payload: dict[str, Any] | None = None,
    trace_id: str | None = None,
) -> tuple[dict[str, Any], bool]:
    """
    Create a queued job or reuse the existing active one for this asset.

    Serializes on ``SELECT … FROM assets FOR UPDATE`` and relies on
    ``uq_kbsew_jobs_one_active_per_asset``. Returns ``(job, created)``.
    """

    settings = get_settings()
    job_id = str(uuid.uuid4())
    async with connection() as conn:
        async with conn.transaction():
            asset_row = await conn.fetchrow(
                "SELECT id FROM kbsew.assets WHERE id = $1::uuid FOR UPDATE",
                asset_id,
            )
            if asset_row is None:
                raise LookupError("Asset not found")
            existing = await active_job_for_asset(asset_id, conn=conn)
            if existing is not None:
                return existing, False
            try:
                row = await conn.fetchrow(
                    f"""
                    INSERT INTO kbsew.ingestion_jobs (
                        id, barrel_id, asset_id, status, progress_pct, message, max_attempts,
                        scheduled_at, trace_id, source_kind, driver_type, payload
                    )
                    VALUES (
                        $1::uuid, $2::uuid, $3::uuid, 'queued', 0, 'Queued', $4,
                        now(), $5, $6, $7, $8::jsonb
                    )
                    RETURNING {_JOB_RETURNING}
                    """,
                    job_id,
                    barrel_id,
                    asset_id,
                    settings.worker_max_attempts_clamped,
                    trace_id,
                    source_kind,
                    driver_type,
                    _jsonb_value(payload),
                )
            except asyncpg.UniqueViolationError:
                raced = await active_job_for_asset(asset_id, conn=conn)
                if raced is None:
                    raise
                logger.info(
                    "[STEP] kbsew_enqueue_job_race_reuse asset_id=%s job_id=%s",
                    asset_id,
                    raced.get("id"),
                )
                return raced, False
            if row is None:
                raise RuntimeError("kbsew job insert returned no row")
            return _record_to_dict(row), True


async def create_job(
    *,
    barrel_id: str,
    asset_id: str,
    source_kind: str,
    driver_type: str | None,
    payload: dict[str, Any] | None = None,
    trace_id: str | None = None,
) -> dict[str, Any]:
    """Compatibility wrapper: enqueue and return the job row (may be pre-existing)."""

    job, _created = await enqueue_job(
        barrel_id=barrel_id,
        asset_id=asset_id,
        source_kind=source_kind,
        driver_type=driver_type,
        payload=payload,
        trace_id=trace_id,
    )
    return job


async def latest_job_for_asset(asset_id: str) -> dict[str, Any] | None:
    async with connection() as conn:
        row = await conn.fetchrow(
            """
            SELECT id, barrel_id, asset_id, status, progress_pct, message, created_at, updated_at,
                   locked_at, locked_by, attempts, max_attempts, scheduled_at, trace_id, source_kind,
                   driver_type, payload
            FROM kbsew.ingestion_jobs
            WHERE asset_id = $1::uuid
            ORDER BY created_at DESC
            LIMIT 1
            """,
            asset_id,
        )
    return _row_dict(row)


async def touch_job_progress(
    job_id: str,
    *,
    worker_id: str,
    progress_pct: int | None = None,
    message: str | None = None,
) -> bool:
    """
    Progress/message update while holding the lease.

    CAS: ``status='running' AND locked_by=worker_id``. Returns False if lease lost.
    Does not change terminal status — worker uses mark_job_* for that.
    """

    async with connection() as conn:
        result = await conn.execute(
            """
            UPDATE kbsew.ingestion_jobs
            SET progress_pct = COALESCE($3, progress_pct),
                message = COALESCE($4, message),
                updated_at = now()
            WHERE id = $1::uuid
              AND status = 'running'
              AND locked_by = $2
            """,
            job_id,
            worker_id,
            progress_pct,
            message,
        )
    return _rows_affected(result) == 1


async def claim_next_job(worker_id: str) -> dict[str, Any] | None:
    async with connection() as conn:
        async with conn.transaction():
            row = await conn.fetchrow(
                """
                WITH next_job AS (
                    SELECT id
                    FROM kbsew.ingestion_jobs
                    WHERE status = 'queued'
                      AND scheduled_at <= now()
                      AND attempts < max_attempts
                    ORDER BY created_at ASC
                    FOR UPDATE SKIP LOCKED
                    LIMIT 1
                )
                UPDATE kbsew.ingestion_jobs j
                SET status = 'running',
                    locked_at = now(),
                    locked_by = $1,
                    attempts = j.attempts + 1,
                    progress_pct = GREATEST(j.progress_pct, 1),
                    message = 'Processing',
                    updated_at = now()
                FROM next_job
                WHERE j.id = next_job.id
                RETURNING j.id, j.barrel_id, j.asset_id, j.status, j.progress_pct, j.message,
                          j.created_at, j.updated_at, j.locked_at, j.locked_by, j.attempts,
                          j.max_attempts, j.scheduled_at, j.trace_id, j.source_kind, j.driver_type, j.payload
                """,
                worker_id,
            )
    return _row_dict(row)


async def heartbeat_job_lease(job_id: str, *, worker_id: str) -> bool:
    """Refresh locked_at for a running job owned by worker_id. Returns True if a row updated."""
    async with connection() as conn:
        result = await conn.execute(
            """
            UPDATE kbsew.ingestion_jobs
            SET locked_at = now(),
                updated_at = now()
            WHERE id = $1::uuid
              AND status = 'running'
              AND locked_by = $2
            """,
            job_id,
            worker_id,
        )
    return result.endswith("1")


async def recover_stale_jobs(*, lease_timeout_seconds: int) -> int:
    async with connection() as conn:
        result = await conn.execute(
            """
            UPDATE kbsew.ingestion_jobs
            SET status = 'queued',
                locked_at = NULL,
                locked_by = NULL,
                scheduled_at = now(),
                message = 'Recovered stale processing lease',
                updated_at = now()
            WHERE status = 'running'
              AND locked_at IS NOT NULL
              AND locked_at < now() - ($1::int * interval '1 second')
            """,
            int(lease_timeout_seconds),
        )
    return int(result.rsplit(" ", 1)[-1])


def _rows_affected(execute_status: str) -> int:
    """Parse asyncpg execute status (`UPDATE N` / `DELETE N`) into row count."""
    try:
        return int(str(execute_status).rsplit(" ", 1)[-1])
    except (TypeError, ValueError):
        return 0


async def reschedule_job(job_id: str, *, message: str, delay_seconds: float, worker_id: str) -> bool:
    """Requeue a running job owned by *worker_id*. Returns False if lease CAS lost."""
    async with connection() as conn:
        result = await conn.execute(
            """
            UPDATE kbsew.ingestion_jobs
            SET status = 'queued',
                locked_at = NULL,
                locked_by = NULL,
                scheduled_at = now() + ($2::double precision * interval '1 second'),
                message = $3,
                updated_at = now()
            WHERE id = $1::uuid
              AND status = 'running'
              AND locked_by = $4
            """,
            job_id,
            float(delay_seconds),
            message,
            worker_id,
        )
    won = _rows_affected(result) == 1
    if not won:
        logger.warning(
            "[STEP] kbsew_job_reschedule_cas_miss job_id=%s worker_id=%s",
            job_id,
            worker_id,
        )
    return won


async def mark_job_completed(job_id: str, *, message: str, worker_id: str) -> bool:
    """Complete a running job owned by *worker_id*. Returns False if lease CAS lost."""
    async with connection() as conn:
        result = await conn.execute(
            """
            UPDATE kbsew.ingestion_jobs
            SET status = 'completed',
                progress_pct = 100,
                message = $2,
                locked_at = NULL,
                locked_by = NULL,
                updated_at = now()
            WHERE id = $1::uuid
              AND status = 'running'
              AND locked_by = $3
            """,
            job_id,
            message,
            worker_id,
        )
    won = _rows_affected(result) == 1
    if not won:
        logger.warning(
            "[STEP] kbsew_job_complete_cas_miss job_id=%s worker_id=%s",
            job_id,
            worker_id,
        )
    return won


async def mark_job_failed(job_id: str, *, message: str, worker_id: str) -> bool:
    """Fail a running job owned by *worker_id*. Returns False if lease CAS lost."""
    async with connection() as conn:
        result = await conn.execute(
            """
            UPDATE kbsew.ingestion_jobs
            SET status = 'failed',
                progress_pct = 100,
                message = $2,
                locked_at = NULL,
                locked_by = NULL,
                updated_at = now()
            WHERE id = $1::uuid
              AND status = 'running'
              AND locked_by = $3
            """,
            job_id,
            message,
            worker_id,
        )
    won = _rows_affected(result) == 1
    if not won:
        logger.warning(
            "[STEP] kbsew_job_fail_cas_miss job_id=%s worker_id=%s",
            job_id,
            worker_id,
        )
    return won


async def count_active_jobs() -> int:
    async with connection() as conn:
        value = await conn.fetchval(
            "SELECT COUNT(*)::int FROM kbsew.ingestion_jobs WHERE status IN ('queued', 'running')"
        )
    return int(value or 0)


async def get_barrel_status(barrel_id: str) -> dict[str, Any] | None:
    barrel = await get_barrel(barrel_id)
    if barrel is None:
        return None
    async with connection() as conn:
        status_rows = await conn.fetch(
            """
            SELECT status, COUNT(*)::int AS cnt
            FROM kbsew.assets
            WHERE barrel_id = $1::uuid
            GROUP BY status
            """,
            barrel_id,
        )
        jobs = await conn.fetch(
            """
            SELECT id, asset_id, status, progress_pct, message, updated_at, trace_id, driver_type
            FROM kbsew.ingestion_jobs
            WHERE barrel_id = $1::uuid AND status IN ('queued', 'running')
            ORDER BY created_at DESC
            LIMIT 20
            """,
            barrel_id,
        )
        completed = await conn.fetch(
            """
            SELECT id, asset_id, status, progress_pct, message, updated_at, trace_id, driver_type
            FROM kbsew.ingestion_jobs
            WHERE barrel_id = $1::uuid AND status IN ('completed', 'failed')
            ORDER BY updated_at DESC
            LIMIT 20
            """,
            barrel_id,
        )
        rev_row = await conn.fetchrow(
            """
            SELECT r.id AS active_revision_id, r.content_sha256, r.indexed_at, r.chunk_count
            FROM kbsew.assets a
            JOIN kbsew.asset_revisions r ON r.id = a.active_revision_id
            WHERE a.barrel_id = $1::uuid
            ORDER BY r.indexed_at DESC
            LIMIT 1
            """,
            barrel_id,
        )
    assets_by_status = {str(row["status"]): int(row["cnt"]) for row in status_rows}
    rev = _row_dict(rev_row)
    summary = revision_summary_fields(
        {
            "id": rev.get("active_revision_id") if rev else None,
            "content_sha256": rev.get("content_sha256") if rev else None,
            "indexed_at": rev.get("indexed_at") if rev else None,
            "chunk_count": rev.get("chunk_count") if rev else None,
        }
        if rev
        else None
    )
    freshness = await revision_service.barrel_pipeline_freshness(barrel_id)
    return {
        **barrel,
        "assets_by_status": assets_by_status,
        "active_jobs": [_record_to_dict(row) for row in jobs],
        "completed_jobs": [_record_to_dict(row) for row in completed],
        **summary,
        **freshness,
    }


def resolve_driver(driver_type: str | None, barrel_driver: str):
    key = (driver_type or barrel_driver).strip().lower()
    return get_driver(key)
