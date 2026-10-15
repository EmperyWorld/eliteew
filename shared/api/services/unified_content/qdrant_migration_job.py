#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Batch backfill unified_content vectors into Qdrant eliteew_documents via runtime indexer.
# Invariants:
# - Uses index_unified_content_qdrant (multi-chunk, current dim); no legacy documents table.
# Related:
# - api/services/unified_content/unified_content_qdrant_service.py
# - api/services/unified_content/semantic_search_service.py
# ---
"""Qdrant migration job for unified document embeddings."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]

from api.services.unified_content.unified_content_qdrant_service import (
    UNIFIED_CONTENT_QDRANT_COLLECTION,
    index_unified_content_qdrant,
)

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class QdrantMigrationStats:
    exported_rows: int = 0
    indexed_rows: int = 0
    skipped_rows: int = 0
    failed_rows: int = 0

    def as_dict(self) -> dict[str, int | float]:
        return {
            "exported_rows": self.exported_rows,
            "indexed_rows": self.indexed_rows,
            "skipped_rows": self.skipped_rows,
            "failed_rows": self.failed_rows,
            "upserted_rows": self.indexed_rows,
            "embedded_rows": self.indexed_rows,
            "recall_checks": 0,
            "recall_hits": 0,
            "recall_ratio": 0.0,
        }


class UnifiedContentQdrantMigrationJob:
    """Batch re-index unified_content rows into Qdrant."""

    def __init__(self, *, db_pool: asyncpg.Pool) -> None:
        self._db_pool = db_pool

    async def run(
        self,
        *,
        batch_size: int = 100,
        max_rows: int | None = None,
        dry_run: bool = False,
        verify_recall_sample: int = 0,
    ) -> QdrantMigrationStats:
        _ = verify_recall_sample
        stats = QdrantMigrationStats()
        offset = 0
        while True:
            remaining = None if max_rows is None else max_rows - stats.exported_rows
            if remaining is not None and remaining <= 0:
                break
            fetch_limit = batch_size if remaining is None else min(batch_size, remaining)
            rows = await self._fetch_content_ids(offset=offset, limit=fetch_limit)
            if not rows:
                break
            stats.exported_rows += len(rows)
            offset += len(rows)
            if dry_run:
                continue
            for row in rows:
                cid = UUID(str(row["id"]))
                try:
                    ok = await index_unified_content_qdrant(self._db_pool, cid)
                    if ok:
                        stats.indexed_rows += 1
                    else:
                        stats.skipped_rows += 1
                except Exception:
                    logger.exception("Migration index failed for id=%s", cid)
                    stats.failed_rows += 1
        logger.info("Unified-content Qdrant migration stats=%s", stats.as_dict())
        return stats

    async def _fetch_content_ids(self, *, offset: int, limit: int) -> list[dict[str, Any]]:
        async with self._db_pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id
                FROM unified_content
                WHERE deleted_at IS NULL
                  AND COALESCE(extracted_text, '') <> ''
                ORDER BY updated_at ASC NULLS LAST, id ASC
                OFFSET $1 LIMIT $2
                """,
                offset,
                limit,
            )
        return [dict(row) for row in rows]


async def run_unified_content_qdrant_migration(
    *,
    batch_size: int = 100,
    max_rows: int | None = None,
    dry_run: bool = False,
    verify_recall_sample: int = 0,
) -> dict[str, int | float]:
    """Resolve runtime dependencies and execute migration job."""
    from api.core.database_manager import get_database_manager  # noqa: PLC0415

    manager = await get_database_manager()
    db_pool = await manager.get_asyncpg_pool()
    job = UnifiedContentQdrantMigrationJob(db_pool=db_pool)
    stats = await job.run(
        batch_size=batch_size,
        max_rows=max_rows,
        dry_run=dry_run,
        verify_recall_sample=verify_recall_sample,
    )
    return stats.as_dict()


__all__ = [
    "QdrantMigrationStats",
    "UNIFIED_CONTENT_QDRANT_COLLECTION",
    "UnifiedContentQdrantMigrationJob",
    "run_unified_content_qdrant_migration",
]
