# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Qdrant index/search/delete for Desktop AI Chat personal Memory Cells.
# Invariants:
# - Collection desktop_memory_cells; filter by memory_cell_id (+ owner_user_id on search).
# - Does not write to desktop_chat_rag or KBSEW barrels.
# Related:
# - api.services.desktop_chat.rag_service
# - documentation/product/desktop/DESKTOP-AI-CHAT-MEMORY-CELLS.md
# ---

from __future__ import annotations

import logging
import uuid
from typing import Any
from uuid import UUID

from api.services.chat_memory_service import (
    EMBEDDING_DIMENSION,
    _get_embedding,
    _get_embeddings_batch,
    _get_qdrant_client,
    rag_http_embed_batch_size,
)
from api.services.marketing_project_rag_service import (
    CHUNK_OVERLAP,
    CHUNK_SIZE,
    MAX_CHUNKS_PER_DOCUMENT,
    MarketingRagChunk,
    _chunk_text,
)

logger = logging.getLogger(__name__)

DESKTOP_MEMORY_CELLS_COLLECTION = "desktop_memory_cells"
DESKTOP_MEMORY_CELLS_POINT_NAMESPACE = uuid.UUID("b2c3d4e5-f6a7-8901-bcde-f12345678901")


def memory_cell_point_id(cell_id: UUID, chunk_index: int) -> str:
    return str(uuid.uuid5(DESKTOP_MEMORY_CELLS_POINT_NAMESPACE, f"{cell_id}:{chunk_index}"))


async def _ensure_memory_cells_collection(client: Any) -> bool:
    from api.core.qdrant_defaults import QDRANT_INDEXING_THRESHOLD
    from api.core.qdrant_vector_collection import ensure_cosine_vector_collection

    return await ensure_cosine_vector_collection(
        client,
        collection_name=DESKTOP_MEMORY_CELLS_COLLECTION,
        vector_size=EMBEDDING_DIMENSION,
        indexing_threshold=QDRANT_INDEXING_THRESHOLD,
        log_step="[STEP] desktop_memory_cells",
    )


async def delete_memory_cell_qdrant_points(cell_id: UUID) -> None:
    client = await _get_qdrant_client()
    if client is None:
        return
    try:
        from qdrant_client.models import FieldCondition, Filter, MatchValue

        q_filter = Filter(must=[FieldCondition(key="memory_cell_id", match=MatchValue(value=str(cell_id)))])
        point_ids: list[Any] = []
        offset = None
        while True:
            res, offset = await client.scroll(
                collection_name=DESKTOP_MEMORY_CELLS_COLLECTION,
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
            await client.delete(collection_name=DESKTOP_MEMORY_CELLS_COLLECTION, points_selector=point_ids)
    except Exception as e:  # noqa: BLE001
        logger.warning("desktop_memory_cells: delete points failed cell_id=%s err=%s", cell_id, e)


def materialize_text_chunks(
    documents: list[tuple[str, str]],
    *,
    max_chunks: int,
) -> list[tuple[str, str]]:
    """Split labeled documents into (label, chunk_text) capped by max_chunks."""
    out: list[tuple[str, str]] = []
    for label, text in documents:
        body = (text or "").strip()
        if not body:
            continue
        pieces = _chunk_text(body, chunk_size=CHUNK_SIZE, overlap=CHUNK_OVERLAP)
        for piece in pieces[:MAX_CHUNKS_PER_DOCUMENT]:
            if not piece.strip():
                continue
            out.append((label, piece.strip()))
            if len(out) >= max_chunks:
                return out
    return out


async def index_memory_cell_documents(
    *,
    cell_id: UUID,
    owner_user_id: UUID,
    documents: list[tuple[str, str]],
    max_chunks: int,
) -> int:
    """
    Replace cell vectors with chunks from labeled documents.
    Returns chunk_count. Raises RuntimeError if Qdrant/embed unavailable after materialize.
    """
    chunks = materialize_text_chunks(documents, max_chunks=max_chunks)
    if not chunks:
        await delete_memory_cell_qdrant_points(cell_id)
        return 0

    texts = [c[1] for c in chunks]
    batch = rag_http_embed_batch_size()
    vectors: list[list[float] | None] = []
    for i in range(0, len(texts), batch):
        part = await _get_embeddings_batch(texts[i : i + batch])
        if part is None or len(part) != len(texts[i : i + batch]):
            raise RuntimeError("memory_cell_embed_unavailable")
        vectors.extend(part)

    client = await _get_qdrant_client()
    if client is None or not await _ensure_memory_cells_collection(client):
        raise RuntimeError("memory_cell_qdrant_unavailable")

    from qdrant_client.models import PointStruct

    points: list[Any] = []
    for idx, ((label, text), vec) in enumerate(zip(chunks, vectors, strict=True)):
        if not vec:
            continue
        points.append(
            PointStruct(
                id=memory_cell_point_id(cell_id, idx),
                vector=vec,
                payload={
                    "memory_cell_id": str(cell_id),
                    "owner_user_id": str(owner_user_id),
                    "chunk_index": idx,
                    "text": text,
                    "source_label": (label or "")[:200],
                },
            )
        )
    if not points:
        raise RuntimeError("memory_cell_embed_unavailable")

    # Overwrite by deterministic ids, then drop orphan higher indices from prior builds.
    await client.upsert(collection_name=DESKTOP_MEMORY_CELLS_COLLECTION, points=points)
    await _delete_orphan_chunk_indices(client, cell_id=cell_id, keep_count=len(points))
    return len(points)


async def _delete_orphan_chunk_indices(client: Any, *, cell_id: UUID, keep_count: int) -> None:
    try:
        from qdrant_client.models import FieldCondition, Filter, MatchValue, Range

        q_filter = Filter(
            must=[
                FieldCondition(key="memory_cell_id", match=MatchValue(value=str(cell_id))),
                FieldCondition(key="chunk_index", range=Range(gte=keep_count)),
            ]
        )
        point_ids: list[Any] = []
        offset = None
        while True:
            res, offset = await client.scroll(
                collection_name=DESKTOP_MEMORY_CELLS_COLLECTION,
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
            await client.delete(collection_name=DESKTOP_MEMORY_CELLS_COLLECTION, points_selector=point_ids)
    except Exception as e:  # noqa: BLE001
        logger.debug("[STEP] memory_cell_orphan_cleanup_skip cell_id=%s err=%s", cell_id, e)


async def search_memory_cell_chunks(
    *,
    query: str,
    cell_id: UUID,
    owner_user_id: UUID,
    limit: int = 8,
    min_score: float | None = 0.2,
) -> list[MarketingRagChunk]:
    if not (query or "").strip():
        return []
    embedding = await _get_embedding(query)
    if not embedding:
        return []
    client = await _get_qdrant_client()
    if client is None or not await _ensure_memory_cells_collection(client):
        return []
    try:
        from qdrant_client.models import FieldCondition, Filter, MatchValue

        q_filter = Filter(
            must=[
                FieldCondition(key="memory_cell_id", match=MatchValue(value=str(cell_id))),
                FieldCondition(key="owner_user_id", match=MatchValue(value=str(owner_user_id))),
            ]
        )
        fetch_limit = limit * 5 if min_score is not None else limit
        res = await client.query_points(
            collection_name=DESKTOP_MEMORY_CELLS_COLLECTION,
            query=embedding,
            limit=fetch_limit,
            query_filter=q_filter,
            with_payload=True,
        )
        out: list[MarketingRagChunk] = []
        for i, pt in enumerate(res.points or []):
            if len(out) >= limit:
                break
            payload = pt.payload or {}
            text = str(payload.get("text") or "")
            if not text.strip():
                continue
            score = getattr(pt, "score", None)
            if min_score is not None and score is not None and float(score) < min_score:
                continue
            out.append(
                MarketingRagChunk(
                    text=text,
                    ordinal=i + 1,
                    content_id=None,
                    chunk_index=payload.get("chunk_index"),
                    source_label=str(payload.get("source_label") or "") or None,
                    score=float(score) if score is not None else None,
                    mime_type=None,
                )
            )
        return out
    except Exception:
        logger.exception("desktop_memory_cells search failed cell_id=%s", cell_id)
        return []
