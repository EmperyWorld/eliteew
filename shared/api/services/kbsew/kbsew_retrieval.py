# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# KBSEW vector retrieval with admin settings (chunks_per_barrel, optional rerank, retrieval_mode).
# Invariants:
# - Rerank uses stack2 llama-rerank via rerank_client; on failure keeps Qdrant order.
# - retrieval_mode override (if set) wins over settings.retrieval_mode; else settings; else dense.
# Related:
# - api/services/desktop_chat/kbsew_search_settings.py
# - api/services/kbsew/kbsew_client.py
# ---

from __future__ import annotations

import logging

from api.services.desktop_chat.kbsew_search_settings import (
    KbsewSearchSettings,
    kbsew_vector_fetch_limit,
)
from api.services.kbsew.kbsew_client import KbsewClientError, KbsewServiceUnavailableError, kbsew_search_barrel
from api.services.rerank_client import DEFAULT_RERANK_TIMEOUT_SEC, rerank_by_index

logger = logging.getLogger(__name__)


async def _rerank_string_chunks(*, query: str, chunks: list[str], take: int) -> list[str]:
    if len(chunks) <= 1 or take <= 0:
        return chunks[:take]

    ranked = await rerank_by_index(query, chunks, timeout=DEFAULT_RERANK_TIMEOUT_SEC)
    if ranked is None:
        logger.debug("[STEP] kbsew_rerank_skip reason=unavailable_or_failed take=%s", take)
        return chunks[:take]

    by_score = sorted(ranked, key=lambda item: item[1], reverse=True)
    ordered: list[str] = []
    seen: set[int] = set()
    for idx, _score in by_score:
        if 0 <= idx < len(chunks) and idx not in seen:
            seen.add(idx)
            ordered.append(chunks[idx])
    for index, chunk in enumerate(chunks):
        if index not in seen:
            ordered.append(chunk)
    return ordered[:take]


async def kbsew_search_with_settings(
    *,
    query: str,
    barrel_id: str,
    settings: KbsewSearchSettings,
    retrieval_mode: str | None = None,
    authorization: str | None = None,
) -> list[str]:
    """Vector search in one barrel honoring admin chunk limit and optional rerank."""

    take = settings.chunks_per_barrel
    fetch_limit = kbsew_vector_fetch_limit(settings)
    try:
        chunks = await kbsew_search_barrel(
            query=query,
            barrel_id=barrel_id,
            limit=fetch_limit,
            retrieval_mode=(retrieval_mode or settings.retrieval_mode),
            authorization=authorization,
        )
    except KbsewServiceUnavailableError:
        raise
    except KbsewClientError:
        raise

    if settings.rerank_enabled and len(chunks) > 1:
        return await _rerank_string_chunks(query=query, chunks=chunks, take=take)
    return chunks[:take]
