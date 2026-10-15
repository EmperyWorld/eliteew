# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Celery beat/driver for batch **pending → Qdrant** re-index of ``ewa_companion_episodes`` (HCM Wave 1).
# Invariants:
# - Uses process-level EWA worker pool (E4); idempotent retries safe.
# - Loads Postgres settings cache before batch sizing (``bootstrap_ewa_platform_settings``).
# Related:
# - api/ewa_platform/companion/episodic/reembed.py
# - api/ewa_platform/workers/ewa_pool.py
# - api/tasks/celery_app.py (beat_schedule)
# ---
"""Celery: companion episodic vector backfill."""

from __future__ import annotations

import logging
from typing import Any

from api.ewa_platform.companion.episodic.reembed import (
    companion_reembed_drain_pending_backlog,
    companion_reembed_pending_episodes_batch,
)
from api.ewa_platform.settings.service import bootstrap_ewa_platform_settings
from api.ewa_platform.workers.celery_beat_guard import run_celery_beat_task_dict
from api.ewa_platform.workers.ewa_pool import open_initialized_ewa_worker_pool
from api.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


async def _run_batch(payload: dict[str, Any]) -> dict[str, Any]:
    try:
        pool = await open_initialized_ewa_worker_pool(min_size=1, max_size=4)
    except RuntimeError:
        logger.info("[companion episodic re-embed] skipped — EWA_DATABASE_URL unset")
        return {"skipped": True, "reason": "EWA_DATABASE_URL_unset"}

    pid = str(payload.get("principal_id") or "").strip() or None
    # Fast path: empty backlog — skip settings bootstrap / vector clients (no ES/Qdrant I/O).
    from api.ewa_platform.persistence_pg.episodes_asyncpg import episodes_pending_count

    try:
        pending = await episodes_pending_count(pool, principal_id=pid)
    except Exception as exc:  # noqa: BLE001 — fall through to normal batch
        logger.debug("[STEP] companion_episodic_reembed_pending_count_fail err=%s", exc)
        pending = None
    if pending == 0:
        logger.info("[STEP] companion_episodic_reembed_empty_skip principal=%s", pid or "*")
        return {
            "skipped": False,
            "indexed": 0,
            "failed": 0,
            "examined": 0,
            "pending_remaining": 0,
        }

    await bootstrap_ewa_platform_settings(pool)
    try:
        return await companion_reembed_pending_episodes_batch(pool, principal_id=pid)
    except Exception as exc:  # noqa: BLE001 — beat must not crash worker on ES/Qdrant blips
        err = str(exc).lower()
        if "timeout" in err or "connection" in err or "elasticsearch" in err:
            logger.warning(
                "[STEP] companion_episodic_reembed_soft_skip err=%s",
                type(exc).__name__,
            )
            return {
                "skipped": True,
                "reason": "upstream_unreachable",
                "indexed": 0,
                "failed": 0,
                "examined": 0,
            }
        raise


async def _run_drain(payload: dict[str, Any]) -> dict[str, Any]:
    try:
        pool = await open_initialized_ewa_worker_pool(min_size=1, max_size=4)
    except RuntimeError:
        logger.info("[companion episodic drain] skipped — EWA_DATABASE_URL unset")
        return {"skipped": True, "reason": "EWA_DATABASE_URL_unset"}

    pid = str(payload.get("principal_id") or "").strip() or None
    max_rounds_raw = payload.get("max_rounds")
    max_rounds = int(max_rounds_raw) if max_rounds_raw is not None else None

    await bootstrap_ewa_platform_settings(pool)
    return await companion_reembed_drain_pending_backlog(
        pool,
        principal_id=pid,
        max_rounds=max_rounds,
    )


@celery_app.task(name="api.ewa_platform.workers.episodic_reembed_task.run_companion_episodic_pending_reembed")
def run_companion_episodic_pending_reembed(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    raw = dict(payload) if isinstance(payload, dict) else {}
    return run_celery_beat_task_dict("companion_episodic_pending_reembed", lambda: _run_batch(raw))


@celery_app.task(name="api.ewa_platform.workers.episodic_reembed_task.run_companion_episodic_drain_backlog")
def run_companion_episodic_drain_backlog(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    """Operator/on-demand drain of the pending episodic vector queue (multi-round batch)."""

    raw = dict(payload) if isinstance(payload, dict) else {}
    return run_celery_beat_task_dict("companion_episodic_drain_backlog", lambda: _run_drain(raw))
