# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Celery beat entry for Air enrollment TTL expiry and dedicated edge lease cleanup.
# Related:
# - api.services.desktop_client.air_enroll_service
# - documentation/product/desktop/DESKTOP-CLIENT-AIR-ENROLL.md
# ---

from __future__ import annotations

import logging
from typing import Any

from api.core.celery_async import run_celery_async
from api.services.desktop_client.air_enroll_edge import AirEdgeError
from api.services.desktop_client.air_enroll_settings import get_air_enroll_settings
from api.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


async def _reconcile_air_enroll_leases(*, trigger: str) -> dict[str, Any]:
    from api.core.database_manager import get_asyncpg_pool
    from api.services.desktop_client.air_enroll_service import AirEnrollService

    if not get_air_enroll_settings().enabled:
        return {
            "trigger": trigger,
            "skipped": True,
            "reason": "air_disabled",
        }
    pool = await get_asyncpg_pool()
    result = await AirEnrollService(pool).reconcile_leases()
    result["trigger"] = trigger
    result["skipped"] = False
    return result


@celery_app.task(
    bind=True,
    name="api.tasks.desktop_client_air_enroll_reconcile.reconcile_desktop_client_air_enroll",
    max_retries=2,
    default_retry_delay=20,
    autoretry_for=(AirEdgeError,),
    retry_backoff=True,
    retry_jitter=True,
)
def reconcile_desktop_client_air_enroll(
    self,
    *,
    trigger: str = "manual",
) -> dict[str, object]:
    del self
    result = run_celery_async(_reconcile_air_enroll_leases(trigger=trigger))
    logger.info(
        "[STEP] air_enroll_reconcile_task_done trigger=%s expired=%s closed=%s degraded=%s",
        trigger,
        result.get("expired"),
        result.get("cleanup_closed"),
        result.get("cleanup_degraded"),
    )
    return result
