"""Unit tests: EWRP job retry policy."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from api.services.ewrp_retry_policy import (
    EWRP_STALE_JOB_AFTER_SEC,
    ewrp_job_is_stale_in_progress,
    ewrp_job_retry_allowed,
    ewrp_retry_requires_billing,
)


@pytest.mark.unit
def test_retry_requires_billing_only_for_failed() -> None:
    assert ewrp_retry_requires_billing("failed") is True
    assert ewrp_retry_requires_billing("queued") is False
    assert ewrp_retry_requires_billing("generating_images") is False


@pytest.mark.unit
def test_stale_in_progress_after_threshold() -> None:
    now = datetime(2026, 5, 27, 12, 0, 0, tzinfo=UTC)
    old = now - timedelta(seconds=EWRP_STALE_JOB_AFTER_SEC + 1)
    assert ewrp_job_is_stale_in_progress("queued", old, now=now) is True
    assert ewrp_job_is_stale_in_progress("generating_content", old, now=now) is True


@pytest.mark.unit
def test_stale_false_for_completed_and_recent() -> None:
    now = datetime(2026, 5, 27, 12, 0, 0, tzinfo=UTC)
    recent = now - timedelta(minutes=5)
    assert ewrp_job_is_stale_in_progress("completed", recent, now=now) is False
    assert ewrp_job_is_stale_in_progress("queued", recent, now=now) is False


@pytest.mark.unit
def test_retry_allowed_failed_or_stale() -> None:
    now = datetime(2026, 5, 27, 12, 0, 0, tzinfo=UTC)
    stale = now - timedelta(hours=3)
    assert ewrp_job_retry_allowed("failed", stale, now=now) is True
    assert ewrp_job_retry_allowed("queued", stale, now=now) is True
    recent = now - timedelta(minutes=10)
    assert ewrp_job_retry_allowed("queued", recent, now=now) is False
