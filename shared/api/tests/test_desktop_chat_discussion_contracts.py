#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Layer C contract locks for Discussion start/ACL, one-active, isolation, lease reaper
# (desktop-ai-chat-025). Stubs DB boundaries; no Redis/Celery/LLM.
# Invariants:
# - Accepted guest can start/continue/finish/cancel/document (not 403 owner_required).
# - Account one-active is keyed to chat.user_id; unique-index races map to 409.
# - Stale running leases become paused_error and clear lease fields.
# Related:
# - documentation/product/desktop/DESKTOP-AI-CHAT-DISCUSSION-MODE.md
# - documentation/platform/PRODUCT-AUDIT-STABILITY-BACKLOG.md (desktop-ai-chat-025)
# ---
"""Discussion HTTP/service contract locks (start/ACL/isolation/reaper)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError

from api.models.desktop_ai_chat import DesktopAiChatMessage, DesktopAiDiscussionSession
from api.services.desktop_chat.collaboration_access import ChatAccess
from api.services.desktop_chat_ensemble.discussion import service as discussion_service
from api.services.desktop_chat_ensemble.discussion.contracts import DiscussionStatus
from api.services.desktop_chat_ensemble.discussion.isolation import active_discussion_blocks_stream
from api.services.desktop_chat_ensemble.discussion.repository import reap_stale_leases


def _owner_access(*, chat_id=None, user_id=None) -> ChatAccess:
    chat = SimpleNamespace(id=chat_id or uuid4(), user_id=user_id or uuid4())
    return ChatAccess(chat=chat, viewer_role="owner", member=None)


def _guest_access(*, chat_id=None, user_id=None) -> ChatAccess:
    chat = SimpleNamespace(id=chat_id or uuid4(), user_id=user_id or uuid4())
    member = SimpleNamespace(status="accepted", user_id=uuid4())
    return ChatAccess(chat=chat, viewer_role="guest", member=member)


@pytest.mark.asyncio
async def test_start_discussion_accepted_guest_hits_chat_active_not_owner_gate() -> None:
    access = _guest_access()
    existing = SimpleNamespace(
        id=uuid4(),
        chat_id=access.chat.id,
        client_request_id=None,
        status=DiscussionStatus.RUNNING.value,
        version=2,
    )
    with (
        patch(
            "api.services.desktop_chat_ensemble.discussion.service.get_active_session_for_chat",
            AsyncMock(return_value=existing),
        ),
        patch(
            "api.services.desktop_chat_ensemble.discussion.service.serialize_session",
            return_value={"id": str(existing.id), "status": existing.status},
        ),
    ):
        with pytest.raises(discussion_service.DiscussionConflict) as ei:
            await discussion_service.start_discussion(
                AsyncMock(),
                access=access,
                preset_id="brainstorm",
                topic="Тема",
                goal="Цель",
                roster=["likiy_sorrento", "arlyqueen"],
                intensity=None,
                role_title=None,
                client_request_id=None,
            )
    assert ei.value.status_code == 409
    assert ei.value.detail == "discussion_already_active"


@pytest.mark.asyncio
async def test_start_discussion_guest_account_active_uses_chat_owner_id() -> None:
    access = _guest_access()
    other = SimpleNamespace(
        id=uuid4(),
        chat_id=uuid4(),
        client_request_id=None,
        status=DiscussionStatus.QUEUED.value,
        version=1,
    )
    owner_lookup = AsyncMock(return_value=other)
    with (
        patch(
            "api.services.desktop_chat_ensemble.discussion.service.get_active_session_for_chat",
            AsyncMock(return_value=None),
        ),
        patch(
            "api.services.desktop_chat_ensemble.discussion.service.get_active_session_for_owner",
            owner_lookup,
        ),
        patch(
            "api.services.desktop_chat_ensemble.discussion.service.serialize_session",
            return_value={"id": str(other.id), "status": other.status},
        ),
    ):
        with pytest.raises(discussion_service.DiscussionConflict) as ei:
            await discussion_service.start_discussion(
                AsyncMock(),
                access=access,
                preset_id="brainstorm",
                topic="Тема",
                goal="Цель",
                roster=["likiy_sorrento", "arlyqueen"],
                intensity=None,
                role_title=None,
                client_request_id=None,
            )
    assert ei.value.status_code == 409
    assert ei.value.detail == "discussion_already_active_for_account"
    owner_lookup.assert_awaited_once()
    owner_call = owner_lookup.await_args
    assert owner_call is not None
    assert owner_call.args[1] == access.chat.user_id


@pytest.mark.asyncio
async def test_continue_discussion_accepted_guest_reaches_session_lookup() -> None:
    access = _guest_access()
    with patch(
        "api.services.desktop_chat_ensemble.discussion.service.get_session",
        AsyncMock(return_value=None),
    ):
        with pytest.raises(HTTPException) as ei:
            await discussion_service.continue_discussion(
                AsyncMock(),
                access=access,
                chat_id=access.chat.id,
                session_id=uuid4(),
                expected_version=1,
                client_request_id=None,
            )
    assert ei.value.status_code == 404
    assert ei.value.detail == "discussion_not_found"


@pytest.mark.parametrize(
    "verb",
    ("finish_discussion", "cancel_discussion", "generate_document"),
)
@pytest.mark.asyncio
async def test_discussion_control_verbs_accepted_guest_reaches_session_lookup(verb: str) -> None:
    access = _guest_access()
    kwargs: dict[str, object] = {
        "access": access,
        "chat_id": access.chat.id,
        "session_id": uuid4(),
        "expected_version": 1,
    }
    if verb == "generate_document":
        kwargs["force"] = False
    with patch(
        "api.services.desktop_chat_ensemble.discussion.service.get_session",
        AsyncMock(return_value=None),
    ):
        with pytest.raises(HTTPException) as ei:
            await getattr(discussion_service, verb)(AsyncMock(), **kwargs)
    assert ei.value.status_code == 404
    assert ei.value.detail == "discussion_not_found"


@pytest.mark.asyncio
async def test_start_discussion_guest_persists_chat_owner_slot() -> None:
    access = _guest_access()
    added: list[Any] = []
    db = AsyncMock()

    async def fake_flush() -> None:
        for obj in added:
            if getattr(obj, "id", None) is None:
                obj.id = uuid4()

    db.add = added.append
    db.flush = AsyncMock(side_effect=fake_flush)
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    persist_role = AsyncMock()
    with (
        patch(
            "api.services.desktop_chat_ensemble.discussion.service.get_active_session_for_chat",
            AsyncMock(return_value=None),
        ),
        patch(
            "api.services.desktop_chat_ensemble.discussion.service.get_active_session_for_owner",
            AsyncMock(return_value=None),
        ),
        patch(
            "api.services.desktop_chat_ensemble.discussion.service.resolve_participant_display_name",
            AsyncMock(return_value="Poet"),
        ),
        patch(
            "api.services.desktop_chat_ensemble.discussion.service._persist_preferred_role",
            persist_role,
        ),
        patch(
            "api.services.desktop_chat_ensemble.discussion.service.enqueue_discussion_batch",
            return_value="task-1",
        ),
        patch(
            "api.services.desktop_chat_ensemble.discussion.service.publish_discussion_event",
            AsyncMock(),
        ),
        patch(
            "api.services.desktop_chat_ensemble.discussion.service.serialize_session",
            return_value={"status": "queued"},
        ),
    ):
        payload = await discussion_service.start_discussion(
            db,
            access=access,
            preset_id="brainstorm",
            topic="Тема",
            goal="Цель",
            roster=["likiy_sorrento", "arlyqueen"],
            intensity=None,
            role_title="редактор",
            client_request_id=None,
        )
    assert payload["status"] == "queued"
    sessions = [obj for obj in added if isinstance(obj, DesktopAiDiscussionSession)]
    messages = [obj for obj in added if isinstance(obj, DesktopAiChatMessage)]
    assert len(sessions) == 1
    assert sessions[0].owner_user_id == access.chat.user_id
    assert sessions[0].owner_user_id != access.viewer_user_id
    assert sessions[0].participant_display_name == "Poet"
    assert sessions[0].participant_role_title == "редактор"
    assert len(messages) == 1
    assert messages[0].author_user_id == access.viewer_user_id
    persist_role.assert_awaited_once()
    persist_call = persist_role.await_args
    assert persist_call is not None
    assert persist_call.kwargs["user_id"] == access.viewer_user_id


@pytest.mark.asyncio
async def test_start_discussion_unique_chat_conflict_maps_to_409() -> None:
    access = _guest_access()
    existing = SimpleNamespace(
        id=uuid4(),
        chat_id=access.chat.id,
        status=DiscussionStatus.QUEUED.value,
    )
    db = AsyncMock()
    db.add = MagicMock()
    db.flush = AsyncMock(side_effect=[None, IntegrityError("INSERT", {}, Exception("unique_chat"))])
    db.rollback = AsyncMock()
    chat_lookup = AsyncMock(side_effect=[None, existing])
    with (
        patch(
            "api.services.desktop_chat_ensemble.discussion.service.get_active_session_for_chat",
            chat_lookup,
        ),
        patch(
            "api.services.desktop_chat_ensemble.discussion.service.get_active_session_for_owner",
            AsyncMock(return_value=None),
        ),
        patch(
            "api.services.desktop_chat_ensemble.discussion.service.resolve_participant_display_name",
            AsyncMock(return_value="Poet"),
        ),
        patch(
            "api.services.desktop_chat_ensemble.discussion.service.serialize_session",
            return_value={"id": str(existing.id), "status": existing.status},
        ),
    ):
        with pytest.raises(discussion_service.DiscussionConflict) as ei:
            await discussion_service.start_discussion(
                db,
                access=access,
                preset_id="brainstorm",
                topic="Тема",
                goal="Цель",
                roster=["likiy_sorrento", "arlyqueen"],
                intensity=None,
                role_title=None,
                client_request_id=None,
            )
    assert ei.value.status_code == 409
    assert ei.value.detail == "discussion_already_active"
    db.rollback.assert_awaited()


@pytest.mark.asyncio
async def test_start_discussion_unique_owner_conflict_maps_to_409() -> None:
    access = _guest_access()
    other = SimpleNamespace(
        id=uuid4(),
        chat_id=uuid4(),
        status=DiscussionStatus.RUNNING.value,
    )
    db = AsyncMock()
    db.add = MagicMock()
    db.flush = AsyncMock(side_effect=[None, IntegrityError("INSERT", {}, Exception("unique_owner"))])
    db.rollback = AsyncMock()
    owner_lookup = AsyncMock(side_effect=[None, other])
    with (
        patch(
            "api.services.desktop_chat_ensemble.discussion.service.get_active_session_for_chat",
            AsyncMock(return_value=None),
        ),
        patch(
            "api.services.desktop_chat_ensemble.discussion.service.get_active_session_for_owner",
            owner_lookup,
        ),
        patch(
            "api.services.desktop_chat_ensemble.discussion.service.resolve_participant_display_name",
            AsyncMock(return_value="Poet"),
        ),
        patch(
            "api.services.desktop_chat_ensemble.discussion.service.serialize_session",
            return_value={"id": str(other.id), "status": other.status},
        ),
    ):
        with pytest.raises(discussion_service.DiscussionConflict) as ei:
            await discussion_service.start_discussion(
                db,
                access=access,
                preset_id="brainstorm",
                topic="Тема",
                goal="Цель",
                roster=["likiy_sorrento", "arlyqueen"],
                intensity=None,
                role_title=None,
                client_request_id=None,
            )
    assert ei.value.status_code == 409
    assert ei.value.detail == "discussion_already_active_for_account"
    db.rollback.assert_awaited()
    assert owner_lookup.await_count == 2
    owner_call = owner_lookup.await_args
    assert owner_call is not None
    assert owner_call.args[1] == access.chat.user_id


@pytest.mark.asyncio
async def test_start_discussion_409_when_chat_already_active() -> None:
    access = _owner_access()
    existing = SimpleNamespace(
        id=uuid4(),
        chat_id=access.chat.id,
        client_request_id=None,
        status=DiscussionStatus.RUNNING.value,
        version=2,
    )
    with (
        patch(
            "api.services.desktop_chat_ensemble.discussion.service.get_active_session_for_chat",
            AsyncMock(return_value=existing),
        ),
        patch(
            "api.services.desktop_chat_ensemble.discussion.service.serialize_session",
            return_value={"id": str(existing.id), "status": existing.status},
        ),
    ):
        with pytest.raises(discussion_service.DiscussionConflict) as ei:
            await discussion_service.start_discussion(
                AsyncMock(),
                access=access,
                preset_id="brainstorm",
                topic="Тема",
                goal="Цель",
                roster=["likiy_sorrento", "arlyqueen"],
                intensity=None,
                role_title=None,
                client_request_id=None,
            )
    assert ei.value.status_code == 409
    assert ei.value.detail == "discussion_already_active"


@pytest.mark.asyncio
async def test_start_discussion_409_when_account_already_active() -> None:
    access = _owner_access()
    other = SimpleNamespace(
        id=uuid4(),
        chat_id=uuid4(),
        client_request_id=None,
        status=DiscussionStatus.QUEUED.value,
        version=1,
    )
    with (
        patch(
            "api.services.desktop_chat_ensemble.discussion.service.get_active_session_for_chat",
            AsyncMock(return_value=None),
        ),
        patch(
            "api.services.desktop_chat_ensemble.discussion.service.get_active_session_for_owner",
            AsyncMock(return_value=other),
        ),
        patch(
            "api.services.desktop_chat_ensemble.discussion.service.serialize_session",
            return_value={"id": str(other.id), "status": other.status},
        ),
    ):
        with pytest.raises(discussion_service.DiscussionConflict) as ei:
            await discussion_service.start_discussion(
                AsyncMock(),
                access=access,
                preset_id="brainstorm",
                topic="Тема",
                goal="Цель",
                roster=["likiy_sorrento", "arlyqueen"],
                intensity=None,
                role_title=None,
                client_request_id=None,
            )
    assert ei.value.status_code == 409
    assert ei.value.detail == "discussion_already_active_for_account"


@pytest.mark.asyncio
async def test_active_discussion_blocks_stream_returns_session_id() -> None:
    chat_id = uuid4()
    session_id = uuid4()
    session = SimpleNamespace(id=session_id)
    with patch(
        "api.services.desktop_chat_ensemble.discussion.isolation.get_active_session_for_chat",
        AsyncMock(return_value=session),
    ):
        blocked = await active_discussion_blocks_stream(AsyncMock(), chat_id)
    assert blocked == session_id


@pytest.mark.asyncio
async def test_active_discussion_blocks_stream_clear_when_idle() -> None:
    with patch(
        "api.services.desktop_chat_ensemble.discussion.isolation.get_active_session_for_chat",
        AsyncMock(return_value=None),
    ):
        blocked = await active_discussion_blocks_stream(AsyncMock(), uuid4())
    assert blocked is None


@pytest.mark.asyncio
async def test_reap_stale_leases_pauses_expired_running_sessions() -> None:
    now = datetime.now(UTC)
    stale = SimpleNamespace(
        id=uuid4(),
        chat_id=uuid4(),
        status=DiscussionStatus.RUNNING.value,
        pause_reason=None,
        lease_owner="worker-1",
        lease_expires_at=now - timedelta(seconds=30),
        version=3,
    )
    fresh = SimpleNamespace(
        id=uuid4(),
        chat_id=uuid4(),
        status=DiscussionStatus.RUNNING.value,
        pause_reason=None,
        lease_owner="worker-2",
        lease_expires_at=now + timedelta(seconds=60),
        version=1,
    )
    result = MagicMock()
    # Repository selects only expired rows; emulate that filter by returning stale only.
    result.scalars.return_value.all.return_value = [stale]
    db = AsyncMock()
    db.execute = AsyncMock(return_value=result)

    with patch(
        "api.services.desktop_chat_ensemble.discussion.repository.bump_version",
        side_effect=lambda s: setattr(s, "version", int(s.version) + 1),
    ):
        count = await reap_stale_leases(db, limit=50)

    assert count == 1
    assert stale.status == DiscussionStatus.PAUSED_ERROR.value
    assert stale.pause_reason == "error"
    assert stale.lease_owner is None
    assert stale.lease_expires_at is None
    assert stale.version == 4
    assert fresh.status == DiscussionStatus.RUNNING.value
