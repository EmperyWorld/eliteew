#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Socket.IO emit helpers for GAF chat, video calls, Friends, and EWDesk feed rooms.
# Invariants:
# - recipient_db_user_id is DB users.id (UUID), room gaf_user_{uuid}; invalid ids no-op with warning.
# - Lazy `_sio()` only — never import AsyncServer at module load (breaks Layer E re-export cycle).
# Related:
# - api/routers/socketio_handler.py
# - documentation/platform/REALTIME-SOCKETIO-AND-WS.md
# - documentation/product/GAF-CHAT-BACKEND.md
# ---
"""GAF / video / friends / EWDesk Socket.IO outbound emits."""

from __future__ import annotations

import logging
from typing import Any, NotRequired, TypedDict
from uuid import UUID

from api.utils.datetime_helpers import utc_now_iso

logger = logging.getLogger(__name__)


def _schedule_mobile_fcm_after_emit(
    event_name: str,
    recipient_db_user_id: str,
    payload: dict[str, Any],
) -> None:
    """FCM must not block Socket.IO / HTTP send paths (OAuth egress can hang for seconds)."""

    async def _run() -> None:
        try:
            from api.services.mobile_push_service import maybe_notify_mobile_after_gaf_emit

            await maybe_notify_mobile_after_gaf_emit(event_name, recipient_db_user_id, payload)
        except Exception:
            logger.debug(
                "[GAF_CHAT] mobile FCM fallback failed for %s",
                event_name,
                exc_info=True,
            )

    try:
        from api.core.async_utils import track_background_task

        track_background_task(
            _run(),
            name=f"gaf_fcm_{event_name}",
            metadata={
                "recipient_db_user_id": recipient_db_user_id,
                "event_name": event_name,
            },
        )
    except RuntimeError:
        logger.debug("[GAF_CHAT] no running loop for FCM schedule event=%s", event_name)
    except Exception:
        logger.debug("[GAF_CHAT] FCM schedule failed event=%s", event_name, exc_info=True)


# Must match api.routers.socketio_handler.EWDESK_FEED_ROOM (avoid circular import).
EWDESK_FEED_ROOM = "ewdesk_feed"


def _sio():
    """Lazy AsyncServer bind — emit modules must not import sio at import time."""
    from api.routers.socketio_handler import sio

    return sio


class GafChatCreatedPayload(TypedDict):
    """Server -> client: new 1:1 chat opened by initiator (see gaf_chat/router get_or_create)."""

    chat_id: str
    initiator_id: str


class GafMessageNewPayload(TypedDict):
    """Server -> client: new message in a chat (partner is recipient)."""

    chat_id: str
    message_id: str
    sender_id: str
    body: str
    created_at: str
    recipient_is_muted: bool
    algorithm: str | None
    encryption_version: str | None
    body_ciphertext: NotRequired[str | None]
    nonce: NotRequired[str | None]
    attachment_content_id: NotRequired[str | None]
    attachment_mime_type: NotRequired[str | None]
    attachment_name: NotRequired[str | None]
    attachment_size: NotRequired[int | None]
    attachment_recipient_saved_id: NotRequired[str | None]
    metadata: NotRequired[dict[str, Any] | None]
    reply_to_message_id: NotRequired[str | None]
    e2ee_session_key_envelope: NotRequired[str | None]


class GafMessageReadPayload(TypedDict):
    """Server -> client: peer marked messages read (up_to_message_id is effective cursor)."""

    chat_id: str
    user_id: str
    up_to_message_id: str


class GafMessageEditedPayload(TypedDict):
    """Server -> client: message body/timestamp updated."""

    chat_id: str
    message_id: str
    sender_id: str
    body: str
    edited_at: str


class GafMessageDeletedPayload(TypedDict):
    """Server -> client: message soft-deleted (for_me_only scopes visibility)."""

    chat_id: str
    message_id: str
    user_id: str
    for_me_only: bool


class GafE2eeConsentChangedPayload(TypedDict):
    """Server -> client: chat-level E2EE mutual-consent state changed."""

    chat_id: str
    status: str
    requested_by_user_id: str | None
    actor_user_id: str
    ready: bool
    activated_at: str | None
    disabled_at: str | None
    declined_at: str | None
    suspend_reason: NotRequired[str]


class VideoCallIncomingPayload(TypedDict):
    """Server -> client: incoming internal video call."""

    call_id: str
    chat_id: str | None
    caller_user_id: str
    created_at: str
    call_kind: NotRequired[str]
    participant_user_ids: NotRequired[list[str]]
    call_target: NotRequired[str]


class VideoCallEndedPayload(TypedDict):
    """Server -> client: internal video call ended by the other participant."""

    call_id: str
    ended_by_user_id: str
    status: NotRequired[str]
    missed_reason: NotRequired[str]


class VideoCallAcceptedPayload(TypedDict):
    """Server -> client: callee accepted a 1:1 call; caller may join Meet."""

    call_id: str
    chat_id: str | None
    accepted_by_user_id: str


def _gaf_user_room_for_recipient(recipient_db_user_id: str) -> str | None:
    """Return Socket.IO room name gaf_user_{uuid} or None if id is unusable."""
    if not isinstance(recipient_db_user_id, str):
        logger.warning("[GAF_CHAT] emit skipped: recipient_db_user_id must be str, got %s", type(recipient_db_user_id))
        return None
    raw = recipient_db_user_id.strip()
    if not raw:
        logger.warning("[GAF_CHAT] emit skipped: empty recipient_db_user_id")
        return None
    try:
        normalized = str(UUID(raw))
    except ValueError:
        logger.warning("[GAF_CHAT] emit skipped: recipient_db_user_id is not a valid UUID: %r", raw)
        return None
    return f"gaf_user_{normalized}"


async def _emit_gaf_chat_event(event_name: str, recipient_db_user_id: str, payload: dict[str, Any]) -> None:
    """Emit a namespaced gaf_chat.* event to the recipient's personal room; no-op if id/payload invalid."""
    room = _gaf_user_room_for_recipient(recipient_db_user_id)
    if room is None:
        return
    if not isinstance(payload, dict):
        logger.warning("[GAF_CHAT] emit skipped for %s: payload must be dict, got %s", event_name, type(payload))
        return
    await _sio().emit(event_name, payload, room=room)
    logger.debug("[GAF_CHAT] emitted %s room=%s keys=%s", event_name, room, sorted(payload.keys()))
    _schedule_mobile_fcm_after_emit(event_name, recipient_db_user_id, payload)


async def emit_gaf_message_new(recipient_db_user_id: str, payload: GafMessageNewPayload) -> None:
    """Emit gaf_chat.message_new to recipient (DB user id)."""
    await _emit_gaf_chat_event("gaf_chat.message_new", recipient_db_user_id, payload)


async def emit_gaf_message_read(recipient_db_user_id: str, payload: GafMessageReadPayload) -> None:
    """Emit gaf_chat.message_read to recipient."""
    await _emit_gaf_chat_event("gaf_chat.message_read", recipient_db_user_id, payload)


async def emit_gaf_chat_created(recipient_db_user_id: str, payload: GafChatCreatedPayload) -> None:
    """Emit gaf_chat.chat_created when a new chat is created."""
    await _emit_gaf_chat_event("gaf_chat.chat_created", recipient_db_user_id, payload)


async def emit_gaf_message_edited(recipient_db_user_id: str, payload: GafMessageEditedPayload) -> None:
    """Emit gaf_chat.message_edited so the other participant can refresh the message."""
    await _emit_gaf_chat_event("gaf_chat.message_edited", recipient_db_user_id, payload)


async def emit_gaf_message_deleted(recipient_db_user_id: str, payload: GafMessageDeletedPayload) -> None:
    """Emit gaf_chat.message_deleted so the other participant can refresh the thread."""
    await _emit_gaf_chat_event("gaf_chat.message_deleted", recipient_db_user_id, payload)


async def emit_gaf_e2ee_consent_changed(recipient_db_user_id: str, payload: GafE2eeConsentChangedPayload) -> None:
    """Emit gaf_chat.e2ee_consent_changed so both participants refresh consent state."""
    await _emit_gaf_chat_event("gaf_chat.e2ee_consent_changed", recipient_db_user_id, payload)


async def emit_video_call_incoming(recipient_db_user_id: str, payload: VideoCallIncomingPayload) -> None:
    """Emit video_call.incoming; Socket SID fan-out + FCM respect call_target preference."""
    from api.video_calls.call_target import (
        get_user_call_target,
        list_socket_sids_for_call_target,
        should_send_mobile_call_push,
    )

    call_target = await get_user_call_target(recipient_db_user_id)
    body: dict[str, Any] = dict(payload)
    body["call_target"] = call_target
    room = _gaf_user_room_for_recipient(recipient_db_user_id)
    if room is None:
        return
    target_sids = await list_socket_sids_for_call_target(recipient_db_user_id, call_target)
    if target_sids is None:
        await _sio().emit("video_call.incoming", body, room=room)
        logger.debug(
            "[GAF_CHAT] emitted video_call.incoming room=%s call_target=%s",
            room,
            call_target,
        )
    elif target_sids:
        for sid in target_sids:
            await _sio().emit("video_call.incoming", body, room=sid)
        logger.debug(
            "[GAF_CHAT] emitted video_call.incoming sids=%s call_target=%s",
            len(target_sids),
            call_target,
        )
    else:
        logger.debug(
            "[GAF_CHAT] skip socket video_call.incoming room=%s call_target=%s reason=no_matching_sids",
            room,
            call_target,
        )
    if not should_send_mobile_call_push(call_target):
        return
    _schedule_mobile_fcm_after_emit("video_call.incoming", recipient_db_user_id, body)


async def emit_video_call_ended(recipient_db_user_id: str, payload: VideoCallEndedPayload) -> None:
    """Emit video_call.ended to a user's personal realtime room."""
    await _emit_gaf_chat_event("video_call.ended", recipient_db_user_id, payload)


async def emit_video_call_accepted(recipient_db_user_id: str, payload: VideoCallAcceptedPayload) -> None:
    """Emit video_call.accepted so the caller can join after callee accepts."""
    await _emit_gaf_chat_event("video_call.accepted", recipient_db_user_id, payload)


async def emit_friends_updated(recipient_db_user_id: str, payload: dict[str, Any]) -> None:
    """Emit friends.updated so all Friends views can refresh live."""
    room = f"gaf_user_{recipient_db_user_id}"
    await _sio().emit("friends.updated", payload, room=room)
    logger.debug("[FRIENDS] emit friends.updated to room=%s", room)


async def emit_ewdesk_news_updated(payload: dict[str, Any]) -> None:
    """Broadcast EWDesk feed invalidation to all authenticated desktop Socket.IO clients."""
    body = {**payload, "timestamp": payload.get("timestamp") or utc_now_iso()}
    await _sio().emit("ewdesk.news_updated", body, room=EWDESK_FEED_ROOM)
    logger.debug("[EWDESK] emit ewdesk.news_updated room=%s", EWDESK_FEED_ROOM)
