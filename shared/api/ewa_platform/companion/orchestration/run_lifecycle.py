# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Canonical task-run lifecycle helpers: terminal status sets, optimistic revision reads,
# and guards before Celery/API mutate the same ``ewa_companion_task_runs`` row.
# Invariants:
# - Postgres ``ewa_companion_task_runs`` is the source of truth (not Redis pub/sub).
# - ``expect_revision`` on updates prevents stale chat confirm vs worker completion races.
# - Callers treat ``(False, reason)`` from ``assert_run_executable`` as a no-op skip, not an exception.
# - E2 media workers must use ``apply_companion_run_terminal`` (OCC); reapers may pass force=True.
# Related:
# - api/ewa_platform/persistence_pg/companion_asyncpg.py
# - api/ewa_platform/companion/jobs/executor.py
# - api/ewa_platform/companion/orchestration/task_orchestrator.py
# - documentation/product/ewa/EWA-ECOSYSTEM-VULNERABILITY-MAP-2026-07-09.md (E2 / V-C2)
# ---
"""Companion durable task-run lifecycle (Postgres revision guards)."""

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any, Final

import asyncpg

logger = logging.getLogger(__name__)

TERMINAL_RUN_STATUSES: Final[frozenset[str]] = frozenset(
    {"completed", "failed", "cancelled"},
)

ACTIVE_RUN_STATUSES: Final[frozenset[str]] = frozenset(
    {"pending", "running", "awaiting_confirmation"},
)

EXECUTABLE_RUN_STATUSES: Final[frozenset[str]] = frozenset(
    {"pending", "running", "awaiting_confirmation"},
)


def normalize_run_status(run: Mapping[str, Any] | None) -> str:
    if run is None:
        return ""
    return str(run.get("status") or "").strip().lower()


def run_revision(run: Mapping[str, Any] | None) -> int | None:
    if run is None:
        return None
    raw = run.get("run_revision")
    try:
        return int(raw) if raw is not None else None
    except (TypeError, ValueError):  # fmt: skip
        return None


def is_run_terminal(status: str) -> bool:
    return str(status or "").strip().lower() in TERMINAL_RUN_STATUSES


def is_run_active(status: str) -> bool:
    return str(status or "").strip().lower() in ACTIVE_RUN_STATUSES


def assert_run_executable(run: Mapping[str, Any] | None) -> tuple[bool, str | None]:
    """Return ``(True, None)`` when a worker may advance steps; else ``(False, reason_code)``."""

    st = normalize_run_status(run)
    if not st:
        return False, "run_missing_status"
    if st == "cancelled":
        return False, "run_cancelled"
    if is_run_terminal(st):
        return False, f"run_terminal_{st}"
    if st not in EXECUTABLE_RUN_STATUSES:
        return False, f"run_status_{st}"
    return True, None


def log_run_skip(*, run_id: str, principal_id: str, reason: str, context: str) -> None:
    logger.info(
        "[STEP] companion_run_lifecycle_skip context=%s run_id=%s principal_id=%s reason=%s",
        context,
        run_id,
        principal_id,
        reason,
    )


async def apply_companion_run_terminal(
    pool: asyncpg.Pool,
    *,
    run: Mapping[str, Any],
    status: str,
    context: str,
    result_payload: Mapping[str, Any] | None = None,
    error_payload: Mapping[str, Any] | None = None,
    force: bool = False,
) -> dict[str, Any] | None:
    """Terminalize a companion run with OCC unless ``force`` (reaper/stale path).

    Returns the updated row, or ``None`` when skipped (cancelled/terminal/revision conflict).
    """

    from api.ewa_platform.persistence_pg.companion_asyncpg import companion_task_run_update

    run_id = str(run.get("id") or "").strip()
    principal_id = str(run.get("principal_id") or "").strip()
    if not run_id or not principal_id:
        return None

    expect: int | None
    if force:
        expect = None
    else:
        executable, reason = assert_run_executable(run)
        if not executable:
            log_run_skip(
                run_id=run_id,
                principal_id=principal_id,
                reason=str(reason or "not_executable"),
                context=context,
            )
            return None
        expect = run_revision(run)

    updated = await companion_task_run_update(
        pool,
        run_id=run_id,
        principal_id=principal_id,
        status=status,
        result_payload=result_payload,
        error_payload=error_payload,
        expect_revision=expect,
    )
    if updated is None:
        log_run_skip(
            run_id=run_id,
            principal_id=principal_id,
            reason="revision_conflict_or_terminal_guard",
            context=context,
        )
    return updated


__all__ = [
    "ACTIVE_RUN_STATUSES",
    "EXECUTABLE_RUN_STATUSES",
    "TERMINAL_RUN_STATUSES",
    "apply_companion_run_terminal",
    "assert_run_executable",
    "is_run_active",
    "is_run_terminal",
    "log_run_skip",
    "normalize_run_status",
    "run_revision",
]
