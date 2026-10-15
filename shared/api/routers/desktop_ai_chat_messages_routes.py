# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Desktop AI Chat /me and message list/delete routes.
# Invariants:
# - Mounted without extra prefix under parent ``/desktop/ai-chat``.
# - ``me_router`` registered before parameterized ``/chats/{chat_id}`` children.
# Related:
# - api/routers/desktop_ai_chat.py
# - documentation/product/desktop/DESKTOP-AI-CHAT-ROUTER-SPLIT-2026-08-06.md
# ---
"""Desktop AI Chat — /me and messages routes."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.auth import User as AuthUser
from api.core.database_manager import get_asyncpg_pool, get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.dependencies.user_context import get_current_user_db_id
from api.models.desktop_ai_chat import DesktopAiChatAttachment, DesktopAiChatMessage
from api.schemas.desktop_ai_chat import DesktopAiChatMeOut, DesktopAiMessageListOut, DesktopAiMessagesDeleteOut
from api.services.desktop_chat.collaboration_access import require_chat_owner
from api.services.desktop_chat.collaboration_members import require_chat_access
from api.services.desktop_chat.rag_service import (
    delete_desktop_chat_rag_chunks_for_chat,
    index_unified_content_desktop_chat_rag,
)
from api.utils.datetime_helpers import utc_now_naive

me_router = APIRouter(tags=["Desktop - AI Chat"])
router = APIRouter(tags=["Desktop - AI Chat"])


@me_router.get("/me", response_model=DesktopAiChatMeOut)
async def desktop_ai_chat_me(
    content_user_id: str = Depends(get_current_user_db_id),
) -> DesktopAiChatMeOut:
    """DB users.id for FE bubble attribution (same contract as GAF `/gaf-chat/me`)."""
    return DesktopAiChatMeOut(user_id=content_user_id)


@router.get("/chats/{chat_id}/messages", response_model=DesktopAiMessageListOut)
async def list_messages(
    chat_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),
    user: AuthUser = Depends(require_oauth2_user),
    limit: int | None = None,
    offset: int = 0,
    tail: int | None = None,
) -> DesktopAiMessageListOut:
    uid = UUID(user.id)
    access = await require_chat_access(db, chat_id, uid)
    owner_id = access.chat.user_id

    total_r = await db.execute(
        select(func.count()).select_from(DesktopAiChatMessage).where(DesktopAiChatMessage.chat_id == chat_id)
    )
    total = int(total_r.scalar_one() or 0)

    if tail is not None:
        cap = max(1, min(tail, 10_000))
        r = await db.execute(
            select(DesktopAiChatMessage)
            .where(DesktopAiChatMessage.chat_id == chat_id)
            .order_by(desc(DesktopAiChatMessage.created_at), desc(DesktopAiChatMessage.id))
            .limit(cap)
        )
        rows = list(r.scalars().all())
        rows.reverse()
    else:
        q = (
            select(DesktopAiChatMessage)
            .where(DesktopAiChatMessage.chat_id == chat_id)
            .order_by(DesktopAiChatMessage.created_at.asc())
        )
        if limit is not None:
            cap = max(0, min(limit, 10_000))
            q = q.offset(max(0, offset)).limit(cap)
        r = await db.execute(q)
        rows = list(r.scalars().all())

    msgs = []
    for m in rows:
        meta = getattr(m, "message_metadata", None)
        author = getattr(m, "author_user_id", None)
        if m.role == "user" and author is None:
            author = owner_id
        msgs.append(
            {
                "id": str(m.id),
                "role": m.role,
                "content": m.content,
                "tool_calls": m.tool_calls,
                "metadata": meta if isinstance(meta, dict) else None,
                "author_user_id": str(author) if author else None,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
        )
    out: dict[str, Any] = {"items": msgs, "total": total}
    if tail is not None:
        out["truncated"] = total > len(msgs)
    return DesktopAiMessageListOut.model_validate(out)


@router.delete("/chats/{chat_id}/messages/{message_id}", response_model=DesktopAiMessagesDeleteOut)
async def delete_messages_from_user_message(
    chat_id: UUID,
    message_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),
    db_pool: Any = Depends(get_asyncpg_pool),
    user: AuthUser = Depends(require_oauth2_user),
) -> DesktopAiMessagesDeleteOut:
    """Удалить сообщение пользователя и все сообщения после него по порядку (ассистент, tool, user)."""
    uid = UUID(user.id)
    access = await require_chat_access(db, chat_id, uid)
    require_chat_owner(access)
    chat = access.chat

    target = await db.get(DesktopAiChatMessage, message_id)
    if target is None or target.chat_id != chat_id:
        raise HTTPException(status_code=404, detail="Message not found")
    if target.role != "user":
        raise HTTPException(
            status_code=400,
            detail="only_user_messages_can_be_truncated",
        )

    r = await db.execute(
        select(DesktopAiChatMessage)
        .where(DesktopAiChatMessage.chat_id == chat_id)
        .order_by(DesktopAiChatMessage.created_at.asc(), DesktopAiChatMessage.id.asc())
    )
    ordered = list(r.scalars().all())
    idx = next((i for i, m in enumerate(ordered) if m.id == message_id), -1)
    if idx < 0:
        raise HTTPException(status_code=404, detail="Message not found")

    to_remove = ordered[idx:]
    ids = [m.id for m in to_remove]
    if not ids:
        return DesktopAiMessagesDeleteOut(deleted_count=0)

    await db.execute(delete(DesktopAiChatMessage).where(DesktopAiChatMessage.id.in_(ids)))
    chat.updated_at = utc_now_naive()
    await db.commit()

    await delete_desktop_chat_rag_chunks_for_chat(chat_id)
    from api.services.chat_memory_service import delete_chat_history_for_session

    await delete_chat_history_for_session(str(chat_id))
    att_r = await db.execute(select(DesktopAiChatAttachment).where(DesktopAiChatAttachment.chat_id == chat_id))
    for att in att_r.scalars().all():
        if att.content_id:
            ok = await index_unified_content_desktop_chat_rag(
                db_pool,
                chat_id=chat_id,
                content_id=att.content_id,
                owner_user_id=uid,
            )
            att.rag_indexed_at = utc_now_naive() if ok else None
    await db.commit()
    return DesktopAiMessagesDeleteOut(deleted_count=len(ids))
