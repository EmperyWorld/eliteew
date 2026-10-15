# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Celery task for one bounded Desktop AI Chat Discussion batch.
# Invariants:
# - Queue ``desktop_discussion`` only; never waits on user input inside the task.
# Related:
# - api/services/desktop_chat_ensemble/discussion/engine.py
# - documentation/product/desktop/DESKTOP-AI-CHAT-DISCUSSION-MODE.md
# ---
from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from api.core.celery_async import run_celery_async
from api.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)

DISCUSSION_BATCH_SOFT_TIME_LIMIT_SEC = 540
DISCUSSION_BATCH_TIME_LIMIT_SEC = 600


@celery_app.task(
    name="api.tasks.desktop_discussion_batch.discussion_batch_task",
    bind=True,
    max_retries=1,
    soft_time_limit=DISCUSSION_BATCH_SOFT_TIME_LIMIT_SEC,
    time_limit=DISCUSSION_BATCH_TIME_LIMIT_SEC,
    acks_late=True,
    reject_on_worker_lost=True,
)
def discussion_batch_task(
    self: Any,
    *,
    session_id: str,
    expected_version: int,
) -> dict[str, Any]:
    """Run one Discussion segment batch under an optimistic lease."""
    from api.services.desktop_chat_ensemble.discussion.engine import run_discussion_batch

    sid = UUID(str(session_id))
    lease_owner = str(getattr(self.request, "id", "") or f"discussion-{sid}")
    logger.info(
        "[STEP] discussion_batch_start session_id=%s expected_version=%s lease_owner=%s",
        sid,
        expected_version,
        lease_owner,
    )
    return run_celery_async(
        run_discussion_batch(
            session_id=sid,
            expected_version=int(expected_version),
            lease_owner=lease_owner,
        )
    )
