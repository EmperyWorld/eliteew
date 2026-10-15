# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Batched embedding HTTP client for remote llama embed service (gpu141 / stack2).
# Invariants:
# - Embed requests are chunked (AI_EMBEDDINGS_BATCH_SIZE); response vector count must match input.
# - Vector dimension must equal AI_EMBEDDINGS_DIMENSION before indexing.
# Related:
# - api/services/qdrant_store.py
# - documentation/product/KBSEW.md
# ---

from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx

from api.core.config import get_settings

logger = logging.getLogger(__name__)


def _parse_embedding_payload(payload: Any, *, expected_count: int, expected_dim: int) -> list[list[float]]:
    rows: list[list[float]] | None = None
    if isinstance(payload, dict) and "embeddings" in payload:
        raw = payload["embeddings"]
        if isinstance(raw, list):
            rows = [list(row) for row in raw]
    elif isinstance(payload, dict) and "data" in payload:
        raw = payload["data"]
        if isinstance(raw, list):
            rows = [list(item["embedding"]) for item in raw if isinstance(item, dict) and "embedding" in item]
    if rows is None:
        raise RuntimeError("Unexpected embedding response shape")
    if len(rows) != expected_count:
        raise RuntimeError(
            f"Embedding batch size mismatch: sent={expected_count} got={len(rows)}",
        )
    for index, row in enumerate(rows):
        if len(row) != expected_dim:
            raise RuntimeError(
                f"Embedding dimension mismatch at index {index}: expected={expected_dim} got={len(row)}",
            )
    return rows


async def _request_embeddings_batch(
    client: httpx.AsyncClient,
    *,
    base: str,
    model: str,
    texts: list[str],
) -> list[list[float]]:
    settings = get_settings()
    expected_dim = settings.embedding_dimension
    response = await client.post(
        f"{base}/v1/embeddings",
        json={"input": texts, "model": model},
    )
    if response.status_code == 404:
        response = await client.post(
            f"{base}/api/embed",
            json={"content": texts, "model": model},
        )
    response.raise_for_status()
    return _parse_embedding_payload(
        response.json(),
        expected_count=len(texts),
        expected_dim=expected_dim,
    )


async def _embed_batch_with_retry(
    client: httpx.AsyncClient,
    *,
    base: str,
    model: str,
    texts: list[str],
    batch_index: int,
    batch_total: int,
) -> list[list[float]]:
    settings = get_settings()
    attempts = settings.embed_http_retries_clamped
    last_exc: Exception | None = None
    for attempt in range(attempts):
        try:
            vectors = await _request_embeddings_batch(
                client,
                base=base,
                model=model,
                texts=texts,
            )
            logger.info(
                "[STEP] kbsew_embed_batch_ok batch=%s/%s size=%s",
                batch_index,
                batch_total,
                len(texts),
            )
            return vectors
        except (httpx.HTTPError, RuntimeError, ValueError) as exc:
            last_exc = exc
            if attempt >= attempts - 1:
                break
            delay = min(2.0, 0.2 * (2**attempt))
            logger.warning(
                "[STEP] kbsew_embed_batch_retry batch=%s/%s attempt=%s/%s delay=%.2fs reason=%r",
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


async def embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    settings = get_settings()
    base = settings.llama_embedding_url.rstrip("/")
    model = settings.llama_embedding_model
    batch_size = settings.embed_batch_size_clamped
    timeout = httpx.Timeout(settings.embed_batch_timeout_sec)
    batch_total = (len(texts) + batch_size - 1) // batch_size
    all_vectors: list[list[float]] = []
    async with httpx.AsyncClient(timeout=timeout) as client:
        for batch_index, start in enumerate(range(0, len(texts), batch_size), start=1):
            batch = texts[start : start + batch_size]
            vectors = await _embed_batch_with_retry(
                client,
                base=base,
                model=model,
                texts=batch,
                batch_index=batch_index,
                batch_total=batch_total,
            )
            all_vectors.extend(vectors)
    return all_vectors
