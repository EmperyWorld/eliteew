"""Private room authorization and cross-worker delivery; no live infrastructure."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from api.routers import socketio_emit_bi as bi
from api.routers import socketio_emit_desktop_ai_chat as chat
from api.routers import socketio_handler as handler


@pytest.fixture
def sockets(monkeypatch):
    monkeypatch.setattr(handler, "socket_presence_uid_by_sid", {})
    monkeypatch.setattr(handler, "desktop_ai_chat_sessions", {})
    for name in ("emit", "enter_room", "leave_room", "close_room"):
        monkeypatch.setattr(handler.sio, name, AsyncMock())
    session = MagicMock()
    session.__aenter__ = AsyncMock(return_value=MagicMock())
    session.__aexit__ = AsyncMock(return_value=None)
    monkeypatch.setattr("api.services.desktop_chat.db_session.desktop_ai_chat_session", lambda: session)
    return handler.sio


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "channel",
    [
        "victim-sid",
        "desktop_ai_chat:other",
        "gaf_user_other",
        "transcription_task",
        "transcription:task",
        "collab_session_other",
        "doc_editor_other",
        "future_private:other",
    ],
)
async def test_generic_subscribe_denies_private_names(sockets, channel):
    handler.socket_presence_uid_by_sid["sid"] = str(uuid4())
    await handler.subscribe("sid", {"channel": channel})
    sockets.enter_room.assert_not_awaited()
    assert sockets.emit.await_args.args[1]["error"] == "forbidden_channel"


@pytest.mark.asyncio
async def test_public_personal_channels_require_current_connection(sockets):
    uid = str(uuid4())
    await handler.subscribe("sid", {})
    sockets.enter_room.assert_not_awaited()
    handler.socket_presence_uid_by_sid["sid"] = uid
    for channel in ("general", "ewdesk_feed", f"gaf_user_{uid}"):
        await handler.subscribe("sid", {"channel": channel})
        sockets.enter_room.assert_awaited_with("sid", channel)
    # New/reconnected socket does not inherit the old connection's identity.
    await handler.subscribe("new-sid", {"channel": f"gaf_user_{uid}"})
    assert sockets.enter_room.await_count == 3


@pytest.mark.asyncio
async def test_bi_owner_checked_on_join_and_delivery(sockets, monkeypatch):
    old, new = str(uuid4()), str(uuid4())
    owner = AsyncMock(return_value=old)
    monkeypatch.setattr(bi, "bi_session_owner", owner)
    handler.socket_presence_uid_by_sid.update({"old": old, "new": new})
    await handler.subscribe("new", {"channel": "business_intelligence_sess"})
    sockets.enter_room.assert_not_awaited()
    await handler.subscribe("old", {"channel": "business_intelligence_sess"})
    sockets.enter_room.assert_awaited_with("old", bi.bi_member_room("sess", old))
    owner.return_value = new
    sockets.emit.reset_mock()
    await bi.send_bi_completed("sess", {"secret": "new"})
    assert sockets.emit.await_args.kwargs["room"] == bi.bi_member_room("sess", new)
    owner.return_value = None
    sockets.emit.reset_mock()
    await bi.send_bi_error("sess", "private")
    sockets.emit.assert_not_awaited()


@pytest.mark.asyncio
async def test_bi_store_failure_is_closed(monkeypatch):
    monkeypatch.setattr("api.core.database_manager.get_database_manager", AsyncMock(side_effect=RuntimeError))
    assert await bi.bi_session_owner("missing") is None


@pytest.mark.asyncio
async def test_chat_revoke_evicts_and_future_delivery_uses_current_acl(sockets, monkeypatch):
    owner, guest, cid = uuid4(), uuid4(), uuid4()
    recipients = AsyncMock(return_value=[owner, guest])
    monkeypatch.setattr("api.services.desktop_chat.collaboration_access.load_chat_recipient_ids", recipients)
    # Sender's local SID registry is empty, as in a separate worker process.
    await chat.emit_desktop_ai_chat_message_new(chat_id=cid, message={"content": "before"})
    assert {c.kwargs["room"] for c in sockets.emit.await_args_list} == {
        chat.desktop_ai_chat_member_room(cid, owner),
        chat.desktop_ai_chat_member_room(cid, guest),
    }
    recipients.return_value = [owner]
    await chat.emit_desktop_ai_chat_member_changed(
        chat_id=cid, reason="remove", actor_user_id=owner, target_user_id=guest
    )
    sockets.close_room.assert_awaited_once_with(chat.desktop_ai_chat_member_room(cid, guest))
    sockets.emit.reset_mock()
    await chat.emit_desktop_ai_chat_message_new(chat_id=cid, message={"content": "after"})
    sockets.emit.assert_awaited_once()
    assert sockets.emit.await_args.kwargs["room"] == chat.desktop_ai_chat_member_room(cid, owner)
    recipients.side_effect = RuntimeError("DB unavailable")
    sockets.emit.reset_mock()
    await chat.emit_desktop_ai_chat_message_new(chat_id=cid, message={"content": "not sent"})
    sockets.emit.assert_not_awaited()


@pytest.mark.asyncio
async def test_chat_join_canonicalizes_and_rechecks_membership(sockets, monkeypatch):
    uid, cid = uuid4(), uuid4()
    handler.socket_presence_uid_by_sid["sid"] = str(uid)
    access = AsyncMock(return_value=object())
    monkeypatch.setattr("api.services.desktop_chat.collaboration_access.load_chat_for_participant", access)
    await handler.desktop_ai_chat_join("sid", {"chat_id": cid.hex.upper()})
    sockets.enter_room.assert_awaited_once_with("sid", chat.desktop_ai_chat_member_room(cid, uid))
    assert handler.desktop_ai_chat_sessions["sid"] == str(cid)
    sockets.enter_room.reset_mock()
    access.return_value = None
    await handler.desktop_ai_chat_join("sid", {"chat_id": str(cid)})
    sockets.enter_room.assert_not_awaited()


@pytest.mark.asyncio
async def test_chat_recipient_query_excludes_inactive_and_deleted_chats():
    from sqlalchemy import create_engine, text

    from api.services.desktop_chat.collaboration_access import load_chat_recipient_ids

    engine = create_engine("sqlite://")
    owner, cid = uuid4(), uuid4()
    accepted = uuid4()
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE desktop_ai_chats (id CHAR(32), user_id CHAR(32))"))
        conn.execute(text("CREATE TABLE desktop_ai_chat_members (chat_id CHAR(32), user_id CHAR(32), status TEXT)"))
        conn.execute(text("INSERT INTO desktop_ai_chats VALUES (:id, :owner)"), {"id": cid.hex, "owner": owner.hex})
        for status in ("accepted", "pending", "revoked", "left", "rejected"):
            uid = accepted if status == "accepted" else uuid4()
            conn.execute(
                text("INSERT INTO desktop_ai_chat_members VALUES (:chat, :uid, :status)"),
                {"chat": cid.hex, "uid": uid.hex, "status": status},
            )
        db = MagicMock()
        db.execute = AsyncMock(side_effect=conn.execute)
        assert set(await load_chat_recipient_ids(db, cid)) == {owner, accepted}
        conn.execute(text("DELETE FROM desktop_ai_chats"))
        assert await load_chat_recipient_ids(db, cid) == []
    engine.dispose()


@pytest.mark.asyncio
async def test_revocation_delivery_stays_closed_when_room_eviction_fails(sockets, monkeypatch):
    owner, revoked, cid = uuid4(), uuid4(), uuid4()
    monkeypatch.setattr(
        "api.services.desktop_chat.collaboration_access.load_chat_recipient_ids",
        AsyncMock(return_value=[owner]),
    )
    sockets.close_room.side_effect = RuntimeError("redis unavailable")
    await chat.emit_desktop_ai_chat_member_changed(
        chat_id=cid,
        reason="leave",
        actor_user_id=revoked,
        target_user_id=revoked,
    )
    sockets.emit.reset_mock()
    await chat.emit_desktop_ai_chat_turn_started(chat_id=cid, actor_user_id=owner)
    sockets.emit.assert_awaited_once()
    assert sockets.emit.await_args.kwargs["room"] == chat.desktop_ai_chat_member_room(cid, owner)


@pytest.mark.asyncio
async def test_bi_session_owner_uses_stored_identity(monkeypatch):
    owner = str(uuid4())
    client = MagicMock()
    client.get = AsyncMock(return_value={"found": True, "_source": {"user_id": owner}})
    manager = MagicMock()
    manager.get_elasticsearch_client.return_value = client
    monkeypatch.setattr("api.core.database_manager.get_database_manager", AsyncMock(return_value=manager))
    assert await bi.bi_session_owner("sess") == owner
    assert client.get.await_args.kwargs["id"] == "sess"
    client.get.return_value = {"found": False}
    assert await bi.bi_session_owner("sess") is None
    client.get.return_value = {"found": True, "_source": {"user_id": "invalid"}}
    assert await bi.bi_session_owner("sess") is None


@pytest.mark.asyncio
async def test_chat_leave_uses_same_canonical_member_room(sockets):
    uid, cid = uuid4(), uuid4()
    handler.socket_presence_uid_by_sid["sid"] = str(uid)
    handler.desktop_ai_chat_sessions["sid"] = str(cid)
    await handler.desktop_ai_chat_leave("sid", {"chat_id": cid.hex.upper()})
    sockets.leave_room.assert_awaited_once_with("sid", chat.desktop_ai_chat_member_room(cid, uid))
    assert "sid" not in handler.desktop_ai_chat_sessions
