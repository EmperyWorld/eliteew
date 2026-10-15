# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
#   Behavioral test: EWDesk feed Socket.IO emit targets ewdesk_feed room.
# Invariants:
#   - No live Redis/Socket.IO server required (monkeypatch sio.emit).
# Related:
#   - api/routers/socketio_handler.py
#   - api/routers/socketio_emit_gaf.py
# ---

from __future__ import annotations

from typing import Any

import pytest

from api.routers import socketio_emit_gaf, socketio_handler


def test_socketio_emit_gaf_reexport_layer_e_identity() -> None:
    """Layer E: consumers keep importing from socketio_handler; symbols are the emit module objects."""
    assert socketio_handler.emit_ewdesk_news_updated is socketio_emit_gaf.emit_ewdesk_news_updated
    assert socketio_handler.emit_gaf_message_new is socketio_emit_gaf.emit_gaf_message_new
    assert socketio_handler._gaf_user_room_for_recipient is socketio_emit_gaf._gaf_user_room_for_recipient
    assert socketio_handler.GafMessageNewPayload is socketio_emit_gaf.GafMessageNewPayload
    assert socketio_emit_gaf.EWDESK_FEED_ROOM == socketio_handler.EWDESK_FEED_ROOM
    assert socketio_emit_gaf._sio() is socketio_handler.sio


@pytest.mark.anyio
async def test_emit_ewdesk_news_updated_targets_feed_room(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: list[tuple[str, dict[str, Any], str | None]] = []

    async def fake_emit(
        event: str,
        payload: dict[str, Any],
        room: str | None = None,
        **_kwargs: Any,
    ) -> None:
        captured.append((event, payload, room))

    monkeypatch.setattr(socketio_handler.sio, "emit", fake_emit)

    await socketio_handler.emit_ewdesk_news_updated(
        {"post_id": "00000000-0000-0000-0000-000000000001", "reason": "created"}
    )

    assert len(captured) == 1
    event, payload, room = captured[0]
    assert event == "ewdesk.news_updated"
    assert room == socketio_handler.EWDESK_FEED_ROOM
    assert payload["post_id"] == "00000000-0000-0000-0000-000000000001"
    assert payload["reason"] == "created"
    assert isinstance(payload.get("timestamp"), str)
