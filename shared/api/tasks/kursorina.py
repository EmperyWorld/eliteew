# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Celery entry for backend-owned Курсорина mission runs (short queue).
# Invariants:
# - Durable SoT is kursorina_missions; task return is diagnostic only.
# Related:
# - api/services/kursorina/jobs.py
# - documentation/product/desktop/KURSORINA.md
# ---

from __future__ import annotations

import logging

from api.core.celery_async import run_celery_async
from api.services.kursorina.jobs import run_mission_background
from api.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(
    name="api.tasks.kursorina.run_kursorina_mission",
    queue="short",
    soft_time_limit=600,
    time_limit=660,
)
def run_kursorina_mission_task(mission_id: str, user_id: str) -> dict[str, str]:
    logger.info(
        "[STEP] kursorina_celery_start mission_id=%s user_id=%s",
        str(mission_id)[:48],
        str(user_id)[:48],
    )
    run_celery_async(run_mission_background(mission_id=str(mission_id), user_id=str(user_id)))
    return {"mission_id": str(mission_id), "user_id": str(user_id), "status": "done"}


__all__ = ("run_kursorina_mission_task",)
