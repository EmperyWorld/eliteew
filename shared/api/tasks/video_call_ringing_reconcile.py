#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Periodic reconcile for stale 1:1 ringing video calls (lost Celery countdown recovery).
# Invariants:
# - No-op when call is no longer ringing; Redis SET NX dedupes re-delivery per attempt window.
# Related:
# - api.video_calls.service, api.tasks.video_call_ringing_watchdog
# ---

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from api.core.celery_async import run_celery_async
from api.core.unified_config import unified_settings
from api.tasks.celery_app import celery_app
from api.video_calls.call_target import get_user_call_target, missed_reason_for_unreachable
from api.video_calls.service import RingingCallRow, VideoCallService

logger = logging.getLogger(__name__)

_RECONCILE_REDIS_KEY_PREFIX = "video_call:ring_reconcile"


@dataclass(frozen=True)
class RingingReconcileStats:
    scanned: int = 0
    expired_no_answer: int = 0
    expired_unreachable: int = 0
    redelivery_scheduled: int = 0
    redelivery_skipped: int = 0


def _ensure_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


async def claim_ring_reconcile_delivery(*, call_id: str, attempt: int, ttl_seconds: int) -> bool:
    """SET NX guard so beat reconcile does not fan out duplicate delivery tasks."""
    from api.core.database_manager import get_database_manager

    manager = await get_database_manager()
    redis = await manager.get_redis_client()
    key = f"{_RECONCILE_REDIS_KEY_PREFIX}:{call_id}:{attempt}"
    ok = await redis.set(key, "1", nx=True, ex=max(1, int(ttl_seconds)))
    return bool(ok)


async def reconcile_one_ringing_call(
    *,
    row: RingingCallRow,
    service: VideoCallService,
    now: datetime,
    retry_count: int,
    interval_seconds: int,
    answer_timeout_seconds: int,
) -> str:
    """Reconcile a single ringing row. Returns action label for stats."""
    from api.tasks.video_call_ringing_watchdog import (
        _notify_call_ended,
        video_call_delivery_watchdog,
    )

    now_utc = _ensure_utc(now)
    delivered_at = row.ringing_delivered_at
    if delivered_at is not None:
        deadline = _ensure_utc(delivered_at) + timedelta(seconds=answer_timeout_seconds)
        if now_utc < deadline:
            return "noop_delivered_in_window"
        others, already_ended = await service.expire_ringing_call(
            call_id=row.id,
            missed_reason="no_answer",
        )
        if not already_ended:
            await _notify_call_ended(
                call_id=row.id,
                ended_by_user_id=row.caller_user_id,
                other_user_ids=others,
                missed_reason="no_answer",
                status="missed",
            )
        logger.info("[STEP] video_call_reconcile_no_answer call_id=%s", row.id)
        return "expired_no_answer"

    created_at = _ensure_utc(row.created_at)
    elapsed = (now_utc - created_at).total_seconds()
    grace = interval_seconds
    max_window = retry_count * interval_seconds + grace
    if elapsed > max_window:
        call_target = await get_user_call_target(row.callee_user_id)
        missed_reason = missed_reason_for_unreachable(call_target)
        others, already_ended = await service.expire_ringing_call(
            call_id=row.id,
            missed_reason=missed_reason,
        )
        if not already_ended:
            await _notify_call_ended(
                call_id=row.id,
                ended_by_user_id=row.caller_user_id,
                other_user_ids=others,
                missed_reason=missed_reason,
                status="missed",
            )
        logger.info(
            "[STEP] video_call_reconcile_unreachable call_id=%s reason=%s elapsed=%ss",
            row.id,
            missed_reason,
            int(elapsed),
        )
        return "expired_unreachable"

    attempt = min(int(elapsed // interval_seconds), max(0, retry_count - 1))
    if not await claim_ring_reconcile_delivery(
        call_id=row.id,
        attempt=attempt,
        ttl_seconds=interval_seconds,
    ):
        return "redelivery_skipped"

    incoming_payload = row.incoming_payload()
    video_call_delivery_watchdog.apply_async(
        kwargs={
            "call_id": row.id,
            "callee_user_id": row.callee_user_id,
            "caller_user_id": row.caller_user_id,
            "chat_id": row.gaf_chat_id,
            "attempt": attempt,
            "incoming_payload": incoming_payload,
        },
        countdown=0,
    )
    logger.info(
        "[STEP] video_call_reconcile_redelivery call_id=%s attempt=%s elapsed=%ss",
        row.id,
        attempt,
        int(elapsed),
    )
    return "redelivery_scheduled"


async def reconcile_stale_ringing_video_calls_async(
    *,
    limit: int = 50,
    now: datetime | None = None,
) -> RingingReconcileStats:
    from api.core.database_manager import get_asyncpg_pool

    pool = await get_asyncpg_pool()
    service = VideoCallService(pool)
    rows = await service.list_ringing_calls(limit=limit)
    if not rows:
        return RingingReconcileStats()

    now_utc = _ensure_utc(now or datetime.now(UTC))
    retry_count = unified_settings.video_call_delivery_retry_count
    interval_seconds = unified_settings.video_call_delivery_retry_interval_seconds
    answer_timeout_seconds = unified_settings.video_call_ringing_answer_timeout_seconds

    expired_no_answer = 0
    expired_unreachable = 0
    redelivery_scheduled = 0
    redelivery_skipped = 0

    for row in rows:
        action = await reconcile_one_ringing_call(
            row=row,
            service=service,
            now=now_utc,
            retry_count=retry_count,
            interval_seconds=interval_seconds,
            answer_timeout_seconds=answer_timeout_seconds,
        )
        if action == "expired_no_answer":
            expired_no_answer += 1
        elif action == "expired_unreachable":
            expired_unreachable += 1
        elif action == "redelivery_scheduled":
            redelivery_scheduled += 1
        elif action == "redelivery_skipped":
            redelivery_skipped += 1

    return RingingReconcileStats(
        scanned=len(rows),
        expired_no_answer=expired_no_answer,
        expired_unreachable=expired_unreachable,
        redelivery_scheduled=redelivery_scheduled,
        redelivery_skipped=redelivery_skipped,
    )


@celery_app.task(
    bind=True,
    name="api.tasks.video_call_ringing_reconcile.reconcile_stale_ringing_video_calls",
    max_retries=0,
)
def reconcile_stale_ringing_video_calls(self, *, limit: int = 50) -> dict[str, int]:
    del self
    stats = run_celery_async(reconcile_stale_ringing_video_calls_async(limit=int(limit)))
    return {
        "scanned": stats.scanned,
        "expired_no_answer": stats.expired_no_answer,
        "expired_unreachable": stats.expired_unreachable,
        "redelivery_scheduled": stats.redelivery_scheduled,
        "redelivery_skipped": stats.redelivery_skipped,
    }
