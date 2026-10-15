#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# P2 inbound Socket.IO validation: chat-message, collaboration_change, ping, message, heartbeat.
# Invariants:
# - Wrong JSON types emit validation_error (strict mode), not silent passthrough.
# Related:
# - api.routers.socketio_event_schemas; api.routers.socketio_handler
# ---

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from api.routers import socketio_handler
from api.routers.socketio_event_schemas import ChatMessageEvent, parse_socket_event


def test_chat_message_schema_rejects_non_string_content() -> None:
    parsed, errors = parse_socket_event(
        ChatMessageEvent,
        {
            "id": "msg-1",
            "chat_id": "chat-1",
            "content": 123,
        },
    )
    assert parsed is None
    assert errors is not None
    assert any(err.get("loc") == ("content",) for err in errors)


@pytest.mark.asyncio
async def test_chat_message_handler_emits_validation_error_for_bad_content() -> None:
    sid = "sid-chat-bad"
    emit_mock = AsyncMock()
    with patch.object(socketio_handler.sio, "emit", emit_mock):
        await socketio_handler.chat_message(
            sid,
            {
                "id": "msg-1",
                "chat_id": "chat-1",
                "content": 123,
            },
        )

    emit_mock.assert_awaited_once()
    await_args = emit_mock.await_args
    assert await_args is not None
    assert await_args.args[0] == "chat_error"
    assert await_args.args[1]["error"] == "validation_error"


@pytest.mark.asyncio
async def test_collaboration_change_rejects_numeric_session_id() -> None:
    sid = "sid-collab"
    socketio_handler.collaboration_sessions[sid] = {
        "session_id": "sess-1",
        "user_id": "user-1",
        "connected_at": "2026-01-01T00:00:00Z",
    }
    emit_mock = AsyncMock()
    with patch.object(socketio_handler.sio, "emit", emit_mock):
        await socketio_handler.collaboration_change(sid, {"session_id": 42, "op": "insert"})

    emit_mock.assert_awaited_once()
    await_args = emit_mock.await_args
    assert await_args is not None
    assert await_args.args[0] == "collaboration_error"
    assert await_args.args[1]["error"] == "validation_error"
    socketio_handler.collaboration_sessions.pop(sid, None)


@pytest.mark.asyncio
async def test_ping_rejects_non_object_payload() -> None:
    sid = "sid-ping"
    emit_mock = AsyncMock()
    with patch.object(socketio_handler.sio, "emit", emit_mock):
        await socketio_handler.ping(sid, "not-an-object")

    emit_mock.assert_awaited_once()
    await_args = emit_mock.await_args
    assert await_args is not None
    assert await_args.args[1]["error"] == "validation_error"


@pytest.mark.asyncio
async def test_message_rejects_text_wrong_type() -> None:
    sid = "sid-message"
    emit_mock = AsyncMock()
    with patch.object(socketio_handler.sio, "emit", emit_mock):
        await socketio_handler.message(sid, {"text": 123})

    emit_mock.assert_awaited_once()
    await_args = emit_mock.await_args
    assert await_args is not None
    assert await_args.args[1]["error"] == "validation_error"


@pytest.mark.asyncio
async def test_heartbeat_rejects_non_object_payload() -> None:
    sid = "sid-hb"
    emit_mock = AsyncMock()
    with patch.object(socketio_handler.sio, "emit", emit_mock):
        await socketio_handler.emperyworld_client_heartbeat(sid, ["bad"])

    emit_mock.assert_awaited_once()
    await_args = emit_mock.await_args
    assert await_args is not None
    assert await_args.args[1]["error"] == "validation_error"
