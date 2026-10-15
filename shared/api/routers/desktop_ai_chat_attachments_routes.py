# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Desktop AI Chat attachment CRUD and verify-context routes.
# Invariants:
# - Mounted without extra prefix under parent ``/desktop/ai-chat``.
# Related:
# - api/routers/desktop_ai_chat.py
# - documentation/product/desktop/DESKTOP-AI-CHAT-ROUTER-SPLIT-2026-08-06.md
# ---
"""Desktop AI Chat — attachments and verify-context routes."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.auth import User as AuthUser
from api.core.database_manager import get_asyncpg_pool, get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.models.desktop_ai_chat import DesktopAiChatAttachment
from api.schemas.desktop_ai_chat import (
    AttachBody,
    DesktopAiAttachmentListOut,
    DesktopAiAttachmentUpsertOut,
    DesktopAiVerifyContextOut,
)
from api.services.desktop_chat.collaboration_members import require_chat_access
from api.services.desktop_chat.rag_service import (
    delete_desktop_chat_rag_chunks_for_content,
    index_unified_content_desktop_chat_rag,
)
from api.services.desktop_chat.service import verify_project_for_chat
from api.utils.datetime_helpers import utc_now_naive

router = APIRouter(tags=["Desktop - AI Chat"])


@router.get("/chats/{chat_id}/attachments", response_model=DesktopAiAttachmentListOut)
async def list_attachments(
    chat_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),
    user: AuthUser = Depends(require_oauth2_user),
) -> DesktopAiAttachmentListOut:
    uid = UUID(user.id)
    await require_chat_access(db, chat_id, uid)
    r = await db.execute(select(DesktopAiChatAttachment).where(DesktopAiChatAttachment.chat_id == chat_id))
    items = []
    for a in r.scalars().all():
        items.append(
            {
                "id": str(a.id),
                "content_id": str(a.content_id) if a.content_id else None,
                "source_label": a.source_label,
                "uploaded_by": str(a.uploaded_by) if a.uploaded_by else None,
                "rag_indexed_at": a.rag_indexed_at.isoformat() if a.rag_indexed_at else None,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
        )
    return DesktopAiAttachmentListOut.model_validate({"items": items})


@router.post(
    "/chats/{chat_id}/attachments",
    status_code=status.HTTP_201_CREATED,
    response_model=DesktopAiAttachmentUpsertOut,
)
async def add_attachment(
    chat_id: UUID,
    body: AttachBody,
    db: AsyncSession = Depends(get_postgres_session),
    db_pool: Any = Depends(get_asyncpg_pool),
    user: AuthUser = Depends(require_oauth2_user),
) -> DesktopAiAttachmentUpsertOut:
    uid = UUID(user.id)
    access = await require_chat_access(db, chat_id, uid)
    chat = access.chat

    dup_r = await db.execute(
        select(DesktopAiChatAttachment).where(
            DesktopAiChatAttachment.chat_id == chat_id,
            DesktopAiChatAttachment.content_id == body.content_id,
        )
    )
    existing = dup_r.scalars().first()
    if existing is not None:
        ok = bool(existing.rag_indexed_at)
        if not ok:
            ok = await index_unified_content_desktop_chat_rag(
                db_pool,
                chat_id=chat_id,
                content_id=body.content_id,
                owner_user_id=uid,
            )
            if ok:
                existing.rag_indexed_at = utc_now_naive()
                await db.commit()
                await db.refresh(existing)
        return DesktopAiAttachmentUpsertOut.model_validate(
            {
                "id": str(existing.id),
                "content_id": str(existing.content_id) if existing.content_id else None,
                "source_label": existing.source_label,
                "rag_indexed_at": existing.rag_indexed_at.isoformat() if existing.rag_indexed_at else None,
                "rag_index_ok": ok,
            }
        )

    att = DesktopAiChatAttachment(
        chat_id=chat_id,
        content_id=body.content_id,
        source_label=body.source_label,
        uploaded_by=uid,
    )
    db.add(att)
    chat.updated_at = utc_now_naive()
    await db.commit()
    await db.refresh(att)

    ok = await index_unified_content_desktop_chat_rag(
        db_pool,
        chat_id=chat_id,
        content_id=body.content_id,
        owner_user_id=uid,
    )
    if ok:
        att.rag_indexed_at = utc_now_naive()
        await db.commit()
        await db.refresh(att)

    return DesktopAiAttachmentUpsertOut.model_validate(
        {
            "id": str(att.id),
            "content_id": str(att.content_id) if att.content_id else None,
            "source_label": att.source_label,
            "rag_indexed_at": att.rag_indexed_at.isoformat() if att.rag_indexed_at else None,
            "rag_index_ok": ok,
        }
    )


@router.delete("/chats/{chat_id}/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_attachment(
    chat_id: UUID,
    attachment_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),
    user: AuthUser = Depends(require_oauth2_user),
) -> None:
    """Удалить вложение чата и соответствующие точки в Qdrant (desktop_chat_rag) для пары chat+content."""
    uid = UUID(user.id)
    access = await require_chat_access(db, chat_id, uid)
    chat = access.chat
    att = await db.get(DesktopAiChatAttachment, attachment_id)
    if att is None or att.chat_id != chat_id:
        raise HTTPException(status_code=404, detail="Attachment not found")
    if not access.is_owner and att.uploaded_by != uid:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="owner_or_uploader_required")
    content_id = att.content_id
    await db.delete(att)
    chat.updated_at = utc_now_naive()
    await db.commit()
    if content_id is not None:
        await delete_desktop_chat_rag_chunks_for_content(chat_id, content_id)


@router.post("/chats/{chat_id}/verify-context", response_model=DesktopAiVerifyContextOut)
async def verify_context(
    chat_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),
    db_pool: Any = Depends(get_asyncpg_pool),
    user: AuthUser = Depends(require_oauth2_user),
) -> DesktopAiVerifyContextOut:
    """Optional: confirm project binding and RAG flags before streaming."""
    uid = UUID(user.id)
    access = await require_chat_access(db, chat_id, uid)
    chat = access.chat
    try:
        await verify_project_for_chat(
            db_pool,
            project_id=chat.project_id,
            user_id=chat.user_id,
            use_project_rag=bool(chat.use_project_rag),
        )
    except HTTPException as e:
        return DesktopAiVerifyContextOut(ok=False, detail=e.detail)
    return DesktopAiVerifyContextOut(ok=True)
