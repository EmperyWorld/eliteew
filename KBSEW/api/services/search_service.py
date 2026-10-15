# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Barrel semantic search: embed query → dense Qdrant retrieval; optional hybrid
# dense+sparse RRF when retrieval_mode=hybrid and sparse vectors are enabled.
# Invariants:
# - Separate from ingestion orchestration; read-only against Qdrant collections.
# - Default retrieval_mode is dense — existing clients unchanged.
# - Hybrid sparse unavailable or scroll-capped → log kbsew_hybrid_sparse_skip
#   (+ metric) and return dense (honest degrade; optional allow-truncated opt-in).
# - Post-retrieve: finalize_search_chunks (readable + near-dedupe) before top_k.
# - Fail-closed when barrel has indexed assets on a stale PIPELINE_VERSION.
# Related:
# - api/services/embedding_client.py
# - api/services/qdrant_store.py
# - api/services/sparse_vectors.py
# - api/services/text_quality.py
# - api/services/revision_service.py
# - documentation/product/KBSEW.md
# ---

from __future__ import annotations

import logging
import time
from typing import Literal

import api.services.barrel_service as barrel_service
import api.services.revision_service as revision_service
from api.core.config import get_settings
from api.monitoring.metrics import (
    observe_hybrid_sparse_skip,
    observe_search_index_stale,
    observe_search_latency,
    set_stale_assets,
)
from api.services.embedding_client import embed_texts
from api.services.qdrant_store import (
    SparseRankResult,
    search_collection_chunks,
    search_collection_sparse_chunks,
)
from api.services.text_quality import finalize_search_chunks

logger = logging.getLogger(__name__)

# Over-fetch from Qdrant so we can drop PDF/Tika noise chunks and still return top_k.
_SEARCH_FETCH_MULTIPLIER = 4
_RRF_K = 60

RetrievalMode = Literal["dense", "hybrid"]


class BarrelNotFoundError(LookupError):
    """Raised when barrel_id is unknown."""


class BarrelDisabledError(ValueError):
    """Raised when barrel exists but is disabled."""


class EmbeddingFailedError(RuntimeError):
    """Raised when query embedding could not be produced."""


class IndexStaleError(RuntimeError):
    """Raised when indexed assets are behind current PIPELINE_VERSION."""

    def __init__(
        self,
        *,
        stale_assets: int,
        required_pipeline: str,
        message: str = "Barrel index is stale; reindex required",
    ) -> None:
        super().__init__(message)
        self.stale_assets = int(stale_assets)
        self.required_pipeline = required_pipeline
        self.code = "index_stale"


def rrf_merge(
    dense_ranked: list[str],
    sparse_ranked: list[str] | None,
    *,
    top_k: int,
    k: int = _RRF_K,
) -> list[str]:
    """Reciprocal Rank Fusion of dense and sparse ranked chunk texts.

    When sparse results are unavailable/empty, returns dense order (honest degrade).
    """
    if not sparse_ranked:
        return dense_ranked[:top_k]
    scores: dict[str, float] = {}
    for rank, doc in enumerate(dense_ranked):
        scores[doc] = scores.get(doc, 0.0) + 1.0 / (k + rank + 1)
    for rank, doc in enumerate(sparse_ranked):
        scores[doc] = scores.get(doc, 0.0) + 1.0 / (k + rank + 1)
    ordered = sorted(scores.keys(), key=lambda doc: scores[doc], reverse=True)
    return ordered[:top_k]


def _resolve_retrieval_mode(explicit: RetrievalMode | str | None) -> RetrievalMode:
    if explicit is None:
        mode = get_settings().retrieval_mode_resolved
    else:
        mode = str(explicit).strip().lower()
    if mode == "hybrid":
        return "hybrid"
    return "dense"


def _search_fetch_limit(top_k: int) -> int:
    return min(top_k * _SEARCH_FETCH_MULTIPLIER, 40)


async def _dense_retrieve_raw(
    *,
    collection: str,
    query_vector: list[float],
    top_k: int,
) -> list[str]:
    return await search_collection_chunks(
        collection=collection,
        query_vector=query_vector,
        limit=_search_fetch_limit(top_k),
    )


async def _sparse_retrieve(
    *,
    collection: str,
    query: str,
    limit: int,
) -> list[str] | None:
    """
    Sparse ranking list for hybrid RRF.

    Returns ranked chunk texts, or None when sparse cannot run (caller degrades
    to dense and logs ``kbsew_hybrid_sparse_skip``). Truncated scroll (candidate
    cap with more points remaining) degrades to dense unless
    ``KBSEW_HYBRID_ALLOW_TRUNCATED_SPARSE=true``.
    """

    settings = get_settings()
    if not settings.sparse_vectors_enabled:
        logger.info(
            "[STEP] kbsew_hybrid_sparse_skip collection=%s reason=sparse_disabled",
            collection,
        )
        observe_hybrid_sparse_skip("sparse_disabled")
        return None

    try:
        result: SparseRankResult = await search_collection_sparse_chunks(
            collection=collection,
            query=query,
            limit=limit,
            candidate_limit=settings.sparse_candidate_limit_clamped,
        )
    except Exception as exc:  # noqa: BLE001 — degrade to dense; never fail hybrid hard
        logger.warning(
            "[STEP] kbsew_hybrid_sparse_skip collection=%s reason=sparse_error error=%r",
            collection,
            exc,
        )
        observe_hybrid_sparse_skip("sparse_error")
        return None

    if not result.texts:
        logger.info(
            "[STEP] kbsew_hybrid_sparse_skip collection=%s reason=no_sparse_candidates",
            collection,
        )
        observe_hybrid_sparse_skip("no_sparse_candidates")
        return None

    if result.truncated and not settings.hybrid_allow_truncated_sparse:
        logger.info(
            "[STEP] kbsew_hybrid_sparse_skip collection=%s reason=sparse_scroll_cap "
            "candidate_count=%s candidate_limit=%s",
            collection,
            result.candidate_count,
            result.candidate_limit,
        )
        observe_hybrid_sparse_skip("sparse_scroll_cap")
        return None

    if result.truncated and settings.hybrid_allow_truncated_sparse:
        logger.warning(
            "[STEP] kbsew_hybrid_sparse_truncated_used collection=%s candidate_count=%s candidate_limit=%s",
            collection,
            result.candidate_count,
            result.candidate_limit,
        )
        observe_hybrid_sparse_skip("sparse_scroll_cap_allowed")

    return result.texts


async def search_barrel(
    *,
    barrel_id: str,
    query: str,
    limit: int | None = None,
    retrieval_mode: RetrievalMode | str | None = None,
) -> list[str]:
    start = time.perf_counter()
    status = "error"
    settings = get_settings()
    try:
        top_k = limit if limit is not None else settings.search_top_k_clamped
        mode = _resolve_retrieval_mode(retrieval_mode)

        barrel = await barrel_service.get_barrel(barrel_id)
        if barrel is None:
            status = "not_found"
            raise BarrelNotFoundError("Barrel not found")
        if not barrel["enabled"]:
            status = "disabled"
            raise BarrelDisabledError("Barrel disabled")

        freshness = await revision_service.barrel_pipeline_freshness(barrel_id)
        set_stale_assets(int(freshness.get("stale_asset_count") or 0))
        if not freshness.get("pipeline_fresh", True):
            status = "index_stale"
            stale_n = int(freshness.get("stale_asset_count") or 0)
            required = str(freshness.get("required_pipeline_version") or revision_service.PIPELINE_VERSION)
            observe_search_index_stale()
            logger.warning(
                "[STEP] kbsew_search_index_stale barrel_id=%s stale_assets=%s required=%s",
                barrel_id,
                stale_n,
                required,
            )
            raise IndexStaleError(stale_assets=stale_n, required_pipeline=required)

        normalized_query = query.strip()
        if not normalized_query:
            status = "bad_request"
            raise ValueError("Query is empty")

        vectors = await embed_texts([normalized_query])
        if not vectors or not vectors[0]:
            status = "embed_failed"
            raise EmbeddingFailedError("Embedding failed for query")

        collection = str(barrel["qdrant_collection"])
        dense_raw = await _dense_retrieve_raw(
            collection=collection,
            query_vector=vectors[0],
            top_k=top_k,
        )

        if mode != "hybrid":
            status = "ok"
            return finalize_search_chunks(dense_raw, top_k)

        fetch_limit = _search_fetch_limit(top_k)
        sparse_raw = await _sparse_retrieve(
            collection=collection,
            query=normalized_query,
            limit=fetch_limit,
        )
        if sparse_raw is None:
            status = "ok"
            return finalize_search_chunks(dense_raw, top_k)

        merge_k = min(max(len(dense_raw), len(sparse_raw), fetch_limit), 80)
        merged = rrf_merge(dense_raw, sparse_raw, top_k=merge_k)
        status = "ok"
        return finalize_search_chunks(merged, top_k)
    finally:
        observe_search_latency(status=status, seconds=time.perf_counter() - start)
