# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Aggregate Admin workers-ops snapshot (phased Celery inspect + beat + RabbitMQ plane).
# Invariants:
# - Inspect failures degrade celery.status; HTTP snapshot still returns beat/rabbitmq.
# - Outer wait_for budget matches phased inspect (essentials + optional detail).
# Related:
# - documentation/platform/docker-re_doc/ADMIN-WORKERS-OPS.md
# ---
"""Build workers-ops Admin snapshot."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.services.workers_ops.catalog import (
    beat_schedule_catalog,
    celery_rate_limit_policy,
    known_celery_queue_names,
    queue_catalog,
)
from api.services.workers_ops.inspect_celery import (
    INSPECT_TOTAL_BUDGET_SEC,
    empty_celery_slice,
    inspect_celery_sync,
)
from api.services.workers_ops.pools import match_expected_pools
from api.services.workers_ops.queue_depths import celery_queue_depths

logger = logging.getLogger(__name__)


async def build_workers_ops_snapshot(db: AsyncSession) -> dict[str, Any]:
    """Aggregate Celery inspect + beat health + RabbitMQ/UGS queue-ops plane."""
    from api.monitoring.metrics import build_celery_beat_health_slice
    from api.services.ugs.queue_ops_snapshot import build_queue_ops_snapshot

    try:
        celery_slice = await asyncio.wait_for(
            asyncio.to_thread(inspect_celery_sync, detail=True),
            timeout=INSPECT_TOTAL_BUDGET_SEC,
        )
    except TimeoutError:
        logger.warning(
            "[STEP] workers_ops_inspect_timeout sec=%s",
            INSPECT_TOTAL_BUDGET_SEC,
        )
        celery_slice = empty_celery_slice(status="degraded", error="inspect_timeout")
    except Exception as exc:  # noqa: BLE001
        logger.warning("[STEP] workers_ops_inspect_fail err=%s", exc)
        celery_slice = empty_celery_slice(status="unavailable", error=type(exc).__name__)

    try:
        beat_slice = await build_celery_beat_health_slice()
    except Exception as exc:  # noqa: BLE001
        logger.warning("[STEP] workers_ops_beat_slice_fail err=%s", exc)
        beat_slice = {"status": "unavailable", "error": type(exc).__name__, "stale": True}

    rabbitmq_plane: dict[str, Any]
    try:
        rabbitmq_plane = await build_queue_ops_snapshot(db)
    except Exception as exc:  # noqa: BLE001
        logger.warning("[STEP] workers_ops_rabbitmq_plane_fail err=%s", exc)
        rabbitmq_plane = {"status": "unavailable", "error": type(exc).__name__}

    expected = match_expected_pools(celery_slice, beat_slice if isinstance(beat_slice, dict) else {})
    rmq_online: bool | None = None
    if isinstance(rabbitmq_plane, dict) and rabbitmq_plane.get("error") is None:
        leases = rabbitmq_plane.get("redis_leases")
        rabbit = rabbitmq_plane.get("rabbitmq")
        if (isinstance(leases, dict) and int(leases.get("active_count") or 0) > 0) or (
            isinstance(rabbit, dict) and rabbit.get("ok") is True
        ):
            rmq_online = True
        elif isinstance(rabbit, dict) and rabbit.get("ok") is False:
            rmq_online = False
        else:
            rmq_online = None
    for row in expected:
        if row.get("role") == "rabbitmq":
            row["online"] = rmq_online
            row["online_reason"] = (
                "rabbitmq_ok"
                if rmq_online is True
                else ("rabbitmq_down" if rmq_online is False else "rabbitmq_unknown")
            )

    return {
        "celery": {
            **celery_slice,
            "queues": queue_catalog(),
            "known_queue_names": sorted(known_celery_queue_names()),
            "queue_depths": celery_queue_depths(),
            "rate_limit_policy": celery_rate_limit_policy(),
        },
        "beat": {
            "health": beat_slice,
            "schedule": beat_schedule_catalog(),
        },
        "rabbitmq": rabbitmq_plane,
        "expected_pools": expected,
    }
