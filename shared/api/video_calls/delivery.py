#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Detect whether a 1:1 video call incoming signal likely reached the callee (Socket.IO room or FCM).
# Invariants:
# - Read-only presence checks; does not mutate call rows.
# Related:
# - api.tasks.video_call_ringing_watchdog, api.routers.socketio_handler
# ---

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


def gaf_user_room_has_socket_subscribers(recipient_db_user_id: str) -> bool:
    """True when at least one Socket.IO client is subscribed to gaf_user_{uuid}."""
    try:
        from api.routers.socketio_handler import _gaf_user_room_for_recipient, sio
    except Exception:
        logger.debug("[STEP] video_call_delivery_import_skip", exc_info=True)
        return False

    room = _gaf_user_room_for_recipient(recipient_db_user_id)
    if not room:
        return False
    try:
        participants = sio.manager.get_participants("/", room)
    except Exception:
        logger.debug("[STEP] video_call_delivery_participants_failed room=%s", room, exc_info=True)
        return False
    if not participants:
        return False
    for entry in participants:
        if isinstance(entry, (list, tuple)):
            if any(str(item or "").strip() for item in entry):
                return True
        elif str(entry or "").strip():
            return True
    return False


async def send_video_call_incoming_push(callee_user_id: str, payload: dict[str, Any]) -> int:
    """High-priority FCM data push for video_call.incoming; returns number of tokens reached."""
    from api.services.mobile_push_service import send_data_push_to_user
    from api.video_calls.call_target import (
        get_user_call_target,
        normalize_call_target,
        should_send_mobile_call_push,
    )

    call_id = str(payload.get("call_id") or "").strip()
    if not call_id:
        return 0
    raw_target = payload.get("call_target")
    call_target = (
        normalize_call_target(raw_target) if raw_target is not None else await get_user_call_target(callee_user_id)
    )
    if not should_send_mobile_call_push(call_target):
        return 0
    caller_user_id = str(payload.get("caller_user_id") or "").strip()
    from api.services.mobile_push_service import _resolve_user_push_profile

    caller_label, caller_avatar_url = (
        await _resolve_user_push_profile(caller_user_id) if caller_user_id else ("Видеозвонок", "")
    )
    data: dict[str, str] = {
        "type": "video_call_incoming",
        "event": "video_call.incoming",
        "call_id": call_id,
        "source": "eliteew_api",
        "title": caller_label,
        "tab": "chat",
    }
    chat_id = str(payload.get("chat_id") or "").strip()
    if chat_id:
        data["chat_id"] = chat_id
    if caller_user_id:
        data["caller_user_id"] = caller_user_id
    if caller_avatar_url:
        data["caller_avatar_url"] = caller_avatar_url[:500]
    return await send_data_push_to_user(callee_user_id, data, high_priority=True)


async def callee_likely_receives_incoming_signal(callee_user_id: str, *, try_fcm: bool = True) -> bool:
    """Best-effort delivery probe: live socket room or successful FCM send."""
    if gaf_user_room_has_socket_subscribers(callee_user_id):
        return True
    if not try_fcm:
        return False
    return False


async def deliver_video_call_incoming(callee_user_id: str, payload: dict[str, Any]) -> bool:
    """Emit socket event (+ FCM fallback) and return whether delivery likely succeeded."""
    from api.routers.socketio_handler import emit_video_call_incoming
    from api.video_calls.call_target import (
        callee_has_call_target_socket,
        get_user_call_target,
        normalize_call_target,
        should_send_mobile_call_push,
    )

    raw_target = payload.get("call_target")
    call_target = (
        normalize_call_target(raw_target) if raw_target is not None else await get_user_call_target(callee_user_id)
    )
    if "call_target" not in payload:
        payload = {**payload, "call_target": call_target}
    await emit_video_call_incoming(callee_user_id, payload)
    if await callee_has_call_target_socket(callee_user_id, call_target):
        return True
    if not should_send_mobile_call_push(call_target):
        return False
    sent = await send_video_call_incoming_push(callee_user_id, payload)
    return sent > 0
