# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Project-scoped Marketing Cabinet document RAG in Qdrant.
# Chunks unified_content rows, stores vectors in marketing_project_rag, and returns cited fragments for prompts.
# Invariants:
# - Embeddings use LLAMA_EMBEDDING_URL / LLAMA_EMBEDDING_MODEL; answer generation uses a separate text LLM route.
# - Qdrant collection vector size must match AI_EMBEDDINGS_DIMENSION; on mismatch the collection is recreated (reindex required).
# - HTTP batch size for chunk embedding follows AI_EMBEDDINGS_BATCH_SIZE (via rag_http_embed_batch_size).
# - Disabled or deleted RAG sources must not leave stale Qdrant points behind.
# - Default semantic retrieval cap for search/merge helpers: **16** chunks (override per call via `limit`).
# Related:
# - api.routers.marketing_cabinet.project_rag_sources
# - api.services.chat_memory_service
# ---
"""Marketing cabinet: project-scoped document RAG in Qdrant."""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]

from api.core.unified_config import unified_settings
from api.services.chat_memory_service import (
    EMBEDDING_DIMENSION,
    _get_embedding,
    _get_embeddings_batch,
    _get_qdrant_client,
    rag_http_embed_batch_size,
)

logger = logging.getLogger(__name__)


class MarketingRagInfrastructureError(RuntimeError):
    """Qdrant, embeddings, or collection setup failed; callers may map to HTTP 503."""


def _imc_rag_trace() -> bool:
    return bool(getattr(unified_settings, "imc_rag_trace", False))


def _marketing_rag_rerank_enabled() -> bool:
    """Тот же контур, что desktop RAG: при непустом RAG_RERANK_BASE_URL — пул из Qdrant, затем POST /v1/rerank."""
    return bool((getattr(unified_settings, "rag_rerank_base_url", None) or "").strip())


def _imc_rag_trace_preview(text: str, max_len: int = 220) -> str:
    t = (text or "").replace("\n", " ").strip()
    if len(t) <= max_len:
        return t
    return f"{t[: max_len - 1]}…"


def _normalize_rag_context_line(text: str) -> str:
    return " ".join((text or "").split()).strip()


def build_marketing_rag_query(
    query: str,
    *,
    recent_messages: list[str] | tuple[str, ...] | None = None,
    max_chars: int = 4000,
    max_recent_messages: int = 6,
    max_recent_chars: int = 1600,
) -> str:
    """
    Строит запрос для RAG из текущего вопроса и свежего диалога.

    Важное поведение:
    - всегда приоритизирует сам пользовательский запрос;
    - подтягивает только последние сообщения;
    - если лимит короткий, режет более старый контекст, а не свежие реплики.
    """
    base = _normalize_rag_context_line(query)
    if not base:
        return ""
    if max_chars <= 0:
        return base
    if not recent_messages:
        return base[:max_chars]

    recent_budget = min(max_recent_chars, max(0, max_chars - len(base) - 24))
    if recent_budget <= 0:
        return base[:max_chars]

    selected: list[str] = []
    used = 0
    for raw in reversed(list(recent_messages)[-max_recent_messages:]):
        line = _normalize_rag_context_line(raw)
        if not line:
            continue
        remaining = recent_budget - used
        if remaining <= 0:
            break
        if len(line) > remaining:
            if remaining <= 1:
                break
            line = f"{line[: remaining - 1].rstrip()}…"
        selected.append(line)
        used += len(line) + 1
        if used >= recent_budget:
            break

    if not selected:
        return base[:max_chars]

    recent_block = "\n".join(reversed(selected))
    merged = f"{base}\n\nНедавний контекст диалога:\n{recent_block}"
    return merged[:max_chars]


MARKETING_PROJECT_RAG_COLLECTION = "marketing_project_rag"


@dataclass
class MarketingRagChunk:
    """Фрагмент проекта из Qdrant для трассируемых цитат в промптах."""

    text: str
    ordinal: int
    content_id: str | None = None
    chunk_index: int | None = None
    source_label: str | None = None
    score: float | None = None
    mime_type: str | None = None


# Deterministic point ids (same pattern as chat_knowledge_base).
MARKETING_RAG_POINT_NAMESPACE = uuid.UUID("c2d3e4f5-a6b7-8901-cdef-123456789012")

CHUNK_SIZE = 900
CHUNK_OVERLAP = 100
MIN_EXTRACTED_TEXT_CHARS = 60
MAX_CHUNKS_PER_DOCUMENT = 200


# Align with marketing AI expectations: document-like MIME only (not images-only uploads).
def _mime_eligible_for_marketing_rag(mime: str | None) -> bool:
    if not mime:
        return False
    m = mime.lower().strip()
    if m.startswith("text/"):
        return True
    if m == "application/pdf":
        return True
    if m.startswith("application/vnd.openxmlformats"):
        return True
    if m in (
        "application/msword",
        "application/vnd.ms-excel",
        "application/vnd.ms-powerpoint",
        "application/rtf",
        "application/epub+zip",
    ):
        return True
    return m.startswith("application/vnd.oasis.opendocument")


def _chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    if not (text or "").strip():
        return []
    text = text.strip()
    if len(text) <= chunk_size:
        return [text] if text else []
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        if chunk.strip():
            chunks.append(chunk.strip())
        start = end - overlap
        if start >= len(text):
            break
    return chunks


async def _ensure_marketing_rag_collection(client: Any) -> bool:
    from api.core.qdrant_defaults import QDRANT_INDEXING_THRESHOLD
    from api.core.qdrant_vector_collection import ensure_cosine_vector_collection

    return await ensure_cosine_vector_collection(
        client,
        collection_name=MARKETING_PROJECT_RAG_COLLECTION,
        vector_size=EMBEDDING_DIMENSION,
        indexing_threshold=QDRANT_INDEXING_THRESHOLD,
        log_step="[STEP] marketing_rag.index",
    )


async def delete_marketing_rag_chunks_for_content(project_id: UUID, content_id: UUID) -> None:
    """Remove all Qdrant points for this marketing project and unified_content row."""
    client = await _get_qdrant_client()
    if client is None:
        return
    try:
        from qdrant_client.models import FieldCondition, Filter, MatchValue

        q_filter = Filter(
            must=[
                FieldCondition(key="marketing_project_id", match=MatchValue(value=str(project_id))),
                FieldCondition(key="content_id", match=MatchValue(value=str(content_id))),
            ]
        )
        point_ids: list[Any] = []
        offset = None
        while True:
            res, offset = await client.scroll(
                collection_name=MARKETING_PROJECT_RAG_COLLECTION,
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
            await client.delete(collection_name=MARKETING_PROJECT_RAG_COLLECTION, points_selector=point_ids)
        logger.info(
            "[STEP] marketing_rag.delete removed_points=%s project=%s content=%s",
            len(point_ids),
            project_id,
            content_id,
        )
    except Exception as e:
        logger.warning("marketing RAG: delete_marketing_rag_chunks_for_content failed: %s", e)


async def index_unified_content_marketing_rag(db_pool: asyncpg.Pool, content_id: UUID) -> bool:
    """
    Load unified_content row; if eligible (project_id, not deleted, mime, text length), chunk+embed+upsert.
    Returns True if indexing ran successfully (including 0 chunks after trim).
    """

    async def _load_indexable_row() -> asyncpg.Record | None:
        async with db_pool.acquire() as conn:
            return await conn.fetchrow(
                """
                SELECT id, project_id, deleted_at, extracted_text, mime_type, content_type, name,
                       marketing_rag_included
                FROM unified_content
                WHERE id = $1
                """,
                content_id,
            )

    async def _still_indexable() -> bool:
        async with db_pool.acquire() as conn:
            check = await conn.fetchrow(
                """
                SELECT project_id, deleted_at, marketing_rag_included
                FROM unified_content
                WHERE id = $1
                """,
                content_id,
            )
        return bool(
            check is not None
            and check["project_id"] is not None
            and check["deleted_at"] is None
            and check["marketing_rag_included"] is True
        )

    row = await _load_indexable_row()
    if row is None:
        return False
    project_id = row["project_id"]
    if project_id is None or row["deleted_at"] is not None:
        return False
    if row["marketing_rag_included"] is False:
        await delete_marketing_rag_chunks_for_content(UUID(str(project_id)), content_id)
        return True
    mime = row["mime_type"]
    if not _mime_eligible_for_marketing_rag(str(mime) if mime else None):
        logger.debug(
            "marketing RAG: skip index content_id=%s mime=%s (not document/text)",
            content_id,
            mime,
        )
        return False
    raw_text = str(row["extracted_text"] or "").strip()
    if len(raw_text) < MIN_EXTRACTED_TEXT_CHARS:
        logger.debug("marketing RAG: skip index content_id=%s (text too short)", content_id)
        return False

    chunks = _chunk_text(raw_text)[:MAX_CHUNKS_PER_DOCUMENT]
    if not chunks:
        return False

    client = await _get_qdrant_client()
    if client is None or not await _ensure_marketing_rag_collection(client):
        logger.warning("[STEP] marketing_rag.index skipped: Qdrant unavailable content_id=%s", content_id)
        return False

    pid = UUID(str(project_id))
    cid_str = str(content_id)

    # Replace previous vectors for this document in this project (idempotent upsert).
    await delete_marketing_rag_chunks_for_content(pid, content_id)

    try:
        from qdrant_client.models import PointStruct

        embed_bs = rag_http_embed_batch_size()
        total = 0
        for start in range(0, len(chunks), embed_bs):
            batch_chunks = chunks[start : start + embed_bs]
            embeddings = await _get_embeddings_batch(batch_chunks)
            if not await _still_indexable():
                await delete_marketing_rag_chunks_for_content(pid, content_id)
                logger.info(
                    "[STEP] marketing_rag.index aborted: source disabled during embedding project=%s content=%s",
                    pid,
                    content_id,
                )
                return False
            batch_points: list[Any] = []
            for i, (chunk, embedding) in enumerate(zip(batch_chunks, embeddings, strict=False)):
                if not embedding:
                    continue
                idx = start + i
                point_id = str(uuid.uuid5(MARKETING_RAG_POINT_NAMESPACE, f"{pid}_{content_id}_{idx}"))
                payload = {
                    "marketing_project_id": str(pid),
                    "content_id": cid_str,
                    "chunk_index": idx,
                    "text": chunk,
                    "mime_type": str(mime or ""),
                    "content_type": str(row["content_type"] or ""),
                    "name": str(row["name"] or "")[:500],
                }
                batch_points.append(PointStruct(id=point_id, vector=embedding, payload=payload))
            if batch_points:
                await client.upsert(collection_name=MARKETING_PROJECT_RAG_COLLECTION, points=batch_points)
                total += len(batch_points)
        logger.info(
            "[STEP] marketing_rag.index upserted_points=%s project=%s content=%s",
            total,
            pid,
            content_id,
        )
        return True
    except Exception:
        logger.exception("[STEP] marketing_rag.index failed content_id=%s", content_id)
        return False


async def search_marketing_project_rag_chunks(
    db_pool: asyncpg.Pool,
    *,
    query: str,
    project_id: UUID,
    user_id: UUID,
    limit: int = 16,
    min_score: float | None = None,
    skip_internal_rerank: bool = False,
    fail_on_infrastructure_error: bool = False,
) -> list[MarketingRagChunk]:
    """
    Semantic search: возвращает чанки с метаданными для цитирования (content_id, имя файла, индекс).

    При непустом ``RAG_RERANK_BASE_URL`` и ``skip_internal_rerank=False`` (по умолчанию): расширенный пул
    из Qdrant, затем cross-encoder ``/v1/rerank`` и обрезка до ``limit``. Для десктопного RAG, где после
    поиска вызывается ``apply_rerank_to_chunks``, передайте ``skip_internal_rerank=True``, чтобы не
    реранкать дважды.
    """
    from api.routers.marketing_cabinet.common import get_accessible_project

    if not (query or "").strip():
        if _imc_rag_trace():
            logger.info(
                "[STEP] imc.rag_trace.search_skip_empty_query project=%s limit=%s",
                project_id,
                limit,
            )
        return []
    await get_accessible_project(db_pool, project_id, user_id)

    embedding = await _get_embedding(query)
    if not embedding:
        logger.warning(
            "marketing RAG: embedding unavailable, semantic search skipped project=%s",
            project_id,
        )
        if _imc_rag_trace():
            logger.warning(
                "[STEP] imc.rag_trace.search_no_embedding project=%s query_preview=%s",
                project_id,
                _imc_rag_trace_preview(query, 280),
            )
        if fail_on_infrastructure_error:
            msg = "Сервис эмбеддингов недоступен; семантический поиск по проекту невозможен."
            raise MarketingRagInfrastructureError(msg)
        return []
    emb_len = len(embedding)
    if _imc_rag_trace():
        logger.info(
            "[STEP] imc.rag_trace.embedding_ok project=%s dim=%s query_preview=%s",
            project_id,
            emb_len,
            _imc_rag_trace_preview(query, 280),
        )
    client = await _get_qdrant_client()
    if client is None:
        logger.warning("[STEP] imc.rag_trace.qdrant_no_client project=%s", project_id)
        if fail_on_infrastructure_error:
            msg = "Векторное хранилище (Qdrant) недоступно."
            raise MarketingRagInfrastructureError(msg)
        return []
    if not await _ensure_marketing_rag_collection(client):
        logger.warning(
            "[STEP] imc.rag_trace.qdrant_collection_missing project=%s",
            project_id,
        )
        if fail_on_infrastructure_error:
            msg = "Не удалось подготовить коллекцию RAG проекта в Qdrant."
            raise MarketingRagInfrastructureError(msg)
        return []
    try:
        from qdrant_client.models import FieldCondition, Filter, MatchValue

        q_filter = Filter(must=[FieldCondition(key="marketing_project_id", match=MatchValue(value=str(project_id)))])
        rerank_on = _marketing_rag_rerank_enabled() and not skip_internal_rerank
        if rerank_on:
            # Как в desktop build_rag_prefix: шире пул для cross-encoder, затем take=limit.
            fetch_limit = min(128, max(limit * 5, 20))
        elif min_score is not None:
            fetch_limit = limit * 5
        else:
            fetch_limit = limit
        res = await client.query_points(
            collection_name=MARKETING_PROJECT_RAG_COLLECTION,
            query=embedding,
            query_filter=q_filter,
            limit=fetch_limit,
            with_payload=True,
            with_vectors=False,
        )
        raw_points = list(res.points or [])
        if _imc_rag_trace():
            logger.info(
                "[STEP] imc.rag_trace.qdrant_raw project=%s collection=%s limit_req=%s fetch_limit=%s "
                "min_score=%s rerank_on=%s raw_hits=%s",
                project_id,
                MARKETING_PROJECT_RAG_COLLECTION,
                limit,
                fetch_limit,
                min_score,
                rerank_on,
                len(raw_points),
            )
        out: list[MarketingRagChunk] = []
        dropped_min_score = 0
        dropped_empty_text = 0
        collect_cap = fetch_limit if rerank_on else limit
        for pt in raw_points:
            if min_score is not None:
                raw_sc = getattr(pt, "score", None)
                try:
                    sc = float(raw_sc) if raw_sc is not None else None
                except (TypeError, ValueError):  # fmt: skip
                    sc = None
                if sc is not None and sc < min_score:
                    dropped_min_score += 1
                    continue
            payload = pt.payload or {} if isinstance(pt.payload, dict) else {}
            t = payload.get("text")
            if not isinstance(t, str) or not t.strip():
                dropped_empty_text += 1
                continue
            ord_ = len(out) + 1
            cid = payload.get("content_id")
            cidx = payload.get("chunk_index")
            chunk_idx: int | None = None
            if isinstance(cidx, int):
                chunk_idx = cidx
            elif isinstance(cidx, float):
                chunk_idx = int(cidx)
            elif isinstance(cidx, str) and cidx.strip().isdigit():
                chunk_idx = int(cidx.strip())
            name = payload.get("name")
            raw_sc = getattr(pt, "score", None)
            try:
                score_f = float(raw_sc) if raw_sc is not None else None
            except (TypeError, ValueError):  # fmt: skip
                score_f = None
            out.append(
                MarketingRagChunk(
                    text=t.strip(),
                    ordinal=ord_,
                    content_id=str(cid) if cid is not None else None,
                    chunk_index=chunk_idx,
                    source_label=str(name).strip()[:240] if name else None,
                    score=score_f,
                )
            )
            if len(out) >= collect_cap:
                break
        if rerank_on and len(out) > 1:
            from api.services.rerank_client import apply_rerank_to_chunks

            out = await apply_rerank_to_chunks(
                query.strip(),
                out,
                take=limit,
                max_docs=min(64, fetch_limit),
            )
        else:
            out = out[:limit]
        if _imc_rag_trace():
            logger.info(
                "[STEP] imc.rag_trace.qdrant_kept project=%s kept=%s dropped_min_score=%s dropped_empty_payload=%s",
                project_id,
                len(out),
                dropped_min_score,
                dropped_empty_text,
            )
            for ch in out:
                logger.info(
                    "[STEP] imc.rag_trace.chunk project=%s fragment=%s content_id=%s chunk_index=%s "
                    "score=%s text_chars=%s label=%s preview=%s",
                    project_id,
                    ch.ordinal,
                    ch.content_id,
                    ch.chunk_index,
                    ch.score,
                    len(ch.text),
                    (ch.source_label or "")[:80],
                    _imc_rag_trace_preview(ch.text, 180),
                )
        if out:
            logger.info(
                "[STEP] marketing_rag.search hits=%s project=%s min_score=%s",
                len(out),
                project_id,
                min_score,
            )
        elif _imc_rag_trace():
            logger.warning(
                "[STEP] imc.rag_trace.qdrant_zero_chunks project=%s raw_hits=%s (проверьте индекс, фильтр min_score, тексты в payload)",
                project_id,
                len(raw_points),
            )
        return out
    except MarketingRagInfrastructureError:
        raise
    except Exception as e:
        logger.warning("marketing RAG: search failed: %s", e)
        if fail_on_infrastructure_error:
            raise MarketingRagInfrastructureError("Ошибка семантического поиска по проекту.") from e
        return []


async def count_marketing_project_rag_points(
    db_pool: asyncpg.Pool,
    *,
    project_id: UUID,
    user_id: UUID,
) -> int:
    """Exact count of Qdrant points for project; -1 if unavailable."""
    from api.routers.marketing_cabinet.common import get_accessible_project

    await get_accessible_project(db_pool, project_id, user_id)
    client = await _get_qdrant_client()
    if client is None or not await _ensure_marketing_rag_collection(client):
        return -1
    try:
        from qdrant_client.models import FieldCondition, Filter, MatchValue

        q_filter = Filter(must=[FieldCondition(key="marketing_project_id", match=MatchValue(value=str(project_id)))])
        cnt = await client.count(
            collection_name=MARKETING_PROJECT_RAG_COLLECTION,
            count_filter=q_filter,
            exact=True,
        )
        return int(getattr(cnt, "count", cnt) or 0)
    except Exception as e:
        logger.warning("marketing RAG: count failed: %s", e)
        return -1


async def count_vault_documents_with_text(
    db_pool: asyncpg.Pool,
    *,
    project_id: UUID,
    user_id: UUID,
) -> int:
    """Rows in unified_content with enough extracted text for this project (operator hint, not Qdrant)."""
    from api.routers.marketing_cabinet.common import get_accessible_project

    await get_accessible_project(db_pool, project_id, user_id)
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT COUNT(*)::int AS c
            FROM unified_content uc
            WHERE uc.project_id = $1
              AND uc.deleted_at IS NULL
              AND uc.marketing_rag_included IS TRUE
              AND length(trim(COALESCE(uc.extracted_text, ''))) >= $2
            """,
            project_id,
            MIN_EXTRACTED_TEXT_CHARS,
        )
    return int(row["c"]) if row and row["c"] is not None else 0


async def search_marketing_project_rag(
    db_pool: asyncpg.Pool,
    *,
    query: str,
    project_id: UUID,
    user_id: UUID,
    limit: int = 16,
    min_score: float | None = None,
) -> list[str]:
    """
    Semantic search over project document chunks. Enforces project access via marketing helper.
    Returns chunk texts (most relevant first).

    min_score: если задан и у точки есть score (cosine), отбрасываются более слабые совпадения
    (снижает шум из слабо релевантных документов, напр. случайный PDF в проекте).
    """
    rows = await search_marketing_project_rag_chunks(
        db_pool,
        query=query,
        project_id=project_id,
        user_id=user_id,
        limit=limit,
        min_score=min_score,
    )
    return [r.text for r in rows]


def format_rag_chunks_for_prompt(
    chunks: list[str] | list[MarketingRagChunk],
    *,
    max_chars: int = 12000,
) -> str:
    """Формирует блок RAG для промпта: либо нумерованные строки, либо метки fragment/content_id."""
    if not chunks:
        return ""
    parts: list[str] = []
    total = 0
    first = chunks[0]
    if isinstance(first, MarketingRagChunk):
        typed_chunks: list[MarketingRagChunk] = []
        for c in chunks:
            if isinstance(c, MarketingRagChunk):
                typed_chunks.append(c)
        for ch in typed_chunks:
            meta_parts: list[str] = [f"fragment={ch.ordinal}"]
            if ch.content_id:
                meta_parts.append(f"content_id={ch.content_id}")
            if ch.chunk_index is not None:
                meta_parts.append(f"chunk_index={ch.chunk_index}")
            if ch.source_label:
                meta_parts.append(f"label={ch.source_label[:120]}")
            head = "[" + " ".join(meta_parts) + "]"
            block = f"{head}\n{ch.text}"
            if total + len(block) > max_chars:
                break
            parts.append(block)
            total += len(block) + 2
    else:
        str_chunks: list[str] = []
        for c in chunks:
            if isinstance(c, str) and c.strip():
                str_chunks.append(c.strip())
        for i, ch in enumerate(str_chunks, start=1):
            block = f"[fragment={i}] {ch}"
            if total + len(block) > max_chars:
                break
            parts.append(block)
            total += len(block) + 1
    body = "\n\n".join(parts)
    return (
        "Семантически релевантные фрагменты из документов проекта (RAG).\n"
        "В ответе для заказчика указывай источник по полям метки: **label** и номер **fragment**; не заполняй таблицы сырыми content_id/chunk_index.\n"
        f"{body}\n"
    )


async def merge_project_context_text_with_rag(
    db_pool: asyncpg.Pool,
    *,
    project_id: UUID,
    user_id: UUID,
    query: str,
    context_text: str,
    limit: int = 16,
    min_score: float | None = None,
    fail_on_infrastructure_error: bool = False,
) -> str:
    """
    Дополняет текст контекста из Postgres семантическими чанками из Qdrant по этому проекту.
    При недоступности Qdrant/Llama возвращает исходный context_text.
    """
    if not (query or "").strip():
        return context_text
    trace = _imc_rag_trace()
    if trace:
        logger.info(
            "[STEP] imc.rag_trace.merge_pg_rag_start project=%s pg_ctx_chars=%s rag_query_preview=%s "
            "limit=%s min_score=%s",
            project_id,
            len(context_text or ""),
            _imc_rag_trace_preview(query, 300),
            limit,
            min_score,
        )
    try:
        chunks = await search_marketing_project_rag_chunks(
            db_pool,
            query=query.strip()[:4000],
            project_id=project_id,
            user_id=user_id,
            limit=limit,
            min_score=min_score,
            fail_on_infrastructure_error=fail_on_infrastructure_error,
        )
        block = format_rag_chunks_for_prompt(chunks)
        merged = f"{context_text}\n\n{block}" if block else context_text
        if trace:
            logger.info(
                "[STEP] imc.rag_trace.merge_pg_rag_done project=%s chunks=%s rag_block_chars=%s merged_total_chars=%s",
                project_id,
                len(chunks),
                len(block) if block else 0,
                len(merged) if merged else 0,
            )
        if block:
            return merged
    except MarketingRagInfrastructureError:
        raise
    except Exception:
        logger.exception("[STEP] marketing_rag.merge_project_context failed project=%s", project_id)
        if fail_on_infrastructure_error:
            msg = "Ошибка объединения контекста проекта с RAG."
            raise MarketingRagInfrastructureError(msg) from None
    return context_text
