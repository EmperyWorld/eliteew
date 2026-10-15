# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Redis LLEN depths for known Celery queues (Admin workers-ops).
# Invariants:
# - Uses CELERY_REDIS_DB; degrades with empty depths on failure (no fake zeros).
# Related:
# - api/services/workers_ops/catalog.py
# ---
"""Celery broker queue depth probes."""

from __future__ import annotations

import logging
from typing import Any

from api.services.workers_ops.catalog import known_celery_queue_names

logger = logging.getLogger(__name__)


def celery_redis_client():
    """Sync Redis client on CELERY_REDIS_DB (same broker DB as Celery)."""
    import os

    import redis

    from api.tasks.celery_app import get_redis_url

    raw_db = os.environ.get("CELERY_REDIS_DB", "0")
    try:
        db_index = int(raw_db)
    except ValueError:
        db_index = 0
    redis_url = get_redis_url(db_index)
    if not redis_url.strip():
        return None
    return redis.Redis.from_url(
        redis_url,
        decode_responses=True,
        socket_connect_timeout=1.0,
        socket_timeout=1.0,
    )


def celery_queue_depths() -> dict[str, Any]:
    """LLEN per known Celery queue on CELERY_REDIS_DB; degrade without fake zeros on failure."""
    names = sorted(known_celery_queue_names())
    if not names:
        return {"status": "ok", "error": None, "depths": {}}

    cli = celery_redis_client()
    if cli is None:
        logger.warning("[STEP] workers_ops_queue_depths_skip reason=no_redis_client")
        return {"status": "degraded", "error": "redis_unavailable", "depths": {}}

    try:
        depths: dict[str, int] = {}
        for name in names:
            depths[name] = int(cli.llen(name) or 0)
        return {"status": "ok", "error": None, "depths": depths}
    except Exception as exc:  # noqa: BLE001 — degrade path
        logger.warning("[STEP] workers_ops_queue_depths_fail err=%s", exc)
        return {"status": "degraded", "error": type(exc).__name__, "depths": {}}
