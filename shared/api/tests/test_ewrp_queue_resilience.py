"""Unit and behavioral tests for EWRP queue resilience."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from api.services.ewrp_queue_utils import truncate_ewrp_queue_error_message


def _scalar_result(value: object) -> MagicMock:
    result = MagicMock()
    result.scalar_one_or_none.return_value = value
    return result


class _FakeSessionCM:
    def __init__(self, db: AsyncMock) -> None:
        self._db = db

    async def __aenter__(self) -> AsyncMock:
        return self._db

    async def __aexit__(self, *_args: object) -> None:
        return None


def _mount_queue_db(monkeypatch: pytest.MonkeyPatch, db: AsyncMock) -> None:
    manager = MagicMock()
    manager.get_postgres_session = MagicMock(return_value=_FakeSessionCM(db))
    monkeypatch.setattr(
        "api.services.ewrp_queue_resilience.get_database_manager",
        AsyncMock(return_value=manager),
    )


@pytest.mark.unit
def test_truncate_ewrp_queue_error_message_short() -> None:
    assert truncate_ewrp_queue_error_message("ok") == "ok"


@pytest.mark.unit
def test_truncate_ewrp_queue_error_message_long() -> None:
    msg = "x" * 600
    out = truncate_ewrp_queue_error_message(msg, max_len=500)
    assert len(out) == 500
    assert out.endswith("...")


@pytest.mark.unit
def test_truncate_ewrp_queue_error_message_empty() -> None:
    assert truncate_ewrp_queue_error_message("") == "queue_worker_error"


@pytest.mark.anyio
async def test_finalize_marks_failed_and_refunds_in_progress_job(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from api.services.ewrp_queue_resilience import finalize_ewrp_job_queue_failure

    job_id = uuid4()
    user_id = uuid4()
    job = SimpleNamespace(
        id=job_id,
        status="generating_images",
        num_slides=5,
    )
    refund = AsyncMock(return_value=True)

    class FakeBilling:
        def __init__(self, _db: object) -> None:
            self.refund_credits = refund

    monkeypatch.setattr(
        "api.services.ewrp_queue_resilience.BillingService",
        FakeBilling,
    )

    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            _scalar_result(job),
            MagicMock(),
            _scalar_result(SimpleNamespace(type_key="ewrp_presentation")),
        ]
    )
    db.commit = AsyncMock()
    _mount_queue_db(monkeypatch, db)

    await finalize_ewrp_job_queue_failure(
        str(job_id),
        str(user_id),
        "MinIO unreachable",
    )

    assert db.execute.await_count == 3
    db.commit.assert_awaited_once()
    refund.assert_awaited_once()


@pytest.mark.anyio
async def test_finalize_skips_terminal_job(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.services.ewrp_queue_resilience import finalize_ewrp_job_queue_failure

    job_id = uuid4()
    job = SimpleNamespace(id=job_id, status="failed", num_slides=5)

    db = AsyncMock()
    db.execute = AsyncMock(return_value=_scalar_result(job))
    db.commit = AsyncMock()
    _mount_queue_db(monkeypatch, db)

    await finalize_ewrp_job_queue_failure(
        str(job_id),
        str(uuid4()),
        "late dlq",
    )

    db.commit.assert_not_awaited()


@pytest.mark.anyio
async def test_finalize_invalid_job_id_is_noop() -> None:
    from api.services.ewrp_queue_resilience import finalize_ewrp_job_queue_failure

    await finalize_ewrp_job_queue_failure("not-a-uuid", str(uuid4()), "err")


@pytest.mark.anyio
async def test_dlq_ignores_non_ewrp_task(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.services.ewrp_queue_resilience import maybe_mark_ewrp_job_failed_from_dlq

    finalize = AsyncMock()
    monkeypatch.setattr(
        "api.services.ewrp_queue_resilience.finalize_ewrp_job_queue_failure",
        finalize,
    )

    await maybe_mark_ewrp_job_failed_from_dlq(
        {"task_type": "other_task", "job_id": str(uuid4()), "user_id": str(uuid4())}
    )

    finalize.assert_not_awaited()


@pytest.mark.anyio
async def test_dlq_finalizes_ewrp_generate_payload(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.services.ewrp_queue_resilience import maybe_mark_ewrp_job_failed_from_dlq

    job_id = uuid4()
    user_id = uuid4()
    finalize = AsyncMock()
    monkeypatch.setattr(
        "api.services.ewrp_queue_resilience.finalize_ewrp_job_queue_failure",
        finalize,
    )

    await maybe_mark_ewrp_job_failed_from_dlq(
        {
            "task_type": "ewrp_generate",
            "job_id": str(job_id),
            "user_id": str(user_id),
            "last_error": "worker OOM",
            "source_queue": "ewrp_generate",
            "failed_attempts": 3,
        }
    )

    finalize.assert_awaited_once()
    finalize_call = finalize.await_args
    assert finalize_call is not None
    args = finalize_call.args
    assert args[0] == str(job_id)
    assert args[1] == str(user_id)
    assert "worker OOM" in str(args[2])
    assert "source_queue=ewrp_generate" in str(args[2])
