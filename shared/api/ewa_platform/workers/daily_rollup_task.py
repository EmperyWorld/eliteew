# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Celery beat entry — **daily UTC rollup** snapshot from ``ewa_companion_episodes`` into each profile's
# ``learned_preferences.companion_daily_rollup_v1`` for cheap morning companion hints / UI badges.
# Invariants:
# - Never touches marketing AMKA contours; purely EWA Postgres.
# - Uses process-level EWA worker pool (E4); no per-task pool close.
# Related:
# - api/ewa_platform/companion/episodic/daily_rollup.py
# - api/ewa_platform/workers/ewa_pool.py
# - api/tasks/celery_app.py (crontab)
# ---
"""Celery: companion episodic nightly rollup MVP."""

from __future__ import annotations

import logging
from datetime import date
from typing import Any

from api.ewa_platform.companion.episodic.daily_rollup import companion_daily_rollup_for_prior_utc_day
from api.ewa_platform.workers.celery_beat_guard import run_celery_beat_task_dict
from api.ewa_platform.workers.ewa_pool import open_initialized_ewa_worker_pool
from api.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


async def _run(payload: dict[str, Any]) -> dict[str, Any]:
    try:
        pool = await open_initialized_ewa_worker_pool(min_size=1, max_size=4)
    except RuntimeError:
        logger.info("[companion daily rollup] skipped — EWA_DATABASE_URL unset")
        return {"skipped": True, "reason": "EWA_DATABASE_URL_unset"}

    override_raw = payload.get("target_day_iso")
    tgt: date | None = None
    if isinstance(override_raw, str) and override_raw.strip():
        try:
            tgt = date.fromisoformat(override_raw.strip())
        except ValueError:
            tgt = None

    return await companion_daily_rollup_for_prior_utc_day(pool, target_day=tgt)


@celery_app.task(name="api.ewa_platform.workers.daily_rollup_task.run_companion_daily_rollup")
def run_companion_daily_rollup(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    raw = dict(payload) if isinstance(payload, dict) else {}
    return run_celery_beat_task_dict("companion_daily_rollup", lambda: _run(raw))
