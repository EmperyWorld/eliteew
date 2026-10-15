# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for GAF video call friendship/block enforcement.
# Invariants:
# - Creating or joining a call must reuse the same interaction guard as GAF messages.
# - Tests stay database-free and stop before JWT signing when a block denies access.
# Related:
# - api/video_calls/service.py
# - api/services/friends_service.py
# ---

from __future__ import annotations

import pytest

from api.video_calls import service as video_service

CALLER_ID = "33333333-3333-3333-3333-333333333333"
CALLEE_ID = "44444444-4444-4444-4444-444444444444"


class _FakeGafChatService:
    def __init__(self, db_pool: object) -> None:
        self.db_pool = db_pool

    async def get_chat_or_403(self, chat_id: str, user_id: str) -> dict:
        return {"id": chat_id, "user1_id": user_id, "user2_id": CALLEE_ID}

    def _other_user_id(self, chat: dict, user_id: str) -> str:
        return CALLEE_ID


class _FakeBlockedFriendsService:
    calls: list[tuple[str, str, str]] = []

    def __init__(self, db_pool: object) -> None:
        self.db_pool = db_pool

    async def assert_can_interact(
        self,
        user_id: str,
        other_user_id: str,
        *,
        action_label: str,
    ) -> None:
        self.calls.append((user_id, other_user_id, action_label))
        raise ValueError("Interaction blocked")


class _FakeAcquire:
    def __init__(self, conn: object) -> None:
        self.conn = conn

    async def __aenter__(self) -> object:
        return self.conn

    async def __aexit__(self, *_exc: object) -> None:
        return None


class _FakePool:
    def __init__(self, conn: object | None = None) -> None:
        self.conn = conn or object()

    def acquire(self) -> _FakeAcquire:
        return _FakeAcquire(self.conn)


class _FakeJoinConn:
    async def fetchrow(self, *_args: object) -> dict:
        return {
            "id": "11111111-1111-1111-1111-111111111111",
            "provider": "jitsi",
            "room_name": "room",
            "status": "active",
            "gaf_chat_id": "22222222-2222-2222-2222-222222222222",
            "caller_user_id": CALLER_ID,
            "callee_user_id": CALLEE_ID,
            "started_at": None,
        }


@pytest.mark.asyncio
async def test_create_gaf_call_denies_blocked_relationship(monkeypatch: pytest.MonkeyPatch) -> None:
    _FakeBlockedFriendsService.calls = []
    monkeypatch.setattr(video_service, "GafChatService", _FakeGafChatService)
    monkeypatch.setattr(video_service, "FriendsService", _FakeBlockedFriendsService)

    svc = video_service.VideoCallService(_FakePool())

    with pytest.raises(ValueError, match="blocked"):
        await svc.create_gaf_call(chat_id="chat-1", caller_user_id=CALLER_ID)

    assert _FakeBlockedFriendsService.calls == [(CALLER_ID, CALLEE_ID, "начать видеозвонок")]


@pytest.mark.asyncio
async def test_create_gaf_group_call_denies_blocked_relationship(monkeypatch: pytest.MonkeyPatch) -> None:
    _FakeBlockedFriendsService.calls = []
    monkeypatch.setattr(video_service, "GafChatService", _FakeGafChatService)
    monkeypatch.setattr(video_service, "FriendsService", _FakeBlockedFriendsService)

    svc = video_service.VideoCallService(_FakePool())

    with pytest.raises(ValueError, match="blocked"):
        await svc.create_gaf_group_call(
            chat_id="chat-1",
            host_user_id=CALLER_ID,
            additional_participant_ids=["55555555-5555-5555-5555-555555555555"],
        )

    assert _FakeBlockedFriendsService.calls == [
        (CALLER_ID, CALLEE_ID, "начать групповой видеозвонок"),
    ]


@pytest.mark.asyncio
async def test_create_gaf_group_call_requires_extra_participant(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(video_service, "GafChatService", _FakeGafChatService)
    monkeypatch.setattr(video_service, "FriendsService", _FakeBlockedFriendsService)

    svc = video_service.VideoCallService(_FakePool())

    with pytest.raises(ValueError, match="at least one more"):
        await svc.create_gaf_group_call(
            chat_id="chat-1",
            host_user_id=CALLER_ID,
            additional_participant_ids=[],
        )


@pytest.mark.asyncio
async def test_join_call_denies_blocked_existing_call(monkeypatch: pytest.MonkeyPatch) -> None:
    _FakeBlockedFriendsService.calls = []
    monkeypatch.setattr(video_service, "FriendsService", _FakeBlockedFriendsService)

    svc = video_service.VideoCallService(_FakePool(_FakeJoinConn()))

    with pytest.raises(ValueError, match="blocked"):
        await svc.join_call(
            call_id="11111111-1111-1111-1111-111111111111",
            user_id=CALLER_ID,
        )

    assert _FakeBlockedFriendsService.calls == [(CALLER_ID, CALLEE_ID, "присоединиться к видеозвонку")]


def test_notify_participant_user_ids_excludes_ender_and_invalid() -> None:
    result = video_service._notify_participant_user_ids(
        [CALLER_ID, CALLEE_ID, "not-a-uuid", CALLER_ID],
        ending_user_id=CALLER_ID,
    )
    assert result == [CALLEE_ID]
