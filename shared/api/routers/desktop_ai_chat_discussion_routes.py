# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Desktop AI Chat Discussion lifecycle + SSE event routes.
# Invariants:
# - Mounted without extra prefix under parent ``/desktop/ai-chat``.
# - Lifecycle verbs use require_chat_access (owner or accepted guest), not require_chat_owner.
# - Document generation is explicit POST only; never auto from worker.
# Related:
# - api/routers/desktop_ai_chat.py
# - documentation/product/desktop/DESKTOP-AI-CHAT-DISCUSSION-MODE.md
# ---
"""Desktop AI Chat — Discussion mode routes."""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import AsyncIterator
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.auth import User as AuthUser
from api.core.database_manager import get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.ewa_platform.schemas.pydantic.sse_openapi import event_stream_openapi_responses
from api.schemas.desktop_ai_chat_discussion import (
    DiscussionDocumentBody,
    DiscussionEventsStreamSsePayloadDoc,
    DiscussionInterjectionBody,
    DiscussionInterjectionOut,
    DiscussionParticipantProfileOut,
    DiscussionPresetListOut,
    DiscussionSessionOut,
    DiscussionStartBody,
    DiscussionVersionedBody,
)
from api.services.desktop_chat.collaboration_members import require_chat_access
from api.services.desktop_chat_ensemble.discussion import service as discussion_service
from api.services.desktop_chat_ensemble.discussion.events import iter_discussion_sse
from api.services.desktop_chat_ensemble.discussion.serializers import serialize_presets

router = APIRouter(tags=["Desktop - AI Chat Discussion"])
logger = logging.getLogger(__name__)

_DISCUSSION_EVENTS_STREAM_RESPONSES = event_stream_openapi_responses(
    model=DiscussionEventsStreamSsePayloadDoc,
    description=(
        "Discussion live Redis SSE: named ``event:`` frames with JSON ``data:`` "
        "(`DiscussionEventsStreamSsePayloadDoc`); ``: keep-alive`` comments while blocking."
    ),
)


def _uid(user: AuthUser) -> UUID:
    return UUID(user.id)


@router.get("/discussion/presets", response_model=DiscussionPresetListOut)
async def list_discussion_presets(
    user: AuthUser = Depends(require_oauth2_user),
) -> DiscussionPresetListOut:
    _ = user
    return DiscussionPresetListOut(items=serialize_presets())  # type: ignore[arg-type]


@router.get("/discussion/participant-profile", response_model=DiscussionParticipantProfileOut)
async def get_discussion_participant_profile(
    db: AsyncSession = Depends(get_postgres_session),
    user: AuthUser = Depends(require_oauth2_user),
) -> Any:
    return await discussion_service.get_participant_profile(db, user_id=_uid(user))


@router.post(
    "/chats/{chat_id}/discussion/start",
    response_model=DiscussionSessionOut,
    status_code=status.HTTP_201_CREATED,
)
async def start_discussion(
    chat_id: UUID,
    body: DiscussionStartBody,
    db: AsyncSession = Depends(get_postgres_session),
    user: AuthUser = Depends(require_oauth2_user),
) -> Any:
    access = await require_chat_access(db, chat_id, _uid(user))
    try:
        return await discussion_service.start_discussion(
            db,
            access=access,
            preset_id=body.preset_id,
            topic=body.topic,
            goal=body.goal,
            roster=list(body.roster),
            intensity=body.intensity,
            role_title=body.role_title,
            client_request_id=body.client_request_id,
            source_message_id=body.source_message_id,
        )
    except discussion_service.DiscussionConflict as exc:
        raise exc


@router.get(
    "/chats/{chat_id}/discussion/{session_id}",
    response_model=DiscussionSessionOut,
)
async def get_discussion(
    chat_id: UUID,
    session_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),
    user: AuthUser = Depends(require_oauth2_user),
) -> Any:
    await require_chat_access(db, chat_id, _uid(user))
    return await discussion_service.get_discussion(db, chat_id=chat_id, session_id=session_id)


@router.get(
    "/chats/{chat_id}/discussion/{session_id}/events",
    responses=_DISCUSSION_EVENTS_STREAM_RESPONSES,
)
async def discussion_events(
    chat_id: UUID,
    session_id: UUID,
    last_id: str = Query(default="0-0", max_length=64),
    db: AsyncSession = Depends(get_postgres_session),
    user: AuthUser = Depends(require_oauth2_user),
) -> StreamingResponse:
    await require_chat_access(db, chat_id, _uid(user))
    # Ensure session belongs to chat before opening SSE.
    await discussion_service.get_discussion(db, chat_id=chat_id, session_id=session_id)

    async def event_gen() -> AsyncIterator[str]:
        try:
            async for event_name, eid, payload in iter_discussion_sse(
                session_id=session_id,
                last_id=last_id,
            ):
                if event_name == "keepalive":
                    yield ": keep-alive\n\n"
                    continue
                data = json.dumps(payload, ensure_ascii=False, default=str)
                yield f"id: {eid}\nevent: {event_name}\ndata: {data}\n\n"
        except asyncio.CancelledError:
            logger.info("[STEP] discussion_events_cancelled session_id=%s", session_id)
            raise

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post(
    "/chats/{chat_id}/discussion/{session_id}/raise-hand",
    response_model=DiscussionSessionOut,
)
async def raise_hand(
    chat_id: UUID,
    session_id: UUID,
    body: DiscussionVersionedBody,
    db: AsyncSession = Depends(get_postgres_session),
    user: AuthUser = Depends(require_oauth2_user),
) -> Any:
    access = await require_chat_access(db, chat_id, _uid(user))
    return await discussion_service.raise_hand(
        db,
        access=access,
        chat_id=chat_id,
        session_id=session_id,
        expected_version=body.expected_version,
    )


@router.post(
    "/chats/{chat_id}/discussion/{session_id}/interjections",
    response_model=DiscussionInterjectionOut,
)
async def add_interjection(
    chat_id: UUID,
    session_id: UUID,
    body: DiscussionInterjectionBody,
    db: AsyncSession = Depends(get_postgres_session),
    user: AuthUser = Depends(require_oauth2_user),
) -> Any:
    uid = _uid(user)
    access = await require_chat_access(db, chat_id, uid)
    return await discussion_service.add_interjection(
        db,
        access=access,
        user_id=uid,
        chat_id=chat_id,
        session_id=session_id,
        content=body.content,
        expected_version=body.expected_version,
        client_request_id=body.client_request_id,
    )


@router.post(
    "/chats/{chat_id}/discussion/{session_id}/continue",
    response_model=DiscussionSessionOut,
)
async def continue_discussion(
    chat_id: UUID,
    session_id: UUID,
    body: DiscussionVersionedBody,
    db: AsyncSession = Depends(get_postgres_session),
    user: AuthUser = Depends(require_oauth2_user),
) -> Any:
    access = await require_chat_access(db, chat_id, _uid(user))
    return await discussion_service.continue_discussion(
        db,
        access=access,
        chat_id=chat_id,
        session_id=session_id,
        expected_version=body.expected_version,
        client_request_id=body.client_request_id,
    )


@router.post(
    "/chats/{chat_id}/discussion/{session_id}/finish",
    response_model=DiscussionSessionOut,
)
async def finish_discussion(
    chat_id: UUID,
    session_id: UUID,
    body: DiscussionVersionedBody,
    db: AsyncSession = Depends(get_postgres_session),
    user: AuthUser = Depends(require_oauth2_user),
) -> Any:
    access = await require_chat_access(db, chat_id, _uid(user))
    return await discussion_service.finish_discussion(
        db,
        access=access,
        chat_id=chat_id,
        session_id=session_id,
        expected_version=body.expected_version,
    )


@router.post(
    "/chats/{chat_id}/discussion/{session_id}/cancel",
    response_model=DiscussionSessionOut,
)
async def cancel_discussion(
    chat_id: UUID,
    session_id: UUID,
    body: DiscussionVersionedBody,
    db: AsyncSession = Depends(get_postgres_session),
    user: AuthUser = Depends(require_oauth2_user),
) -> Any:
    access = await require_chat_access(db, chat_id, _uid(user))
    return await discussion_service.cancel_discussion(
        db,
        access=access,
        chat_id=chat_id,
        session_id=session_id,
        expected_version=body.expected_version,
    )


@router.post(
    "/chats/{chat_id}/discussion/{session_id}/generate-document",
    response_model=DiscussionSessionOut,
)
async def generate_document(
    chat_id: UUID,
    session_id: UUID,
    body: DiscussionDocumentBody,
    db: AsyncSession = Depends(get_postgres_session),
    user: AuthUser = Depends(require_oauth2_user),
) -> Any:
    access = await require_chat_access(db, chat_id, _uid(user))
    return await discussion_service.generate_document(
        db,
        access=access,
        chat_id=chat_id,
        session_id=session_id,
        expected_version=body.expected_version,
        force=body.force,
    )


# Silence unused import lint in some toolchains when HTTPException only used via re-raise path.
_ = HTTPException
