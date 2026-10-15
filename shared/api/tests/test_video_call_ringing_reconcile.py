# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for periodic 1:1 video call ringing reconcile (stale no_answer / unreachable / redelivery).
# Invariants:
# - Uses mocked VideoCallService and Redis; no live Postgres/Celery broker required.
# Related:
# - api/tasks/video_call_ringing_reconcile.py
# ---

from __future__ import annotations

import importlib
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest

from api.video_calls.service import RingingCallRow

reconcile = importlib.import_module("api.tasks.video_call_ringing_reconcile")


def _ringing_row(
    *,
    call_id: str = "call-1",
    created_at: datetime,
    delivered_at: datetime | None = None,
    caller: str = "caller-1",
    callee: str = "callee-1",
    chat_id: str = "chat-1",
) -> RingingCallRow:
    return RingingCallRow(
        id=call_id,
        status="ringing",
        created_at=created_at,
        ringing_delivered_at=delivered_at,
        caller_user_id=caller,
        callee_user_id=callee,
        gaf_chat_id=chat_id,
    )


@pytest.mark.asyncio
async def test_reconcile_delivered_overdue_expires_no_answer(monkeypatch: pytest.MonkeyPatch) -> None:
    delivered_at = datetime(2026, 7, 31, 10, 0, 0, tzinfo=UTC)
    row = _ringing_row(
        created_at=delivered_at - timedelta(seconds=10),
        delivered_at=delivered_at,
    )
    now = delivered_at + timedelta(seconds=31)
    service = MagicMock()
    service.expire_ringing_call = AsyncMock(return_value=(["caller-1"], False))
    notify = AsyncMock()
    from api.tasks import video_call_ringing_watchdog as watchdog

    monkeypatch.setattr(watchdog, "_notify_call_ended", notify)

    action = await reconcile.reconcile_one_ringing_call(
        row=row,
        service=service,
        now=now,
        retry_count=3,
        interval_seconds=5,
        answer_timeout_seconds=30,
    )

    assert action == "expired_no_answer"
    service.expire_ringing_call.assert_awaited_once_with(call_id="call-1", missed_reason="no_answer")
    notify.assert_awaited_once()


@pytest.mark.asyncio
async def test_reconcile_delivered_still_in_window_noops() -> None:
    delivered_at = datetime(2026, 7, 31, 10, 0, 0, tzinfo=UTC)
    row = _ringing_row(
        created_at=delivered_at - timedelta(seconds=5),
        delivered_at=delivered_at,
    )
    now = delivered_at + timedelta(seconds=10)
    service = MagicMock()
    service.expire_ringing_call = AsyncMock()

    action = await reconcile.reconcile_one_ringing_call(
        row=row,
        service=service,
        now=now,
        retry_count=3,
        interval_seconds=5,
        answer_timeout_seconds=30,
    )

    assert action == "noop_delivered_in_window"
    service.expire_ringing_call.assert_not_called()


@pytest.mark.asyncio
async def test_reconcile_not_delivered_past_window_expires_unreachable(monkeypatch: pytest.MonkeyPatch) -> None:
    created_at = datetime(2026, 7, 31, 10, 0, 0, tzinfo=UTC)
    row = _ringing_row(created_at=created_at)
    now = created_at + timedelta(seconds=21)
    service = MagicMock()
    service.expire_ringing_call = AsyncMock(return_value=(["caller-1"], False))
    notify = AsyncMock()
    from api.tasks import video_call_ringing_watchdog as watchdog

    monkeypatch.setattr(watchdog, "_notify_call_ended", notify)
    monkeypatch.setattr(
        reconcile,
        "get_user_call_target",
        AsyncMock(return_value="mobile_only"),
    )

    action = await reconcile.reconcile_one_ringing_call(
        row=row,
        service=service,
        now=now,
        retry_count=3,
        interval_seconds=5,
        answer_timeout_seconds=30,
    )

    assert action == "expired_unreachable"
    service.expire_ringing_call.assert_awaited_once_with(
        call_id="call-1",
        missed_reason="callee_mobile_unreachable",
    )
    notify.assert_awaited_once()


@pytest.mark.asyncio
async def test_reconcile_not_delivered_in_window_schedules_redelivery(monkeypatch: pytest.MonkeyPatch) -> None:
    created_at = datetime(2026, 7, 31, 10, 0, 0, tzinfo=UTC)
    row = _ringing_row(created_at=created_at)
    now = created_at + timedelta(seconds=12)
    service = MagicMock()
    claim = AsyncMock(return_value=True)
    monkeypatch.setattr(reconcile, "claim_ring_reconcile_delivery", claim)
    apply_async = MagicMock()
    from api.tasks import video_call_ringing_watchdog as watchdog

    monkeypatch.setattr(watchdog.video_call_delivery_watchdog, "apply_async", apply_async)

    action = await reconcile.reconcile_one_ringing_call(
        row=row,
        service=service,
        now=now,
        retry_count=3,
        interval_seconds=5,
        answer_timeout_seconds=30,
    )

    assert action == "redelivery_scheduled"
    claim.assert_awaited_once_with(call_id="call-1", attempt=2, ttl_seconds=5)
    apply_async.assert_called_once()
    kwargs = apply_async.call_args.kwargs["kwargs"]
    assert kwargs["attempt"] == 2
    assert kwargs["incoming_payload"]["call_id"] == "call-1"
    assert kwargs["incoming_payload"]["participant_user_ids"] == ["caller-1", "callee-1"]


@pytest.mark.asyncio
async def test_reconcile_redelivery_skipped_when_redis_claim_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    created_at = datetime(2026, 7, 31, 10, 0, 0, tzinfo=UTC)
    row = _ringing_row(created_at=created_at)
    now = created_at + timedelta(seconds=6)
    service = MagicMock()
    monkeypatch.setattr(reconcile, "claim_ring_reconcile_delivery", AsyncMock(return_value=False))
    from api.tasks import video_call_ringing_watchdog as watchdog

    apply_async = MagicMock()
    monkeypatch.setattr(watchdog.video_call_delivery_watchdog, "apply_async", apply_async)

    action = await reconcile.reconcile_one_ringing_call(
        row=row,
        service=service,
        now=now,
        retry_count=3,
        interval_seconds=5,
        answer_timeout_seconds=30,
    )

    assert action == "redelivery_skipped"
    apply_async.assert_not_called()


@pytest.mark.asyncio
async def test_reconcile_stale_ringing_video_calls_async_aggregates_stats(monkeypatch: pytest.MonkeyPatch) -> None:
    created_at = datetime(2026, 7, 31, 10, 0, 0, tzinfo=UTC)
    rows = [
        _ringing_row(call_id="a", created_at=created_at),
        _ringing_row(
            call_id="b",
            created_at=created_at,
            delivered_at=created_at + timedelta(seconds=1),
        ),
    ]
    service = MagicMock()
    service.list_ringing_calls = AsyncMock(return_value=rows)
    monkeypatch.setattr(
        reconcile,
        "reconcile_one_ringing_call",
        AsyncMock(side_effect=["redelivery_scheduled", "expired_no_answer"]),
    )

    async def _fake_pool() -> MagicMock:
        return MagicMock()

    monkeypatch.setattr(
        "api.core.database_manager.get_asyncpg_pool",
        _fake_pool,
    )
    monkeypatch.setattr(
        reconcile,
        "VideoCallService",
        lambda pool: service,
    )

    stats = await reconcile.reconcile_stale_ringing_video_calls_async(
        limit=10,
        now=created_at + timedelta(seconds=40),
    )

    assert stats.scanned == 2
    assert stats.redelivery_scheduled == 1
    assert stats.expired_no_answer == 1


def test_ringing_call_row_incoming_payload_matches_create_shape() -> None:
    created_at = datetime(2026, 7, 31, 10, 0, 0, tzinfo=UTC)
    row = _ringing_row(created_at=created_at)
    payload = row.incoming_payload()
    assert payload == {
        "call_id": "call-1",
        "chat_id": "chat-1",
        "caller_user_id": "caller-1",
        "created_at": "2026-07-31T10:00:00+00:00",
        "participant_user_ids": ["caller-1", "callee-1"],
    }
