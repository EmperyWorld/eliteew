#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Pydantic v2 schemas for inbound Socket.IO client events (strict validation at handler boundary).
# Invariants:
# - strict=True: wrong JSON types fail validation (no silent coercion).
# - extra=forbid on structured events; collaboration_change allows passthrough payload.
# Related:
# - api.routers.socketio_handler
# ---

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, StrictInt, ValidationError
from pydantic_core import ErrorDetails


class SocketEventSchema(BaseModel):
    """Base for inbound Socket.IO event payloads."""

    model_config = ConfigDict(extra="forbid", strict=True)


class JoinDocumentEvent(SocketEventSchema):
    document_id: str = Field(min_length=1)
    owner_user_id: str | None = None


class GetCollaboratorsEvent(SocketEventSchema):
    document_id: str = Field(min_length=1)


class KickDocumentUserEvent(SocketEventSchema):
    target_sid: str = Field(min_length=1)
    document_id: str | None = None


class CursorPositionSchema(SocketEventSchema):
    line: StrictInt
    column: StrictInt


class CursorMoveEvent(SocketEventSchema):
    cursor_position: CursorPositionSchema


class JoinCollaborationSessionEvent(SocketEventSchema):
    session_id: str = Field(min_length=1)
    user_id: str = Field(min_length=1)


class ChannelSubscriptionEvent(SocketEventSchema):
    channel: str = Field(min_length=1, default="general")


class PingEvent(SocketEventSchema):
    """Optional client ping metadata; empty object is valid."""


class MessageEvent(BaseModel):
    """Generic ``message`` event: known string fields are strict; extra keys allowed."""

    model_config = ConfigDict(extra="allow", strict=True)

    text: str | None = None
    content: str | None = None


class ChatMessageMetadata(BaseModel):
    model_config = ConfigDict(extra="allow", strict=True)

    timestamp: str | None = None


class ChatMessageEvent(SocketEventSchema):
    """Inbound ``chat-message`` from EmperyworldSocketService.sendMessage."""

    id: str = Field(min_length=1)
    chat_id: str = Field(min_length=1)
    user_id: str | None = None
    user_name: str | None = None
    content: str
    message_type: str | None = None
    metadata: ChatMessageMetadata | None = None


class CollaborationChangeEvent(BaseModel):
    """Collaboration patch broadcast; extra keys carry document diff fields."""

    model_config = ConfigDict(extra="allow", strict=True)

    session_id: str = Field(min_length=1)


class EmpyerworldHeartbeatEvent(BaseModel):
    model_config = ConfigDict(extra="allow", strict=True)

    user_id: str | None = None
    timestamp: str | None = None
    performance_metrics: dict[str, Any] | None = None


class LeaveCollaborationSessionEvent(SocketEventSchema):
    session_id: str | None = None


class LeaveDocumentEvent(SocketEventSchema):
    document_id: str | None = None


class DesktopAiChatJoinEvent(SocketEventSchema):
    chat_id: str = Field(min_length=1)


class DesktopAiChatLeaveEvent(SocketEventSchema):
    chat_id: str | None = None


def parse_socket_event[T: BaseModel](model: type[T], data: Any) -> tuple[T | None, list[ErrorDetails] | None]:
    """Validate inbound Socket.IO payload; return (model, None) or (None, pydantic errors)."""
    if data is None:
        data = {}
    if not isinstance(data, dict):
        return None, [
            {
                "type": "type_error",
                "loc": ("payload",),
                "msg": "payload must be a JSON object",
                "input": data,
            }
        ]
    try:
        return model.model_validate(data), None
    except ValidationError as exc:
        return None, exc.errors(include_url=False)
