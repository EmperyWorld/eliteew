# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   Вложения unified_content в Desktop AI Chat и триггер RAG-индексации при успехе.
# Invariants:
#   - updated_at / rag_indexed_at — utc_now_naive().
# Related:
#   - api/services/desktop_chat/rag_service.py
# ------------------------------------------------------------------------------
"""Привязка unified_content к чату Desktop AI (и индексация в desktop_chat_rag при возможности)."""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-untyped]
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.models.desktop_ai_chat import DesktopAiChat, DesktopAiChatAttachment
from api.services.desktop_chat.rag_service import index_unified_content_desktop_chat_rag
from api.utils.datetime_helpers import utc_now_naive

logger = logging.getLogger(__name__)


async def attach_unified_content_to_desktop_ai_chat(
    db: AsyncSession,
    db_pool: asyncpg.Pool,
    *,
    chat_id: UUID,
    user_id: UUID,
    content_id: UUID,
    source_label: str | None,
) -> tuple[bool, bool]:
    """
    Создаёт строку вложения, если ещё нет; индексирует RAG при выполнимости.

    Returns:
        (created_new_attachment, rag_index_ok)
    """
    existing = (
        await db.execute(
            select(DesktopAiChatAttachment.id)
            .where(
                DesktopAiChatAttachment.chat_id == chat_id,
                DesktopAiChatAttachment.content_id == content_id,
            )
            .limit(1)
        )
    ).scalar_one_or_none()
    created = False
    if existing is None:
        att = DesktopAiChatAttachment(
            chat_id=chat_id,
            content_id=content_id,
            source_label=(source_label or "")[:500] if source_label else None,
        )
        db.add(att)
        chat_row = await db.get(DesktopAiChat, chat_id)
        if chat_row is not None:
            chat_row.updated_at = utc_now_naive()
        created = True
    await db.commit()

    ok = await index_unified_content_desktop_chat_rag(
        db_pool,
        chat_id=chat_id,
        content_id=content_id,
        owner_user_id=user_id,
    )
    if ok:
        r2 = await db.execute(
            select(DesktopAiChatAttachment)
            .where(
                DesktopAiChatAttachment.chat_id == chat_id,
                DesktopAiChatAttachment.content_id == content_id,
            )
            .limit(1)
        )
        att2 = r2.scalar_one_or_none()
        if att2 is not None and att2.rag_indexed_at is None:
            att2.rag_indexed_at = utc_now_naive()
            await db.commit()

    if not ok:
        logger.info(
            "[STEP] desktop_ai_chat attach content_id=%s chat_id=%s rag_index skipped or not eligible",
            content_id,
            chat_id,
        )
    return created, ok


def parse_uuid_loose(raw: Any) -> UUID | None:
    if isinstance(raw, UUID):
        return raw
    if isinstance(raw, str) and raw.strip():
        try:
            return UUID(raw.strip())
        except ValueError:
            return None
    return None
