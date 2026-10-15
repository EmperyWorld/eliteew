# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit locks for Desktop AI Chat collaboration members (invite gates, capabilities, leave).
# Invariants:
# - No live HTTP/friends DB; friendship and persistence mocked where needed.
# Related:
# - api/services/desktop_chat/collaboration_members.py
# ---

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

from api.services.desktop_chat.collaboration_access import ChatAccess
from api.services.desktop_chat.collaboration_members import (
    chat_capabilities,
    invite_friend_to_chat,
    leave_chat,
)


def test_capabilities_owner_vs_guest() -> None:
    owner = chat_capabilities(is_owner=True)
    guest = chat_capabilities(is_owner=False)
    assert owner["can_regenerate"] is True
    assert owner["can_manage_members"] is True
    assert owner["can_leave"] is False
    assert guest["can_regenerate"] is False
    assert guest["can_delete_messages"] is False
    assert guest["can_manage_project"] is False
    assert guest["can_leave"] is True
    assert guest["can_stream"] is True


@pytest.mark.asyncio
async def test_invite_requires_ensemble() -> None:
    owner = uuid4()
    friend = uuid4()
    chat = SimpleNamespace(
        id=uuid4(),
        user_id=owner,
        settings={"desktop_chat_mode": "solo"},
    )
    access = ChatAccess(chat=chat, viewer_role="owner", member=None)
    db = AsyncMock()
    with (
        patch(
            "api.services.desktop_chat.collaboration_members.require_chat_access",
            AsyncMock(return_value=access),
        ),
        pytest.raises(HTTPException) as exc,
    ):
        await invite_friend_to_chat(db, chat_id=chat.id, owner_id=owner, friend_user_id=friend)
    assert exc.value.status_code == 409
    assert exc.value.detail == "ensemble_required"


@pytest.mark.asyncio
async def test_leave_marks_left_status() -> None:
    owner = uuid4()
    guest = uuid4()
    chat = SimpleNamespace(id=uuid4(), user_id=owner)
    member = SimpleNamespace(
        id=uuid4(),
        chat_id=chat.id,
        user_id=guest,
        status="accepted",
        responded_at=None,
    )
    access = ChatAccess(chat=chat, viewer_role="guest", member=member)
    db = AsyncMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    with patch(
        "api.services.desktop_chat.collaboration_members.require_chat_access",
        AsyncMock(return_value=access),
    ):
        out = await leave_chat(db, chat_id=chat.id, user_id=guest)
    assert out.status == "left"
    assert out.responded_at is not None
    db.commit.assert_awaited()


@pytest.mark.asyncio
async def test_owner_cannot_leave() -> None:
    owner = uuid4()
    chat = SimpleNamespace(id=uuid4(), user_id=owner)
    access = ChatAccess(chat=chat, viewer_role="owner", member=None)
    db = AsyncMock()
    with (
        patch(
            "api.services.desktop_chat.collaboration_members.require_chat_access",
            AsyncMock(return_value=access),
        ),
        pytest.raises(HTTPException) as exc,
    ):
        await leave_chat(db, chat_id=chat.id, user_id=owner)
    assert exc.value.status_code == 400
    assert exc.value.detail == "owner_cannot_leave"


@pytest.mark.asyncio
async def test_list_chat_participants_owner_then_accepted_guests() -> None:
    from api.services.desktop_chat.collaboration_members import list_chat_participants

    owner = uuid4()
    guest = uuid4()
    chat = SimpleNamespace(id=uuid4(), user_id=owner)
    owner_user = SimpleNamespace(id=owner, full_name="Owner Name", username="owner", avatar_url="/a/o.png")
    guest_user = SimpleNamespace(id=guest, full_name="Guest Name", username="guest", avatar_url=None)

    member_result = SimpleNamespace(all=lambda: [(guest,)])
    users_result = SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [owner_user, guest_user]))

    db = AsyncMock()
    db.execute = AsyncMock(side_effect=[member_result, users_result])

    with patch(
        "api.services.desktop_chat.collaboration_members.resolve_author_display_name",
        side_effect=lambda **kw: kw.get("full_name") or str(kw["user_id"])[:8],
    ):
        out = await list_chat_participants(db, chat)

    assert len(out) == 2
    assert out[0]["user_id"] == str(owner)
    assert out[0]["is_owner"] is True
    assert out[0]["avatar_url"] == "/a/o.png"
    assert out[1]["user_id"] == str(guest)
    assert out[1]["is_owner"] is False
    assert out[1]["avatar_url"] is None


@pytest.mark.asyncio
async def test_enrich_chat_out_includes_participants() -> None:
    from api.services.desktop_chat.collaboration_members import enrich_chat_out

    owner = uuid4()
    chat = SimpleNamespace(id=uuid4(), user_id=owner)
    db = AsyncMock()
    with (
        patch(
            "api.services.desktop_chat.collaboration_members.count_accepted_members",
            AsyncMock(return_value=1),
        ),
        patch(
            "api.services.desktop_chat.collaboration_members.list_chat_participants",
            AsyncMock(
                return_value=[
                    {
                        "user_id": str(owner),
                        "display_name": "Owner",
                        "avatar_url": None,
                        "is_owner": True,
                    }
                ]
            ),
        ),
    ):
        out = await enrich_chat_out(db, {"id": str(chat.id)}, chat=chat, viewer_role="guest")

    assert out["is_shared"] is True
    assert out["owner_user_id"] == str(owner)
    assert out["participants"][0]["is_owner"] is True
    assert out["viewer_role"] == "guest"
