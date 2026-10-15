# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Qdrant vector indexing for unified content catalogue (collection eliteew_documents).
# Invariants:
# - One owner user_id per content in payload; ACL enforced at search time in SemanticSearchService.
# - Living vector index for unified content; Chroma is retired (no read/write fallback here).
# - Vector dim must match AI_EMBEDDINGS_DIMENSION; collection ensured via ensure_cosine_vector_collection.
# Related:
# - api/services/unified_content/semantic_search_service.py
# - api/services/marketing_project_rag_service.py
# ---

from __future__ import annotations

import logging
import uuid
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]

from api.core.unified_config import unified_settings
from api.services.chat_memory_service import (
    EMBEDDING_DIMENSION,
    _get_embeddings_batch,
    _get_qdrant_client,
    rag_http_embed_batch_size,
)
from api.services.marketing_project_rag_service import (
    MAX_CHUNKS_PER_DOCUMENT,
    MIN_EXTRACTED_TEXT_CHARS,
    _chunk_text,
    _mime_eligible_for_marketing_rag,
)

logger = logging.getLogger(__name__)

UNIFIED_CONTENT_QDRANT_COLLECTION = "eliteew_documents"
UNIFIED_CONTENT_QDRANT_POINT_NAMESPACE = uuid.UUID("d4e5f6a7-b8c9-0123-def0-456789abcdef")


def _embeddings_enabled() -> bool:
    return bool(getattr(unified_settings, "ai_embeddings_enabled", True))


async def _ensure_unified_content_qdrant_collection(client: Any) -> bool:
    from api.core.qdrant_defaults import QDRANT_INDEXING_THRESHOLD
    from api.core.qdrant_vector_collection import ensure_cosine_vector_collection

    return await ensure_cosine_vector_collection(
        client,
        collection_name=UNIFIED_CONTENT_QDRANT_COLLECTION,
        vector_size=EMBEDDING_DIMENSION,
        indexing_threshold=QDRANT_INDEXING_THRESHOLD,
        log_step="[STEP] unified_content_qdrant",
    )


async def delete_qdrant_chunks_for_content(content_id: UUID) -> None:
    """Remove all Qdrant points for a unified_content row."""
    client = await _get_qdrant_client()
    if client is None:
        return
    try:
        from qdrant_client.models import FieldCondition, Filter, MatchValue

        q_filter = Filter(must=[FieldCondition(key="content_id", match=MatchValue(value=str(content_id)))])
        point_ids: list[Any] = []
        offset = None
        while True:
            res, offset = await client.scroll(
                collection_name=UNIFIED_CONTENT_QDRANT_COLLECTION,
                scroll_filter=q_filter,
                limit=100,
                offset=offset,
                with_payload=False,
                with_vectors=False,
            )
            for pt in res or []:
                point_ids.append(pt.id)
            if offset is None:
                break
        if point_ids:
            await client.delete(collection_name=UNIFIED_CONTENT_QDRANT_COLLECTION, points_selector=point_ids)
            logger.info(
                "[STEP] unified_content_qdrant.delete content_id=%s points=%s",
                content_id,
                len(point_ids),
            )
    except Exception as exc:
        logger.warning("unified_content_qdrant: delete failed content_id=%s err=%s", content_id, exc)


async def index_unified_content_qdrant(db_pool: asyncpg.Pool, content_id: UUID) -> bool:
    """Chunk, embed, and upsert unified_content into eliteew_documents."""
    if not _embeddings_enabled():
        logger.debug("[STEP] unified_content_qdrant_skip reason=embeddings_disabled content_id=%s", content_id)
        return False

    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT id, user_id, deleted_at, extracted_text, mime_type, content_type, name, tags
            FROM unified_content
            WHERE id = $1
            """,
            content_id,
        )

    if row is None or row["deleted_at"] is not None:
        await delete_qdrant_chunks_for_content(content_id)
        return False

    mime = row["mime_type"]
    if not _mime_eligible_for_marketing_rag(str(mime) if mime else None):
        logger.debug(
            "[STEP] unified_content_qdrant_skip reason=mime_ineligible content_id=%s mime=%s",
            content_id,
            mime,
        )
        return False

    raw_text = str(row["extracted_text"] or "").strip()
    if len(raw_text) < MIN_EXTRACTED_TEXT_CHARS:
        logger.debug(
            "[STEP] unified_content_qdrant_skip reason=no_text content_id=%s chars=%s",
            content_id,
            len(raw_text),
        )
        await delete_qdrant_chunks_for_content(content_id)
        return False

    chunks = _chunk_text(raw_text)[:MAX_CHUNKS_PER_DOCUMENT]
    if not chunks:
        return False

    client = await _get_qdrant_client()
    if client is None or not await _ensure_unified_content_qdrant_collection(client):
        logger.warning(
            "[STEP] unified_content_qdrant_skip reason=qdrant_unavailable content_id=%s",
            content_id,
        )
        return False

    owner_id = str(row["user_id"] or "")
    cid_str = str(content_id)
    tags_raw = row["tags"] or []
    tags = [str(t).strip() for t in tags_raw if str(t).strip()] if isinstance(tags_raw, list) else []

    await delete_qdrant_chunks_for_content(content_id)

    try:
        from qdrant_client.models import PointStruct

        embed_bs = rag_http_embed_batch_size()
        total = 0
        for start in range(0, len(chunks), embed_bs):
            batch_chunks = chunks[start : start + embed_bs]
            embeddings = await _get_embeddings_batch(batch_chunks)
            batch_points: list[Any] = []
            for i, (chunk, embedding) in enumerate(zip(batch_chunks, embeddings, strict=False)):
                if not embedding:
                    continue
                idx = start + i
                point_id = str(uuid.uuid5(UNIFIED_CONTENT_QDRANT_POINT_NAMESPACE, f"{content_id}_{idx}"))
                payload = {
                    "user_id": owner_id,
                    "content_id": cid_str,
                    "chunk_index": idx,
                    "text": chunk,
                    "mime_type": str(mime or ""),
                    "content_type": str(row["content_type"] or ""),
                    "name": str(row["name"] or "")[:500],
                    "tags": tags,
                }
                batch_points.append(PointStruct(id=point_id, vector=embedding, payload=payload))
            if batch_points:
                await client.upsert(collection_name=UNIFIED_CONTENT_QDRANT_COLLECTION, points=batch_points)
                total += len(batch_points)
        logger.info(
            "[STEP] unified_content_qdrant.index upserted_points=%s content_id=%s",
            total,
            content_id,
        )
        return True
    except Exception:
        logger.exception("unified_content_qdrant: index failed content_id=%s", content_id)
        return False


async def reindex_desktop_chat_attachments_for_content(
    db_pool: asyncpg.Pool,
    content_id: UUID,
) -> None:
    """After OCR, re-index desktop chat attachments that reference this content."""
    from api.services.desktop_chat.rag_service import index_unified_content_desktop_chat_rag

    async with db_pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT a.chat_id, c.user_id
            FROM desktop_ai_chat_attachments a
            JOIN desktop_ai_chats c ON c.id = a.chat_id
            WHERE a.content_id = $1
            """,
            content_id,
        )
    for row in rows:
        try:
            await index_unified_content_desktop_chat_rag(
                db_pool,
                chat_id=UUID(str(row["chat_id"])),
                content_id=content_id,
                owner_user_id=UUID(str(row["user_id"])),
            )
        except Exception:
            logger.exception(
                "desktop_chat_rag reindex after processing failed chat_id=%s content_id=%s",
                row["chat_id"],
                content_id,
            )


__all__ = [
    "UNIFIED_CONTENT_QDRANT_COLLECTION",
    "delete_qdrant_chunks_for_content",
    "index_unified_content_qdrant",
    "reindex_desktop_chat_attachments_for_content",
]
