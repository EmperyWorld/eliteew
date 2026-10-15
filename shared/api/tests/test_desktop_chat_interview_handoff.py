#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract locks for interview-prep blueprint handoff into Discussion.
# Invariants:
# - RU headings Тема/Цель интервью extract without metadata.
# - source_message_id forces preset=interview and auto_document on finish only.
# - Missing/wrong source → 404; heading-less source → 400.
# Related:
# - documentation/product/desktop/DESKTOP-AI-CHAT-DISCUSSION-MODE.md
# ---
"""Interview handoff extract + start/finish auto-document locks."""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

from api.models.desktop_ai_chat import DesktopAiDiscussionSession
from api.services.desktop_chat.collaboration_access import ChatAccess
from api.services.desktop_chat_ensemble.blueprint.picker import (
    user_requests_interview_prep,
)
from api.services.desktop_chat_ensemble.discussion import service as discussion_service
from api.services.desktop_chat_ensemble.discussion.contracts import DiscussionStatus
from api.services.desktop_chat_ensemble.discussion.interview_handoff import (
    extract_interview_handoff,
)

_POET_CARD = """## Тема интервью

**Стратегический вектор исследования рыночных ниш и потребительских болей для формирования позиционирования EliteEW.**

Для того чтобы наше позиционирование не стало набором маркетинговых клише.

## Цель интервью

Определить операционную задачу интервью: верификацию гипотез о ценности продукта.

**Задачи для операционной применимости:**
* Валидация функциональных связок.
"""


def _guest_access(*, chat_id=None, user_id=None) -> ChatAccess:
    chat = SimpleNamespace(
        id=chat_id or uuid4(),
        user_id=user_id or uuid4(),
        settings={"desktop_ensemble_ids": ["likiy_sorrento"]},
    )
    member = SimpleNamespace(status="accepted", user_id=uuid4())
    return ChatAccess(chat=chat, viewer_role="guest", member=member)


def test_extract_interview_handoff_reads_ru_headings_from_research_plan() -> None:
    hit = extract_interview_handoff(_POET_CARD)
    assert hit is not None
    assert hit["preset_id"] == "interview"
    assert "Стратегический вектор" in hit["topic"]
    assert "операционную задачу" in hit["goal"]


def test_extract_interview_handoff_prefers_metadata() -> None:
    hit = extract_interview_handoff(
        "## Тема интервью\n\nFrom markdown",
        {"interview_handoff": {"topic": "Meta topic", "goal": "Meta goal"}},
    )
    assert hit == {
        "topic": "Meta topic",
        "goal": "Meta goal",
        "preset_id": "interview",
        "roster": [],
        "panel_guide": "",
        "panel_roles": {},
    }


def test_extract_interview_handoff_reads_panel_roster_and_guide() -> None:
    card = """## Тема интервью

Смысловое ядро EliteEW.

## Цель интервью

Позиционирование после ответов основателя.

## Панель интервью

- `arlyqueen` — ведущий: JTBD и messaging
- `it_kernel` — техника и границы архитектуры

## Гайд для панели

1. Какой JTBD главный?
2. Где unfair advantage?
"""
    hit = extract_interview_handoff(card)
    assert hit is not None
    assert hit["roster"] == ["arlyqueen", "it_kernel"]
    assert "JTBD" in hit["panel_roles"]["arlyqueen"]
    assert "JTBD главный" in hit["panel_guide"]


@pytest.mark.asyncio
async def test_start_discussion_uses_panel_roster_not_fe_defaults() -> None:
    access = _guest_access()
    access.chat.settings = {
        "desktop_ensemble_ids": ["likiy_sorrento", "akimbo", "suno_songwriter"],
    }
    source_id = uuid4()
    card = """## Тема интервью

Тема панели.

## Цель интервью

Цель панели.

## Панель интервью

- `arlyqueen` — ведущий
- `it_kernel` — техника

## Гайд для панели

Спроси про JTBD.
"""
    source = SimpleNamespace(
        id=source_id,
        chat_id=access.chat.id,
        role="assistant",
        content=card,
        message_metadata={"desktop_ensemble_contributors": ["likiy_sorrento"]},
    )
    added: list[Any] = []
    db = AsyncMock()
    db.get = AsyncMock(return_value=source)

    async def fake_flush() -> None:
        for obj in added:
            if getattr(obj, "id", None) is None:
                obj.id = uuid4()

    db.add = added.append
    db.flush = AsyncMock(side_effect=fake_flush)
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
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
            AsyncMock(),
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
            return_value={"status": "queued", "preset_id": "interview"},
        ),
    ):
        await discussion_service.start_discussion(
            db,
            access=access,
            preset_id="brainstorm",
            topic="ignored",
            goal="ignored",
            roster=["likiy_sorrento", "akimbo", "arlekino_pravoz"],
            intensity=None,
            role_title=None,
            client_request_id=None,
            source_message_id=source_id,
        )
    sessions = [obj for obj in added if isinstance(obj, DesktopAiDiscussionSession)]
    assert len(sessions) == 1
    assert sessions[0].roster == ["arlyqueen", "it_kernel"]
    assert "JTBD" in sessions[0].settings["interview_handoff"]["panel_guide"]
    assert sessions[0].settings["interview_handoff"]["panel_roles"]["arlyqueen"]


def test_user_requests_interview_prep_does_not_steal_generic_research() -> None:
    assert user_requests_interview_prep("тема интервью и цель интервью") is True
    assert user_requests_interview_prep("Подготовьте карточку интервью: тема, цель и гайд вопросов для панели.") is True
    assert user_requests_interview_prep("Подготовьте план исследования: скрипт интервью и критерии решения.") is False


def test_extract_interview_handoff_reads_bold_tema_cel_room_card() -> None:
    card = """## Стратегическая карточка интервью

**Тема:** Извлечение смыслового ядра EliteEW.

**Цель:** Трансформировать видение основателя в позиционирование.
"""
    hit = extract_interview_handoff(card)
    assert hit is not None
    assert "смыслового ядра" in hit["topic"]
    assert "позиционирование" in hit["goal"]


def test_extract_interview_handoff_ignores_lone_bold_tema() -> None:
    assert extract_interview_handoff("**Тема:** Только тема без цели.") is None


@pytest.mark.asyncio
async def test_start_discussion_source_message_forces_interview_and_auto_document() -> None:
    access = _guest_access()
    source_id = uuid4()
    source = SimpleNamespace(
        id=source_id,
        chat_id=access.chat.id,
        role="assistant",
        content=_POET_CARD,
        message_metadata={},
    )
    added: list[Any] = []
    db = AsyncMock()
    db.get = AsyncMock(return_value=source)

    async def fake_flush() -> None:
        for obj in added:
            if getattr(obj, "id", None) is None:
                obj.id = uuid4()

    db.add = added.append
    db.flush = AsyncMock(side_effect=fake_flush)
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
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
            AsyncMock(),
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
            return_value={"status": "queued", "preset_id": "interview"},
        ),
    ):
        payload = await discussion_service.start_discussion(
            db,
            access=access,
            preset_id="brainstorm",
            topic="ignored",
            goal="ignored",
            roster=[],
            intensity=None,
            role_title=None,
            client_request_id=None,
            source_message_id=source_id,
        )
    assert payload["preset_id"] == "interview"
    sessions = [obj for obj in added if isinstance(obj, DesktopAiDiscussionSession)]
    assert len(sessions) == 1
    assert sessions[0].preset_id == "interview"
    assert "Стратегический вектор" in sessions[0].topic
    assert sessions[0].roster == ["likiy_sorrento"]
    assert sessions[0].settings["interview_handoff"]["auto_document"] is True
    assert sessions[0].settings["interview_handoff"]["source_message_id"] == str(source_id)


@pytest.mark.asyncio
async def test_start_discussion_missing_source_message_is_404() -> None:
    access = _guest_access()
    db = AsyncMock()
    db.get = AsyncMock(return_value=None)
    with (
        patch(
            "api.services.desktop_chat_ensemble.discussion.service.get_active_session_for_chat",
            AsyncMock(return_value=None),
        ),
        patch(
            "api.services.desktop_chat_ensemble.discussion.service.get_active_session_for_owner",
            AsyncMock(return_value=None),
        ),
    ):
        with pytest.raises(HTTPException) as ei:
            await discussion_service.start_discussion(
                db,
                access=access,
                preset_id="interview",
                topic="x",
                goal="",
                roster=["likiy_sorrento"],
                intensity=None,
                role_title=None,
                client_request_id=None,
                source_message_id=uuid4(),
            )
    assert ei.value.status_code == 404
    assert ei.value.detail == "interview_handoff_not_found"


@pytest.mark.asyncio
async def test_start_discussion_source_without_topic_is_400() -> None:
    access = _guest_access()
    source_id = uuid4()
    source = SimpleNamespace(
        id=source_id,
        chat_id=access.chat.id,
        role="assistant",
        content="## Методология\n\nMixed method",
        message_metadata={},
    )
    db = AsyncMock()
    db.get = AsyncMock(return_value=source)
    with (
        patch(
            "api.services.desktop_chat_ensemble.discussion.service.get_active_session_for_chat",
            AsyncMock(return_value=None),
        ),
        patch(
            "api.services.desktop_chat_ensemble.discussion.service.get_active_session_for_owner",
            AsyncMock(return_value=None),
        ),
    ):
        with pytest.raises(HTTPException) as ei:
            await discussion_service.start_discussion(
                db,
                access=access,
                preset_id="interview",
                topic="x",
                goal="",
                roster=["likiy_sorrento"],
                intensity=None,
                role_title=None,
                client_request_id=None,
                source_message_id=source_id,
            )
    assert ei.value.status_code == 400
    assert ei.value.detail == "interview_handoff_not_found"


@pytest.mark.asyncio
async def test_finish_discussion_auto_documents_interview_handoff() -> None:
    access = _guest_access()
    session = SimpleNamespace(
        id=uuid4(),
        chat_id=access.chat.id,
        status=DiscussionStatus.RUNNING.value,
        version=3,
        pause_reason=None,
        pause_requested=False,
        lease_owner="w",
        lease_expires_at=None,
        settings={"interview_handoff": {"auto_document": True, "preset_id": "interview"}},
        document_markdown="",
    )
    posted = SimpleNamespace(id=uuid4())

    async def fake_generate(*_args, **_kwargs):
        session.document_markdown = "# Insight brief\n\nFounder vision."
        return {"status": "completed"}

    db = AsyncMock()
    with (
        patch(
            "api.services.desktop_chat_ensemble.discussion.service.get_session",
            AsyncMock(return_value=session),
        ),
        patch(
            "api.services.desktop_chat_ensemble.discussion.service.list_turns",
            AsyncMock(return_value=[]),
        ),
        patch(
            "api.services.desktop_chat_ensemble.discussion.service.publish_discussion_event",
            AsyncMock(),
        ),
        patch(
            "api.services.desktop_chat_ensemble.discussion.service.serialize_session",
            return_value={"status": "completed"},
        ),
        patch(
            "api.services.desktop_chat_ensemble.discussion.service.generate_document",
            AsyncMock(side_effect=fake_generate),
        ),
        patch(
            "api.services.desktop_chat.service_persist.persist_assistant_message_isolated",
            AsyncMock(return_value=posted),
        ) as persist,
    ):
        payload = await discussion_service.finish_discussion(
            db,
            access=access,
            chat_id=access.chat.id,
            session_id=session.id,
            expected_version=None,
        )
    assert payload["status"] == "completed"
    persist.assert_awaited_once()
    persist_call = persist.await_args
    assert persist_call is not None
    meta = persist_call.kwargs["message_metadata"]
    assert meta["desktop_discussion_document"] is True
    assert meta["artifact_type"] == "discussion_interview"
    assert session.status == DiscussionStatus.COMPLETED.value


@pytest.mark.asyncio
async def test_finish_discussion_skips_auto_document_without_handoff_flag() -> None:
    access = _guest_access()
    session = SimpleNamespace(
        id=uuid4(),
        chat_id=access.chat.id,
        status=DiscussionStatus.RUNNING.value,
        version=1,
        pause_reason=None,
        pause_requested=False,
        lease_owner=None,
        lease_expires_at=None,
        settings={},
        document_markdown="",
    )
    db = AsyncMock()
    with (
        patch(
            "api.services.desktop_chat_ensemble.discussion.service.get_session",
            AsyncMock(return_value=session),
        ),
        patch(
            "api.services.desktop_chat_ensemble.discussion.service.list_turns",
            AsyncMock(return_value=[]),
        ),
        patch(
            "api.services.desktop_chat_ensemble.discussion.service.publish_discussion_event",
            AsyncMock(),
        ),
        patch(
            "api.services.desktop_chat_ensemble.discussion.service.serialize_session",
            return_value={"status": "completed"},
        ),
        patch(
            "api.services.desktop_chat_ensemble.discussion.service.generate_document",
            AsyncMock(),
        ) as gen,
        patch(
            "api.services.desktop_chat.service_persist.persist_assistant_message_isolated",
            AsyncMock(),
        ) as persist,
    ):
        await discussion_service.finish_discussion(
            db,
            access=access,
            chat_id=access.chat.id,
            session_id=session.id,
            expected_version=None,
        )
    gen.assert_not_awaited()
    persist.assert_not_awaited()
