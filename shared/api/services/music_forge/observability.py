# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Multi-worker MusicForge counters via Redis INCR + Prometheus dual-write.
# Invariants:
# - music_forge_metric_inc публикует в Redis и зеркалит в Prometheus scrape.
# - Redis недоступен → skip Redis с debug; Prometheus observe всё равно best-effort.
# Related:
# - api/routers/music_forge_admin.py
# - api/monitoring/metrics.py
# - documentation/product/MUSIC-FORGE-APP.md
# ---
"""MusicForge durable (Redis) observability counters."""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

REDIS_COUNTER_PREFIX = "music_forge:metric:v1"


async def _redis() -> Any | None:
    try:
        from api.core.database_manager import get_database_manager

        manager = await get_database_manager()
        return await manager.get_redis_client()
    except Exception:
        logger.debug("[STEP] music_forge_metric_redis_skip", exc_info=True)
        return None


def _counter_key(name: str, labels: dict[str, Any]) -> str:
    if not labels:
        return f"{REDIS_COUNTER_PREFIX}:{name}"
    parts = [name]
    for key in sorted(labels):
        value = labels[key]
        if value is None:
            continue
        parts.append(f"{key}={value}")
    return f"{REDIS_COUNTER_PREFIX}:{'|'.join(parts)}"


async def music_forge_metric_inc(name: str, **labels: Any) -> None:
    """Increment Redis + Prometheus counters (best-effort across workers)."""
    try:
        from api.monitoring.metrics import observe_music_forge_metric

        observe_music_forge_metric(name, **labels)
    except Exception:
        logger.debug("[STEP] music_forge_metric_prometheus_skip name=%s", name, exc_info=True)

    redis = await _redis()
    if redis is None:
        return
    key = _counter_key(name, labels)
    try:
        total = int(await redis.incr(key))
        await redis.expire(key, 7 * 24 * 3600)
        logger.debug("[STEP] music_forge_metric name=%s total=%s", key, total)
    except Exception:
        logger.debug("[STEP] music_forge_metric_inc_skip name=%s", name, exc_info=True)


async def music_forge_metrics_snapshot() -> dict[str, int]:
    """Scan Redis metric keys for admin overview (live multi-worker)."""
    redis = await _redis()
    if redis is None:
        return {}
    out: dict[str, int] = {}
    try:
        cursor = 0
        pattern = f"{REDIS_COUNTER_PREFIX}:*"
        while True:
            cursor, keys = await redis.scan(cursor=cursor, match=pattern, count=100)
            for key in keys:
                key_s = key.decode("utf-8") if isinstance(key, bytes) else str(key)
                raw = await redis.get(key)
                if raw is None:
                    continue
                label = key_s.removeprefix(f"{REDIS_COUNTER_PREFIX}:")
                out[label] = int(raw)
            if cursor == 0:
                break
    except Exception:
        logger.debug("[STEP] music_forge_metric_snapshot_skip", exc_info=True)
        return {}
    return out
