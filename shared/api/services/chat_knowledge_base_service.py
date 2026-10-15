# SPDX-License-Identifier: MIT
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# RAG по документам сессии чата: facade над desktop_chat_rag (индексация, поиск, удаление по session_id).
# Invariants:
# - session_id трактуется как chat_id; индексация идёт через unified_content.extracted_text.
# Related:
# - api.services.desktop_chat.rag_service
# ---
"""Chat session RAG facade: index, search, and delete by session_id (chat_id)."""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

# Сколько чанков возвращать из поиска по базе знаний сессии. 128 чанков при окне 128k токенов.
CHAT_KB_SEARCH_LIMIT = 128


async def run_indexing(session_id: str, document_id: str, user_id: str) -> None:
    """
    Facade: index into desktop_chat_rag using unified_content.extracted_text (session_id = chat_id).
    """
    from uuid import UUID

    from api.core.database_manager import get_asyncpg_pool
    from api.services.desktop_chat.rag_service import index_unified_content_desktop_chat_rag

    try:
        chat_id = UUID(str(session_id))
        content_id = UUID(str(document_id))
        owner_user_id = UUID(str(user_id))
    except ValueError:
        logger.warning(
            "Chat KB facade: invalid ids session=%s document=%s user=%s",
            session_id,
            document_id,
            user_id,
        )
        return
    db_pool = await get_asyncpg_pool()
    ok = await index_unified_content_desktop_chat_rag(
        db_pool,
        chat_id=chat_id,
        content_id=content_id,
        owner_user_id=owner_user_id,
    )
    logger.info(
        "[STEP] chat_kb_facade.index session=%s document=%s ok=%s",
        session_id,
        document_id,
        ok,
    )


async def delete_document_from_kb(session_id: str, document_id: str) -> None:
    """Facade: remove desktop_chat_rag points for chat + content."""
    from uuid import UUID

    from api.services.desktop_chat.rag_service import delete_desktop_chat_rag_chunks_for_content

    try:
        chat_id = UUID(str(session_id))
        content_id = UUID(str(document_id))
    except ValueError:
        return
    await delete_desktop_chat_rag_chunks_for_content(chat_id, content_id)


async def search_knowledge_base(query: str, session_id: str, limit: int = CHAT_KB_SEARCH_LIMIT) -> list[dict[str, Any]]:
    """Facade: search desktop_chat_rag (session_id = chat_id)."""
    from uuid import UUID

    from api.services.desktop_chat.rag_service import search_desktop_chat_rag_chunks

    if not (query or "").strip():
        return []
    try:
        chat_id = UUID(str(session_id))
    except ValueError:
        return []
    chunks = await search_desktop_chat_rag_chunks(query=query, chat_id=chat_id, limit=limit)
    out: list[dict[str, Any]] = []
    for chunk in chunks:
        text = str(chunk.text or "").strip()
        if not text:
            continue
        out.append(
            {
                "text": text,
                "document_id": str(chunk.content_id or ""),
                "document_name": str(chunk.source_label or ""),
            }
        )
    return out
