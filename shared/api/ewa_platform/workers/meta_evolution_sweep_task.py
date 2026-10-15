# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Celery beat driver: enqueue ``companion_evolution_tick`` (``tick_reason=scheduled``) for each principal
# with an active server plan when meta evolution is enabled.
# Invariants:
# - Fan-out only; per-principal work runs in ``companion_evolution_tick`` worker.
# - Uses process-level EWA worker pool (E4); no per-task pool close.
# Related:
# - api/ewa_platform/companion/plans/meta_schedule.py
# - api/ewa_platform/workers/ewa_pool.py
# - api/tasks/celery_app.py (beat_schedule)
# ---
"""Celery beat: companion meta evolution sweep."""

from __future__ import annotations

import logging
from typing import Any

from api.ewa_platform.companion.plans.meta_schedule import companion_meta_evolution_sweep_execute
from api.ewa_platform.workers.celery_beat_guard import run_celery_beat_task_dict
from api.ewa_platform.workers.ewa_pool import open_initialized_ewa_worker_pool
from api.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


async def _run(_payload: dict[str, Any]) -> dict[str, Any]:
    try:
        pool = await open_initialized_ewa_worker_pool(min_size=1, max_size=4)
    except RuntimeError:
        logger.info("[companion meta evolution sweep] skipped — EWA_DATABASE_URL unset")
        return {"skipped": True, "reason": "EWA_DATABASE_URL_unset"}

    return await companion_meta_evolution_sweep_execute(pool)


@celery_app.task(
    name="api.ewa_platform.workers.meta_evolution_sweep_task.run_companion_meta_evolution_sweep",
)
def run_companion_meta_evolution_sweep(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    raw = dict(payload) if isinstance(payload, dict) else {}
    return run_celery_beat_task_dict("companion_meta_evolution_sweep", lambda: _run(raw))


__all__ = ("run_companion_meta_evolution_sweep",)
