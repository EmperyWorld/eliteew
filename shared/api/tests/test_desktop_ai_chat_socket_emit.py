# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
#   Behavioral tests for Desktop AI Chat Socket.IO emit helpers and join ACL.
# Invariants:
#   - No live Redis/Socket.IO server required (monkeypatch sio.emit / ACL).
# Related:
#   - api/routers/socketio_emit_desktop_ai_chat.py
#   - api/routers/socketio_handler.py
# ---

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID, uuid4

import pytest

from api.routers import socketio_emit_desktop_ai_chat, socketio_handler
from api.services.desktop_chat.collaboration_access import ChatAccess

_RECIPIENT = UUID("00000000-0000-0000-0000-000000000042")


@pytest.fixture(autouse=True)
def isolated_recipients(monkeypatch: pytest.MonkeyPatch):
    session = MagicMock()
    session.__aenter__ = AsyncMock(return_value=MagicMock())
    session.__aexit__ = AsyncMock(return_value=None)
    monkeypatch.setattr("api.services.desktop_chat.db_session.desktop_ai_chat_session", lambda: session)
    monkeypatch.setattr(
        "api.services.desktop_chat.collaboration_access.load_chat_recipient_ids",
        AsyncMock(return_value=[_RECIPIENT]),
    )


def test_socketio_emit_desktop_ai_chat_reexport_layer_e_identity() -> None:
    assert (
        socketio_handler.emit_desktop_ai_chat_turn_started
        is socketio_emit_desktop_ai_chat.emit_desktop_ai_chat_turn_started
    )
    assert (
        socketio_handler.emit_desktop_ai_chat_message_new
        is socketio_emit_desktop_ai_chat.emit_desktop_ai_chat_message_new
    )
    assert socketio_handler.desktop_ai_chat_room is socketio_emit_desktop_ai_chat.desktop_ai_chat_room
    assert socketio_emit_desktop_ai_chat._sio() is socketio_handler.sio


def test_desktop_ai_chat_room_name() -> None:
    chat_id = "00000000-0000-0000-0000-000000000099"
    assert socketio_emit_desktop_ai_chat.desktop_ai_chat_room(chat_id) == f"desktop_ai_chat:{chat_id}"


@pytest.mark.anyio
async def test_emit_desktop_ai_chat_turn_started_targets_chat_room(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: list[tuple[str, dict[str, Any], str | None]] = []

    async def fake_emit(
        event: str,
        payload: dict[str, Any],
        room: str | None = None,
        **_kwargs: Any,
    ) -> None:
        captured.append((event, payload, room))

    monkeypatch.setattr(socketio_handler.sio, "emit", fake_emit)

    chat_id = uuid4()
    actor_id = uuid4()
    await socketio_handler.emit_desktop_ai_chat_turn_started(chat_id=chat_id, actor_user_id=actor_id)

    assert len(captured) == 1
    event, payload, room = captured[0]
    assert event == "desktop_ai_chat.turn_started"
    assert room == f"desktop_ai_chat:{chat_id}:user:{_RECIPIENT}"
    assert payload["chat_id"] == str(chat_id)
    assert payload["actor_user_id"] == str(actor_id)
    assert isinstance(payload.get("timestamp"), str)


@pytest.mark.anyio
async def test_emit_desktop_ai_chat_member_changed_includes_target(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: list[tuple[str, dict[str, Any], str | None]] = []

    async def fake_emit(
        event: str,
        payload: dict[str, Any],
        room: str | None = None,
        **_kwargs: Any,
    ) -> None:
        captured.append((event, payload, room))

    monkeypatch.setattr(socketio_handler.sio, "emit", fake_emit)

    chat_id = uuid4()
    owner_id = uuid4()
    guest_id = uuid4()
    await socketio_handler.emit_desktop_ai_chat_member_changed(
        chat_id=chat_id,
        reason="invite",
        actor_user_id=owner_id,
        target_user_id=guest_id,
    )

    assert captured[0][0] == "desktop_ai_chat.member_changed"
    assert captured[0][2] == f"desktop_ai_chat:{chat_id}:user:{_RECIPIENT}"
    assert captured[0][1]["reason"] == "invite"
    assert captured[0][1]["target_user_id"] == str(guest_id)
    assert len(captured) == 2
    assert captured[1][0] == "desktop_ai_chat.member_changed"
    assert captured[1][2] == f"gaf_user_{guest_id}"
    assert captured[1][1]["target_user_id"] == str(guest_id)


@pytest.mark.anyio
async def test_emit_desktop_ai_chat_message_new_targets_chat_room(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: list[tuple[str, dict[str, Any], str | None]] = []

    async def fake_emit(
        event: str,
        payload: dict[str, Any],
        room: str | None = None,
        **_kwargs: Any,
    ) -> None:
        captured.append((event, payload, room))

    monkeypatch.setattr(socketio_handler.sio, "emit", fake_emit)

    chat_id = uuid4()
    actor_id = uuid4()
    message = {
        "id": str(uuid4()),
        "role": "user",
        "content": "hello peers",
        "author_user_id": str(actor_id),
    }
    await socketio_handler.emit_desktop_ai_chat_message_new(
        chat_id=chat_id,
        message=message,
        actor_user_id=actor_id,
    )

    assert len(captured) == 1
    event, payload, room = captured[0]
    assert event == "desktop_ai_chat.message_new"
    assert room == f"desktop_ai_chat:{chat_id}:user:{_RECIPIENT}"
    assert payload["chat_id"] == str(chat_id)
    assert payload["message"] == message
    assert payload["actor_user_id"] == str(actor_id)
    assert isinstance(payload.get("timestamp"), str)


def test_desktop_ai_chat_message_dto_shape() -> None:
    msg = MagicMock()
    msg.id = uuid4()
    msg.role = "assistant"
    msg.content = "ok"
    msg.tool_calls = None
    msg.message_metadata = {"desktop_hero_id": "likii"}
    msg.author_user_id = None
    msg.created_at = None
    dto = socketio_emit_desktop_ai_chat.desktop_ai_chat_message_dto(msg)
    assert dto["id"] == str(msg.id)
    assert dto["role"] == "assistant"
    assert dto["content"] == "ok"
    assert dto["metadata"] == {"desktop_hero_id": "likii"}
    assert dto["author_user_id"] is None


@pytest.mark.anyio
async def test_desktop_ai_chat_join_acl_denies_non_participant(monkeypatch: pytest.MonkeyPatch) -> None:
    chat_id = uuid4()
    user_id = uuid4()
    sid = "test-sid-deny"

    socketio_handler.socket_presence_uid_by_sid[sid] = str(user_id)
    socketio_handler.desktop_ai_chat_sessions.clear()

    emitted: list[tuple[str, dict[str, Any], str | None]] = []

    async def fake_emit(
        event: str,
        payload: dict[str, Any],
        room: str | None = None,
        **_kwargs: Any,
    ) -> None:
        emitted.append((event, payload, room))

    monkeypatch.setattr(socketio_handler.sio, "emit", fake_emit)
    monkeypatch.setattr(socketio_handler.sio, "enter_room", AsyncMock())
    monkeypatch.setattr(socketio_handler.sio, "leave_room", AsyncMock())

    session_cm = MagicMock()
    session_cm.__aenter__ = AsyncMock(return_value=MagicMock())
    session_cm.__aexit__ = AsyncMock(return_value=None)
    monkeypatch.setattr(
        "api.services.desktop_chat.db_session.desktop_ai_chat_session",
        lambda: session_cm,
    )
    monkeypatch.setattr(
        "api.services.desktop_chat.collaboration_access.load_chat_for_participant",
        AsyncMock(return_value=None),
    )

    await socketio_handler.desktop_ai_chat_join(sid, {"chat_id": str(chat_id)})

    assert emitted
    assert emitted[0][0] == "desktop_ai_chat_error"
    assert emitted[0][1]["error"] == "chat_not_found"
    assert sid not in socketio_handler.desktop_ai_chat_sessions


@pytest.mark.anyio
async def test_desktop_ai_chat_join_enters_room_for_participant(monkeypatch: pytest.MonkeyPatch) -> None:
    chat_id = uuid4()
    user_id = uuid4()
    sid = "test-sid-join"

    socketio_handler.socket_presence_uid_by_sid[sid] = str(user_id)
    socketio_handler.desktop_ai_chat_sessions.clear()

    enter_room = AsyncMock()
    emitted: list[tuple[str, dict[str, Any], str | None]] = []

    async def fake_emit(
        event: str,
        payload: dict[str, Any],
        room: str | None = None,
        **_kwargs: Any,
    ) -> None:
        emitted.append((event, payload, room))

    monkeypatch.setattr(socketio_handler.sio, "emit", fake_emit)
    monkeypatch.setattr(socketio_handler.sio, "enter_room", enter_room)
    monkeypatch.setattr(socketio_handler.sio, "leave_room", AsyncMock())

    session_cm = MagicMock()
    session_cm.__aenter__ = AsyncMock(return_value=MagicMock())
    session_cm.__aexit__ = AsyncMock(return_value=None)
    monkeypatch.setattr(
        "api.services.desktop_chat.db_session.desktop_ai_chat_session",
        lambda: session_cm,
    )

    chat = MagicMock()
    access = ChatAccess(chat=chat, viewer_role="owner", member=None)
    monkeypatch.setattr(
        "api.services.desktop_chat.collaboration_access.load_chat_for_participant",
        AsyncMock(return_value=access),
    )

    await socketio_handler.desktop_ai_chat_join(sid, {"chat_id": str(chat_id)})

    enter_room.assert_awaited_once_with(sid, f"desktop_ai_chat:{chat_id}:user:{user_id}")
    assert socketio_handler.desktop_ai_chat_sessions[sid] == str(chat_id)
    assert any(e[0] == "desktop_ai_chat.joined" for e in emitted)
