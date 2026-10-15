# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Celery beat: reclaim stale agentic session leases, sweep expired HITL gates,
# and reclaim no-lease orphaned active sessions (Gate G2).
# Invariants:
# - No-op when substrate disabled or reaper env off; uses process-level EWA worker pool (E4).
# Related:
# - api/ewa_platform/agentic/jobs/executor.py
# - api/ewa_platform/workers/ewa_pool.py
# - documentation/product/ewa/EWA-FORENSIC-AUDIT-RECOVERY-PLAN-2026-07-09.md (Gate G2)
# ---

from __future__ import annotations

import logging

from api.core.celery_async import run_celery_async
from api.ewa_platform.agentic.config import (
    agentic_gate_sweep_enabled,
    agentic_lease_reaper_enabled,
    agentic_orphan_sweep_enabled,
    agentic_substrate_enabled,
)
from api.ewa_platform.agentic.jobs.executor import (
    reclaim_stale_agentic_leases,
    sweep_expired_agentic_gates,
    sweep_orphaned_agentic_sessions,
)
from api.ewa_platform.workers.ewa_pool import open_initialized_ewa_worker_pool
from api.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


async def _run_agentic_lease_reaper_sweep() -> dict[str, int]:
    if not agentic_substrate_enabled() or not agentic_lease_reaper_enabled():
        return {"reclaimed": 0, "gates_expired": 0, "orphans_swept": 0}

    try:
        pool = await open_initialized_ewa_worker_pool(min_size=1, max_size=2)
    except RuntimeError:
        logger.warning("[AGENTIC_LEASE_REAPER] skip reason=EWA_DATABASE_URL_unset")
        return {"reclaimed": 0, "gates_expired": 0, "orphans_swept": 0}

    reclaimed = await reclaim_stale_agentic_leases(pool)
    gates_expired = 0
    if agentic_gate_sweep_enabled():
        gates_expired = await sweep_expired_agentic_gates(pool)
    orphans_swept = 0
    if agentic_orphan_sweep_enabled():
        orphans_swept = await sweep_orphaned_agentic_sessions(pool)
    if reclaimed or gates_expired or orphans_swept:
        logger.info(
            "[AGENTIC_LEASE_REAPER] reclaimed=%s gates_expired=%s orphans_swept=%s",
            reclaimed,
            gates_expired,
            orphans_swept,
        )
    return {
        "reclaimed": reclaimed,
        "gates_expired": gates_expired,
        "orphans_swept": orphans_swept,
    }


@celery_app.task(
    name="api.tasks.agentic_lease_reaper.sweep_stale_agentic_leases_task",
    soft_time_limit=120,
    time_limit=150,
)
def sweep_stale_agentic_leases_task() -> dict[str, int]:
    try:
        return run_celery_async(_run_agentic_lease_reaper_sweep())
    except Exception:
        logger.exception("[AGENTIC_LEASE_REAPER] task failed")
        raise
