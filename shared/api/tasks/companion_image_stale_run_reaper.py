# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Celery beat: reconcile stuck EWA companion async image runs with UGS terminal states or stale timeout.
# Invariants:
# - No-op when EWA/UGS DB unavailable (logged, task may retry on next beat).
# Related:
# - api/ewa_platform/companion/jobs/image_run_reconcile.py
# ---

from __future__ import annotations

import logging

from api.core.celery_async import run_celery_async
from api.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


async def _run_reap_stale_companion_image_runs() -> None:
    from api.ewa_platform.companion.jobs.image_run_reconcile import reap_stale_companion_image_runs

    n = await reap_stale_companion_image_runs()
    if n:
        logger.info("[COMPANION_IMAGE_STALE_REAPER] reconciled %s run(s)", n)


@celery_app.task(
    name="api.tasks.companion_image_stale_run_reaper.reap_stale_companion_image_runs_task",
    soft_time_limit=120,
    time_limit=150,
)
def reap_stale_companion_image_runs_task() -> None:
    try:
        run_celery_async(_run_reap_stale_companion_image_runs())
    except Exception:
        logger.exception("[COMPANION_IMAGE_STALE_REAPER] task failed")
        raise
