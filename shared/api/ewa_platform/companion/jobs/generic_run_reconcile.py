# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# E1 universal hygiene: terminalize stale companion task runs that media-specific
# reapers do not cover (non-media intents + sync execution_mode orphans).
# Invariants:
# - Never touches awaiting_confirmation (HITL) or already-terminal runs.
# - Async media intents stay with music/image/presentation reapers (UGS/EWRP truth).
# - Sync media + any non-media pending/running past horizon → failed + SSE.
# Related:
# - documentation/product/ewa/EWA-ECOSYSTEM-VULNERABILITY-MAP-2026-07-09.md (E1, V-H1, V-C3)
# - api/tasks/ewa_universal_orphan_reaper.py
# ---

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any, Final

import asyncpg

from api.ewa_platform.companion.jobs.music_run_reconcile import MUSIC_ASYNC_INTENT_KINDS
from api.ewa_platform.companion.jobs.presentation_run_reconcile import (
    PRESENTATION_ASYNC_INTENT_KINDS,
)
from api.ewa_platform.companion.jobs.task_events import publish_task_event_async
from api.ewa_platform.companion.orchestration.companion_image_generation import (
    IMAGE_ASYNC_INTENT_KINDS,
)
from api.ewa_platform.companion.orchestration.run_lifecycle import (
    TERMINAL_RUN_STATUSES,
    normalize_run_status,
)
from api.ewa_platform.persistence_pg.companion_asyncpg import (
    companion_task_run_update,
    companion_task_step_update,
    companion_task_steps_list,
)

logger = logging.getLogger(__name__)

MEDIA_ASYNC_INTENT_KINDS: Final[frozenset[str]] = frozenset(
    set(MUSIC_ASYNC_INTENT_KINDS) | set(IMAGE_ASYNC_INTENT_KINDS) | set(PRESENTATION_ASYNC_INTENT_KINDS)
)

_DEFAULT_STALE_SEC: Final[int] = 600
_DEFAULT_BATCH_LIMIT: Final[int] = 50


def companion_generic_stale_reap_after_seconds() -> int:
    from api.ewa_platform.settings.access import ewa_getenv_int

    return max(120, ewa_getenv_int("EWA_COMPANION_GENERIC_STALE_REAP_AFTER_SEC", default=_DEFAULT_STALE_SEC))


def companion_generic_reaper_batch_limit() -> int:
    from api.ewa_platform.settings.access import ewa_getenv_int

    raw = ewa_getenv_int("EWA_UNIVERSAL_REAPER_BATCH_LIMIT", default=_DEFAULT_BATCH_LIMIT)
    return max(1, min(200, raw))


def companion_generic_reaper_enabled() -> bool:
    from api.ewa_platform.settings.access import ewa_getenv

    raw = ewa_getenv("EWA_COMPANION_GENERIC_STALE_REAPER_ENABLED", "1").strip().lower()
    return raw not in {"0", "false", "off", "no"}


def is_media_async_intent(intent_kind: str) -> bool:
    return str(intent_kind or "").strip() in MEDIA_ASYNC_INTENT_KINDS


async def _fail_open_steps(pool: asyncpg.Pool, *, run_id: str, message: str) -> None:
    steps = await companion_task_steps_list(pool, run_id=run_id)
    for step in steps:
        st = str(step.get("status") or "").strip().lower()
        if st not in {"pending", "running", "in_progress", "claimed"}:
            continue
        step_id = str(step.get("id") or "").strip()
        if not step_id:
            continue
        await companion_task_step_update(
            pool,
            step_id=step_id,
            status="failed",
            error_payload={"message": message, "stage": "generic-stale-reaper"},
        )


async def terminalize_stale_companion_run(
    pool: asyncpg.Pool,
    *,
    run: Mapping[str, Any],
    message: str = "companion_run_stale_reaped",
) -> bool:
    """Mark a non-terminal companion run failed and publish SSE (idempotent)."""

    run_id = str(run.get("id") or "").strip()
    principal_id = str(run.get("principal_id") or "").strip()
    if not run_id or not principal_id:
        return False

    status = normalize_run_status(run)
    if status in TERMINAL_RUN_STATUSES:
        return False
    if status == "awaiting_confirmation":
        return False
    if status not in {"pending", "running"}:
        return False

    intent_kind = str(run.get("intent_kind") or "").strip()
    error_payload = {
        "message": message,
        "stage": "generic-stale-reaper",
        "intent_kind": intent_kind,
        "execution_mode": str(run.get("execution_mode") or "").strip(),
    }

    await _fail_open_steps(pool, run_id=run_id, message=message)
    updated = await companion_task_run_update(
        pool,
        run_id=run_id,
        principal_id=principal_id,
        status="failed",
        error_payload=error_payload,
        expect_revision=None,
    )
    if updated is None:
        return False

    await publish_task_event_async(
        principal_id=principal_id,
        event_name="task_failed",
        payload={
            "run_id": run_id,
            "status": "failed",
            "intent_kind": intent_kind,
            "error_payload": error_payload,
        },
    )
    logger.warning(
        "[STEP] companion_generic_stale_reaped run_id=%s intent=%s mode=%s",
        run_id,
        intent_kind or "-",
        str(run.get("execution_mode") or "-"),
    )
    return True


async def reap_stale_companion_generic_runs(pool: asyncpg.Pool | None = None) -> int:
    """Reap V-H1 (non-media) and V-C3 (sync media) immortal companion runs."""

    if not companion_generic_reaper_enabled():
        return 0

    owns_pool = pool is None
    stale_sec = companion_generic_stale_reap_after_seconds()
    batch = companion_generic_reaper_batch_limit()
    media_kinds = list(MEDIA_ASYNC_INTENT_KINDS)

    if owns_pool:
        from api.ewa_platform.workers.ewa_pool import open_initialized_ewa_worker_pool

        try:
            pool = await open_initialized_ewa_worker_pool(min_size=1, max_size=2)
        except RuntimeError:
            logger.warning("[COMPANION_GENERIC_STALE_REAPER] EWA_DATABASE_URL unset")
            return 0

    assert pool is not None
    # Process-level pool (E4): do not close after each sweep, including owns_pool path.
    reconciled = 0
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT *
            FROM ewa_companion_task_runs
            WHERE status IN ('pending', 'running')
              AND updated_at < NOW() - ($1::int * INTERVAL '1 second')
              AND (
                NOT (intent_kind = ANY($2::text[]))
                OR lower(coalesce(execution_mode, '')) = 'sync'
              )
            ORDER BY updated_at ASC
            LIMIT $3
            """,
            stale_sec,
            media_kinds,
            batch,
        )
    for row in rows:
        run = dict(row)
        # Async media: leave to domain reapers (UGS/EWRP).
        if (
            is_media_async_intent(str(run.get("intent_kind") or ""))
            and str(run.get("execution_mode") or "").strip().lower() == "async"
        ):
            continue
        if await terminalize_stale_companion_run(pool, run=run):
            reconciled += 1

    if reconciled:
        logger.warning(
            "[COMPANION_GENERIC_STALE_REAPER] reconciled=%s stale_sec=%s",
            reconciled,
            stale_sec,
        )
    return reconciled


__all__ = [
    "MEDIA_ASYNC_INTENT_KINDS",
    "companion_generic_reaper_batch_limit",
    "companion_generic_reaper_enabled",
    "companion_generic_stale_reap_after_seconds",
    "is_media_async_intent",
    "reap_stale_companion_generic_runs",
    "terminalize_stale_companion_run",
]
