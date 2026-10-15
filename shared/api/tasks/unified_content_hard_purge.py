# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Celery beat task: hard-purge soft-deleted unified_content past retention (BYTEA + S3 + row).
# Invariants:
# - No-op when UNIFIED_CONTENT_HARD_PURGE_BEAT_ENABLED is off (default off).
# - Delegates deletes to StorageMigrateService.hard_purge_soft_deleted (dry_run=False).
# Related:
# - api/services/unified_content/storage_migrate_service.py
# - api/tasks/celery_app.py
# ---

from __future__ import annotations

import logging
from typing import Any

from api.core.celery_async import run_celery_async
from api.monitoring.metrics import record_unified_content_hard_purge_run
from api.services.unified_content.storage_migrate_service import (
    StorageMigrateService,
    hard_purge_retention_days,
    unified_content_hard_purge_batch_limit,
    unified_content_hard_purge_beat_enabled,
)
from api.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


async def _run_unified_content_hard_purge() -> dict[str, Any]:
    if not unified_content_hard_purge_beat_enabled():
        logger.info("[STEP] unified_content_hard_purge_skip reason=beat_disabled")
        return {"skipped": True, "reason": "beat_disabled"}

    from api.core.database_manager import DatabaseConnectionError, get_asyncpg_pool

    try:
        pool = await get_asyncpg_pool()
    except DatabaseConnectionError:
        logger.warning("[STEP] unified_content_hard_purge_skip reason=database_unavailable")
        return {"skipped": True, "reason": "database_unavailable"}

    days = hard_purge_retention_days()
    limit = unified_content_hard_purge_batch_limit()
    service = StorageMigrateService(pool)
    return await service.hard_purge_soft_deleted(
        dry_run=False,
        limit=limit,
        older_than_days=days,
    )


@celery_app.task(
    name="api.tasks.unified_content_hard_purge.run_unified_content_hard_purge_task",
    soft_time_limit=600,
    time_limit=720,
)
def run_unified_content_hard_purge_task() -> dict[str, Any]:
    try:
        result = run_celery_async(_run_unified_content_hard_purge())
        if result.get("skipped"):
            return result
        record_unified_content_hard_purge_run(stats=result, ok=int(result.get("failed") or 0) == 0)
        return result
    except Exception:
        record_unified_content_hard_purge_run(stats={}, ok=False)
        logger.exception("[STEP] unified_content_hard_purge_task_failed")
        raise
