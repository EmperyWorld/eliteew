#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral tests: inbound Socket.IO events reject wrong JSON types via Pydantic strict schemas.
# Invariants:
# - join_document with numeric document_id must emit validation_error, not silent ignore.
# Related:
# - api.routers.socketio_handler.join_document; api.routers.socketio_event_schemas
# ---

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from api.routers import socketio_handler
from api.routers.socketio_event_schemas import JoinDocumentEvent, parse_socket_event


def test_join_document_schema_rejects_wrong_type_strict() -> None:
    parsed, errors = parse_socket_event(JoinDocumentEvent, {"document_id": 12345})
    assert parsed is None
    assert errors is not None
    assert any(err.get("type") == "string_type" for err in errors)


def test_join_document_schema_accepts_valid_payload() -> None:
    doc_id = "550e8400-e29b-41d4-a716-446655440000"
    parsed, errors = parse_socket_event(
        JoinDocumentEvent,
        {"document_id": doc_id, "owner_user_id": "owner-uuid"},
    )
    assert errors is None
    assert parsed is not None
    assert parsed.document_id == doc_id
    assert parsed.owner_user_id == "owner-uuid"


@pytest.mark.asyncio
async def test_join_document_handler_emits_validation_error_for_broken_json() -> None:
    sid = "sid-broken-join"
    emit_mock = AsyncMock()
    with patch.object(socketio_handler.sio, "emit", emit_mock):
        await socketio_handler.join_document(sid, {"document_id": 999})

    emit_mock.assert_awaited_once()
    await_args = emit_mock.await_args
    assert await_args is not None
    args, kwargs = await_args
    assert args[0] == "doc_editor_error"
    payload = args[1]
    assert payload["error"] == "validation_error"
    assert isinstance(payload.get("details"), list)
    assert kwargs.get("room") == sid


@pytest.mark.asyncio
async def test_join_document_handler_emits_validation_error_for_missing_document_id() -> None:
    sid = "sid-missing-doc"
    emit_mock = AsyncMock()
    with patch.object(socketio_handler.sio, "emit", emit_mock):
        await socketio_handler.join_document(sid, {})

    emit_mock.assert_awaited_once()
    await_args = emit_mock.await_args
    assert await_args is not None
    payload = await_args.args[1]
    assert payload["error"] == "validation_error"


@pytest.mark.asyncio
async def test_cursor_move_rejects_string_coordinates() -> None:
    sid = "sid-cursor"
    socketio_handler.doc_editor_sessions[sid] = {
        "document_id": "doc-1",
        "connected_at": "2026-01-01T00:00:00Z",
    }
    emit_mock = AsyncMock()
    with patch.object(socketio_handler.sio, "emit", emit_mock):
        await socketio_handler.cursor_move(
            sid,
            {"cursor_position": {"line": "1", "column": "2"}},
        )

    emit_mock.assert_awaited_once()
    await_args = emit_mock.await_args
    assert await_args is not None
    assert await_args.args[0] == "doc_editor_error"
    assert await_args.args[1]["error"] == "validation_error"
    socketio_handler.doc_editor_sessions.pop(sid, None)
