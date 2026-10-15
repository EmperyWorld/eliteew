# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# CRUD + extract/update for Desktop AI Chat personal Memory Cells.
# Invariants:
# - Extract/update is owner-only; chat is hard-deleted only after successful index.
# - Update may target only the cell already bound to the chat.
# - Soft quota from admin defaults (default 3); guests never own cells.
# Related:
# - documentation/product/desktop/DESKTOP-AI-CHAT-MEMORY-CELLS.md
# ---

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any, Literal
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.models.desktop_ai_chat import (
    DesktopAiChat,
    DesktopAiChatAttachment,
    DesktopAiChatMessage,
    DesktopAiMemoryCell,
)
from api.services.desktop_chat.memory_cells_rag import (
    delete_memory_cell_qdrant_points,
    index_memory_cell_documents,
)
from api.services.desktop_chat.memory_cells_settings import (
    memory_cells_feature_enabled,
    memory_cells_max_chunks,
    memory_cells_max_messages,
    memory_cells_max_per_user,
)
from api.services.desktop_chat.rag_service import (
    build_desktop_chat_rag_index_text,
    delete_desktop_chat_rag_chunks_for_chat,
)
from api.services.desktop_chat.stream_lock import peek_stream_lock

logger = logging.getLogger(__name__)


class MemoryCellError(Exception):
    def __init__(self, code: str, *, status_code: int = 400) -> None:
        super().__init__(code)
        self.code = code
        self.status_code = status_code


def cell_to_dict(cell: DesktopAiMemoryCell) -> dict[str, Any]:
    return {
        "id": str(cell.id),
        "owner_user_id": str(cell.owner_user_id),
        "title": cell.title,
        "description": cell.description,
        "status": cell.status,
        "source_chat_id": str(cell.source_chat_id) if cell.source_chat_id else None,
        "message_count_indexed": int(cell.message_count_indexed or 0),
        "chunk_count": int(cell.chunk_count or 0),
        "char_count": int(cell.char_count or 0),
        "last_built_at": cell.last_built_at.isoformat() if cell.last_built_at else None,
        "created_at": cell.created_at.isoformat() if cell.created_at else None,
        "updated_at": cell.updated_at.isoformat() if cell.updated_at else None,
    }


async def count_owner_cells(db: AsyncSession, owner_user_id: UUID) -> int:
    r = await db.execute(
        select(func.count()).select_from(DesktopAiMemoryCell).where(DesktopAiMemoryCell.owner_user_id == owner_user_id)
    )
    return int(r.scalar_one() or 0)


async def list_owner_cells(db: AsyncSession, owner_user_id: UUID) -> list[DesktopAiMemoryCell]:
    r = await db.execute(
        select(DesktopAiMemoryCell)
        .where(DesktopAiMemoryCell.owner_user_id == owner_user_id)
        .order_by(DesktopAiMemoryCell.updated_at.desc())
    )
    return list(r.scalars().all())


async def get_owner_cell(db: AsyncSession, cell_id: UUID, owner_user_id: UUID) -> DesktopAiMemoryCell | None:
    r = await db.execute(
        select(DesktopAiMemoryCell).where(
            DesktopAiMemoryCell.id == cell_id,
            DesktopAiMemoryCell.owner_user_id == owner_user_id,
        )
    )
    return r.scalar_one_or_none()


async def patch_owner_cell(
    db: AsyncSession,
    cell: DesktopAiMemoryCell,
    *,
    title: str | None = None,
    description: str | None = None,
) -> DesktopAiMemoryCell:
    if title is not None:
        t = title.strip()
        if not t:
            raise MemoryCellError("title_required", status_code=400)
        cell.title = t[:200]
    if description is not None:
        cell.description = description.strip()[:4000] or None
    cell.updated_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(cell)
    return cell


async def delete_owner_cell(db: AsyncSession, cell: DesktopAiMemoryCell) -> None:
    cell_id = cell.id
    await db.execute(delete(DesktopAiMemoryCell).where(DesktopAiMemoryCell.id == cell_id))
    await db.commit()
    await delete_memory_cell_qdrant_points(cell_id)


async def resolve_owned_cell_for_attach(
    db: AsyncSession,
    *,
    owner_user_id: UUID,
    memory_cell_id: UUID | None,
) -> UUID | None:
    if memory_cell_id is None:
        return None
    cell = await get_owner_cell(db, memory_cell_id, owner_user_id)
    if cell is None:
        raise MemoryCellError("memory_cell_not_found", status_code=404)
    if cell.status != "ready":
        raise MemoryCellError("memory_cell_not_ready", status_code=409)
    return cell.id


async def _gather_chat_documents(
    db: AsyncSession,
    db_pool: Any,
    *,
    chat_id: UUID,
    max_messages: int,
) -> tuple[list[tuple[str, str]], int, int]:
    """Return (documents, message_count, char_count)."""
    msg_r = await db.execute(
        select(DesktopAiChatMessage)
        .where(
            DesktopAiChatMessage.chat_id == chat_id,
            DesktopAiChatMessage.role.in_(("user", "assistant")),
        )
        .order_by(DesktopAiChatMessage.created_at.asc())
        .limit(max_messages)
    )
    messages = list(msg_r.scalars().all())
    documents: list[tuple[str, str]] = []
    char_count = 0
    for m in messages:
        body = (m.content or "").strip()
        if not body:
            continue
        label = "user" if m.role == "user" else "assistant"
        documents.append((label, body))
        char_count += len(body)

    att_r = await db.execute(select(DesktopAiChatAttachment).where(DesktopAiChatAttachment.chat_id == chat_id))
    attachments = list(att_r.scalars().all())
    for att in attachments:
        if not att.content_id or db_pool is None:
            continue
        try:
            row = await db_pool.fetchrow(
                """
                SELECT id, name, original_filename, title, description, tags, metadata,
                       mime_type, extracted_text
                FROM unified_content
                WHERE id = $1
                """,
                att.content_id,
            )
        except Exception as e:  # noqa: BLE001
            logger.debug("[STEP] memory_cell_attach_fetch_skip content_id=%s err=%s", att.content_id, e)
            continue
        if not row:
            continue
        text = build_desktop_chat_rag_index_text(dict(row))
        if not text.strip():
            continue
        label = (att.source_label or row.get("name") or "attachment")[:120]
        documents.append((f"attachment:{label}", text))
        char_count += len(text)

    return documents, len(messages), char_count


async def _hard_delete_chat_after_extract(db: AsyncSession, chat_id: UUID) -> None:
    await db.execute(delete(DesktopAiChat).where(DesktopAiChat.id == chat_id))
    await db.commit()
    await delete_desktop_chat_rag_chunks_for_chat(chat_id)
    from api.services.chat_memory_service import delete_chat_history_for_session

    await delete_chat_history_for_session(str(chat_id))


async def extract_memory_cell_from_chat(
    db: AsyncSession,
    db_pool: Any,
    *,
    chat: DesktopAiChat,
    owner_user_id: UUID,
    mode: Literal["create", "update"],
    title: str | None,
    defaults: dict[str, Any],
) -> DesktopAiMemoryCell:
    if not memory_cells_feature_enabled(defaults):
        raise MemoryCellError("memory_cells_disabled", status_code=403)
    if chat.user_id != owner_user_id:
        raise MemoryCellError("owner_only", status_code=403)

    lock = await peek_stream_lock(chat.id)
    if lock.get("locked"):
        raise MemoryCellError("turn_in_progress", status_code=409)

    max_messages = memory_cells_max_messages(defaults)
    max_chunks = memory_cells_max_chunks(defaults)
    documents, message_count, char_count = await _gather_chat_documents(
        db, db_pool, chat_id=chat.id, max_messages=max_messages
    )
    if not documents:
        raise MemoryCellError("empty_chat", status_code=400)

    cell: DesktopAiMemoryCell
    if mode == "create":
        if chat.memory_cell_id is not None:
            raise MemoryCellError("chat_already_bound", status_code=409)
        quota = memory_cells_max_per_user(defaults)
        if await count_owner_cells(db, owner_user_id) >= quota:
            raise MemoryCellError("cell_quota", status_code=409)
        t = (title or "").strip() or (chat.title or "").strip() or "Память"
        cell = DesktopAiMemoryCell(
            owner_user_id=owner_user_id,
            title=t[:200],
            status="building",
            source_chat_id=chat.id,
        )
        db.add(cell)
        await db.flush()
    else:
        bound = chat.memory_cell_id
        if bound is None:
            raise MemoryCellError("no_bound_cell", status_code=409)
        found = await get_owner_cell(db, bound, owner_user_id)
        if found is None:
            raise MemoryCellError("memory_cell_not_found", status_code=404)
        cell = found
        if title is not None and title.strip():
            cell.title = title.strip()[:200]
        cell.status = "building"
        cell.source_chat_id = chat.id
        cell.updated_at = datetime.now(UTC)
        await db.flush()

    await db.commit()
    await db.refresh(cell)

    try:
        chunk_count = await index_memory_cell_documents(
            cell_id=cell.id,
            owner_user_id=owner_user_id,
            documents=documents,
            max_chunks=max_chunks,
        )
        if chunk_count <= 0:
            raise MemoryCellError("empty_index", status_code=400)
    except MemoryCellError:
        cell.status = "failed"
        cell.updated_at = datetime.now(UTC)
        await db.commit()
        raise
    except Exception as e:  # noqa: BLE001
        logger.exception("memory_cell_index_failed cell_id=%s", cell.id)
        cell.status = "failed"
        cell.updated_at = datetime.now(UTC)
        await db.commit()
        code = "index_failed"
        if "embed" in str(e).lower():
            code = "embed_unavailable"
        elif "qdrant" in str(e).lower():
            code = "qdrant_unavailable"
        raise MemoryCellError(code, status_code=503) from e

    cell.status = "ready"
    cell.message_count_indexed = message_count
    cell.chunk_count = chunk_count
    cell.char_count = char_count
    cell.last_built_at = datetime.now(UTC)
    cell.updated_at = datetime.now(UTC)
    cell.source_chat_id = chat.id
    await db.commit()
    await db.refresh(cell)

    chat_id = chat.id
    await _hard_delete_chat_after_extract(db, chat_id)
    # source_chat_id SET NULL via FK; refresh cell
    await db.refresh(cell)
    logger.info(
        "[STEP] memory_cell_extract_ok mode=%s cell_id=%s chunks=%s chat_deleted=%s",
        mode,
        cell.id,
        chunk_count,
        chat_id,
    )
    return cell
