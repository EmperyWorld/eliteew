# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Gate G1 reliability helpers: mirror sync must not block enqueue; IntegrityError
# and other non-retryable DB faults terminalize the agentic session instead of
# Celery blind retries.
# Invariants:
# - safe_sync_and_publish never raises to the caller.
# - is_nonretryable_agentic_error is pure and side-effect free.
# Related:
# - documentation/product/ewa/EWA-FORENSIC-AUDIT-RECOVERY-PLAN-2026-07-09.md (Gate G1)
# ---

from __future__ import annotations

import logging
from collections.abc import Mapping
from contextlib import suppress
from typing import Any

from api.ewa_platform.agentic.adapters.task_run_events import sync_and_publish_task_run_from_session
from api.ewa_platform.agentic.config import agentic_step_scheduler_enabled
from api.ewa_platform.agentic.jobs.enqueue import enqueue_agentic_loop_tick, enqueue_agentic_step
from api.ewa_platform.agentic.kernel import state_machine as fsm

logger = logging.getLogger(__name__)

# Name-based: asyncpg exposes these under asyncpg.exceptions, not always on the
# top-level asyncpg module (version-dependent). Matching by type name is stable.
_NONRETRYABLE_TYPE_NAMES = frozenset(
    {
        "IntegrityError",
        "NotNullViolationError",
        "ForeignKeyViolationError",
        "UniqueViolationError",
        "CheckViolationError",
        "RestrictViolationError",
        "ExclusionViolationError",
        "DataError",
        "InterfaceError",
        "DatatypeMismatchError",
    },
)


def is_nonretryable_agentic_error(exc: BaseException) -> bool:
    """Return True for DB/schema faults that must not be Celery-retried."""

    name = type(exc).__name__
    if name in _NONRETRYABLE_TYPE_NAMES:
        return True
    # Nested causes (Celery / run_celery_async wrappers)
    cause = getattr(exc, "__cause__", None)
    if isinstance(cause, BaseException) and cause is not exc:
        return is_nonretryable_agentic_error(cause)
    return False


def is_agentic_celery_soft_timeout(exc: BaseException) -> bool:
    """Return True for Celery/billiard SoftTimeLimitExceeded (incl. wrapped causes)."""

    name = type(exc).__name__
    if name == "SoftTimeLimitExceeded":
        return True
    cause = getattr(exc, "__cause__", None)
    if isinstance(cause, BaseException) and cause is not exc:
        return is_agentic_celery_soft_timeout(cause)
    context = getattr(exc, "__context__", None)
    if isinstance(context, BaseException) and context is not exc:
        return is_agentic_celery_soft_timeout(context)
    return False


async def safe_sync_and_publish_task_run_from_session(
    pool: Any,
    *,
    session: Mapping[str, Any],
) -> bool:
    """Best-effort Operations mirror sync. Never raises; returns False on failure."""

    sid = str(session.get("id") or "").strip()
    try:
        await sync_and_publish_task_run_from_session(pool, session=session)
        return True
    except Exception as exc:  # noqa: BLE001 — mirror must not abort progress
        logger.exception(
            "[STEP] agentic_mirror_sync_failed session_id=%s err=%s will_reschedule=deferred",
            sid,
            exc,
        )
        with suppress(Exception):
            from api.monitoring.metrics import observe_ewa_agentic_mirror_sync_fail

            observe_ewa_agentic_mirror_sync_fail()
        return False


def reschedule_after_loop_tick(
    *,
    session_id: str,
    principal_id: str,
    session: Mapping[str, Any],
    mirror_ok: bool,
) -> str | None:
    """Enqueue next loop tick or step after a successful tick body (mirror-independent)."""

    session_status = str(session.get("status") or "")
    if agentic_step_scheduler_enabled() and session_status == fsm.STATUS_EXECUTING:
        task_id = enqueue_agentic_step(session_id=session_id, principal_id=principal_id)
        kind = "step"
    else:
        task_id = enqueue_agentic_loop_tick(
            session_id=session_id,
            principal_id=principal_id,
            expected_revision=int(session.get("session_revision") or 0),
        )
        kind = "loop_tick"
    logger.info(
        "[STEP] agentic_job_enqueued session_id=%s kind=%s celery_task_id=%s mirror_ok=%s",
        session_id,
        kind,
        task_id,
        mirror_ok,
    )
    return task_id


async def terminalize_session_nonretryable(
    pool: Any,
    *,
    session_id: str,
    principal_id: str,
    exc: BaseException,
    expect_revision: int | None = None,
) -> dict[str, Any] | None:
    """Force session → failed and best-effort mirror sync after a non-retryable fault."""

    sid = str(session_id or "").strip()
    pid = str(principal_id or "").strip()
    if not sid or not pid:
        return None

    reason = f"nonretryable:{type(exc).__name__}:{exc}"[:2000]
    tr = await fsm.apply_session_transition(
        pool,
        session_id=sid,
        principal_id=pid,
        event="fatal_error",
        expect_revision=expect_revision,
        clear_lease=True,
    )
    if not tr.ok and expect_revision is not None:
        # Revision may have drifted during the failed tick — force terminal without OCC.
        tr = await fsm.apply_session_transition(
            pool,
            session_id=sid,
            principal_id=pid,
            event="fatal_error",
            expect_revision=None,
            clear_lease=True,
        )
    session = tr.session
    if session is None:
        logger.warning(
            "[STEP] agentic_terminalize_nonretryable_failed session_id=%s reason=%s detail=%s",
            sid,
            tr.reason,
            reason,
        )
        return None

    mirror_ok = await safe_sync_and_publish_task_run_from_session(pool, session=session)
    with suppress(Exception):
        from api.monitoring.metrics import observe_ewa_agentic_celery_nonretryable

        observe_ewa_agentic_celery_nonretryable(error_class=type(exc).__name__)
    logger.error(
        "[STEP] agentic_session_terminalized_nonretryable session_id=%s status=%s mirror_ok=%s err=%s",
        sid,
        session.get("status"),
        mirror_ok,
        reason,
    )
    return session


__all__ = (
    "is_agentic_celery_soft_timeout",
    "is_nonretryable_agentic_error",
    "reschedule_after_loop_tick",
    "safe_sync_and_publish_task_run_from_session",
    "terminalize_session_nonretryable",
)
