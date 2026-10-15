# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Extended tests for UGS queue worker resilience (Redis lease, Postgres advisory fallback, detached finalize).
# Related:
# - api/services/ugs/queue_worker_resilience.py
# - api/services/ugs/detached_generation_failure.py
# - api/services/ugs/ugs_execution_context.py
# ---
"""Extended UGS queue worker resilience tests."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from api.core.database_manager import DatabaseConnectionError


@pytest.mark.anyio
async def test_acquire_ugs_worker_lease_uses_pg_when_redis_unavailable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from api.services.ugs import queue_worker_resilience as qwr

    async def _raise() -> None:
        raise DatabaseConnectionError("no redis")

    class _Result:
        def scalar(self) -> bool:
            return True

    db = AsyncMock()
    db.execute = AsyncMock(return_value=_Result())

    monkeypatch.setattr(qwr, "get_redis_client", _raise)
    ok, token = await qwr.acquire_ugs_worker_lease(
        "550e8400-e29b-41d4-a716-446655440000",
        db=db,
    )
    assert ok is True
    assert token is not None
    assert token.startswith("pg:")
    db.execute.assert_awaited()


@pytest.mark.anyio
async def test_acquire_ugs_worker_lease_pg_conflict_returns_false(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from api.services.ugs import queue_worker_resilience as qwr

    async def _raise() -> None:
        raise DatabaseConnectionError("no redis")

    class _Result:
        def scalar(self) -> bool:
            return False

    db = AsyncMock()
    db.execute = AsyncMock(return_value=_Result())

    monkeypatch.setattr(qwr, "get_redis_client", _raise)
    ok, token = await qwr.acquire_ugs_worker_lease(
        "550e8400-e29b-41d4-a716-446655440000",
        db=db,
    )
    assert ok is False
    assert token is None


@pytest.mark.anyio
async def test_release_ugs_worker_lease_unlocks_pg_token() -> None:
    from api.services.ugs import queue_worker_resilience as qwr

    db = AsyncMock()
    db.execute = AsyncMock(return_value=MagicMock())
    k1, k2 = qwr._advisory_lock_keys("550e8400-e29b-41d4-a716-446655440000")
    await qwr.release_ugs_worker_lease(
        "550e8400-e29b-41d4-a716-446655440000",
        f"pg:{k1}:{k2}",
        db=db,
    )
    db.execute.assert_awaited()


@pytest.mark.anyio
async def test_finalize_detached_generation_failure_skips_terminal(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from types import SimpleNamespace

    from api.services.ugs import detached_generation_failure as dgf

    request = SimpleNamespace(
        id="550e8400-e29b-41d4-a716-446655440000",
        status="completed",
        error_message=None,
        completed_at=None,
        updated_at=None,
        request_metadata={},
    )

    class _Result:
        def scalar_one_or_none(self):
            return request

    class _Session:
        async def execute(self, _stmt: object) -> _Result:
            return _Result()

        async def commit(self) -> None:
            return None

    class _Ctx:
        async def __aenter__(self) -> _Session:
            return _Session()

        async def __aexit__(self, *_args: object) -> None:
            return None

    class _Manager:
        def get_postgres_session(self) -> _Ctx:
            return _Ctx()

    async def _manager() -> _Manager:
        return _Manager()

    monkeypatch.setattr("api.core.database_manager.get_database_manager", _manager)
    await dgf.finalize_detached_generation_failure("550e8400-e29b-41d4-a716-446655440000", error_message="boom")


def test_nested_worker_context_roundtrip() -> None:
    from api.services.ugs.ugs_execution_context import (
        enter_ugs_worker_request_context,
        exit_ugs_worker_request_context,
        get_active_ugs_worker_request_id,
    )

    assert get_active_ugs_worker_request_id() is None
    token = enter_ugs_worker_request_context("parent-req")
    assert get_active_ugs_worker_request_id() == "parent-req"
    exit_ugs_worker_request_context(token)
    assert get_active_ugs_worker_request_id() is None


@pytest.mark.anyio
async def test_maybe_mark_ugs_request_failed_from_dlq_updates_non_terminal_row(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from api.services.ugs import queue_worker_resilience as qwr

    request = SimpleNamespace(
        id="550e8400-e29b-41d4-a716-446655440000",
        status="processing",
        error_message=None,
        completed_at=None,
        updated_at=None,
        request_metadata={"queue_status": "processing"},
        credits_used=2.0,
        user_id="user-1",
        generation_type=SimpleNamespace(id="type-1"),
    )

    class _Result:
        def scalar_one_or_none(self) -> SimpleNamespace:
            return request

    class _Session:
        def __init__(self) -> None:
            self.commit_calls = 0

        async def execute(self, _stmt: object) -> _Result:
            return _Result()

        async def commit(self) -> None:
            self.commit_calls += 1

    class _Ctx:
        def __init__(self, session: _Session) -> None:
            self._session = session

        async def __aenter__(self) -> _Session:
            return self._session

        async def __aexit__(self, *_args: object) -> None:
            return None

    class _Manager:
        def __init__(self, session: _Session) -> None:
            self._session = session

        def get_postgres_session(self) -> _Ctx:
            return _Ctx(self._session)

    class _QueueManager:
        calls: list[tuple[str, str]] = []

        def __init__(self, _db: object) -> None:
            pass

        async def update_queue_status(self, request_id: str, status: str) -> bool:
            self.calls.append((request_id, status))
            return True

    class _Metrics:
        calls: list[dict[str, object]] = []

        def __init__(self, _db: object) -> None:
            pass

        async def record_generation_complete(self, *args: object, **kwargs: object) -> None:
            self.calls.append({"args": args, "kwargs": kwargs})

    class _Billing:
        calls: list[tuple[str, int]] = []

        def __init__(self, _db: object) -> None:
            pass

        async def refund_credits(self, user_id: str, _generation_type: object, *, credit_amount: int) -> None:
            self.calls.append((user_id, credit_amount))

    session = _Session()

    async def _manager() -> _Manager:
        return _Manager(session)

    monkeypatch.setattr(qwr, "get_database_manager", _manager)
    monkeypatch.setattr("api.services.ugs.queue_manager_service.QueueManagerService", _QueueManager)
    monkeypatch.setattr("api.services.ugs.metrics_service.UGSMetricsService", _Metrics)
    monkeypatch.setattr("api.services.ugs.billing_service.BillingService", _Billing)

    await qwr.maybe_mark_ugs_request_failed_from_dlq(
        {
            "task_type": "ugs_generation",
            "request_id": str(request.id),
            "failed_attempts": 3,
            "last_error": "worker OOM",
            "source_queue": "ai.generation.queue",
        }
    )

    assert request.status == "failed"
    assert request.error_message == "worker OOM"
    assert request.request_metadata.get("queue_worker_dlq") is True
    assert request.request_metadata.get("queue_worker_source_queue") == "ai.generation.queue"
    assert request.request_metadata.get("queue_worker_failed_attempts") == 3
    assert session.commit_calls == 1
    assert _QueueManager.calls == [(str(request.id), "failed")]
    assert _Metrics.calls
    assert _Billing.calls == [("user-1", 2)]


@pytest.mark.anyio
async def test_maybe_mark_ugs_request_failed_from_dlq_skips_terminal_rows(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from api.services.ugs import queue_worker_resilience as qwr

    request = SimpleNamespace(
        id="550e8400-e29b-41d4-a716-446655440000",
        status="completed",
        request_metadata={},
        credits_used=0,
        user_id="user-1",
        generation_type=SimpleNamespace(id="type-1"),
    )

    class _Result:
        def scalar_one_or_none(self) -> SimpleNamespace:
            return request

    class _Session:
        def __init__(self) -> None:
            self.commit_calls = 0

        async def execute(self, _stmt: object) -> _Result:
            return _Result()

        async def commit(self) -> None:
            self.commit_calls += 1

    class _Ctx:
        def __init__(self, session: _Session) -> None:
            self._session = session

        async def __aenter__(self) -> _Session:
            return self._session

        async def __aexit__(self, *_args: object) -> None:
            return None

    class _Manager:
        def __init__(self, session: _Session) -> None:
            self._session = session

        def get_postgres_session(self) -> _Ctx:
            return _Ctx(self._session)

    class _QueueManager:
        calls: list[tuple[str, str]] = []

        def __init__(self, _db: object) -> None:
            pass

        async def update_queue_status(self, request_id: str, status: str) -> bool:
            self.calls.append((request_id, status))
            return True

    session = _Session()

    async def _manager() -> _Manager:
        return _Manager(session)

    monkeypatch.setattr(qwr, "get_database_manager", _manager)
    monkeypatch.setattr("api.services.ugs.queue_manager_service.QueueManagerService", _QueueManager)

    await qwr.maybe_mark_ugs_request_failed_from_dlq(
        {
            "task_type": "ugs_generation",
            "request_id": str(request.id),
            "failed_attempts": 2,
            "source_queue": "ai.generation.queue",
        }
    )

    assert request.status == "completed"
    assert session.commit_calls == 0
    assert _QueueManager.calls == []
