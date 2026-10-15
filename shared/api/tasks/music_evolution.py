# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Celery entry points for Music Evolution backend XL Base runs and stale run reconciliation.
# Invariants:
# - The durable run tables remain the source of truth; task return values are diagnostic only.
# - HTTP only enqueues tasks; execution delegates to the durable pipeline/reaper service paths.
# Related:
# - api/services/music_evolution_pipeline.py
# - api/tasks/tasks.py
# ---
"""Celery task wrappers for Music Evolution."""

from __future__ import annotations

import logging

from api.core.celery_async import run_celery_async
from api.services.music_evolution_pipeline import (
    reap_stale_music_evolution_runs,
    run_music_evolution_pipeline_background,
)
from api.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="api.tasks.music_evolution.run_music_evolution_pipeline")
def run_music_evolution_pipeline_task(run_id: str, user_id: str) -> dict[str, str]:
    """Run one Music Evolution pipeline from Celery."""
    logger.info("Music Evolution Celery task started run_id=%s user_id=%s", run_id, user_id)
    run_celery_async(run_music_evolution_pipeline_background(run_id=run_id, user_id=user_id))
    return {"run_id": run_id, "user_id": user_id, "status": "submitted"}


@celery_app.task(
    name="api.tasks.music_evolution.reap_stale_music_evolution_runs",
    soft_time_limit=120,
    time_limit=150,
)
def reap_stale_music_evolution_runs_task() -> dict[str, int]:
    """Reconcile stale queued/running Music Evolution runs from Celery beat."""
    logger.info("Music Evolution stale reaper task started")
    reconciled = run_celery_async(reap_stale_music_evolution_runs())
    if reconciled:
        logger.warning("[MUSIC_EVOLUTION_STALE_REAPER] reconciled=%s", reconciled)
    return {"reconciled": reconciled}
