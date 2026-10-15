# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Celery entry point for manually backfilling Marketing Cabinet performance facts for one project.
# It reuses the project-scoped sync service and returns diagnostic row counts for operator logs.
# Invariants:
# - Task is explicit/manual; no beat schedule scans all projects.
# - Database connections come from DatabaseManager shared asyncpg pool.
# Related:
# - api/services/marketing_cabinet/project_performance_sync.py
# - documentation/product/marketing/MARKETING-CABINET-PERFORMANCE.md
# ---
from __future__ import annotations

import logging
from uuid import UUID

from api.core.celery_async import run_celery_async
from api.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


async def _run_marketing_performance_sync(project_id: str) -> dict[str, int | str]:
    from api.core.database_manager import get_asyncpg_pool, get_database_manager
    from api.services.marketing_cabinet.project_performance_sync import sync_marketing_performance_facts

    await get_database_manager()
    pool = await get_asyncpg_pool()
    result = await sync_marketing_performance_facts(pool, project_id=UUID(project_id))
    return {
        "project_id": str(result.project_id),
        "deleted_rows": result.deleted_rows,
        "spend_rows": result.spend_rows,
        "lead_rows": result.lead_rows,
        "revenue_rows": result.revenue_rows,
        "inserted_rows": result.inserted_rows,
    }


@celery_app.task(
    name="api.tasks.marketing_performance_sync.sync_marketing_performance_facts_task",
    soft_time_limit=180,
    time_limit=240,
)
def sync_marketing_performance_facts_task(project_id: str) -> dict[str, int | str]:
    """Backfill generated Marketing performance facts for one project."""
    try:
        return run_celery_async(_run_marketing_performance_sync(project_id))
    except Exception:
        logger.exception("[MARKETING_PERFORMANCE_SYNC] task failed project_id=%s", project_id)
        raise
