# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# RAG по вложениям одного desktop-чата в Qdrant (desktop_chat_rag).
# Invariants:
# - Размерность эмбеддингов = AI_EMBEDDINGS_DIMENSION; при смене dim коллекция пересоздаётся (реиндексация вложений).
# Related:
# - api.core.qdrant_vector_collection
# - api.services.marketing_project_rag_service
# ---
"""
Per-chat RAG in Qdrant collection ``desktop_chat_rag``.

Payload: ``desktop_chat_id``, ``content_id``, ``chunk_index``, ``text``, mime/name.
Does not write to ``marketing_project_rag``.
"""

from __future__ import annotations

import logging
import uuid
from collections.abc import Mapping
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-untyped]

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
    MIN_EXTRACTED_TEXT_CHARS,
    MarketingRagChunk,
    _chunk_text,
    _mime_eligible_for_marketing_rag,
)

logger = logging.getLogger(__name__)


def _mime_eligible_for_desktop_chat_rag(mime: str | None) -> bool:
    """Текстовые типы как в маркетинговом RAG + изображения (если есть extracted_text длиной ≥ порога)."""
    if _mime_eligible_for_marketing_rag(mime):
        return True
    m = (mime or "").lower().strip()
    return m.startswith("image/")


DESKTOP_CHAT_RAG_COLLECTION = "desktop_chat_rag"
DESKTOP_CHAT_RAG_POINT_NAMESPACE = uuid.UUID("a1b2c3d4-e5f6-7890-abcd-ef1234567890")

# Строковые поля metadata (UGS / студии), из которых можно собрать текст для эмбеддинга.
_IMAGE_RAG_METADATA_STRING_KEYS = (
    "prompt",
    "caption",
    "image_prompt",
    "negative_prompt",
    "user_prompt",
    "summary",
)


def build_desktop_chat_rag_index_text(row: Mapping[str, Any]) -> str:
    """
    Текст для чанкинга и индекса в Qdrant. Пустая строка — индексировать нечего.

    Для изображений без extracted_text (типично PNG из UGS) собираем подпись из имени файла,
    title/description, тегов и известных ключей metadata — иначе RAG по чату всегда пустой.
    """
    raw = str(row.get("extracted_text") or "").strip()
    if len(raw) >= MIN_EXTRACTED_TEXT_CHARS:
        return raw

    mime = str(row.get("mime_type") or "").lower().strip()
    if not mime.startswith("image/"):
        return raw

    parts: list[str] = []
    for key in ("name", "original_filename", "title", "description"):
        val = row.get(key)
        if val is None:
            continue
        s = str(val).strip()
        if s:
            parts.append(s)

    tags = row.get("tags")
    if isinstance(tags, (list, tuple)):
        for t in tags:
            if t is None:
                continue
            s = str(t).strip()
            if s:
                parts.append(s)

    meta = row.get("metadata")
    if isinstance(meta, dict):
        for k in _IMAGE_RAG_METADATA_STRING_KEYS:
            v = meta.get(k)
            if isinstance(v, str) and v.strip():
                parts.append(v.strip())

    synthesized = " ".join(parts).strip()
    if not synthesized:
        return ""

    base = f"Изображение во вложении чата. {synthesized}"
    if len(base) < MIN_EXTRACTED_TEXT_CHARS:
        cid = row.get("id")
        if cid is not None:
            base = f"{base} Идентификатор вложения: {cid}."
    return base.strip()


async def _ensure_desktop_chat_rag_collection(client: Any) -> bool:
    from api.core.qdrant_defaults import QDRANT_INDEXING_THRESHOLD
    from api.core.qdrant_vector_collection import ensure_cosine_vector_collection

    return await ensure_cosine_vector_collection(
        client,
        collection_name=DESKTOP_CHAT_RAG_COLLECTION,
        vector_size=EMBEDDING_DIMENSION,
        indexing_threshold=QDRANT_INDEXING_THRESHOLD,
        log_step="[STEP] desktop_chat_rag",
    )


async def delete_desktop_chat_rag_chunks_for_chat(chat_id: UUID) -> None:
    """Remove all indexed chunks for a chat (e.g. on delete chat or history truncate)."""
    client = await _get_qdrant_client()
    if client is None:
        return
    try:
        from qdrant_client.models import FieldCondition, Filter, MatchValue

        q_filter = Filter(must=[FieldCondition(key="desktop_chat_id", match=MatchValue(value=str(chat_id)))])
        point_ids: list[Any] = []
        offset = None
        while True:
            res, offset = await client.scroll(
                collection_name=DESKTOP_CHAT_RAG_COLLECTION,
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
            await client.delete(collection_name=DESKTOP_CHAT_RAG_COLLECTION, points_selector=point_ids)
    except Exception as e:
        logger.warning("desktop_chat_rag: delete chunks for chat failed: %s", e)


async def delete_desktop_chat_rag_chunks_for_content(chat_id: UUID, content_id: UUID) -> None:
    client = await _get_qdrant_client()
    if client is None:
        return
    try:
        from qdrant_client.models import FieldCondition, Filter, MatchValue

        q_filter = Filter(
            must=[
                FieldCondition(key="desktop_chat_id", match=MatchValue(value=str(chat_id))),
                FieldCondition(key="content_id", match=MatchValue(value=str(content_id))),
            ]
        )
        point_ids: list[Any] = []
        offset = None
        while True:
            res, offset = await client.scroll(
                collection_name=DESKTOP_CHAT_RAG_COLLECTION,
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
            await client.delete(collection_name=DESKTOP_CHAT_RAG_COLLECTION, points_selector=point_ids)
    except Exception as e:
        logger.warning("desktop_chat_rag: delete chunks failed: %s", e)


async def index_unified_content_desktop_chat_rag(
    db_pool: asyncpg.Pool,
    *,
    chat_id: UUID,
    content_id: UUID,
    owner_user_id: UUID,
    source_message_id: UUID | None = None,
) -> bool:
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT uc.id, uc.user_id, uc.deleted_at, uc.extracted_text, uc.mime_type, uc.content_type, uc.name,
                   uc.title, uc.description, uc.original_filename, uc.tags, uc.metadata
            FROM unified_content uc
            WHERE uc.id = $1
            """,
            content_id,
        )
    if row is None or row["deleted_at"] is not None:
        logger.debug("[STEP] desktop_chat_rag_skip reason=missing_or_deleted content_id=%s", content_id)
        return False
    uid = row["user_id"]
    if uid is None or UUID(str(uid)) != owner_user_id:
        logger.warning("desktop_chat_rag: skip index wrong owner content_id=%s", content_id)
        return False
    mime = row["mime_type"]
    if not _mime_eligible_for_desktop_chat_rag(str(mime) if mime else None):
        logger.debug(
            "[STEP] desktop_chat_rag_skip reason=mime_ineligible content_id=%s mime=%s",
            content_id,
            mime,
        )
        return False

    raw_text = build_desktop_chat_rag_index_text(row)
    if len(raw_text) < MIN_EXTRACTED_TEXT_CHARS:
        logger.debug(
            "[STEP] desktop_chat_rag_skip reason=text_too_short content_id=%s chars=%s",
            content_id,
            len(raw_text),
        )
        return False
    if not str(row.get("extracted_text") or "").strip() and str(mime or "").lower().strip().startswith("image/"):
        logger.info(
            "[STEP] desktop_chat_rag image_synthetic_text content_id=%s chars=%s",
            content_id,
            len(raw_text),
        )

    chunks = _chunk_text(raw_text, chunk_size=CHUNK_SIZE, overlap=CHUNK_OVERLAP)[:MAX_CHUNKS_PER_DOCUMENT]
    if not chunks:
        logger.debug("[STEP] desktop_chat_rag_skip reason=no_chunks content_id=%s", content_id)
        return False

    client = await _get_qdrant_client()
    if client is None or not await _ensure_desktop_chat_rag_collection(client):
        logger.warning("[STEP] desktop_chat_rag index skipped: Qdrant unavailable content_id=%s", content_id)
        return False

    cid_str = str(content_id)
    chat_s = str(chat_id)
    await delete_desktop_chat_rag_chunks_for_content(chat_id, content_id)

    try:
        from qdrant_client.models import PointStruct

        embed_bs = rag_http_embed_batch_size()
        for start in range(0, len(chunks), embed_bs):
            batch_chunks = chunks[start : start + embed_bs]
            embeddings = await _get_embeddings_batch(batch_chunks)
            batch_points: list[Any] = []
            for i, (chunk, embedding) in enumerate(zip(batch_chunks, embeddings, strict=False)):
                if not embedding:
                    continue
                idx = start + i
                point_id = str(uuid.uuid5(DESKTOP_CHAT_RAG_POINT_NAMESPACE, f"{chat_s}_{cid_str}_{idx}"))
                payload = {
                    "desktop_chat_id": chat_s,
                    "content_id": cid_str,
                    "chunk_index": idx,
                    "text": chunk,
                    "mime_type": str(mime or ""),
                    "name": str(row["name"] or "")[:500],
                }
                if source_message_id is not None:
                    payload["source_message_id"] = str(source_message_id)
                batch_points.append(PointStruct(id=point_id, vector=embedding, payload=payload))
            if batch_points:
                await client.upsert(collection_name=DESKTOP_CHAT_RAG_COLLECTION, points=batch_points)
        return True
    except Exception:
        logger.exception("[STEP] desktop_chat_rag index failed content_id=%s", content_id)
        return False


async def search_desktop_chat_rag_chunks(
    *,
    query: str,
    chat_id: UUID,
    limit: int = 12,
    min_score: float | None = 0.2,
) -> list[MarketingRagChunk]:
    if not (query or "").strip():
        return []
    embedding = await _get_embedding(query)
    if not embedding:
        return []
    client = await _get_qdrant_client()
    if client is None or not await _ensure_desktop_chat_rag_collection(client):
        return []
    try:
        from qdrant_client.models import FieldCondition, Filter, MatchValue

        q_filter = Filter(must=[FieldCondition(key="desktop_chat_id", match=MatchValue(value=str(chat_id)))])
        fetch_limit = limit * 5 if min_score is not None else limit
        res = await client.query_points(
            collection_name=DESKTOP_CHAT_RAG_COLLECTION,
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
                    content_id=str(payload.get("content_id") or "") or None,
                    chunk_index=payload.get("chunk_index"),
                    source_label=str(payload.get("name") or "") or None,
                    score=float(score) if score is not None else None,
                    mime_type=str(payload.get("mime_type") or "").strip() or None,
                )
            )
        return out
    except Exception:
        logger.exception("desktop_chat_rag search failed chat_id=%s", chat_id)
        return []


def dedupe_desktop_chat_rag_chunks(
    chunks: list[MarketingRagChunk],
    *,
    limit: int,
    max_per_content_id: int = 2,
) -> list[MarketingRagChunk]:
    """Не даём одному и тому же unified_content забить весь top_k однотипными чанками."""
    if not chunks:
        return []
    scored = sorted(
        chunks,
        key=lambda c: float(c.score) if c.score is not None else 0.0,
        reverse=True,
    )
    per: dict[str, int] = {}
    out: list[MarketingRagChunk] = []
    next_ord = 1
    for ch in scored:
        cid = (ch.content_id or "").strip() or "__none__"
        if per.get(cid, 0) >= max_per_content_id:
            continue
        per[cid] = per.get(cid, 0) + 1
        out.append(
            MarketingRagChunk(
                text=ch.text,
                ordinal=next_ord,
                content_id=ch.content_id,
                chunk_index=ch.chunk_index,
                source_label=ch.source_label,
                score=ch.score,
                mime_type=ch.mime_type,
            )
        )
        next_ord += 1
        if len(out) >= limit:
            break
    return out


def format_desktop_chat_rag_chunks_for_prompt(
    chunks: list[MarketingRagChunk],
    *,
    max_chars: int = 12000,
) -> str:
    """
    Блок RAG **только для desktop-чата**: без ремарки про «документы проекта» из маркетинга.
    Явно снимает типичный отказ модели «не могу показать картинку», когда вложения уже в чате.
    """
    if not chunks:
        return ""
    intro = (
        "Ниже — семантически похожие фрагменты из **вложений и текста этого же чата** "
        "(в т.ч. подписи/извлечённый текст по сгенерированным через UGS изображениям, если они проиндексированы).\n\n"
        "Если пользователь просит показать или нарисовать картинку, а фрагменты ниже уже относятся к изображениям "
        "из **этого** чата (см. type=image или содержание) — отвечай, что изображение уже есть в истории чата "
        "(превью/скачивание в интерфейсе), кратко опиши сцену. **Не** пиши, что технически не можешь показать изображение.\n\n"
        "В ответе можно сослаться на номер **fragment**.\n\n"
    )
    budget = max(500, max_chars - len(intro))
    parts: list[str] = []
    used = 0
    for ch in chunks:
        meta_parts: list[str] = [f"fragment={ch.ordinal}"]
        if ch.content_id:
            meta_parts.append(f"content_id={ch.content_id}")
        if ch.chunk_index is not None:
            meta_parts.append(f"chunk_index={ch.chunk_index}")
        if ch.source_label:
            meta_parts.append(f"label={ch.source_label[:120]}")
        mt = (ch.mime_type or "").lower().strip()
        if mt.startswith("image/"):
            meta_parts.append("type=image")
        head = "[" + " ".join(meta_parts) + "]"
        block = f"{head}\n{ch.text}"
        if used + len(block) > budget:
            break
        parts.append(block)
        used += len(block) + 2
    if not parts:
        return intro.rstrip()
    return intro + "\n\n".join(parts)
