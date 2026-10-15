# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit locks for Desktop AI Chat collaboration access (owner vs accepted guest).
# Invariants:
# - No live HTTP; mocked AsyncSession execute chain.
# Related:
# - api/services/desktop_chat/collaboration_access.py
# ---

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from api.services.desktop_chat.collaboration_access import (
    ChatAccess,
    load_chat_for_participant,
    load_chat_for_user,
    require_chat_owner,
)


def _chat(*, owner_id, chat_id=None):
    return SimpleNamespace(id=chat_id or uuid4(), user_id=owner_id, title="t")


def _member(*, chat_id, user_id, status="accepted"):
    return SimpleNamespace(
        id=uuid4(),
        chat_id=chat_id,
        user_id=user_id,
        role="guest",
        status=status,
    )


def _exec_result(value):
    result = MagicMock()
    result.scalar_one_or_none = MagicMock(return_value=value)
    return result


@pytest.mark.asyncio
async def test_owner_access_without_member_row() -> None:
    owner = uuid4()
    chat = _chat(owner_id=owner)
    db = AsyncMock()
    db.execute = AsyncMock(return_value=_exec_result(chat))

    access = await load_chat_for_participant(db, chat.id, owner)
    assert access is not None
    assert access.is_owner
    assert access.viewer_role == "owner"
    assert await load_chat_for_user(db, chat.id, owner) is chat


@pytest.mark.asyncio
async def test_stranger_denied() -> None:
    owner = uuid4()
    stranger = uuid4()
    chat = _chat(owner_id=owner)
    db = AsyncMock()
    db.execute = AsyncMock(side_effect=[_exec_result(chat), _exec_result(None)])

    assert await load_chat_for_participant(db, chat.id, stranger) is None

    db.execute = AsyncMock(side_effect=[_exec_result(chat), _exec_result(None)])
    assert await load_chat_for_user(db, chat.id, stranger) is None


@pytest.mark.asyncio
async def test_accepted_guest_access() -> None:
    owner = uuid4()
    guest = uuid4()
    chat = _chat(owner_id=owner)
    member = _member(chat_id=chat.id, user_id=guest, status="accepted")
    db = AsyncMock()
    db.execute = AsyncMock(side_effect=[_exec_result(chat), _exec_result(member)])

    access = await load_chat_for_participant(db, chat.id, guest)
    assert access is not None
    assert not access.is_owner
    assert access.viewer_role == "guest"
    assert access.member is member

    db.execute = AsyncMock(side_effect=[_exec_result(chat), _exec_result(member)])
    assert await load_chat_for_user(db, chat.id, guest) is chat


@pytest.mark.asyncio
async def test_left_or_revoked_treated_as_missing() -> None:
    owner = uuid4()
    guest = uuid4()
    chat = _chat(owner_id=owner)
    # Query filters status=accepted, so left/revoked returns None from DB.
    db = AsyncMock()
    db.execute = AsyncMock(side_effect=[_exec_result(chat), _exec_result(None)])

    assert await load_chat_for_participant(db, chat.id, guest) is None


def test_require_chat_owner_rejects_guest() -> None:
    owner = uuid4()
    guest = uuid4()
    chat = _chat(owner_id=owner)
    member = _member(chat_id=chat.id, user_id=guest)
    access = ChatAccess(chat=chat, viewer_role="guest", member=member)
    with pytest.raises(HTTPException) as exc:
        require_chat_owner(access)
    assert exc.value.status_code == 403


def test_require_chat_owner_allows_owner() -> None:
    owner = uuid4()
    chat = _chat(owner_id=owner)
    access = ChatAccess(chat=chat, viewer_role="owner", member=None)
    assert require_chat_owner(access) is chat


def test_viewer_user_id_owner_is_chat_creator() -> None:
    owner = uuid4()
    chat = _chat(owner_id=owner)
    access = ChatAccess(chat=chat, viewer_role="owner", member=None)
    assert access.viewer_user_id == owner


def test_viewer_user_id_guest_is_member() -> None:
    owner = uuid4()
    guest = uuid4()
    chat = _chat(owner_id=owner)
    member = _member(chat_id=chat.id, user_id=guest)
    access = ChatAccess(chat=chat, viewer_role="guest", member=member)
    assert access.viewer_user_id == guest
    assert access.viewer_user_id != owner
