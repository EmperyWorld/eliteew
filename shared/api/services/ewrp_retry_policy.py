# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Pure retry eligibility rules for EWRP jobs (failed restart vs stale in-progress re-queue).
# Invariants:
# - Stale threshold matches frontend `EWRP_HISTORY_STALE_AFTER_MS` (2 h).
# - No I/O imports — safe for unit tests without SQLAlchemy.
# Related:
# - api/routers/ewrp.py (`POST /ewrp/{job_id}/retry`)
# - shared/web/frontend/src/components/EWRP/EwrpGeneratorChunks.tsx
# ---

from __future__ import annotations

from datetime import UTC, datetime, timedelta

EWRP_STALE_JOB_AFTER_SEC = 2 * 60 * 60

_TERMINAL_STATUSES = frozenset({"completed", "failed"})


def _normalize_status(status: str | None) -> str:
    return (status or "").lower().strip()


def ewrp_retry_requires_billing(status: str | None) -> bool:
    """Failed jobs were refunded on pipeline failure — retry bills again."""
    return _normalize_status(status) == "failed"


def ewrp_job_is_stale_in_progress(
    status: str | None,
    updated_at: datetime | None,
    *,
    now: datetime | None = None,
) -> bool:
    """Non-terminal job with no progress update longer than the stale window."""
    norm = _normalize_status(status)
    if norm in _TERMINAL_STATUSES or not norm:
        return False
    if updated_at is None:
        return False
    ref = updated_at
    if ref.tzinfo is not None:
        ref = ref.astimezone(UTC).replace(tzinfo=None)
    moment = now or datetime.now(UTC).replace(tzinfo=None)
    if moment.tzinfo is not None:
        moment = moment.astimezone(UTC).replace(tzinfo=None)
    return (moment - ref) > timedelta(seconds=EWRP_STALE_JOB_AFTER_SEC)


def ewrp_job_retry_allowed(
    status: str | None,
    updated_at: datetime | None,
    *,
    now: datetime | None = None,
) -> bool:
    """Retry same job id: failed (re-bill) or stale in-progress (re-queue only)."""
    norm = _normalize_status(status)
    if norm == "failed":
        return True
    return ewrp_job_is_stale_in_progress(status, updated_at, now=now)
