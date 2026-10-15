# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Schedule Celery ``companion_meta_from_plan`` / ``scheduled`` meta evolution ticks and run beat sweeps
# over principals with an active server plan.
# Invariants:
# - Requires ``EWA_COMPANION_META_EVOLUTION_ENABLED=1``; beat sweep additionally respects
#   ``EWA_COMPANION_META_EVOLUTION_BEAT_ENABLED``.
# - Each enqueue uses an explicit ``idempotency_key`` (hourly bucket for scheduled, per-plan for plan_v1).
# Related:
# - api/ewa_platform/companion/plans/meta_tick.py
# - api/ewa_platform/companion/persona/evolution_schedule.py
# - api/ewa_platform/workers/meta_evolution_sweep_task.py
# ---
"""Celery scheduling for ``companion_meta_v1`` evolution."""

from __future__ import annotations

import logging
import os
from datetime import UTC, datetime
from typing import Any

import asyncpg

from api.ewa_platform.companion.persona.evolution_schedule import schedule_companion_evolution_tick
from api.ewa_platform.companion.plans.config import (
    companion_meta_evolution_beat_enabled,
    companion_meta_evolution_enabled,
    companion_plan_enabled,
)
from api.ewa_platform.persistence_pg import companion_plans_asyncpg as plans_pg

logger = logging.getLogger(__name__)

_IDEMPOTENCY_MAX = 128


def build_meta_plan_idempotency_key(*, principal_id: str, plan_id: str) -> str:
    return f"meta:plan:v1:{principal_id.strip()}:{plan_id.strip()}"[:_IDEMPOTENCY_MAX]


def build_meta_scheduled_idempotency_key(
    *,
    principal_id: str,
    plan_id: str,
    hour_bucket_utc: str | None = None,
) -> str:
    bucket = hour_bucket_utc or datetime.now(UTC).strftime("%Y%m%d%H")
    return f"meta:scheduled:v1:{principal_id.strip()}:{plan_id.strip()}:{bucket}"[:_IDEMPOTENCY_MAX]


def schedule_companion_meta_from_plan(*, principal_id: str, plan_id: str) -> bool:
    """After successful ``plan_v1`` persist — refresh ``companion_meta_v1`` in profile."""

    if not companion_plan_enabled() or not companion_meta_evolution_enabled():
        return False
    pid = principal_id.strip()
    plid = plan_id.strip()
    if not pid or not plid:
        return False
    return schedule_companion_evolution_tick(
        principal_id=pid,
        tick_reason="companion_meta_from_plan",
        idempotency_key=build_meta_plan_idempotency_key(principal_id=pid, plan_id=plid),
        log_step="companion_meta_from_plan_scheduled",
    )


def schedule_companion_meta_scheduled_for_principal(
    *,
    principal_id: str,
    plan_id: str,
    hour_bucket_utc: str | None = None,
) -> bool:
    """Enqueue one scheduled meta tick (used by beat sweep)."""

    if not companion_meta_evolution_enabled():
        return False
    pid = principal_id.strip()
    plid = plan_id.strip()
    if not pid or not plid:
        return False
    return schedule_companion_evolution_tick(
        principal_id=pid,
        tick_reason="scheduled",
        idempotency_key=build_meta_scheduled_idempotency_key(
            principal_id=pid,
            plan_id=plid,
            hour_bucket_utc=hour_bucket_utc,
        ),
        log_step="companion_meta_scheduled_tick_enqueued",
    )


async def companion_meta_evolution_sweep_execute(pool: asyncpg.Pool) -> dict[str, Any]:
    """Find active plans and enqueue scheduled meta ticks (fan-out)."""

    if not companion_meta_evolution_enabled():
        return {"skipped": True, "reason": "meta_evolution_disabled"}
    if not companion_meta_evolution_beat_enabled():
        return {"skipped": True, "reason": "meta_beat_disabled"}

    try:
        limit = int(os.getenv("EWA_COMPANION_META_EVOLUTION_SWEEP_LIMIT", "500").strip() or "500")
    except ValueError:
        limit = 500
    limit = max(1, min(limit, 5000))

    hour_bucket = datetime.now(UTC).strftime("%Y%m%d%H")
    candidates = await plans_pg.plan_list_active_principal_plan_ids(pool, limit=limit)
    enqueued = 0
    for row in candidates:
        pid = str(row.get("principal_id") or "").strip()
        plid = str(row.get("plan_id") or "").strip()
        if not pid or not plid:
            continue
        if schedule_companion_meta_scheduled_for_principal(
            principal_id=pid,
            plan_id=plid,
            hour_bucket_utc=hour_bucket,
        ):
            enqueued += 1

    logger.info(
        "[STEP] companion_meta_evolution_sweep_done candidates=%s enqueued=%s hour_bucket=%s",
        len(candidates),
        enqueued,
        hour_bucket,
    )
    return {
        "skipped": False,
        "reason": "ok",
        "candidates": len(candidates),
        "enqueued": enqueued,
        "hour_bucket": hour_bucket,
    }


__all__ = (
    "build_meta_plan_idempotency_key",
    "build_meta_scheduled_idempotency_key",
    "companion_meta_evolution_sweep_execute",
    "schedule_companion_meta_from_plan",
    "schedule_companion_meta_scheduled_for_principal",
)
