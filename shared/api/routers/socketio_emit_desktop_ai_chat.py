#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Socket.IO emit helpers for Desktop AI Chat collaboration rooms (turn, membership, messages).
# Invariants:
# - Delivery room desktop_ai_chat:{chat_id}:user:{user_id}; lazy `_sio()` only — never import AsyncServer at module load.
# - Emits are best-effort; failures log and never raise into HTTP/stream paths.
# - message_new carries REST-shaped message DTO (no SSE token fan-out).
# Related:
# - api/routers/socketio_handler.py
# - documentation/product/desktop/DESKTOP-AI-CHAT-COLLABORATION.md
# ---
"""Desktop AI Chat collaboration Socket.IO outbound emits."""

from __future__ import annotations

import logging
from typing import Any, Literal, NotRequired, TypedDict
from uuid import UUID

from api.utils.datetime_helpers import utc_now_iso

logger = logging.getLogger(__name__)

MemberChangeReason = Literal["invite", "accept", "decline", "remove", "leave"]


def _sio():
    """Lazy AsyncServer bind — emit modules must not import sio at import time."""
    from api.routers.socketio_handler import sio

    return sio


def desktop_ai_chat_room(chat_id: str | UUID) -> str:
    """Canonical Socket.IO room for a shared Desktop AI Chat."""
    return f"desktop_ai_chat:{chat_id}"


def desktop_ai_chat_member_room(chat_id: str | UUID, user_id: str | UUID) -> str:
    """A private delivery room bound to canonical chat and authenticated user IDs."""
    return f"desktop_ai_chat:{UUID(str(chat_id))}:user:{UUID(str(user_id))}"


class DesktopAiChatTurnEventPayload(TypedDict):
    chat_id: str
    actor_user_id: str
    timestamp: NotRequired[str]


class DesktopAiChatMemberChangedPayload(TypedDict):
    chat_id: str
    reason: MemberChangeReason
    actor_user_id: str
    target_user_id: NotRequired[str | None]
    timestamp: NotRequired[str]


def desktop_ai_chat_message_dto(msg: Any) -> dict[str, Any]:
    """REST-shaped message dict for Socket.IO message_new (matches list_messages item)."""
    meta = getattr(msg, "message_metadata", None)
    author = getattr(msg, "author_user_id", None)
    created = getattr(msg, "created_at", None)
    return {
        "id": str(msg.id),
        "role": msg.role,
        "content": msg.content,
        "tool_calls": getattr(msg, "tool_calls", None),
        "metadata": meta if isinstance(meta, dict) else None,
        "author_user_id": str(author) if author else None,
        "created_at": created.isoformat() if created is not None else None,
    }


async def _emit_to_chat_room(event_name: str, chat_id: str | UUID, payload: dict[str, Any]) -> None:
    from api.services.desktop_chat.collaboration_access import load_chat_recipient_ids
    from api.services.desktop_chat.db_session import desktop_ai_chat_session

    room = desktop_ai_chat_room(chat_id)
    body = {**payload, "timestamp": payload.get("timestamp") or utc_now_iso()}
    try:
        async with desktop_ai_chat_session() as db:
            recipients = await load_chat_recipient_ids(db, UUID(str(chat_id)))
        for user_id in recipients:
            await _sio().emit(event_name, body, room=desktop_ai_chat_member_room(chat_id, user_id))
        logger.debug(
            "[desktop_ai_chat] emitted %s room=%s keys=%s",
            event_name,
            room,
            sorted(body.keys()),
        )
    except Exception:
        logger.debug("[STEP] desktop_ai_chat socket_emit_skip event=%s room=%s", event_name, room, exc_info=True)


async def _emit_to_user_room(event_name: str, user_id: str | UUID, payload: dict[str, Any]) -> None:
    """Best-effort personal room (same shape as GAF gaf_user_{uuid}) for invitees not in chat room yet."""
    try:
        uid = str(UUID(str(user_id)))
    except ValueError:
        logger.debug("[STEP] desktop_ai_chat user_room_emit_skip invalid_uid")
        return
    room = f"gaf_user_{uid}"
    body = {**payload, "timestamp": payload.get("timestamp") or utc_now_iso()}
    try:
        await _sio().emit(event_name, body, room=room)
        logger.debug(
            "[desktop_ai_chat] emitted %s personal_room=%s keys=%s",
            event_name,
            room,
            sorted(body.keys()),
        )
    except Exception:
        logger.debug(
            "[STEP] desktop_ai_chat socket_emit_skip event=%s room=%s",
            event_name,
            room,
            exc_info=True,
        )


async def emit_desktop_ai_chat_turn_started(*, chat_id: str | UUID, actor_user_id: str | UUID) -> None:
    """Notify room participants that a stream lock was acquired."""
    await _emit_to_chat_room(
        "desktop_ai_chat.turn_started",
        chat_id,
        {
            "chat_id": str(chat_id),
            "actor_user_id": str(actor_user_id),
        },
    )


async def emit_desktop_ai_chat_turn_done(*, chat_id: str | UUID, actor_user_id: str | UUID) -> None:
    """Notify room participants that a stream ended and lock was released."""
    await _emit_to_chat_room(
        "desktop_ai_chat.turn_done",
        chat_id,
        {
            "chat_id": str(chat_id),
            "actor_user_id": str(actor_user_id),
        },
    )


async def emit_desktop_ai_chat_message_new(
    *,
    chat_id: str | UUID,
    message: dict[str, Any],
    actor_user_id: str | UUID | None = None,
) -> None:
    """Fan-out a persisted message DTO to the chat room (GAF-aligned; no token stream)."""
    payload: dict[str, Any] = {
        "chat_id": str(chat_id),
        "message": message,
    }
    if actor_user_id is not None:
        payload["actor_user_id"] = str(actor_user_id)
    await _emit_to_chat_room("desktop_ai_chat.message_new", chat_id, payload)


async def emit_desktop_ai_chat_member_changed(
    *,
    chat_id: str | UUID,
    reason: MemberChangeReason,
    actor_user_id: str | UUID,
    target_user_id: str | UUID | None = None,
) -> None:
    """Broadcast membership mutation to chat room; also ping target's personal room when set."""
    payload: dict[str, Any] = {
        "chat_id": str(chat_id),
        "reason": reason,
        "actor_user_id": str(actor_user_id),
    }
    if target_user_id is not None:
        payload["target_user_id"] = str(target_user_id)
    if target_user_id is not None and reason in ("remove", "leave"):
        try:
            # Redis manager propagates room closure to all API processes.
            await _sio().close_room(desktop_ai_chat_member_room(chat_id, target_user_id))
        except Exception:
            # Delivery still rechecks DB recipients; failed eviction cannot grant access.
            logger.debug("[STEP] desktop_ai_chat room_eviction_failed", exc_info=True)
    await _emit_to_chat_room("desktop_ai_chat.member_changed", chat_id, payload)
    # Invitee / kicked user often are not in the chat room yet (or just left).
    if target_user_id is not None and reason in ("invite", "remove", "leave", "accept", "decline"):
        await _emit_to_user_room("desktop_ai_chat.member_changed", target_user_id, payload)
