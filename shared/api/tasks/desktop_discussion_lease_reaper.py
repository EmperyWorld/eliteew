# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Maintenance reaper for stale Discussion worker leases → paused_error.
# Invariants:
# - Never silently re-runs a crashed batch; operator/Continue must resume.
# Related:
# - api/services/desktop_chat_ensemble/discussion/repository.py
# ---
from __future__ import annotations

import logging
from typing import Any

from api.core.celery_async import run_celery_async
from api.services.desktop_chat.db_session import desktop_ai_chat_session
from api.services.desktop_chat_ensemble.discussion.repository import reap_stale_leases
from api.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


async def _reap(*, limit: int) -> dict[str, Any]:
    async with desktop_ai_chat_session() as db:
        count = await reap_stale_leases(db, limit=limit)
        await db.commit()
    logger.info("[STEP] discussion_lease_reaper_done reaped=%s", count)
    return {"ok": True, "reaped": count}


@celery_app.task(
    name="api.tasks.desktop_discussion_lease_reaper.reap_stale_discussion_leases_task",
    bind=False,
    max_retries=0,
    soft_time_limit=60,
    time_limit=90,
)
def reap_stale_discussion_leases_task(limit: int = 50) -> dict[str, Any]:
    return run_celery_async(_reap(limit=max(1, min(int(limit or 50), 200))))
