# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Celery entry point for MusicForge backend-first song generation runs.
# Invariants:
# - Task return values are diagnostic only; durable run tables remain the source of truth.
# - Importing this module only registers Celery callables and never starts work.
# Related:
# - api/services/music_forge/pipeline.py
# - api/tasks/tasks.py
# ---
"""Celery task wrappers for MusicForge."""

from __future__ import annotations

import logging

from api.core.celery_async import run_celery_async
from api.services.music_forge.pipeline import run_music_forge_pipeline_background
from api.services.music_forge.reconcile import reconcile_orphan_runs_isolated
from api.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(
    name="api.tasks.music_forge.run_music_forge_pipeline",
    soft_time_limit=900,
    time_limit=960,
)
def run_music_forge_pipeline_task(run_id: str, user_id: str) -> dict[str, str]:
    """Run one MusicForge pipeline from Celery.

    Soft/hard limits sit above ComfyUI music provider timeout (600s) so the
    worker does not SoftTimeLimitExceeded before UGS can finish or fail cleanly.
    """
    logger.info("MusicForge Celery task started run_id=%s user_id=%s", run_id, user_id)
    run_celery_async(run_music_forge_pipeline_background(run_id=run_id, user_id=user_id))
    return {"run_id": run_id, "user_id": user_id, "status": "submitted"}


@celery_app.task(name="api.tasks.music_forge.reconcile_orphan_runs")
def reconcile_music_forge_orphan_runs_task(limit: int = 50) -> dict[str, int]:
    """Перевести застрявшие non-terminal MusicForge runs в failed."""
    count = run_celery_async(reconcile_orphan_runs_isolated(limit=int(limit)))
    return {"reconciled": int(count or 0)}
