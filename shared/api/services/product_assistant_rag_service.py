# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Индексация и поиск RAG для справочника продукта (коллекция product_assistant_kb).
# Invariants:
# - Vector dimension согласован с AI_EMBEDDINGS_DIMENSION; при смене embedder коллекция может быть пересоздана (реиндексация документов).
# - search_product_assistant_kb_hybrid: vector + keyword supplement из Postgres; при RAG_RERANK_BASE_URL — cross-encoder rerank.
# Related:
# - api.core.qdrant_vector_collection
# - api.services.marketing_project_rag_service (чанкинг и константы)
# ---
"""
Справочник (продукт): глобальная KB администратора в Qdrant ``product_assistant_kb``.

Не смешивать с другими контурами RAG в монорепозитории:

- ``desktop_chat_rag`` — только вложения **конкретного** чата (фильтр ``desktop_chat_id``).
- ``marketing_project_rag`` / vault — только документы **маркетингового проекта** (фильтр ``marketing_project_id`` + ACL).
- **Здесь** — только документы из ``assistant_kb_documents``, индексируемые в ``product_assistant_kb`` (без user/chat/project в фильтре: одна общая база для ответов справочника).

Payload точек: ``document_id``, ``chunk_index``, ``text``, ``title``.
Полный текст документа в Postgres; в Qdrant — чанки и эмбеддинги.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any
from uuid import UUID

from api.core.unified_config import unified_settings
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
from api.services.rerank_client import DEFAULT_RERANK_MAX_DOCS, apply_rerank_to_chunks

logger = logging.getLogger(__name__)

# Расширенный пул кандидатов перед cross-encoder (как desktop AI chat / marketing RAG).
_PRODUCT_ASSISTANT_RERANK_POOL_CAP = 36


def _product_assistant_rag_rerank_enabled() -> bool:
    """Тот же контур, что desktop/marketing RAG: POST /v1/rerank при непустом RAG_RERANK_BASE_URL."""
    return bool((getattr(unified_settings, "rag_rerank_base_url", None) or "").strip())


PRODUCT_ASSISTANT_RAG_COLLECTION = "product_assistant_kb"
PRODUCT_ASSISTANT_POINT_NAMESPACE = uuid.UUID("7f8e9d0c-1a2b-4c5d-8e9f-0a1b2c3d4e5f")
# Бюджет символов для блока RAG в промпте (см. desktop_chat build_rag_prefix rag_max_chunks_chars).
DEFAULT_ASSISTANT_RAG_PROMPT_MAX_CHARS = 24_000


def _query_preview(q: str, max_len: int = 200) -> str:
    s = (q or "").replace("\n", " ").strip()
    if len(s) <= max_len:
        return s
    return s[: max_len - 1] + "…"


async def _ensure_product_assistant_collection(client: Any) -> bool:
    from api.core.qdrant_defaults import QDRANT_INDEXING_THRESHOLD
    from api.core.qdrant_vector_collection import ensure_cosine_vector_collection

    return await ensure_cosine_vector_collection(
        client,
        collection_name=PRODUCT_ASSISTANT_RAG_COLLECTION,
        vector_size=EMBEDDING_DIMENSION,
        indexing_threshold=QDRANT_INDEXING_THRESHOLD,
        log_step="[STEP] product_assistant_kb",
    )


async def delete_product_assistant_chunks_for_document(document_id: UUID) -> None:
    client = await _get_qdrant_client()
    if client is None:
        return
    try:
        from qdrant_client.models import FieldCondition, Filter, MatchValue

        q_filter = Filter(must=[FieldCondition(key="document_id", match=MatchValue(value=str(document_id)))])
        point_ids: list[Any] = []
        offset = None
        while True:
            res, offset = await client.scroll(
                collection_name=PRODUCT_ASSISTANT_RAG_COLLECTION,
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
            await client.delete(
                collection_name=PRODUCT_ASSISTANT_RAG_COLLECTION,
                points_selector=point_ids,
            )
    except Exception as e:
        logger.warning("product_assistant_kb: delete chunks failed doc=%s: %s", document_id, e)


async def delete_product_assistant_collection_if_exists() -> None:
    """Drop the handbook RAG collection (all vectors). Safe if Qdrant is down."""
    client = await _get_qdrant_client()
    if client is None:
        logger.warning("[STEP] product_assistant_kb: purge skip Qdrant client unavailable")
        return
    try:
        exists = await client.collection_exists(PRODUCT_ASSISTANT_RAG_COLLECTION)
        if exists:
            await client.delete_collection(collection_name=PRODUCT_ASSISTANT_RAG_COLLECTION)
            logger.info("[STEP] product_assistant_kb: collection deleted name=%s", PRODUCT_ASSISTANT_RAG_COLLECTION)
    except Exception as e:
        logger.warning("product_assistant_kb: delete_collection failed: %s", e)


async def index_product_assistant_document(*, document_id: UUID, title: str, body: str) -> tuple[bool, int, str | None]:
    """Chunk, embed, upsert. Returns (ok, chunk_count, error_message)."""
    raw = (body or "").strip()
    if len(raw) < 20:
        return False, 0, "Текст слишком короткий для индексации (минимум ~20 символов)."

    chunks = _chunk_text(raw, chunk_size=CHUNK_SIZE, overlap=CHUNK_OVERLAP)[:MAX_CHUNKS_PER_DOCUMENT]
    if not chunks:
        return False, 0, "Нет фрагментов после разбиения."

    client = await _get_qdrant_client()
    if client is None or not await _ensure_product_assistant_collection(client):
        return False, 0, "Qdrant недоступен — индексация пропущена."

    doc_s = str(document_id)
    await delete_product_assistant_chunks_for_document(document_id)

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
                point_id = str(uuid.uuid5(PRODUCT_ASSISTANT_POINT_NAMESPACE, f"{doc_s}_{idx}"))
                payload = {
                    "document_id": doc_s,
                    "chunk_index": idx,
                    "text": chunk,
                    "title": (title or "")[:500],
                }
                batch_points.append(PointStruct(id=point_id, vector=embedding, payload=payload))
            if batch_points:
                await client.upsert(
                    collection_name=PRODUCT_ASSISTANT_RAG_COLLECTION,
                    points=batch_points,
                )
                total += len(batch_points)
        return True, total, None
    except Exception as e:
        logger.exception("product_assistant_kb index failed doc=%s", document_id)
        return False, 0, str(e)


def dedupe_product_assistant_kb_chunks(
    chunks: list[MarketingRagChunk],
    *,
    limit: int,
    max_per_document_id: int = 2,
) -> list[MarketingRagChunk]:
    """Один длинный документ не заполняет весь top_k однотипными чанками (аналог desktop_chat RAG)."""
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
        did = (ch.content_id or "").strip() or "__none__"
        if per.get(did, 0) >= max_per_document_id:
            continue
        per[did] = per.get(did, 0) + 1
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


def merge_assistant_rag_hybrid(
    vector_chunks: list[MarketingRagChunk],
    keyword_chunks: list[MarketingRagChunk],
    *,
    limit: int,
) -> list[MarketingRagChunk]:
    """Vector-first merge; keyword chunks fill gaps without duplicate document_id."""
    from api.services.product_assistant_prompt_helpers import merge_rag_content_id_order

    by_id: dict[str, MarketingRagChunk] = {}
    for ch in vector_chunks + keyword_chunks:
        did = (ch.content_id or "").strip()
        if did and did not in by_id:
            by_id[did] = ch
    order = merge_rag_content_id_order(
        [(c.content_id or "").strip() for c in vector_chunks if (c.content_id or "").strip()],
        [(c.content_id or "").strip() for c in keyword_chunks if (c.content_id or "").strip()],
        limit=limit,
    )
    out: list[MarketingRagChunk] = []
    for i, doc_id in enumerate(order):
        ch = by_id.get(doc_id)
        if ch is None:
            continue
        out.append(
            MarketingRagChunk(
                text=ch.text,
                ordinal=i + 1,
                content_id=ch.content_id,
                chunk_index=ch.chunk_index,
                source_label=ch.source_label,
                score=ch.score,
                mime_type=ch.mime_type,
            )
        )
    return out


async def search_product_assistant_kb_keyword(
    db: Any,
    *,
    query: str,
    limit: int = 4,
    scan_limit: int = 300,
) -> list[MarketingRagChunk]:
    """Keyword supplement from Postgres title/body when vector search is thin."""
    from sqlalchemy import text

    from api.services.product_assistant_prompt_helpers import (
        extract_keyword_snippet,
        score_faq_entry_relevance,
    )

    q = (query or "").strip()
    if not q or limit <= 0:
        return []
    result = await db.execute(
        text(
            """
            SELECT id, title, body
            FROM assistant_kb_documents
            WHERE status = 'indexed' AND length(trim(body)) >= 20
            ORDER BY updated_at DESC
            LIMIT :lim
            """
        ),
        {"lim": scan_limit},
    )
    rows = result.mappings().all()
    scored: list[tuple[int, Any]] = []
    for row in rows:
        title = str(row["title"] or "")
        body = str(row["body"] or "")
        score = score_faq_entry_relevance(q, title, body)
        if score > 0:
            scored.append((score, row))
    if not scored:
        return []
    scored.sort(key=lambda item: (-item[0], str(item[1]["id"])))
    chunks: list[MarketingRagChunk] = []
    for i, (score, row) in enumerate(scored[:limit]):
        doc_id = str(row["id"])
        title = str(row["title"] or "")
        body = str(row["body"] or "")
        snippet = extract_keyword_snippet(body, q)
        if not snippet:
            continue
        chunks.append(
            MarketingRagChunk(
                text=snippet,
                ordinal=i + 1,
                content_id=doc_id,
                chunk_index=0,
                source_label=title[:500],
                score=0.5 + min(score, 10) * 0.05,
                mime_type="text/markdown",
            )
        )
    return chunks


async def search_product_assistant_kb_hybrid(
    db: Any,
    *,
    query: str,
    limit: int = 8,
    min_score: float | None = 0.18,
    fallback_min_score: float = 0.08,
    use_rerank: bool | None = None,
) -> list[MarketingRagChunk]:
    """Vector search with fallback score; keyword supplement; dedupe; optional cross-encoder rerank."""
    rerank_on = _product_assistant_rag_rerank_enabled() if use_rerank is None else bool(use_rerank)
    pool_limit = min(_PRODUCT_ASSISTANT_RERANK_POOL_CAP, max(limit * 3, limit)) if rerank_on else limit
    vector = await search_product_assistant_kb_with_fallback(
        query=query,
        limit=pool_limit,
        min_score=min_score,
        fallback_min_score=fallback_min_score,
    )
    keyword_limit = max(2, pool_limit // 2)
    keyword = await search_product_assistant_kb_keyword(db, query=query, limit=keyword_limit)
    merged = merge_assistant_rag_hybrid(vector, keyword, limit=pool_limit)
    deduped = dedupe_product_assistant_kb_chunks(merged, limit=pool_limit, max_per_document_id=2)
    if rerank_on and len(deduped) > 1:
        deduped = await apply_rerank_to_chunks(
            query,
            deduped,
            take=limit,
            max_docs=min(DEFAULT_RERANK_MAX_DOCS, pool_limit),
        )
        logger.info(
            "[STEP] product_assistant.rag rerank pool=%s take=%s preview=%s",
            pool_limit,
            limit,
            _query_preview(query),
        )
        return deduped
    return deduped[:limit]


async def search_product_assistant_kb(
    *,
    query: str,
    limit: int = 8,
    min_score: float | None = 0.18,
) -> list[MarketingRagChunk]:
    if not (query or "").strip():
        return []
    embedding = await _get_embedding(query)
    if not embedding:
        logger.info(
            "[STEP] product_assistant.rag skip_no_embedding collection=%s preview=%s",
            PRODUCT_ASSISTANT_RAG_COLLECTION,
            _query_preview(query),
        )
        return []
    client = await _get_qdrant_client()
    if client is None or not await _ensure_product_assistant_collection(client):
        logger.info(
            "[STEP] product_assistant.rag skip_no_qdrant collection=%s preview=%s",
            PRODUCT_ASSISTANT_RAG_COLLECTION,
            _query_preview(query),
        )
        return []
    try:
        fetch_limit = limit * 8 if min_score is not None else limit
        res = await client.query_points(
            collection_name=PRODUCT_ASSISTANT_RAG_COLLECTION,
            query=embedding,
            limit=fetch_limit,
            with_payload=True,
        )
        raw_points = list(res.points or [])
        candidates: list[MarketingRagChunk] = []
        dropped_score = 0
        dropped_empty = 0
        for i, pt in enumerate(raw_points):
            payload = pt.payload or {}
            text = str(payload.get("text") or "")
            if not text.strip():
                dropped_empty += 1
                continue
            score = getattr(pt, "score", None)
            if min_score is not None and score is not None and float(score) < min_score:
                dropped_score += 1
                continue
            candidates.append(
                MarketingRagChunk(
                    text=text,
                    ordinal=i + 1,
                    content_id=str(payload.get("document_id") or "") or None,
                    chunk_index=payload.get("chunk_index"),
                    source_label=str(payload.get("title") or "") or None,
                    score=float(score) if score is not None else None,
                )
            )
        deduped = dedupe_product_assistant_kb_chunks(candidates, limit=limit, max_per_document_id=2)
        logger.info(
            "[STEP] product_assistant.rag search collection=%s raw=%s after_score=%s deduped=%s preview=%s",
            PRODUCT_ASSISTANT_RAG_COLLECTION,
            len(raw_points),
            len(candidates),
            len(deduped),
            _query_preview(query),
        )
        return deduped
    except Exception:
        logger.exception("product_assistant_kb search failed")
        return []


async def search_product_assistant_kb_with_fallback(
    *,
    query: str,
    limit: int = 8,
    min_score: float | None = 0.18,
    fallback_min_score: float = 0.08,
) -> list[MarketingRagChunk]:
    """Vector search; при пустом результате — повтор с более мягким порогом score."""
    chunks = await search_product_assistant_kb(query=query, limit=limit, min_score=min_score)
    if chunks or min_score is None:
        return chunks
    logger.info(
        "[STEP] product_assistant.rag retry_lower_score preview=%s threshold=%s",
        _query_preview(query),
        fallback_min_score,
    )
    return await search_product_assistant_kb(
        query=query,
        limit=limit,
        min_score=fallback_min_score,
    )


def rag_chunk_source_labels(chunks: list[MarketingRagChunk]) -> list[str | None]:
    return [(c.source_label or None) for c in chunks]


def format_rag_context_for_prompt(
    chunks: list[MarketingRagChunk],
    *,
    max_chars: int | None = DEFAULT_ASSISTANT_RAG_PROMPT_MAX_CHARS,
) -> str:
    lines: list[str] = []
    for c in chunks:
        label = (c.source_label or "").strip()
        prefix = f"[{label}] " if label else ""
        lines.append(f"{prefix}{c.text.strip()}")
    full = "\n\n".join(lines)
    if max_chars is None or len(full) <= max_chars:
        return full
    used = 0
    parts: list[str] = []
    for c in chunks:
        label = (c.source_label or "").strip()
        prefix = f"[{label}] " if label else ""
        block = f"{prefix}{c.text.strip()}"
        sep = "\n\n" if parts else ""
        if used + len(sep) + len(block) > max_chars:
            break
        parts.append(block)
        used += len(sep) + len(block)
    out = "\n\n".join(parts)
    logger.info(
        "[STEP] product_assistant.rag truncated_prompt chars=%s max=%s",
        len(out),
        max_chars,
    )
    return out


async def llama_generate_stream(
    *,
    base_url: str,
    model: str,
    prompt: str,
    options: dict | None = None,
):
    """Текстовый поток: Llama /api/generate или llama /v1/completions (stream)."""
    import httpx

    from api.core.http_clients import get_httpx_client
    from api.services.product_assistant_prompt_helpers import ASSISTANT_LLAMA_NUM_PREDICT
    from api.utils.llm_openai_compat_http import httpx_compat_generate_text_stream

    client = get_httpx_client()
    stream_opts = {"temperature": 0.4, "num_predict": ASSISTANT_LLAMA_NUM_PREDICT}
    if options:
        stream_opts.update(options)
    async for piece in httpx_compat_generate_text_stream(
        client,
        base_url,
        model=model,
        prompt=prompt,
        system=None,
        options=stream_opts,
        timeout=httpx.Timeout(300.0, connect=15.0),
    ):
        yield piece
