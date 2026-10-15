# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Enqueue Discussion batch tasks onto Celery queue ``desktop_discussion``.
# Invariants:
# - Never raises to API path — log + None on broker failure (caller keeps paused/queued).
# Related:
# - api/tasks/desktop_discussion_batch.py
# ---
"""Discussion Celery enqueue helper."""

from __future__ import annotations

import logging
from uuid import UUID

from api.services.desktop_chat_ensemble.discussion.contracts import DISCUSSION_CELERY_QUEUE

logger = logging.getLogger(__name__)


def enqueue_discussion_batch(*, session_id: UUID, expected_version: int) -> str | None:
    """Schedule one Discussion batch; returns Celery task id or None."""
    try:
        from api.tasks.desktop_discussion_batch import discussion_batch_task

        async_result = discussion_batch_task.apply_async(
            kwargs={
                "session_id": str(session_id),
                "expected_version": int(expected_version),
            },
            queue=DISCUSSION_CELERY_QUEUE,
        )
        task_id = str(getattr(async_result, "id", "") or "").strip() or None
        logger.info(
            "[STEP] discussion_batch_enqueued session_id=%s expected_version=%s celery_task_id=%s",
            session_id,
            expected_version,
            task_id,
        )
        return task_id
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "[STEP] discussion_batch_enqueue_failed session_id=%s err=%s",
            session_id,
            exc,
        )
        return None
