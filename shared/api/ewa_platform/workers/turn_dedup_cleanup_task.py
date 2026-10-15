# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Celery beat entry — purge expired rows from ``ewa_companion_turn_dedup`` (Phase 5.6 TTL cleanup).
# Invariants:
# - No-op when ``EWA_DATABASE_URL`` unset; never deletes rows inside the active TTL window.
# - Uses process-level EWA worker pool (E4); no per-task pool close.
# Related:
# - api/ewa_platform/companion/turn/turn_dedup.py
# - api/ewa_platform/workers/ewa_pool.py
# - api/tasks/celery_app.py (beat schedule)
# ---

from __future__ import annotations

import logging
from typing import Any

from api.core.celery_async import run_celery_async
from api.ewa_platform.companion.turn.turn_dedup import companion_turn_dedup_purge_expired
from api.ewa_platform.workers.ewa_pool import open_initialized_ewa_worker_pool
from api.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


async def _run() -> dict[str, Any]:
    try:
        pool = await open_initialized_ewa_worker_pool(min_size=1, max_size=4)
    except RuntimeError:
        logger.info("[companion turn dedup cleanup] skipped — EWA_DATABASE_URL unset")
        return {"skipped": True, "reason": "EWA_DATABASE_URL_unset"}

    deleted = await companion_turn_dedup_purge_expired(pool)
    if deleted:
        logger.info("[companion turn dedup cleanup] deleted %s row(s)", deleted)
    return {"deleted": deleted}


@celery_app.task(
    name="api.ewa_platform.workers.turn_dedup_cleanup_task.run_companion_turn_dedup_cleanup",
    soft_time_limit=120,
    time_limit=150,
)
def run_companion_turn_dedup_cleanup() -> dict[str, Any]:
    try:
        return run_celery_async(_run())
    except Exception:
        logger.exception("[companion turn dedup cleanup] task failed")
        raise
