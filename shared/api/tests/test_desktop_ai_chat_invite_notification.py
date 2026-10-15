# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit locks for Desktop AI Chat invite in-app notification helpers.
# Invariants:
# - Stable notification id; send/dismiss never raise to the invite route.
# Related:
# - api/routers/desktop_ai_chat.py
# - documentation/product/desktop/DESKTOP-AI-CHAT-COLLABORATION.md
# ---

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from api.routers.desktop_ai_chat import (
    _desktop_ai_chat_invite_notification_id,
    _dismiss_desktop_ai_chat_invite_notification,
    _notify_desktop_ai_chat_invite,
)


def test_invite_notification_id_stable() -> None:
    mid = str(uuid4())
    assert _desktop_ai_chat_invite_notification_id(mid) == f"desktop_ai_chat_invite_{mid}"


@pytest.mark.asyncio
async def test_notify_invite_sends_persistent_row() -> None:
    ns = MagicMock()
    ns.send_to_user = AsyncMock()
    chat_id = uuid4()
    member_id = str(uuid4())
    with patch("api.routers.desktop_ai_chat_shared.get_notification_service", return_value=ns):
        await _notify_desktop_ai_chat_invite(
            to_user_id="friend-1",
            member_id=member_id,
            chat_id=chat_id,
            chat_title="Команда",
            from_display_name="Alice",
        )
    ns.send_to_user.assert_awaited_once()
    to_uid, payload = ns.send_to_user.await_args.args
    assert to_uid == "friend-1"
    assert payload.notification_id == f"desktop_ai_chat_invite_{member_id}"
    assert payload.persistent is True
    assert payload.source == "desktop_ai_chat"
    assert payload.metadata["kind"] == "desktop_ai_chat_invite"
    assert payload.metadata["chat_id"] == str(chat_id)
    assert payload.metadata["open_app"]["appComponent"] == "DesktopAiChatApp"
    assert payload.metadata["open_app"]["desktopAiChatId"] == str(chat_id)
    actions = {a.action for a in payload.actions}
    assert actions == {
        "desktop_ai_chat_invite_accept",
        "desktop_ai_chat_invite_decline",
        "desktop_ai_chat_invite_open",
    }


@pytest.mark.asyncio
async def test_notify_invite_swallows_send_errors() -> None:
    ns = MagicMock()
    ns.send_to_user = AsyncMock(side_effect=RuntimeError("down"))
    with patch("api.routers.desktop_ai_chat_shared.get_notification_service", return_value=ns):
        await _notify_desktop_ai_chat_invite(
            to_user_id="friend-1",
            member_id=str(uuid4()),
            chat_id=uuid4(),
            chat_title="Команда",
            from_display_name="Alice",
        )


@pytest.mark.asyncio
async def test_dismiss_invite_notification() -> None:
    ns = MagicMock()
    ns.emit_dismiss_for_user = AsyncMock()
    mid = uuid4()
    with patch("api.routers.desktop_ai_chat_shared.get_notification_service", return_value=ns):
        await _dismiss_desktop_ai_chat_invite_notification(to_user_id="u1", member_id=mid)
    ns.emit_dismiss_for_user.assert_awaited_once_with("u1", f"desktop_ai_chat_invite_{mid}")
