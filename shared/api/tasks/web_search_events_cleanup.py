# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Celery beat task: purge web_search_events older than retention window.
# Related:
# - api/services/web_search_events_service.py
# - api/tasks/celery_app.py
# ---

from __future__ import annotations

import logging
from typing import Any

from api.core.celery_async import run_celery_async
from api.core.database_manager import get_postgres_session
from api.services.web_search_events_service import cleanup_web_search_events
from api.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


async def _run() -> dict[str, Any]:
    async for db in get_postgres_session():
        deleted = await cleanup_web_search_events(db)
        return {"deleted": deleted}
    return {"deleted": 0}


@celery_app.task(
    name="api.tasks.web_search_events_cleanup.run_web_search_events_cleanup_task",
    soft_time_limit=120,
    time_limit=150,
)
def run_web_search_events_cleanup_task() -> dict[str, Any]:
    try:
        return run_celery_async(_run())
    except Exception:
        logger.exception("[web search events cleanup] task failed")
        raise
