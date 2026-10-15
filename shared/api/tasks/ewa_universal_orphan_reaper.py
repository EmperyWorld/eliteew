# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# E1 Celery beat orchestrator: one maintenance tick for agentic + companion/media
# orphan hygiene (delegates to existing domain reapers + generic companion reaper).
# Invariants:
# - Domain modules stay authoritative; this task only sequences and aggregates counts.
# - No-op when EWA_UNIVERSAL_ORPHAN_REAPER_ENABLED is off (default on).
# Related:
# - documentation/product/ewa/EWA-ECOSYSTEM-VULNERABILITY-MAP-2026-07-09.md (E1)
# - api/ewa_platform/companion/jobs/generic_run_reconcile.py
# ---

from __future__ import annotations

import logging

from api.core.celery_async import run_celery_async
from api.monitoring.metrics import record_ewa_celery_beat_success, record_ewa_universal_reaper_sweep
from api.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


def ewa_universal_orphan_reaper_enabled() -> bool:
    from api.ewa_platform.settings.access import ewa_getenv

    raw = ewa_getenv("EWA_UNIVERSAL_ORPHAN_REAPER_ENABLED", "1").strip().lower()
    return raw not in {"0", "false", "off", "no"}


def ewa_universal_orphan_reaper_interval_sec() -> int:
    from api.ewa_platform.settings.access import ewa_getenv_int

    return max(60, min(3600, ewa_getenv_int("EWA_UNIVERSAL_ORPHAN_REAPER_INTERVAL_SEC", default=180)))


async def _run_ewa_universal_orphan_sweep() -> dict[str, int]:
    if not ewa_universal_orphan_reaper_enabled():
        return {
            "agentic_reclaimed": 0,
            "agentic_gates_expired": 0,
            "agentic_orphans_swept": 0,
            "music": 0,
            "image": 0,
            "presentation": 0,
            "generic": 0,
        }

    from api.tasks.agentic_lease_reaper import _run_agentic_lease_reaper_sweep

    agentic = await _run_agentic_lease_reaper_sweep()

    from api.ewa_platform.companion.jobs.generic_run_reconcile import (
        reap_stale_companion_generic_runs,
    )
    from api.ewa_platform.companion.jobs.image_run_reconcile import reap_stale_companion_image_runs
    from api.ewa_platform.companion.jobs.music_run_reconcile import reap_stale_companion_music_runs
    from api.ewa_platform.companion.jobs.presentation_run_reconcile import (
        reap_stale_companion_presentation_runs,
    )

    music = await reap_stale_companion_music_runs()
    image = await reap_stale_companion_image_runs()
    presentation = await reap_stale_companion_presentation_runs()
    generic = await reap_stale_companion_generic_runs()

    out = {
        "agentic_reclaimed": int(agentic.get("reclaimed") or 0),
        "agentic_gates_expired": int(agentic.get("gates_expired") or 0),
        "agentic_orphans_swept": int(agentic.get("orphans_swept") or 0),
        "music": int(music or 0),
        "image": int(image or 0),
        "presentation": int(presentation or 0),
        "generic": int(generic or 0),
    }
    total = sum(out.values())
    if total:
        logger.info("[EWA_UNIVERSAL_ORPHAN_REAPER] sweep=%s", out)
    return out


@celery_app.task(
    name="api.tasks.ewa_universal_orphan_reaper.run_ewa_universal_orphan_sweep_task",
    soft_time_limit=240,
    time_limit=300,
)
def run_ewa_universal_orphan_sweep_task() -> dict[str, int]:
    try:
        counts = run_celery_async(_run_ewa_universal_orphan_sweep())
        record_ewa_universal_reaper_sweep(counts=counts, ok=True)
        record_ewa_celery_beat_success(task="ewa_universal_orphan_reaper")
        return counts
    except Exception:
        record_ewa_universal_reaper_sweep(counts={}, ok=False)
        logger.exception("[EWA_UNIVERSAL_ORPHAN_REAPER] task failed")
        raise
