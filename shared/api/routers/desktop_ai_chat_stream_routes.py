# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Desktop AI Chat SSE stream and stream-lock routes.
# Invariants:
# - Mounted without extra prefix under parent ``/desktop/ai-chat``.
# - POST …/stream must not bind Depends(get_postgres_session) to SSE lifetime
#   (prep via desktop_ai_chat_session only; close before StreamingResponse).
# - SSE headers: Cache-Control no-cache, Connection keep-alive, X-Accel-Buffering no.
# - OpenAPI Wave B5: ``text/event-stream`` + ``DesktopAiChatStreamSsePayloadDoc``.
# Related:
# - api/routers/desktop_ai_chat.py
# - api/schemas/desktop_ai_chat.py
# - api/services/desktop_chat/db_session.py
# - documentation/product/desktop/DESKTOP-AI-CHAT-ROUTER-SPLIT-2026-08-06.md
# ---
"""Desktop AI Chat — SSE stream and stream-lock routes."""

from __future__ import annotations

import logging
from typing import Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.auth import User as AuthUser
from api.core.database_manager import get_asyncpg_pool, get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.ewa_platform.schemas.pydantic.sse_openapi import event_stream_openapi_responses
from api.models.desktop_ai_chat import DesktopAiChatMessage
from api.routers.marketing_cabinet.common import get_accessible_project
from api.schemas.desktop_ai_chat import (
    DesktopAiChatStreamSsePayloadDoc,
    DesktopAiStreamLockPeekOut,
    StreamBody,
)
from api.services.desktop_chat.collaboration_members import require_chat_access
from api.services.desktop_chat.db_session import desktop_ai_chat_session
from api.services.desktop_chat.service import (
    apply_ensemble_document_confirm,
    fetch_config_defaults,
    stream_chat_turn,
)
from api.services.desktop_chat.solo_slot import assert_solo_slot_allows_stream
from api.services.desktop_chat.stream_coordination import StreamCoordinationUnavailable
from api.services.desktop_chat.stream_lock import (
    acquire_stream_lock,
    peek_stream_lock,
    release_stream_lock,
    try_register_idempotency,
    wrap_stream_with_lock_and_idem,
)
from api.services.desktop_chat_ensemble.discussion.isolation import active_discussion_blocks_stream
from api.services.desktop_chat_ensemble.settings import is_ensemble_chat

router = APIRouter(tags=["Desktop - AI Chat"])
logger = logging.getLogger(__name__)

_CHAT_STREAM_RESPONSES = event_stream_openapi_responses(
    model=DesktopAiChatStreamSsePayloadDoc,
    description=(
        "Desktop AI Chat turn SSE: JSON ``data:`` frames with ``event`` "
        "(`DesktopAiChatStreamSsePayloadDoc`); keep-alive comments while waiting."
    ),
)


@router.post("/chats/{chat_id}/stream", responses=_CHAT_STREAM_RESPONSES)
async def stream_message(
    chat_id: UUID,
    body: StreamBody,
    db_pool: Any = Depends(get_asyncpg_pool),
    user: AuthUser = Depends(require_oauth2_user),
) -> StreamingResponse:
    """SSE turn. Prep uses a short-lived session that closes before StreamingResponse starts."""
    uid = UUID(user.id)
    stream_user_text = body.content.strip()
    regenerate = bool(body.regenerate)
    ensemble_skip_user_persist = False
    ensemble_forced_path: Literal["blueprint", "legacy"] | None = None
    use_tools = False
    use_web_search = False
    defaults: dict[str, Any]

    async with desktop_ai_chat_session() as db:
        access = await require_chat_access(db, chat_id, uid)
        chat = access.chat
        if regenerate and not access.is_owner:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="owner_required")
        if access.is_owner and chat.project_id:
            await get_accessible_project(db_pool, chat.project_id, uid)

        defaults = await fetch_config_defaults(db)
        if not defaults.get("feature_enabled", True):
            raise HTTPException(status_code=403, detail="Experts disabled")

        active_discussion_id = await active_discussion_blocks_stream(db, chat_id)
        if active_discussion_id is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="discussion_active",
                headers={"X-Discussion-Session-Id": str(active_discussion_id)},
            )

        if body.ensemble_document_confirm is None:
            await assert_solo_slot_allows_stream(db, chat)

        if body.ensemble_document_confirm:
            if body.regenerate:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="confirm_with_regenerate_forbidden",
                )
            if body.ref_user_message_id is None:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ref_user_message_id_required")
            if not is_ensemble_chat(chat):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="ensemble_confirm_only_for_group_chat",
                )
            if body.content.strip():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="confirm_with_content_forbidden",
                )
            stream_user_text = await apply_ensemble_document_confirm(
                db,
                chat=chat,
                ref_message_id=body.ref_user_message_id,
                decision=body.ensemble_document_confirm,
            )
            ensemble_forced_path = "blueprint" if body.ensemble_document_confirm == "accept" else "legacy"
            ensemble_skip_user_persist = True
            regenerate = False
            use_tools = False
            use_web_search = False
        elif body.regenerate:
            last_r = await db.execute(
                select(DesktopAiChatMessage.role)
                .where(DesktopAiChatMessage.chat_id == chat_id)
                .order_by(DesktopAiChatMessage.created_at.desc())
                .limit(1)
            )
            row = last_r.first()
            last_role = row[0] if row else None
            if last_role != "assistant":
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="nothing_to_regenerate",
                )
            use_tools = bool(body.use_tools) and not is_ensemble_chat(chat)
            web_search_on = bool(body.use_web_search) and bool(defaults.get("tools_web_search_enabled", False))
            use_web_search = web_search_on and (use_tools or is_ensemble_chat(chat))
        elif not body.content.strip():
            raise HTTPException(status_code=400, detail="content required")
        else:
            use_tools = bool(body.use_tools) and not is_ensemble_chat(chat)
            web_search_on = bool(body.use_web_search) and bool(defaults.get("tools_web_search_enabled", False))
            use_web_search = web_search_on and (use_tools or is_ensemble_chat(chat))

    # Prep session closed — generator must not capture request-scoped ORM.
    try:
        if not await acquire_stream_lock(chat_id, uid, db_pool=db_pool):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="turn_in_progress")
        if body.client_request_id is not None and not await try_register_idempotency(
            uid, body.client_request_id, db_pool=db_pool
        ):
            await release_stream_lock(chat_id)
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="duplicate_client_request")
    except StreamCoordinationUnavailable as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="stream_coordination_unavailable",
        ) from exc

    try:
        from api.routers.socketio_emit_desktop_ai_chat import emit_desktop_ai_chat_turn_started

        await emit_desktop_ai_chat_turn_started(chat_id=chat_id, actor_user_id=uid)
    except Exception:
        logger.debug("[STEP] desktop_ai_chat turn_started_emit_skip chat=%s", chat_id, exc_info=True)

    gen = stream_chat_turn(
        db_pool,
        chat_id=chat_id,
        user_id=uid,
        user_text=stream_user_text,
        defaults=defaults,
        use_tools_flag=use_tools,
        use_web_search=use_web_search,
        regenerate=regenerate,
        ensemble_skip_user_persist=ensemble_skip_user_persist,
        ensemble_forced_path=ensemble_forced_path,
    )
    gen = wrap_stream_with_lock_and_idem(
        gen,
        chat_id=chat_id,
        user_id=uid,
        client_request_id=body.client_request_id,
    )

    return StreamingResponse(
        gen,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


async def _release_stale_stream_lock_for_user(
    chat_id: UUID,
    db: AsyncSession,
    user: AuthUser,
) -> None:
    """Clear stream lock: owner always, or lock-holder guest."""
    uid = UUID(user.id)
    access = await require_chat_access(db, chat_id, uid)
    peek = await peek_stream_lock(chat_id)
    holder = (peek.get("holder_user_id") or "").strip()
    if access.is_owner or (holder and holder == str(uid)):
        await release_stream_lock(chat_id)
        try:
            from api.routers.socketio_emit_desktop_ai_chat import emit_desktop_ai_chat_turn_done

            await emit_desktop_ai_chat_turn_done(chat_id=chat_id, actor_user_id=uid)
        except Exception:
            logger.debug(
                "[STEP] desktop_ai_chat turn_done_emit_skip chat=%s clear_lock=1",
                chat_id,
                exc_info=True,
            )
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="owner_or_lock_holder_required")


@router.delete("/chats/{chat_id}/stream-lock", status_code=status.HTTP_204_NO_CONTENT)
async def release_stale_stream_lock(
    chat_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),
    user: AuthUser = Depends(require_oauth2_user),
) -> None:
    await _release_stale_stream_lock_for_user(chat_id, db, user)


@router.post("/chats/{chat_id}/stream-lock/release", status_code=status.HTTP_204_NO_CONTENT)
async def release_stale_stream_lock_post(
    chat_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),
    user: AuthUser = Depends(require_oauth2_user),
) -> None:
    """Same as DELETE /stream-lock (some proxies mishandle DELETE)."""
    await _release_stale_stream_lock_for_user(chat_id, db, user)


@router.get("/chats/{chat_id}/stream-lock", response_model=DesktopAiStreamLockPeekOut)
async def get_stream_lock_status(
    chat_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),
    user: AuthUser = Depends(require_oauth2_user),
) -> DesktopAiStreamLockPeekOut:
    uid = UUID(user.id)
    await require_chat_access(db, chat_id, uid)
    return DesktopAiStreamLockPeekOut.model_validate(await peek_stream_lock(chat_id))
