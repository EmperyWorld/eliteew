# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Contract tests for QueueManagerService stale cleanup orchestration and stale-candidate mapping.
# Invariants:
# - Tests do not require a live Postgres instance; DB writes are mocked at service boundary.
# - Cleanup reasons/keys must stay stable for operator snapshots and runbooks.
# Related:
# - api/services/ugs/queue_manager_service.py
# - api/services/ugs/queue_stale_reconciliation.py
# - api/services/ugs/queue_ops_snapshot.py
# ---
"""Queue manager runtime contracts for stale cleanup flow."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest


@pytest.mark.asyncio
async def test_cleanup_stale_request_states_commits_and_runs_post_cleanup() -> None:
    """When stale rows are found, cleanup commits once and re-runs queue cleanup after marking."""
    from api.services.ugs.queue_manager_service import QueueManagerService

    db = AsyncMock()
    svc = QueueManagerService(db)

    svc.cleanup_stale_entries = AsyncMock(return_value=0)  # type: ignore[method-assign]
    svc._mark_stale_requests_failed = AsyncMock(side_effect=[2, 3])  # type: ignore[method-assign]
    svc._mark_stale_processing_requests = AsyncMock(return_value=1)  # type: ignore[method-assign]

    updated = await svc.cleanup_stale_request_states()

    assert updated == 6
    assert svc.cleanup_stale_entries.await_count == 2
    db.commit.assert_awaited_once()
    reasons = [call.kwargs.get("cleanup_reason") for call in svc._mark_stale_requests_failed.await_args_list]
    assert reasons == ["stale_pending_orphaned", "stale_pending_queue_timeout"]


@pytest.mark.asyncio
async def test_cleanup_stale_request_states_skips_commit_without_updates() -> None:
    """No stale rows means no commit and no post-marking queue cleanup."""
    from api.services.ugs.queue_manager_service import QueueManagerService

    db = AsyncMock()
    svc = QueueManagerService(db)

    svc.cleanup_stale_entries = AsyncMock(return_value=0)  # type: ignore[method-assign]
    svc._mark_stale_requests_failed = AsyncMock(side_effect=[0, 0])  # type: ignore[method-assign]
    svc._mark_stale_processing_requests = AsyncMock(return_value=0)  # type: ignore[method-assign]

    updated = await svc.cleanup_stale_request_states()

    assert updated == 0
    db.commit.assert_not_awaited()
    assert svc.cleanup_stale_entries.await_count == 1


@pytest.mark.asyncio
async def test_count_stale_candidates_uses_stable_operator_keys() -> None:
    """Queue-ops snapshot depends on stable stale-candidate key names."""
    from api.services.ugs.queue_manager_service import QueueManagerService

    svc = QueueManagerService(AsyncMock())
    svc._count_stale_candidates = AsyncMock(side_effect=[4, 5])  # type: ignore[method-assign]
    svc._count_stale_processing_candidates = AsyncMock(return_value=6)  # type: ignore[method-assign]

    counts = await svc.count_stale_candidates()

    assert counts == {
        "stale_pending_orphaned": 4,
        "stale_pending_queue_timeout": 5,
        "stale_processing_timeout": 6,
    }
    assert svc._count_stale_candidates.await_count == 2


@pytest.mark.asyncio
async def test_maybe_cleanup_stale_request_states_throttles_by_interval(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Hot polling paths should not run full stale cleanup on every request."""
    from api.services.ugs import queue_stale_reconciliation as qsr
    from api.services.ugs.queue_manager_service import QueueManagerService

    db = AsyncMock()
    svc = QueueManagerService(db)
    svc.cleanup_stale_request_states = AsyncMock(return_value=9)  # type: ignore[method-assign]

    monkeypatch.setattr(qsr, "ugs_list_stale_cleanup_interval_seconds", lambda: 60)
    qsr._list_stale_cleanup_last_monotonic = 0.0
    times = iter([100.0, 110.0, 190.0])
    monkeypatch.setattr(qsr, "time", SimpleNamespace(monotonic=lambda: next(times)))

    first = await svc.maybe_cleanup_stale_request_states()
    second = await svc.maybe_cleanup_stale_request_states()
    third = await svc.maybe_cleanup_stale_request_states()
    forced = await svc.maybe_cleanup_stale_request_states(force=True)

    assert first == 9
    assert second == 0
    assert third == 9
    assert forced == 9
    assert svc.cleanup_stale_request_states.await_count == 3
