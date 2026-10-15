"""Celery: сброс зависших music_batch_generations в status=running (падение воркера / таймаут UGS)."""

from __future__ import annotations

import logging

from api.core.celery_async import run_celery_async
from api.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


async def _run_reap_stale_music_batch_running() -> None:
    from api.services.music_batch_tests import reap_stale_music_batch_running_rows_and_requeue

    n = await reap_stale_music_batch_running_rows_and_requeue()
    if n:
        logger.info("[MUSIC_BATCH_STALE_REAPER] reset %s stale running row(s)", n)


@celery_app.task(name="api.tasks.music_batch_stale_running_reaper.reap_stale_music_batch_running_rows_task")
def reap_stale_music_batch_running_rows_task() -> None:
    try:
        run_celery_async(_run_reap_stale_music_batch_running())
    except Exception:
        logger.exception("[MUSIC_BATCH_STALE_REAPER] task failed")
        raise
