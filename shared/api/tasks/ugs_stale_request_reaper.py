#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Celery beat task: run QueueManagerService.cleanup_stale_request_states so abandoned UGS rows
# move to failed without waiting for a user-facing UGS API call.
# Invariants:
# - No-op when UGS_STALE_REAPER_ENABLED is 0/false or Postgres is unavailable.
# - Celery task uses a shorter soft/hard time limit than the global default so a stuck cleanup
#   cannot occupy a worker for the full global 600s window.
# Related:
# - api/services/ugs/queue_manager_service.py
# - api/services/ugs/ugs_stale_horizons.py (UGS_STALE_* horizons)
# - documentation/platform/docker-re_doc/UGS-IDEMPOTENCY.md
# ---
"""Celery: periodic reconciliation of stale UGS generation_requests / queue rows."""

from __future__ import annotations

import logging
import os

from api.core.celery_async import run_celery_async
from api.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


def _stale_reaper_enabled() -> bool:
    return os.environ.get("UGS_STALE_REAPER_ENABLED", "1").strip().lower() not in {"0", "false", "no"}


async def _run_ugs_stale_request_cleanup() -> None:
    if not _stale_reaper_enabled():
        return

    from api.core.database_manager import DatabaseConnectionError, get_database_manager
    from api.services.ugs.queue_manager_service import QueueManagerService

    try:
        manager = await get_database_manager()
    except DatabaseConnectionError:
        logger.warning("[UGS_STALE_REAPER] database manager unavailable")
        return

    if not manager.postgres_session_factory:
        logger.warning("[UGS_STALE_REAPER] postgres session factory missing")
        return

    async with manager.get_postgres_session() as db:
        qm = QueueManagerService(db)
        n = await qm.cleanup_stale_request_states()

    if n:
        logger.info("[UGS_STALE_REAPER] reconciled %s stale UGS request(s)", n)


@celery_app.task(
    name="api.tasks.ugs_stale_request_reaper.run_ugs_stale_request_cleanup_task",
    soft_time_limit=120,
    time_limit=150,
)
def run_ugs_stale_request_cleanup_task() -> None:
    try:
        run_celery_async(_run_ugs_stale_request_cleanup())
    except Exception:
        logger.exception("[UGS_STALE_REAPER] task failed")
        raise
