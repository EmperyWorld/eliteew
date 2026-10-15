# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
#   Behavioral tests for admin Users channel mismatch heuristic and directory batch scan.
# Related:
#   - api/core/admin_user_channel_mismatch.py
#   - api/services/admin_users_directory.py
# ---

import asyncio
from unittest.mock import AsyncMock, MagicMock

import pytest

from api.core.admin_user_channel_mismatch import directory_entry_has_channel_mismatch


def test_sso_browser_without_socket() -> None:
    assert directory_entry_has_channel_mismatch(
        presence_online=False,
        presence_sessions_web=0,
        presence_sessions_mobile=0,
        sso_browser_active=True,
    )


def test_socket_without_sso_browser() -> None:
    assert directory_entry_has_channel_mismatch(
        presence_online=True,
        presence_sessions_web=1,
        presence_sessions_mobile=0,
        sso_browser_active=False,
    )


def test_aligned_channels_no_mismatch() -> None:
    assert not directory_entry_has_channel_mismatch(
        presence_online=True,
        presence_sessions_web=1,
        presence_sessions_mobile=0,
        sso_browser_active=True,
    )
    assert not directory_entry_has_channel_mismatch(
        presence_online=False,
        presence_sessions_web=0,
        presence_sessions_mobile=0,
        sso_browser_active=False,
    )


def test_directory_channel_mismatch_matching_ids_collects_both_kinds(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Batch scan returns user ids where SSO and Socket.IO disagree."""
    from api.services.admin_users_directory import directory_channel_mismatch_matching_ids

    uid_socket = "550e8400-e29b-41d4-a716-446655440000"
    uid_sso = "660e8400-e29b-41d4-a716-446655440001"
    uid_ok = "770e8400-e29b-41d4-a716-446655440002"

    db = AsyncMock()
    execute_result = MagicMock()
    execute_result.scalars.return_value.all.return_value = [
        uid_socket,
        uid_sso,
        uid_ok,
    ]
    db.execute = AsyncMock(return_value=execute_result)
    count_q = MagicMock()
    count_q.whereclause = None

    async def fake_presence(_ids: list[str]) -> tuple[bool, dict]:
        return True, {
            uid_socket: {
                "online": True,
                "sessions_web": 1,
                "sessions_mobile": 0,
            },
            uid_sso: {
                "online": False,
                "sessions_web": 0,
                "sessions_mobile": 0,
            },
            uid_ok: {
                "online": True,
                "sessions_web": 1,
                "sessions_mobile": 0,
            },
        }

    async def fake_sso(_ids: list[str]) -> dict:
        return {
            uid_socket: {"browser": {"active": False}},
            uid_sso: {"browser": {"active": True}},
            uid_ok: {"browser": {"active": True}},
        }

    monkeypatch.setattr(
        "api.services.presence_service.batch_presence_for_user_ids",
        fake_presence,
    )
    monkeypatch.setattr(
        "api.services.sso_session_registry.batch_sso_sessions_for_user_ids",
        fake_sso,
    )

    redis_ok, mismatch_ids = asyncio.run(directory_channel_mismatch_matching_ids(db, count_q))
    assert redis_ok is True
    assert mismatch_ids == {uid_socket, uid_sso}


def test_directory_channel_mismatch_matching_ids_redis_unavailable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from api.services.admin_users_directory import directory_channel_mismatch_matching_ids

    uid = "550e8400-e29b-41d4-a716-446655440000"
    db = AsyncMock()
    execute_result = MagicMock()
    execute_result.scalars.return_value.all.return_value = [uid]
    db.execute = AsyncMock(return_value=execute_result)
    count_q = MagicMock()
    count_q.whereclause = None

    async def fake_presence_down(_ids: list[str]) -> tuple[bool, dict]:
        return False, {}

    monkeypatch.setattr(
        "api.services.presence_service.batch_presence_for_user_ids",
        fake_presence_down,
    )

    redis_ok, mismatch_ids = asyncio.run(directory_channel_mismatch_matching_ids(db, count_q))
    assert redis_ok is False
    assert mismatch_ids == set()
