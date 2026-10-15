# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Celery task: backfill WebP display thumbnails for image unified_content rows.
# Invariants:
# - Best-effort; skips broken_quarantined and missing originals.
# - Does not block folder-view; async owner/admin batch only.
# Related:
# - documentation/product/CONTENT-BROKEN-FILES-AND-WEBP-DISPLAY.md
# - api/services/unified_content/processors/image_processor.py
# ---

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from api.core.celery_async import run_celery_async
from api.services.unified_content.processors.image_processor import ImageProcessor
from api.services.unified_content.storage_backends.factory import StorageBackendFactory
from api.services.unified_content.storage_backends.minio_storage import (
    SeaweedFileCorruptedError,
    SeaweedFileNotFoundError,
    SeaweedStorageUnavailableError,
)
from api.services.unified_content.storage_integrity import STORAGE_INTEGRITY_BROKEN_QUARANTINED
from api.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


async def _backfill_webp_thumbnails(*, limit: int = 50, owner_user_id: str | None = None) -> dict[str, Any]:
    from api.core.database_manager import DatabaseConnectionError, get_asyncpg_pool

    try:
        pool = await get_asyncpg_pool()
    except DatabaseConnectionError:
        logger.warning("[STEP] webp_thumb_backfill_skip reason=database_unavailable")
        return {"skipped": True, "reason": "database_unavailable"}

    cap = max(1, min(int(limit), 500))
    async with pool.acquire() as conn:
        if owner_user_id:
            rows = await conn.fetch(
                """
                SELECT id, file_path, storage_backend::text AS sb, mime_type, name, original_filename
                FROM unified_content
                WHERE deleted_at IS NULL
                  AND content_type = 'image'
                  AND coalesce(storage_integrity_status, '') <> $2
                  AND (user_id)::text = $3
                  AND (
                    thumbnail_path IS NULL
                    OR thumbnail_path NOT ILIKE '%.webp'
                    OR coalesce(metadata->>'display_derivative', '') <> 'webp'
                  )
                ORDER BY updated_at DESC
                LIMIT $1
                """,
                cap,
                STORAGE_INTEGRITY_BROKEN_QUARANTINED,
                owner_user_id,
            )
        else:
            rows = await conn.fetch(
                """
                SELECT id, file_path, storage_backend::text AS sb, mime_type, name, original_filename
                FROM unified_content
                WHERE deleted_at IS NULL
                  AND content_type = 'image'
                  AND coalesce(storage_integrity_status, '') <> $2
                  AND (
                    thumbnail_path IS NULL
                    OR thumbnail_path NOT ILIKE '%.webp'
                    OR coalesce(metadata->>'display_derivative', '') <> 'webp'
                  )
                ORDER BY updated_at DESC
                LIMIT $1
                """,
                cap,
                STORAGE_INTEGRITY_BROKEN_QUARANTINED,
            )

    factory = StorageBackendFactory(pool)
    processor = ImageProcessor(pool)
    ok = 0
    failed = 0
    skipped = 0
    for row in rows:
        content_id: UUID = row["id"]
        file_path = (row["file_path"] or "").strip()
        sb = (row["sb"] or "").strip().lower()
        if not file_path or sb not in {"seaweedfs", "minio"}:
            skipped += 1
            continue
        try:
            backend = factory.get_backend_by_name("seaweedfs")
            data = await backend.retrieve(file_path, content_id, fail_fast=True)
            if not data:
                skipped += 1
                continue
            filename = row["original_filename"] or row["name"] or f"{content_id}.bin"
            mime = row["mime_type"] or "image/jpeg"
            result = await processor.process(content_id, data, str(filename), str(mime))
            if result.get("processing_status") == "completed":
                ok += 1
            else:
                failed += 1
        except SeaweedStorageUnavailableError:
            skipped += 1
            logger.warning("[STEP] webp_thumb_backfill_storage_503 content_id=%s", content_id)
        except (SeaweedFileNotFoundError, SeaweedFileCorruptedError) as exc:
            failed += 1
            logger.warning(
                "[STEP] webp_thumb_backfill_storage_404 content_id=%s err=%s",
                content_id,
                type(exc).__name__,
            )
        except Exception:
            failed += 1
            logger.exception("[STEP] webp_thumb_backfill_row_fail content_id=%s", content_id)

    stats = {"ok": ok, "failed": failed, "skipped": skipped, "scanned": len(rows)}
    logger.info("[STEP] webp_thumb_backfill_done %s", stats)
    return stats


@celery_app.task(name="api.tasks.unified_content_webp_backfill.run_webp_thumbnail_backfill_task")
def run_webp_thumbnail_backfill_task(
    limit: int = 50,
    owner_user_id: str | None = None,
) -> dict[str, Any]:
    return run_celery_async(_backfill_webp_thumbnails(limit=limit, owner_user_id=owner_user_id))
