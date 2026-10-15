# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Утилиты для одноименных Qdrant-коллекций с cosine: создание и согласование размерности вектора с текущим embedder.
# Invariants:
# - Production collections are never deleted automatically on vector dim mismatch; explicit migration/alias cutover is required.
# - Если схема коллекции не позволяет прочитать size, коллекция не трогается.
# Related:
# - api.core.qdrant_defaults
# - api.services.chat_memory_service (EMBEDDING_DIMENSION)
# ---
"""Qdrant: ensure single-vector cosine collections match configured embedding size."""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


def _single_vector_size_from_collection_info(info: Any) -> int | None:
    """Return vector size for a default (unnamed) vector config, or first named vector."""
    params = getattr(getattr(info, "config", None), "params", None)
    if params is None:
        return None
    vecs = getattr(params, "vectors", None)
    if vecs is None:
        return None
    size = getattr(vecs, "size", None)
    if size is not None:
        return int(size)
    if isinstance(vecs, dict):
        for v in vecs.values():
            s = getattr(v, "size", None)
            if s is not None:
                return int(s)
    return None


async def ensure_cosine_vector_collection(
    client: Any,
    *,
    collection_name: str,
    vector_size: int,
    indexing_threshold: int,
    log_step: str,
) -> bool:
    """
    Create collection if missing; if it exists with a different dim, fail closed and require explicit migration.
    """
    try:
        from qdrant_client.models import Distance, OptimizersConfigDiff, VectorParams

        exists = await client.collection_exists(collection_name)
        if exists:
            coll_info = await client.get_collection(collection_name=collection_name)
            got = _single_vector_size_from_collection_info(coll_info)
            if got is not None and got != vector_size:
                logger.error(
                    "%s qdrant vector dim mismatch collection=%s expected=%s got=%s — explicit migration required",
                    log_step,
                    collection_name,
                    vector_size,
                    got,
                )
                return False
            elif got == vector_size:
                return True
            else:
                # Cannot read size; keep existing collection (same as legacy short-circuit).
                return True
        if not exists:
            await client.create_collection(
                collection_name=collection_name,
                vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE),
                optimizers_config=OptimizersConfigDiff(indexing_threshold=indexing_threshold),
            )
            logger.info("%s collection created name=%s dim=%s", log_step, collection_name, vector_size)
        return True
    except Exception as e:
        logger.warning("%s ensure collection failed name=%s: %s", log_step, collection_name, e)
        return False
