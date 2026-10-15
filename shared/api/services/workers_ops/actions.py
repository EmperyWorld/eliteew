# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Safe Celery control actions for Admin workers-ops (revoke / purge whitelist).
# Invariants:
# - purge only accepts names from celery_app.conf.task_queues (+ default queue).
# Related:
# - api/services/workers_ops/catalog.py
# ---
"""Celery revoke / purge actions."""

from __future__ import annotations

import logging
from typing import Any

from api.services.workers_ops.catalog import known_celery_queue_names

logger = logging.getLogger(__name__)


def revoke_celery_task(task_id: str, *, terminate: bool = False) -> dict[str, Any]:
    """Revoke a Celery task by id. terminate=True sends SIGTERM to running worker child."""
    tid = (task_id or "").strip()
    if not tid:
        raise ValueError("task_id_required")
    from api.tasks.celery_app import celery_app

    celery_app.control.revoke(tid, terminate=terminate)
    logger.info("[STEP] workers_ops_revoke task_id=%s terminate=%s", tid, terminate)
    return {"ok": True, "task_id": tid, "terminate": terminate}


def purge_celery_queue(queue_name: str) -> dict[str, Any]:
    """Purge a known Celery queue; unknown names are rejected."""
    name = (queue_name or "").strip()
    allowed = known_celery_queue_names()
    if name not in allowed:
        raise ValueError(f"queue_not_allowed:{name}")
    from api.tasks.celery_app import celery_app

    with celery_app.connection_or_acquire() as conn:
        purged = conn.default_channel.queue_purge(name)
    count = int(purged or 0)
    logger.info("[STEP] workers_ops_purge_queue queue=%s purged=%s", name, count)
    return {"ok": True, "queue": name, "purged": count}
