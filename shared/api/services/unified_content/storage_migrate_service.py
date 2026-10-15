# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Batch migrate oversized PostgreSQL BYTEA blobs to SeaweedFS and hard-purge
# soft-deleted unified_content past retention (BYTEA + S3 + row).
# Invariants:
# - Never NULL file_data unless SeaweedFS store+verify succeeded (or dry_run).
# - Candidate selection mirrors StorageBackendFactory.get_backend thresholds.
# - Soft-delete younger than retention days is never hard-purged (days=0 = all).
# Related:
# - api/services/unified_content/storage_backends/factory.py
# - api/tasks/unified_content_hard_purge.py (scheduled beat)
# - documentation/platform/docker-re_doc/STACK1-POSTGRES-REMEDIATION-2026-07-11.md
# ---
"""Storage remediation: PG BYTEA → SeaweedFS migrate + soft-delete hard purge."""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]

from api.services.unified_content.storage_backends.factory import (
    StorageBackendFactory,
    get_storage_factory,
)
from api.services.unified_content.storage_backends.minio_storage import (
    SeaweedFileNotFoundError,
)

logger = logging.getLogger(__name__)

DEFAULT_HARD_PURGE_DAYS = 30
DEFAULT_HARD_PURGE_BATCH_LIMIT = 500
DEFAULT_HARD_PURGE_INTERVAL_HOURS = 24


def _env_truthy(name: str, *, default: str = "0") -> bool:
    return (os.environ.get(name) or default).strip().lower() in {"1", "true", "yes", "on"}


def hard_purge_retention_days() -> int:
    raw = (os.environ.get("UNIFIED_CONTENT_HARD_PURGE_DAYS") or "").strip()
    if not raw:
        return DEFAULT_HARD_PURGE_DAYS
    try:
        days = int(raw)
    except ValueError:
        logger.warning(
            "[STEP] storage_migrate_purge_days_invalid value=%s fallback=%s",
            raw,
            DEFAULT_HARD_PURGE_DAYS,
        )
        return DEFAULT_HARD_PURGE_DAYS
    return max(0, days)


def unified_content_hard_purge_beat_enabled() -> bool:
    """Scheduled Celery beat hard-purge (default off until operator enables)."""

    return _env_truthy("UNIFIED_CONTENT_HARD_PURGE_BEAT_ENABLED", default="0")


def unified_content_hard_purge_interval_hours() -> int:
    raw = (os.environ.get("UNIFIED_CONTENT_HARD_PURGE_INTERVAL_HOURS") or "").strip()
    if not raw:
        return DEFAULT_HARD_PURGE_INTERVAL_HOURS
    try:
        hours = int(raw)
    except ValueError:
        logger.warning(
            "[STEP] storage_hard_purge_interval_invalid value=%s fallback=%s",
            raw,
            DEFAULT_HARD_PURGE_INTERVAL_HOURS,
        )
        return DEFAULT_HARD_PURGE_INTERVAL_HOURS
    return max(1, min(hours, 24 * 7))


def unified_content_hard_purge_batch_limit() -> int:
    raw = (os.environ.get("UNIFIED_CONTENT_HARD_PURGE_BATCH_LIMIT") or "").strip()
    if not raw:
        return DEFAULT_HARD_PURGE_BATCH_LIMIT
    try:
        limit = int(raw)
    except ValueError:
        logger.warning(
            "[STEP] storage_hard_purge_batch_limit_invalid value=%s fallback=%s",
            raw,
            DEFAULT_HARD_PURGE_BATCH_LIMIT,
        )
        return DEFAULT_HARD_PURGE_BATCH_LIMIT
    return max(1, min(limit, 10_000))


def should_migrate_to_seaweed(*, file_size: int, content_type: str | None) -> bool:
    """True when factory policy would place this blob on SeaweedFS (not PostgreSQL)."""
    size = max(0, int(file_size or 0))
    ctype = (content_type or "").strip().lower() or None
    if ctype == "audio" and size > 0 and size < StorageBackendFactory.AUDIO_POSTGRES_MAX_BYTES:
        return False
    return size >= StorageBackendFactory.SIZE_THRESHOLD


@dataclass(slots=True)
class StorageMigrateStats:
    scanned: int = 0
    migrated: int = 0
    skipped: int = 0
    failed: int = 0
    dry_run: bool = False
    failed_ids: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return {
            "scanned": self.scanned,
            "migrated": self.migrated,
            "skipped": self.skipped,
            "failed": self.failed,
            "dry_run": self.dry_run,
            "failed_ids": list(self.failed_ids[:50]),
        }


@dataclass(slots=True)
class HardPurgeStats:
    scanned: int = 0
    purged: int = 0
    skipped: int = 0
    failed: int = 0
    dry_run: bool = False
    older_than_days: int = DEFAULT_HARD_PURGE_DAYS
    failed_ids: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return {
            "scanned": self.scanned,
            "purged": self.purged,
            "skipped": self.skipped,
            "failed": self.failed,
            "dry_run": self.dry_run,
            "older_than_days": self.older_than_days,
            "failed_ids": list(self.failed_ids[:50]),
        }


class StorageMigrateService:
    """Operator remediation for unified_content blob placement and soft-delete GC."""

    def __init__(
        self,
        db_pool: asyncpg.Pool,
        storage_factory: StorageBackendFactory | None = None,
    ) -> None:
        self.db_pool = db_pool
        self.storage_factory = storage_factory or get_storage_factory(db_pool)

    async def migrate_pg_blobs_to_seaweed(
        self,
        *,
        dry_run: bool = True,
        limit: int = 500,
        only_content_id: UUID | None = None,
    ) -> dict[str, Any]:
        """
        Move live PostgreSQL BYTEA rows that belong on SeaweedFS per factory policy.

        Offline SeaweedFS → hard-fail the row (BYTEA kept). dry_run never writes.
        """
        stats = StorageMigrateStats(dry_run=dry_run)
        rows = await self._fetch_migrate_candidates(limit=limit, only_content_id=only_content_id)
        stats.scanned = len(rows)
        logger.info(
            "[STEP] storage_migrate_start dry_run=%s scanned=%s limit=%s",
            dry_run,
            stats.scanned,
            limit,
        )

        for row in rows:
            content_id = row["id"]
            try:
                effective_size = max(
                    int(row["file_size"] or 0),
                    int(row["bytea_len"] or 0),
                )
                if not should_migrate_to_seaweed(
                    file_size=effective_size,
                    content_type=row["content_type"],
                ):
                    stats.skipped += 1
                    continue
                if dry_run:
                    stats.migrated += 1
                    continue
                await self._migrate_one_row(row)
                stats.migrated += 1
            except Exception:
                stats.failed += 1
                stats.failed_ids.append(str(content_id))
                logger.exception(
                    "[STEP] storage_migrate_row_fail content_id=%s",
                    content_id,
                )

        logger.info(
            "[STEP] storage_migrate_done %s",
            stats.as_dict(),
        )
        return stats.as_dict()

    async def hard_purge_soft_deleted(
        self,
        *,
        dry_run: bool = True,
        limit: int = 500,
        older_than_days: int | None = None,
        only_content_id: UUID | None = None,
    ) -> dict[str, Any]:
        """Permanently delete soft-deleted rows older than retention (BYTEA + S3 + row)."""
        days = older_than_days if older_than_days is not None else hard_purge_retention_days()
        # 0 = purge all soft-deleted; negative rejected.
        days = max(0, int(days))
        stats = HardPurgeStats(dry_run=dry_run, older_than_days=days)
        rows = await self._fetch_purge_candidates(
            limit=limit,
            older_than_days=days,
            only_content_id=only_content_id,
        )
        stats.scanned = len(rows)
        logger.info(
            "[STEP] storage_hard_purge_start dry_run=%s scanned=%s days=%s",
            dry_run,
            stats.scanned,
            days,
        )

        for row in rows:
            content_id = row["id"]
            try:
                if dry_run:
                    stats.purged += 1
                    continue
                await self._purge_one_row(row)
                stats.purged += 1
            except Exception:
                stats.failed += 1
                stats.failed_ids.append(str(content_id))
                logger.exception(
                    "[STEP] storage_hard_purge_row_fail content_id=%s",
                    content_id,
                )

        logger.info("[STEP] storage_hard_purge_done %s", stats.as_dict())
        return stats.as_dict()

    async def _fetch_migrate_candidates(
        self,
        *,
        limit: int,
        only_content_id: UUID | None,
    ) -> list[asyncpg.Record]:
        limit = max(1, min(int(limit), 10_000))
        async with self.db_pool.acquire() as conn:
            if only_content_id is not None:
                rows = await conn.fetch(
                    """
                    SELECT id, content_type, mime_type, original_filename,
                           file_size, octet_length(file_data) AS bytea_len, file_data
                    FROM unified_content
                    WHERE id = $1
                      AND deleted_at IS NULL
                      AND storage_backend::text = 'postgresql'
                      AND file_data IS NOT NULL
                    """,
                    only_content_id,
                )
            else:
                # Pre-filter by size; Python re-checks factory rules (audio exception).
                rows = await conn.fetch(
                    """
                    SELECT id, content_type, mime_type, original_filename,
                           file_size, octet_length(file_data) AS bytea_len, file_data
                    FROM unified_content
                    WHERE deleted_at IS NULL
                      AND storage_backend::text = 'postgresql'
                      AND file_data IS NOT NULL
                      AND GREATEST(COALESCE(file_size, 0), octet_length(file_data))
                          >= $1
                    ORDER BY GREATEST(COALESCE(file_size, 0), octet_length(file_data)) DESC
                    LIMIT $2
                    """,
                    StorageBackendFactory.SIZE_THRESHOLD,
                    limit,
                )
        return list(rows)

    async def _migrate_one_row(self, row: asyncpg.Record) -> None:
        content_id: UUID = row["id"]
        file_data: bytes = row["file_data"]
        if not file_data:
            return
        filename = (row["original_filename"] or "blob.bin").strip() or "blob.bin"
        mime_type = (row["mime_type"] or "application/octet-stream").strip()
        seaweed = self.storage_factory.get_backend_by_name("seaweedfs")

        storage_path = await seaweed.store(content_id, file_data, filename, mime_type)
        try:
            visible = await seaweed.exists(storage_path, content_id)
        except Exception as exc:
            msg = f"Post-migrate verify failed for {content_id}: {exc}"
            raise RuntimeError(msg) from exc
        if not visible:
            msg = f"Post-migrate verify failed: object not visible for {content_id}"
            raise RuntimeError(msg)

        async with self.db_pool.acquire() as conn, conn.transaction():
            status = await conn.execute(
                """
                UPDATE unified_content
                SET file_data = NULL,
                    file_path = $2,
                    storage_backend = 'seaweedfs',
                    updated_at = NOW()
                WHERE id = $1
                  AND deleted_at IS NULL
                  AND storage_backend::text = 'postgresql'
                  AND file_data IS NOT NULL
                """,
                content_id,
                storage_path,
            )
            if status != "UPDATE 1":
                msg = f"Migrate UPDATE affected 0 rows for {content_id}"
                raise RuntimeError(msg)

        logger.info(
            "[STEP] storage_migrate_row_ok content_id=%s path=%s bytes=%s",
            content_id,
            storage_path,
            len(file_data),
        )

    async def _fetch_purge_candidates(
        self,
        *,
        limit: int,
        older_than_days: int,
        only_content_id: UUID | None,
    ) -> list[asyncpg.Record]:
        limit = max(1, min(int(limit), 10_000))
        async with self.db_pool.acquire() as conn:
            if only_content_id is not None:
                rows = await conn.fetch(
                    """
                    SELECT id, storage_backend::text AS sb, file_path, deleted_at
                    FROM unified_content
                    WHERE id = $1
                      AND deleted_at IS NOT NULL
                      AND deleted_at <= NOW() - ($2::int * INTERVAL '1 day')
                    """,
                    only_content_id,
                    older_than_days,
                )
            else:
                rows = await conn.fetch(
                    """
                    SELECT id, storage_backend::text AS sb, file_path, deleted_at
                    FROM unified_content
                    WHERE deleted_at IS NOT NULL
                      AND deleted_at <= NOW() - ($1::int * INTERVAL '1 day')
                    ORDER BY deleted_at ASC
                    LIMIT $2
                    """,
                    older_than_days,
                    limit,
                )
        return list(rows)

    async def _purge_one_row(self, row: asyncpg.Record) -> None:
        content_id: UUID = row["id"]
        sb = (row["sb"] or "").strip().lower()
        file_path = (row["file_path"] or "").strip()

        if sb in {"seaweedfs", "minio"} and file_path:
            try:
                backend = self.storage_factory.get_backend_by_name("seaweedfs")
                deleted = await backend.delete(file_path, content_id)
                if not deleted:
                    logger.info(
                        "[STEP] storage_hard_purge_s3_missing content_id=%s path=%s",
                        content_id,
                        file_path,
                    )
            except SeaweedFileNotFoundError:
                logger.info(
                    "[STEP] storage_hard_purge_s3_not_found content_id=%s",
                    content_id,
                )
            except Exception:
                logger.exception(
                    "[STEP] storage_hard_purge_s3_skip content_id=%s",
                    content_id,
                )

        # Best-effort secondary index cleanup (same as soft-delete path).
        try:
            from api.services.unified_content.unified_content_qdrant_service import (
                delete_qdrant_chunks_for_content,
            )

            await delete_qdrant_chunks_for_content(content_id)
        except Exception:
            logger.debug(
                "[STEP] storage_hard_purge_qdrant_skip content_id=%s",
                content_id,
                exc_info=True,
            )

        async with self.db_pool.acquire() as conn, conn.transaction():
            # Self-FK parent_id has no ON DELETE action — clear before DELETE.
            await conn.execute(
                "UPDATE unified_content SET parent_id = NULL WHERE parent_id = $1",
                content_id,
            )
            status = await conn.execute(
                """
                DELETE FROM unified_content
                WHERE id = $1
                  AND deleted_at IS NOT NULL
                """,
                content_id,
            )
            if status != "DELETE 1":
                msg = f"Hard purge DELETE affected 0 rows for {content_id}"
                raise RuntimeError(msg)

        logger.info("[STEP] storage_hard_purge_row_ok content_id=%s", content_id)
