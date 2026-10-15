#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Celery tasks for 1:1 GAF video call ringing delivery retries and no-answer timeout.
# Invariants:
# - Idempotent: tasks no-op when call is no longer ringing.
# Related:
# - api.video_calls.delivery, api.video_calls.service
# ---

from __future__ import annotations

import logging
from uuid import UUID

from api.core.celery_async import run_celery_async
from api.core.unified_config import unified_settings
from api.tasks.celery_app import celery_app
from api.video_calls.delivery import (
    deliver_video_call_incoming,
)
from api.video_calls.service import VideoCallService

logger = logging.getLogger(__name__)


async def _run_delivery_attempt(
    *,
    call_id: str,
    callee_user_id: str,
    caller_user_id: str,
    chat_id: str | None,
    attempt: int,
    incoming_payload: dict[str, object],
) -> None:
    from api.core.database_manager import get_asyncpg_pool

    pool = await get_asyncpg_pool()
    service = VideoCallService(pool)
    call_uuid = UUID(str(call_id))
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT status, ringing_delivered_at
            FROM video_calls
            WHERE id = $1
            """,
            call_uuid,
        )
    if not row or str(row["status"]) != "ringing":
        logger.info("[STEP] video_call_watchdog_skip call_id=%s reason=not_ringing", call_id)
        return

    from api.video_calls.call_target import (
        callee_has_call_target_socket,
        get_user_call_target,
        missed_reason_for_unreachable,
        normalize_call_target,
        should_send_mobile_call_push,
    )

    raw_target = incoming_payload.get("call_target")
    call_target = (
        normalize_call_target(raw_target) if raw_target is not None else await get_user_call_target(callee_user_id)
    )
    if attempt == 0:
        delivered = await callee_has_call_target_socket(callee_user_id, call_target)
        if not delivered and should_send_mobile_call_push(call_target):
            try:
                from api.services.mobile_push_service import _fcm_configured, _list_android_tokens

                if _fcm_configured():
                    tokens = await _list_android_tokens(callee_user_id)
                    delivered = bool(tokens)
            except Exception:
                logger.debug("[STEP] video_call_delivery_token_probe_failed", exc_info=True)
    else:
        delivered = await deliver_video_call_incoming(callee_user_id, incoming_payload)
    if delivered:
        delivered_at = await service.mark_ringing_delivered(call_id=call_id)
        if delivered_at and row["ringing_delivered_at"] is None:
            timeout_s = unified_settings.video_call_ringing_answer_timeout_seconds
            video_call_answer_timeout.apply_async(
                args=[call_id],
                countdown=timeout_s,
            )
            logger.info(
                "[STEP] video_call_delivered call_id=%s attempt=%s answer_timeout_in=%ss",
                call_id,
                attempt,
                timeout_s,
            )
        return

    max_attempts = unified_settings.video_call_delivery_retry_count
    if attempt + 1 >= max_attempts:
        missed_reason = missed_reason_for_unreachable(call_target)
        others, already_ended = await service.expire_ringing_call(
            call_id=call_id,
            missed_reason=missed_reason,
        )
        if not already_ended:
            await _notify_call_ended(
                call_id=call_id,
                ended_by_user_id=caller_user_id,
                other_user_ids=others,
                missed_reason=missed_reason,
                status="missed",
            )
        logger.info(
            "[STEP] video_call_unreachable call_id=%s attempts=%s reason=%s",
            call_id,
            attempt + 1,
            missed_reason,
        )
        return

    interval = unified_settings.video_call_delivery_retry_interval_seconds
    video_call_delivery_watchdog.apply_async(
        kwargs={
            "call_id": call_id,
            "callee_user_id": callee_user_id,
            "caller_user_id": caller_user_id,
            "chat_id": chat_id,
            "attempt": attempt + 1,
            "incoming_payload": incoming_payload,
        },
        countdown=interval,
    )
    logger.info(
        "[STEP] video_call_delivery_retry_scheduled call_id=%s next_attempt=%s in=%ss",
        call_id,
        attempt + 1,
        interval,
    )


async def _run_answer_timeout(call_id: str) -> None:
    from api.core.database_manager import get_asyncpg_pool

    pool = await get_asyncpg_pool()
    service = VideoCallService(pool)
    call_uuid = UUID(str(call_id))
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT status, caller_user_id::text, callee_user_id::text
            FROM video_calls
            WHERE id = $1
            """,
            call_uuid,
        )
    if not row or str(row["status"]) != "ringing":
        return
    caller_id = str(row["caller_user_id"])
    others, already_ended = await service.expire_ringing_call(
        call_id=call_id,
        missed_reason="no_answer",
    )
    if not already_ended:
        await _notify_call_ended(
            call_id=call_id,
            ended_by_user_id=caller_id,
            other_user_ids=others,
            missed_reason="no_answer",
            status="missed",
        )
    logger.info("[STEP] video_call_no_answer_timeout call_id=%s", call_id)


async def _notify_call_ended(
    *,
    call_id: str,
    ended_by_user_id: str,
    other_user_ids: list[str],
    missed_reason: str | None,
    status: str,
) -> None:
    from api.routers.socketio_handler import emit_video_call_ended

    payload = {
        "call_id": call_id,
        "ended_by_user_id": ended_by_user_id,
        "status": status,
        "missed_reason": missed_reason,
    }
    for user_id in other_user_ids:
        await emit_video_call_ended(user_id, payload)


def schedule_video_call_ringing_watchdog(
    *,
    call_id: str,
    callee_user_id: str,
    caller_user_id: str,
    chat_id: str | None,
    incoming_payload: dict[str, object],
) -> None:
    """Enqueue first delivery attempt (attempt 0 runs immediately)."""
    try:
        video_call_delivery_watchdog.apply_async(
            kwargs={
                "call_id": call_id,
                "callee_user_id": callee_user_id,
                "caller_user_id": caller_user_id,
                "chat_id": chat_id,
                "attempt": 0,
                "incoming_payload": incoming_payload,
            },
            countdown=0,
        )
    except Exception:
        logger.warning("[STEP] video_call_watchdog_enqueue_failed call_id=%s", call_id, exc_info=True)


@celery_app.task(
    bind=True,
    name="api.tasks.video_call_ringing_watchdog.video_call_delivery_watchdog",
    max_retries=0,
)
def video_call_delivery_watchdog(
    self,
    *,
    call_id: str,
    callee_user_id: str,
    caller_user_id: str,
    chat_id: str | None,
    attempt: int,
    incoming_payload: dict[str, object],
) -> None:
    del self
    run_celery_async(
        _run_delivery_attempt(
            call_id=call_id,
            callee_user_id=callee_user_id,
            caller_user_id=caller_user_id,
            chat_id=chat_id,
            attempt=attempt,
            incoming_payload=incoming_payload,
        )
    )


@celery_app.task(
    bind=True,
    name="api.tasks.video_call_ringing_watchdog.video_call_answer_timeout",
    max_retries=0,
)
def video_call_answer_timeout(self, call_id: str) -> None:
    del self
    run_celery_async(_run_answer_timeout(call_id))
