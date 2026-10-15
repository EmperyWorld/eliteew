# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# HTTP API for app-internal GAF video calls and short-lived meeting tokens.
# Invariants:
# - 1:1 create does not return join_url until callee accepts (active),
#   except when the callee reuses create on an existing ringing call (accept-via-create).
# - Meeting JWT responses are never cacheable.
# - GET /pending-incoming recovers desktop incoming UI when Socket.IO missed the event.
# Related:
# - api/video_calls/service.py
# - documentation/product/INTERNAL-VIDEO-CALLS.md
# ---

from __future__ import annotations

from datetime import UTC, datetime
from typing import Never

import structlog  # type: ignore[import-not-found]
from fastapi import APIRouter, Depends, HTTPException, Response, status

from api.core.database_manager import get_asyncpg_pool
from api.dependencies.user_context import get_current_user_db_id
from api.routers.socketio_handler import (
    emit_video_call_accepted,
    emit_video_call_ended,
    emit_video_call_incoming,
)
from api.tasks.video_call_ringing_watchdog import schedule_video_call_ringing_watchdog
from api.video_calls.schemas import (
    GroupGafVideoCallCreateRequest,
    VideoCallCreateResponse,
    VideoCallEndResponse,
    VideoCallInviteRequest,
    VideoCallInviteResponse,
    VideoCallJoinResponse,
    VideoCallPendingIncomingItem,
)
from api.video_calls.service import (
    VideoCallAwaitingAcceptError,
    VideoCallConfigError,
    VideoCallEndedError,
    VideoCallNotFoundError,
    VideoCallService,
)

logger = structlog.get_logger("api.video_calls.router")

router = APIRouter(prefix="/video-calls", tags=["Video Calls"])


def set_video_calls_no_cache(response: Response) -> None:
    """Meeting JWT responses are personal and must not be cached."""

    response.headers["Cache-Control"] = "private, no-store, no-cache, max-age=0, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"


async def get_video_call_service() -> VideoCallService:
    pool = await get_asyncpg_pool()
    return VideoCallService(pool)


def _raise_call_error(exc: ValueError | RuntimeError) -> Never:
    detail = str(exc)
    if isinstance(exc, VideoCallConfigError):
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=detail) from exc
    if isinstance(exc, VideoCallAwaitingAcceptError):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail) from exc
    if isinstance(exc, VideoCallEndedError):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail) from exc
    if isinstance(exc, VideoCallNotFoundError) or "not found" in detail.lower():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail) from exc
    lowered = detail.lower()
    if "not a participant" in lowered or "blocked" in lowered or "заблок" in lowered:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail) from exc
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail) from exc


def _ended_payload(
    *,
    call_id: str,
    ended_by_user_id: str,
    call_status: str | None,
    missed_reason: str | None,
) -> dict[str, str]:
    payload: dict[str, str] = {
        "call_id": call_id,
        "ended_by_user_id": ended_by_user_id,
    }
    if call_status:
        payload["status"] = call_status
    if missed_reason:
        payload["missed_reason"] = missed_reason
    return payload


@router.post(
    "/gaf-chats/{chat_id}",
    response_model=VideoCallCreateResponse,
    dependencies=[Depends(set_video_calls_no_cache)],
    summary="Start a video call for a GAF chat",
)
async def create_gaf_video_call(
    chat_id: str,
    current_user_id: str = Depends(get_current_user_db_id),
    service: VideoCallService = Depends(get_video_call_service),
) -> VideoCallCreateResponse:
    """Start a 1:1 internal call; only GAF chat participants can create it."""

    try:
        result = await service.create_gaf_call(chat_id=chat_id, caller_user_id=current_user_id)
    except (ValueError, RuntimeError) as exc:
        _raise_call_error(exc)
    response = result.response
    if result.created:
        incoming_payload = {
            "call_id": response.call_id,
            "chat_id": response.chat_id,
            "caller_user_id": current_user_id,
            "created_at": datetime.now(UTC).isoformat(),
            "participant_user_ids": [current_user_id, result.peer_user_id],
        }
        await emit_video_call_incoming(result.peer_user_id, incoming_payload)
        schedule_video_call_ringing_watchdog(
            call_id=response.call_id,
            callee_user_id=result.peer_user_id,
            caller_user_id=current_user_id,
            chat_id=response.chat_id,
            incoming_payload=incoming_payload,
        )
    elif (
        result.accepted_now
        and result.call_kind == "direct"
        and result.caller_user_id
        and result.caller_user_id != current_user_id
    ):
        accepted_payload = {
            "call_id": response.call_id,
            "chat_id": result.chat_id,
            "accepted_by_user_id": current_user_id,
        }
        await emit_video_call_accepted(result.caller_user_id, accepted_payload)
        await emit_video_call_accepted(current_user_id, accepted_payload)
        logger.info(
            "video_call_accepted_via_create_reuse",
            call_id=response.call_id,
            caller=result.caller_user_id,
        )
    return response


@router.get(
    "/pending-incoming",
    response_model=list[VideoCallPendingIncomingItem],
    dependencies=[Depends(set_video_calls_no_cache)],
    summary="List ringing 1:1 calls waiting for this user as callee",
)
async def list_pending_incoming_video_calls(
    current_user_id: str = Depends(get_current_user_db_id),
    service: VideoCallService = Depends(get_video_call_service),
) -> list[VideoCallPendingIncomingItem]:
    """Recovery path when Socket.IO missed video_call.incoming (desktop-client)."""

    return await service.list_pending_incoming_for_user(user_id=current_user_id)


@router.post(
    "/gaf-chats/{chat_id}/group",
    response_model=VideoCallCreateResponse,
    dependencies=[Depends(set_video_calls_no_cache)],
    summary="Start a group video call for a GAF chat",
)
async def create_gaf_group_video_call(
    chat_id: str,
    body: GroupGafVideoCallCreateRequest,
    current_user_id: str = Depends(get_current_user_db_id),
    service: VideoCallService = Depends(get_video_call_service),
) -> VideoCallCreateResponse:
    """Start a group call with the chat partner plus at least one more friend."""

    try:
        response, invited_user_ids, created = await service.create_gaf_group_call(
            chat_id=chat_id,
            host_user_id=current_user_id,
            additional_participant_ids=body.additional_participant_ids,
        )
    except (ValueError, RuntimeError) as exc:
        _raise_call_error(exc)
    if created:
        all_participant_ids = list(dict.fromkeys([current_user_id, *invited_user_ids]))
        payload = {
            "call_id": response.call_id,
            "chat_id": response.chat_id,
            "caller_user_id": current_user_id,
            "created_at": datetime.now(UTC).isoformat(),
            "call_kind": "group",
            "participant_user_ids": all_participant_ids,
        }
        for invitee_id in invited_user_ids:
            await emit_video_call_incoming(invitee_id, payload)
    return response


@router.post(
    "/{call_id}/invite",
    response_model=VideoCallInviteResponse,
    summary="Invite friends into an active group video call",
)
async def invite_to_video_call(
    call_id: str,
    body: VideoCallInviteRequest,
    current_user_id: str = Depends(get_current_user_db_id),
    service: VideoCallService = Depends(get_video_call_service),
) -> VideoCallInviteResponse:
    """Notify newly invited friends about an existing group call."""

    try:
        invited_user_ids = await service.invite_to_call(
            call_id=call_id,
            inviter_user_id=current_user_id,
            participant_user_ids=body.participant_user_ids,
        )
    except (ValueError, RuntimeError) as exc:
        _raise_call_error(exc)
    if invited_user_ids:
        payload = {
            "call_id": call_id,
            "chat_id": None,
            "caller_user_id": current_user_id,
            "created_at": datetime.now(UTC).isoformat(),
            "call_kind": "group",
        }
        for invitee_id in invited_user_ids:
            await emit_video_call_incoming(invitee_id, payload)
        logger.info("video_call_invite_notified", call_id=call_id, invited=len(invited_user_ids))
    return VideoCallInviteResponse(call_id=call_id, invited_user_ids=invited_user_ids)


@router.post(
    "/{call_id}/join",
    response_model=VideoCallJoinResponse,
    dependencies=[Depends(set_video_calls_no_cache)],
    summary="Join an existing internal video call",
)
async def join_video_call(
    call_id: str,
    current_user_id: str = Depends(get_current_user_db_id),
    service: VideoCallService = Depends(get_video_call_service),
) -> VideoCallJoinResponse:
    """Return a fresh short-lived meeting token for a call participant."""

    try:
        result = await service.join_call(call_id=call_id, user_id=current_user_id)
    except (ValueError, RuntimeError) as exc:
        _raise_call_error(exc)
    if (
        result.accepted_now
        and result.call_kind == "direct"
        and result.caller_user_id
        and result.caller_user_id != current_user_id
    ):
        await emit_video_call_accepted(
            result.caller_user_id,
            {
                "call_id": call_id,
                "chat_id": result.chat_id,
                "accepted_by_user_id": current_user_id,
            },
        )
        # Callee's other devices (idle desktop while phone answered) must clear ringing UI.
        # Clients open Meet only when they own local outgoing / this join — not on every accepted.
        if current_user_id != result.caller_user_id:
            await emit_video_call_accepted(
                current_user_id,
                {
                    "call_id": call_id,
                    "chat_id": result.chat_id,
                    "accepted_by_user_id": current_user_id,
                },
            )
        logger.info("video_call_accepted_notified", call_id=call_id, caller=result.caller_user_id)
    return result.response


@router.post(
    "/{call_id}/end",
    response_model=VideoCallEndResponse,
    summary="End an internal video call",
)
async def end_video_call(
    call_id: str,
    current_user_id: str = Depends(get_current_user_db_id),
    service: VideoCallService = Depends(get_video_call_service),
) -> VideoCallEndResponse:
    """Mark a call ended and notify the other participant."""

    try:
        other_user_ids, already_ended, missed_reason, call_status = await service.end_call(
            call_id=call_id,
            user_id=current_user_id,
        )
    except (ValueError, RuntimeError) as exc:
        _raise_call_error(exc)
    if not already_ended:
        payload = _ended_payload(
            call_id=call_id,
            ended_by_user_id=current_user_id,
            call_status=call_status,
            missed_reason=missed_reason,
        )
        for other_user_id in other_user_ids:
            await emit_video_call_ended(other_user_id, payload)
        logger.info("video_call_ended", call_id=call_id, notified=len(other_user_ids))
    else:
        logger.info("video_call_end_idempotent", call_id=call_id)
    return VideoCallEndResponse(
        call_id=call_id,
        already_ended=already_ended,
        call_status=call_status,
        missed_reason=missed_reason,
    )
