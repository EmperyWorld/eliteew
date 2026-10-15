#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral tests for 1:1 video call accept gate and missed_reason metadata.
# Related:
# - api.video_calls.service
# ---

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

import pytest

from api.video_calls import service as video_service
from api.video_calls.service import VideoCallAwaitingAcceptError

CALLER_ID = "33333333-3333-3333-3333-333333333333"
CALLEE_ID = "44444444-4444-4444-4444-444444444444"
CHAT_ID = "22222222-2222-2222-2222-222222222222"
CALL_ID = "11111111-1111-1111-1111-111111111111"


class _FakeGafChatService:
    def __init__(self, db_pool: object) -> None:
        self.db_pool = db_pool
        self.sent_events: list[dict] = []

    async def get_chat_or_403(self, chat_id: str, user_id: str) -> dict:
        return {"id": chat_id, "user1_id": CALLER_ID, "user2_id": CALLEE_ID}

    def _other_user_id(self, chat: dict, user_id: str) -> str:
        if user_id == CALLER_ID:
            return CALLEE_ID
        return CALLER_ID

    async def send_video_call_event_message(
        self,
        chat_id: str,
        actor_user_id: str,
        body: str,
        *,
        metadata: dict | None = None,
    ) -> None:
        self.sent_events.append(
            {"chat_id": chat_id, "actor_user_id": actor_user_id, "body": body, "metadata": metadata or {}}
        )


class _FakeFriendsService:
    def __init__(self, db_pool: object) -> None:
        self.db_pool = db_pool

    async def assert_can_interact(self, user_id: str, other_user_id: str, *, action_label: str) -> None:
        return None


class _FakeAcquire:
    def __init__(self, conn: object) -> None:
        self.conn = conn

    async def __aenter__(self) -> object:
        return self.conn

    async def __aexit__(self, *_exc: object) -> None:
        return None


class _FakeTransaction:
    async def __aenter__(self) -> object:
        return self

    async def __aexit__(self, *_exc: object) -> None:
        return None


class _FakeCreateConn:
    def __init__(self) -> None:
        self.profile = {"full_name": "Caller", "email": "caller@test"}

    def transaction(self) -> _FakeTransaction:
        return _FakeTransaction()

    async def fetchrow(self, query: str, *_args: object) -> dict | None:
        if "FROM video_calls" in query and "status IN" in query:
            return None
        if "INSERT INTO video_calls" in query:
            return {
                "id": UUID(CALL_ID),
                "provider": "jitsi",
                "room_name": "ew-gaf-testroom",
                "status": "ringing",
                "gaf_chat_id": UUID(CHAT_ID),
                "caller_user_id": UUID(CALLER_ID),
                "callee_user_id": UUID(CALLEE_ID),
            }
        if "FROM users" in query:
            return self.profile
        return None


class _FakePool:
    def __init__(self, conn: object) -> None:
        self.conn = conn

    def acquire(self) -> _FakeAcquire:
        return _FakeAcquire(self.conn)


class _FakeRingingJoinConn:
    async def fetchrow(self, query: str, *_args: object) -> dict | None:
        if "FROM video_calls vc" in query:
            return {
                "id": UUID(CALL_ID),
                "provider": "jitsi",
                "room_name": "ew-gaf-testroom",
                "status": "ringing",
                "gaf_chat_id": UUID(CHAT_ID),
                "caller_user_id": UUID(CALLER_ID),
                "callee_user_id": UUID(CALLEE_ID),
                "started_at": None,
                "call_kind": "direct",
            }
        if "UPDATE video_calls" in query and "active" in query:
            return {
                "id": UUID(CALL_ID),
                "provider": "jitsi",
                "room_name": "ew-gaf-testroom",
                "status": "active",
                "gaf_chat_id": UUID(CHAT_ID),
                "caller_user_id": UUID(CALLER_ID),
                "callee_user_id": UUID(CALLEE_ID),
                "started_at": datetime.now(UTC),
                "call_kind": "direct",
            }
        if "FROM users" in query:
            return {"full_name": "User", "email": "u@test"}
        return None


@pytest.fixture(autouse=True)
def patch_gaf(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(video_service, "GafChatService", _FakeGafChatService)
    monkeypatch.setattr(video_service, "FriendsService", _FakeFriendsService)
    monkeypatch.setattr(
        video_service.unified_settings,
        "jitsi_app_secret",
        "test-secret",
        raising=False,
    )
    monkeypatch.setattr(
        video_service.unified_settings,
        "jitsi_public_url",
        "https://meet.test",
        raising=False,
    )
    monkeypatch.setattr(
        video_service.unified_settings,
        "jitsi_xmpp_domain",
        "meet.test",
        raising=False,
    )


@pytest.mark.asyncio
async def test_create_direct_call_returns_no_join_url_while_ringing() -> None:
    svc = video_service.VideoCallService(_FakePool(_FakeCreateConn()))
    result = await svc.create_gaf_call(chat_id=CHAT_ID, caller_user_id=CALLER_ID)
    assert result.created is True
    assert result.peer_user_id == CALLEE_ID
    assert result.response.awaiting_accept is True
    assert result.response.join_url is None
    assert result.response.jwt is None
    assert result.response.status == "ringing"


@pytest.mark.asyncio
async def test_create_reuses_ringing_as_callee_accepts() -> None:
    class _ReuseConn(_FakeRingingJoinConn):
        async def fetchrow(self, query: str, *_args: object) -> dict | None:
            if "FROM video_calls" in query and "status IN" in query:
                return {
                    "id": UUID(CALL_ID),
                    "provider": "jitsi",
                    "room_name": "ew-gaf-testroom",
                    "status": "ringing",
                    "gaf_chat_id": UUID(CHAT_ID),
                    "caller_user_id": UUID(CALLER_ID),
                    "callee_user_id": UUID(CALLEE_ID),
                }
            return await super().fetchrow(query, *_args)

    svc = video_service.VideoCallService(_FakePool(_ReuseConn()))
    result = await svc.create_gaf_call(chat_id=CHAT_ID, caller_user_id=CALLEE_ID)
    assert result.created is False
    assert result.accepted_now is True
    assert result.response.reused_existing is True
    assert result.response.awaiting_accept is False
    assert result.response.join_url is not None
    assert result.response.status == "active"
    assert result.caller_user_id == CALLER_ID


@pytest.mark.asyncio
async def test_create_reuses_active_call_without_awaiting_accept_kw_clash() -> None:
    """Regression: join.model_dump() already has awaiting_accept; must not pass twice."""

    class _ActiveReuseConn:
        profile = {"full_name": "Caller", "email": "c@test"}

        async def fetchrow(self, query: str, *_args: object) -> dict | None:
            if "FROM video_calls" in query and "status IN" in query:
                return {
                    "id": UUID(CALL_ID),
                    "provider": "jitsi",
                    "room_name": "ew-gaf-testroom",
                    "status": "active",
                    "gaf_chat_id": UUID(CHAT_ID),
                    "caller_user_id": UUID(CALLER_ID),
                    "callee_user_id": UUID(CALLEE_ID),
                    "call_kind": "direct",
                }
            if "FROM users" in query:
                return self.profile
            return None

    svc = video_service.VideoCallService(_FakePool(_ActiveReuseConn()))
    result = await svc.create_gaf_call(chat_id=CHAT_ID, caller_user_id=CALLER_ID)
    assert result.created is False
    assert result.response.reused_existing is True
    assert result.response.awaiting_accept is False
    assert result.response.join_url is not None
    assert result.response.status == "active"


@pytest.mark.asyncio
async def test_join_call_blocks_caller_while_ringing() -> None:
    svc = video_service.VideoCallService(_FakePool(_FakeRingingJoinConn()))
    with pytest.raises(VideoCallAwaitingAcceptError, match="awaiting_callee_accept"):
        await svc.join_call(call_id=CALL_ID, user_id=CALLER_ID)


@pytest.mark.asyncio
async def test_join_call_callee_accept_returns_join_url() -> None:
    svc = video_service.VideoCallService(_FakePool(_FakeRingingJoinConn()))
    result = await svc.join_call(call_id=CALL_ID, user_id=CALLEE_ID)
    assert result.accepted_now is True
    assert result.response.join_url is not None
    assert result.response.status == "active"


@pytest.mark.asyncio
async def test_end_call_infers_declined_when_callee_hangs_up_ringing(monkeypatch: pytest.MonkeyPatch) -> None:
    class _EndConn:
        async def fetchrow(self, query: str, *_args: object) -> dict | None:
            if "WITH before AS" in query:
                return {
                    "id": UUID(CALL_ID),
                    "gaf_chat_id": UUID(CHAT_ID),
                    "status": "missed",
                    "previous_status": "ringing",
                    "caller_user_id": CALLER_ID,
                    "callee_user_id": CALLEE_ID,
                    "started_at": None,
                    "ended_at": datetime.now(UTC),
                    "missed_reason": None,
                }
            if "FROM video_call_participants" in query:
                return None
            if "FROM video_calls" in query and "caller_user_id::text" in query:
                return {"caller_user_id": CALLER_ID, "callee_user_id": CALLEE_ID}
            return None

        async def fetch(self, query: str, *_args: object) -> list:
            if "FROM video_call_participants" in query:
                return []
            return []

        async def execute(self, *_args: object) -> None:
            return None

    fake_gaf = _FakeGafChatService(_FakePool(_EndConn()))
    monkeypatch.setattr(video_service, "GafChatService", lambda _pool: fake_gaf)

    svc = video_service.VideoCallService(_FakePool(_EndConn()))
    others, already_ended, missed_reason, status = await svc.end_call(call_id=CALL_ID, user_id=CALLEE_ID)
    assert already_ended is False
    assert status == "missed"
    assert missed_reason == "declined"
    assert CALLER_ID in others


@pytest.mark.asyncio
async def test_end_call_idempotent_preserves_missed_terminal_state(monkeypatch: pytest.MonkeyPatch) -> None:
    """Repeat /end on already-missed must not flip status to ended or clear missed_reason."""

    class _AlreadyMissedConn:
        async def fetchrow(self, query: str, *_args: object) -> dict | None:
            if "WITH before AS" in query:
                return {
                    "id": UUID(CALL_ID),
                    "gaf_chat_id": UUID(CHAT_ID),
                    "status": "missed",
                    "previous_status": "missed",
                    "caller_user_id": CALLER_ID,
                    "callee_user_id": CALLEE_ID,
                    "started_at": None,
                    "ended_at": datetime.now(UTC),
                    "missed_reason": "callee_unreachable",
                }
            if "FROM video_call_participants" in query:
                return None
            if "FROM video_calls" in query and "caller_user_id::text" in query:
                return {"caller_user_id": CALLER_ID, "callee_user_id": CALLEE_ID}
            return None

        async def fetch(self, query: str, *_args: object) -> list:
            if "FROM video_call_participants" in query:
                return []
            return []

        async def execute(self, *_args: object) -> None:
            return None

    fake_gaf = _FakeGafChatService(_FakePool(_AlreadyMissedConn()))
    monkeypatch.setattr(video_service, "GafChatService", lambda _pool: fake_gaf)

    svc = video_service.VideoCallService(_FakePool(_AlreadyMissedConn()))
    others, already_ended, missed_reason, status = await svc.end_call(
        call_id=CALL_ID,
        user_id=CALLER_ID,
    )
    assert already_ended is True
    assert status == "missed"
    assert missed_reason == "callee_unreachable"
    assert CALLEE_ID in others
    assert fake_gaf.sent_events == []
