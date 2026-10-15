# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Qdrant collection management, batched upsert, dense search, and sparse retrieval.
# Invariants:
# - Upserts are chunked (KBSEW_QDRANT_UPSERT_BATCH_SIZE) to avoid oversized HTTP bodies.
# - Each chunk must carry an embedding before upsert.
# - Index commit upserts first, then prunes stale chunk_index >= keep_count (no wipe-before-upsert).
# - Default dense: unnamed vectors. Sparse payload scroll is opt-in via KBSEW_SPARSE_VECTORS_ENABLED.
# - Native named dense+sparse: KBSEW_SPARSE_NATIVE_QDRANT=true (requires collection recreate).
# - Sparse scroll reports truncated when candidate_limit is hit with more points left.
# Related:
# - api/services/embedding_client.py
# - api/services/sparse_vectors.py
# - api/services/search_service.py
# - documentation/product/KBSEW.md
# ---

from __future__ import annotations

import asyncio
import logging
import uuid
from dataclasses import dataclass
from typing import Any, Literal

from qdrant_client import AsyncQdrantClient
from qdrant_client.http.exceptions import ResponseHandlingException
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    FilterSelector,
    MatchValue,
    PointStruct,
    Range,
    SparseVectorParams,
    VectorParams,
)

from api.core.config import get_settings
from api.models.chunk import Chunk
from api.services.sparse_vectors import (
    SPARSE_SCHEME_HASHED_LOG_TF_V1,
    rank_texts_by_sparse_payload,
    sparse_weights_payload,
    try_qdrant_sparse_vector,
)

logger = logging.getLogger(__name__)

_client: AsyncQdrantClient | None = None

# Named vector keys when KBSEW_SPARSE_NATIVE_QDRANT is on (new collections only).
DENSE_VECTOR_NAME = "dense"
SPARSE_VECTOR_NAME = "sparse"

CollectionSchemaMode = Literal["missing", "unnamed", "named_native", "other"]


def collection_name_for_barrel(barrel_id: str) -> str:
    return f"kbsew_barrel_{barrel_id.replace('-', '')[:24]}"


def get_qdrant_client() -> AsyncQdrantClient:
    global _client  # noqa: PLW0603
    if _client is None:
        settings = get_settings()
        kwargs: dict[str, Any] = {
            "url": settings.qdrant_http_url,
            "prefer_grpc": False,
            "check_compatibility": False,
        }
        if settings.qdrant_api_key:
            kwargs["api_key"] = settings.qdrant_api_key
        _client = AsyncQdrantClient(**kwargs)
    return _client


def reset_qdrant_client_for_tests() -> None:
    global _client  # noqa: PLW0603
    _client = None


def _vectors_config_is_named_native(vectors: Any, sparse_vectors: Any) -> bool:
    if not isinstance(vectors, dict):
        return False
    if DENSE_VECTOR_NAME not in vectors:
        return False
    if not isinstance(sparse_vectors, dict):
        return False
    return SPARSE_VECTOR_NAME in sparse_vectors


async def detect_collection_schema(collection: str) -> CollectionSchemaMode:
    """Inspect an existing collection: unnamed dense vs named dense+sparse."""

    client = get_qdrant_client()
    if not await client.collection_exists(collection):
        return "missing"
    try:
        info = await client.get_collection(collection)
        params = getattr(getattr(info, "config", None), "params", None)
        vectors = getattr(params, "vectors", None) if params is not None else None
        sparse_vectors = (
            getattr(params, "sparse_vectors", None) if params is not None else None
        )
        if _vectors_config_is_named_native(vectors, sparse_vectors):
            return "named_native"
        # Unnamed VectorParams (or equivalent single dense config).
        if vectors is not None and not isinstance(vectors, dict):
            return "unnamed"
        if isinstance(vectors, dict) and DENSE_VECTOR_NAME not in vectors:
            return "other"
        if isinstance(vectors, dict) and not sparse_vectors:
            return "other"
        return "unnamed"
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "[STEP] kbsew_qdrant_schema_detect_failed collection=%s reason=%r",
            collection,
            exc,
        )
        return "other"


def chunk_to_point(*, chunk: Chunk, barrel_id: str, asset_id: str) -> PointStruct:
    if not chunk.embedding:
        raise ValueError(f"chunk missing embedding (index={chunk.chunk_index})")
    settings = get_settings()
    point_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{asset_id}:{chunk.chunk_index}"))
    payload: dict[str, Any] = {
        "barrel_id": barrel_id,
        "asset_id": asset_id,
        "chunk_index": chunk.chunk_index,
        "text": chunk.text[:4000],
        **chunk.metadata,
        # Multimodal fields after metadata so chunk_kind/page/bbox win.
        **chunk.multimodal_payload_fields(),
    }
    vector: Any = chunk.embedding
    if settings.sparse_native_active:
        sparse_vec = try_qdrant_sparse_vector(
            chunk.text, max_terms=settings.sparse_max_terms_clamped
        )
        named: dict[str, Any] = {DENSE_VECTOR_NAME: chunk.embedding}
        if sparse_vec is not None:
            named[SPARSE_VECTOR_NAME] = sparse_vec
            payload["sparse_scheme"] = SPARSE_SCHEME_HASHED_LOG_TF_V1
            payload["sparse_vector_ready"] = True
        vector = named
    elif settings.sparse_vectors_enabled:
        sparse_payload = sparse_weights_payload(
            chunk.text, max_terms=settings.sparse_max_terms_clamped
        )
        if sparse_payload:
            # Hybrid search scores these payload weights in-process (legacy path).
            payload.update(sparse_payload)
            payload["sparse_vector_ready"] = True
    return PointStruct(id=point_id, vector=vector, payload=payload)


async def ensure_collection(collection: str, vector_size: int) -> None:
    client = get_qdrant_client()
    exists = await client.collection_exists(collection)
    if exists:
        settings = get_settings()
        if settings.sparse_native_active:
            mode = await detect_collection_schema(collection)
            if mode != "named_native":
                logger.warning(
                    "[STEP] kbsew_qdrant_native_schema_mismatch collection=%s mode=%s "
                    "action=keep_existing hint=delete_collection_then_force_reindex",
                    collection,
                    mode,
                )
        return
    settings = get_settings()
    if settings.sparse_native_active:
        await client.create_collection(
            collection_name=collection,
            vectors_config={
                DENSE_VECTOR_NAME: VectorParams(
                    size=vector_size, distance=Distance.COSINE
                ),
            },
            sparse_vectors_config={
                SPARSE_VECTOR_NAME: SparseVectorParams(),
            },
        )
        logger.info(
            "[STEP] kbsew_qdrant_collection_created name=%s dim=%s schema=named_native",
            collection,
            vector_size,
        )
        return
    await client.create_collection(
        collection_name=collection,
        vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE),
    )
    logger.info(
        "[STEP] kbsew_qdrant_collection_created name=%s dim=%s schema=unnamed",
        collection,
        vector_size,
    )


async def delete_collection(collection: str) -> None:
    client = get_qdrant_client()
    try:
        if await client.collection_exists(collection):
            await client.delete_collection(collection)
            logger.info("[STEP] kbsew_qdrant_collection_deleted name=%s", collection)
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "[STEP] kbsew_qdrant_delete_skip name=%s reason=%s", collection, exc
        )


async def recreate_collection_native_sparse(
    *, collection: str, vector_size: int
) -> None:
    """
    Delete and recreate a barrel collection with named dense + sparse vectors.

    Operator path after enabling KBSEW_SPARSE_NATIVE_QDRANT — follow with force-reindex.
    """

    await delete_collection(collection)
    settings = get_settings()
    client = get_qdrant_client()
    await client.create_collection(
        collection_name=collection,
        vectors_config={
            DENSE_VECTOR_NAME: VectorParams(size=vector_size, distance=Distance.COSINE),
        },
        sparse_vectors_config={
            SPARSE_VECTOR_NAME: SparseVectorParams(),
        },
    )
    logger.info(
        "[STEP] kbsew_qdrant_collection_recreated_native name=%s dim=%s sparse_flag=%s",
        collection,
        vector_size,
        settings.sparse_native_active,
    )


async def delete_points_for_asset(*, collection: str, asset_id: str) -> None:
    """Remove all points for one asset (operator repair / full wipe). Prefer prune-after-upsert."""

    client = get_qdrant_client()
    try:
        if not await client.collection_exists(collection):
            return
        await client.delete(
            collection_name=collection,
            points_selector=FilterSelector(
                filter=Filter(
                    must=[
                        FieldCondition(
                            key="asset_id",
                            match=MatchValue(value=asset_id),
                        )
                    ]
                )
            ),
        )
        logger.info(
            "[STEP] kbsew_qdrant_asset_points_deleted collection=%s asset_id=%s",
            collection,
            asset_id,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "[STEP] kbsew_qdrant_asset_delete_failed collection=%s asset_id=%s reason=%s",
            collection,
            asset_id,
            exc,
        )
        raise


async def delete_stale_points_after_upsert(
    *,
    collection: str,
    asset_id: str,
    keep_chunk_count: int,
) -> None:
    """
    After a successful upsert of chunk_index 0..N-1, drop leftover higher indices
    from a previous longer revision. Does not wipe points before upsert.
    """

    if keep_chunk_count < 1:
        raise ValueError("keep_chunk_count must be >= 1 after successful upsert")
    client = get_qdrant_client()
    try:
        if not await client.collection_exists(collection):
            return
        await client.delete(
            collection_name=collection,
            points_selector=FilterSelector(
                filter=Filter(
                    must=[
                        FieldCondition(
                            key="asset_id",
                            match=MatchValue(value=asset_id),
                        ),
                        FieldCondition(
                            key="chunk_index",
                            range=Range(gte=keep_chunk_count),
                        ),
                    ]
                )
            ),
        )
        logger.info(
            "[STEP] kbsew_qdrant_stale_points_pruned collection=%s asset_id=%s keep=%s",
            collection,
            asset_id,
            keep_chunk_count,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "[STEP] kbsew_qdrant_stale_prune_failed collection=%s asset_id=%s reason=%s",
            collection,
            asset_id,
            exc,
        )
        raise


async def _upsert_points_batch(
    *,
    collection: str,
    points: list[PointStruct],
    batch_index: int,
    batch_total: int,
) -> None:
    settings = get_settings()
    attempts = settings.qdrant_upsert_retries_clamped
    client = get_qdrant_client()
    last_exc: Exception | None = None
    for attempt in range(attempts):
        try:
            await client.upsert(collection_name=collection, points=points)
            logger.info(
                "[STEP] kbsew_qdrant_upsert_batch_ok batch=%s/%s points=%s",
                batch_index,
                batch_total,
                len(points),
            )
            return
        except (ResponseHandlingException, TimeoutError, OSError) as exc:
            last_exc = exc
            if attempt >= attempts - 1:
                break
            delay = min(2.0, 0.2 * (2**attempt))
            logger.warning(
                "[STEP] kbsew_qdrant_upsert_retry batch=%s/%s attempt=%s/%s delay=%.2fs reason=%r",
                batch_index,
                batch_total,
                attempt + 1,
                attempts,
                delay,
                exc,
            )
            await asyncio.sleep(delay)
    assert last_exc is not None
    raise last_exc


def _payload_texts_from_points(points: Any) -> list[str]:
    chunks: list[str] = []
    for point in points or []:
        payload = point.payload or {}
        text = payload.get("text")
        if isinstance(text, str) and text.strip():
            chunks.append(text.strip())
    return chunks


async def search_collection_chunks(
    *,
    collection: str,
    query_vector: list[float],
    limit: int,
) -> list[str]:
    client = get_qdrant_client()
    if not await client.collection_exists(collection):
        return []
    mode = await detect_collection_schema(collection)
    query_kwargs: dict[str, Any] = {
        "collection_name": collection,
        "query": query_vector,
        "limit": limit,
        "with_payload": True,
        "with_vectors": False,
    }
    if mode == "named_native":
        query_kwargs["using"] = DENSE_VECTOR_NAME
    result = await client.query_points(**query_kwargs)
    return _payload_texts_from_points(result.points)


@dataclass(frozen=True, slots=True)
class SparseCandidateBatch:
    """Scrolled sparse-payload candidates plus whether the scroll universe was capped."""

    candidates: list[dict[str, Any]]
    truncated: bool
    limit: int


async def fetch_sparse_payload_candidates(
    *,
    collection: str,
    limit: int,
) -> SparseCandidateBatch:
    """
    Scroll points that carry hashed sparse payload fields for hybrid ranking.

    ``truncated=True`` when the scroll hit ``limit`` while more matching points
    remain — payload scoring is not an ANN sparse index.
    """

    if limit <= 0:
        return SparseCandidateBatch(candidates=[], truncated=False, limit=limit)
    client = get_qdrant_client()
    if not await client.collection_exists(collection):
        return SparseCandidateBatch(candidates=[], truncated=False, limit=limit)

    out: list[dict[str, Any]] = []
    offset: Any | None = None
    truncated = False
    scroll_filter = Filter(
        must=[
            FieldCondition(
                key="sparse_scheme",
                match=MatchValue(value=SPARSE_SCHEME_HASHED_LOG_TF_V1),
            )
        ]
    )
    while len(out) < limit:
        batch_limit = min(64, limit - len(out))
        records, next_offset = await client.scroll(
            collection_name=collection,
            scroll_filter=scroll_filter,
            limit=batch_limit,
            offset=offset,
            with_payload=[
                "text",
                "sparse_indices",
                "sparse_values",
                "sparse_scheme",
            ],
            with_vectors=False,
        )
        if not records:
            break
        for index, record in enumerate(records):
            payload = record.payload or {}
            text = payload.get("text")
            indices = payload.get("sparse_indices")
            values = payload.get("sparse_values")
            if not isinstance(text, str) or not text.strip():
                continue
            if not isinstance(indices, list) or not isinstance(values, list):
                continue
            if not indices or len(indices) != len(values):
                continue
            out.append(
                {
                    "text": text.strip(),
                    "sparse_indices": indices,
                    "sparse_values": values,
                }
            )
            if len(out) >= limit:
                # Cap hit: more points in this page or later pages → incomplete sparse universe.
                truncated = next_offset is not None or (index + 1) < len(records)
                break
        if len(out) >= limit:
            break
        if next_offset is None:
            break
        offset = next_offset
    return SparseCandidateBatch(candidates=out, truncated=truncated, limit=limit)


@dataclass(frozen=True, slots=True)
class SparseRankResult:
    """Sparse ranking outcome for hybrid RRF (payload scroll or native ANN)."""

    texts: list[str]
    truncated: bool
    candidate_count: int
    candidate_limit: int
    backend: str = "payload_scroll"


async def _search_native_sparse_chunks(
    *,
    collection: str,
    query: str,
    limit: int,
) -> SparseRankResult:
    """Qdrant-side sparse ANN over named vector ``sparse``."""

    settings = get_settings()
    sparse_query = try_qdrant_sparse_vector(
        query, max_terms=settings.sparse_max_terms_clamped
    )
    if sparse_query is None:
        return SparseRankResult(
            texts=[],
            truncated=False,
            candidate_count=0,
            candidate_limit=limit,
            backend="native_qdrant",
        )
    client = get_qdrant_client()
    result = await client.query_points(
        collection_name=collection,
        query=sparse_query,
        using=SPARSE_VECTOR_NAME,
        limit=limit,
        with_payload=True,
        with_vectors=False,
    )
    texts = _payload_texts_from_points(result.points)
    return SparseRankResult(
        texts=texts,
        truncated=False,
        candidate_count=len(texts),
        candidate_limit=limit,
        backend="native_qdrant",
    )


async def search_collection_sparse_chunks(
    *,
    collection: str,
    query: str,
    limit: int,
    candidate_limit: int | None = None,
) -> SparseRankResult:
    """
    Sparse ranking for hybrid RRF.

    Prefer native named sparse ANN when enabled and the collection schema matches;
    otherwise scroll + in-process score (legacy).
    """

    settings = get_settings()
    scroll_limit = (
        candidate_limit
        if candidate_limit is not None
        else settings.sparse_candidate_limit_clamped
    )

    if settings.sparse_native_active:
        mode = await detect_collection_schema(collection)
        if mode == "named_native":
            return await _search_native_sparse_chunks(
                collection=collection,
                query=query,
                limit=limit,
            )
        logger.info(
            "[STEP] kbsew_sparse_native_fallback_payload collection=%s mode=%s",
            collection,
            mode,
        )

    batch = await fetch_sparse_payload_candidates(
        collection=collection,
        limit=scroll_limit,
    )
    if not batch.candidates:
        return SparseRankResult(
            texts=[],
            truncated=False,
            candidate_count=0,
            candidate_limit=scroll_limit,
            backend="payload_scroll",
        )
    ranked = rank_texts_by_sparse_payload(
        query,
        batch.candidates,
        max_terms=settings.sparse_max_terms_clamped,
        top_k=limit,
    )
    return SparseRankResult(
        texts=ranked,
        truncated=batch.truncated,
        candidate_count=len(batch.candidates),
        candidate_limit=scroll_limit,
        backend="payload_scroll",
    )


async def upsert_chunks(
    *,
    collection: str,
    barrel_id: str,
    asset_id: str,
    chunks: list[Chunk],
) -> int:
    if not chunks:
        return 0
    settings = get_settings()
    dim = settings.embedding_dimension
    await ensure_collection(collection, dim)
    points = [
        chunk_to_point(chunk=chunk, barrel_id=barrel_id, asset_id=asset_id)
        for chunk in chunks
    ]
    batch_size = settings.qdrant_upsert_batch_size_clamped
    batch_total = (len(points) + batch_size - 1) // batch_size
    indexed = 0
    for batch_index, start in enumerate(range(0, len(points), batch_size), start=1):
        batch = points[start : start + batch_size]
        await _upsert_points_batch(
            collection=collection,
            points=batch,
            batch_index=batch_index,
            batch_total=batch_total,
        )
        indexed += len(batch)
    return indexed
