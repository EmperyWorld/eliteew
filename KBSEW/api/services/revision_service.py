# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Persist KBSEW asset_revisions rows and maintain assets.active_revision_id
# after a successful Qdrant index; expose pipeline freshness for search/worker.
# Invariants:
# - One active pointer per asset (assets.active_revision_id).
# - Revisions are append-only; re-index creates a new revision row.
# - Bump PIPELINE_VERSION whenever text_quality / chunker / sparse payload
#   schema changes — stale assets must reindex before search returns chunks.
# Related:
# - documentation/product/KBSEW.md
# - shared/api/migrations/applied/20260722_01_kbsew_asset_revisions.sql
# ---

from __future__ import annotations

import logging
import uuid
from typing import Any

import asyncpg

from api.core.config import get_settings
from api.core.database import connection

logger = logging.getLogger(__name__)

# Bump on text_quality / chunker / sparse payload contract changes.
# v2: spaced-letter + mid-word glue + ingest quality gate.
# v3: broader OCR line-wrap glue + residual density gate after normalize.
PIPELINE_VERSION = "kbsew-ingest-v3"


def _row_dict(row: asyncpg.Record | None) -> dict[str, Any] | None:
    return dict(row) if row is not None else None


async def create_revision(
    *,
    asset_id: str,
    content_sha256: str,
    chunk_count: int,
    embed_model: str | None = None,
    pipeline_version: str | None = None,
) -> dict[str, Any]:
    """Insert a revision row without activating it."""

    settings = get_settings()
    revision_id = str(uuid.uuid4())
    model = (embed_model or settings.llama_embedding_model or "").strip() or None
    pipeline = (pipeline_version or PIPELINE_VERSION).strip() or PIPELINE_VERSION
    async with connection() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO kbsew.asset_revisions (
                id, asset_id, content_sha256, indexed_at, chunk_count,
                embed_model, pipeline_version
            )
            VALUES ($1::uuid, $2::uuid, $3, now(), $4, $5, $6)
            RETURNING id, asset_id, content_sha256, indexed_at, chunk_count,
                      embed_model, pipeline_version, created_at
            """,
            revision_id,
            asset_id,
            content_sha256,
            int(chunk_count),
            model,
            pipeline,
        )
    assert row is not None
    logger.info(
        "[STEP] kbsew_asset_revision_created asset_id=%s revision_id=%s chunks=%s",
        asset_id,
        revision_id,
        chunk_count,
    )
    return dict(row)


async def set_active_revision(*, asset_id: str, revision_id: str) -> None:
    async with connection() as conn:
        await conn.execute(
            """
            UPDATE kbsew.assets
            SET active_revision_id = $2::uuid, updated_at = now()
            WHERE id = $1::uuid
            """,
            asset_id,
            revision_id,
        )


async def record_successful_index(
    *,
    asset_id: str,
    content_sha256: str | None,
    chunk_count: int,
    embed_model: str | None = None,
    pipeline_version: str | None = None,
) -> dict[str, Any] | None:
    """
    Create a revision and point assets.active_revision_id at it.

    Returns None when content_sha256 is missing (cannot lineage without hash).
    """

    sha = (content_sha256 or "").strip()
    if not sha:
        logger.warning(
            "[STEP] kbsew_asset_revision_skip asset_id=%s reason=missing_content_sha256",
            asset_id,
        )
        return None
    revision = await create_revision(
        asset_id=asset_id,
        content_sha256=sha,
        chunk_count=chunk_count,
        embed_model=embed_model,
        pipeline_version=pipeline_version,
    )
    await set_active_revision(asset_id=asset_id, revision_id=str(revision["id"]))
    return revision


async def get_active_revision(asset_id: str) -> dict[str, Any] | None:
    async with connection() as conn:
        row = await conn.fetchrow(
            """
            SELECT r.id, r.asset_id, r.content_sha256, r.indexed_at, r.chunk_count,
                   r.embed_model, r.pipeline_version, r.created_at
            FROM kbsew.assets a
            JOIN kbsew.asset_revisions r ON r.id = a.active_revision_id
            WHERE a.id = $1::uuid
            """,
            asset_id,
        )
    return _row_dict(row)


async def list_revisions(asset_id: str, *, limit: int = 50) -> list[dict[str, Any]]:
    capped = max(1, min(int(limit), 200))
    async with connection() as conn:
        rows = await conn.fetch(
            """
            SELECT id, asset_id, content_sha256, indexed_at, chunk_count,
                   embed_model, pipeline_version, created_at
            FROM kbsew.asset_revisions
            WHERE asset_id = $1::uuid
            ORDER BY indexed_at DESC
            LIMIT $2
            """,
            asset_id,
            capped,
        )
    return [dict(row) for row in rows]


def revision_pipeline_is_current(pipeline_version: str | None) -> bool:
    return str(pipeline_version or "").strip() == PIPELINE_VERSION


async def count_stale_indexed_assets_for_barrel(barrel_id: str) -> int:
    """Assets whose active revision is missing or not PIPELINE_VERSION.

    Includes pending/running reindex rows so search stays fail-closed while
    auto-heal is in flight (old Qdrant points must not be served).
    """

    async with connection() as conn:
        value = await conn.fetchval(
            """
            SELECT COUNT(*)::int
            FROM kbsew.assets a
            LEFT JOIN kbsew.asset_revisions r ON r.id = a.active_revision_id
            WHERE a.barrel_id = $1::uuid
              AND a.status IN ('indexed', 'pending', 'running')
              AND (
                a.active_revision_id IS NULL
                OR COALESCE(r.pipeline_version, '') <> $2
              )
            """,
            barrel_id,
            PIPELINE_VERSION,
        )
    return int(value or 0)


async def barrel_pipeline_freshness(barrel_id: str) -> dict[str, Any]:
    stale = await count_stale_indexed_assets_for_barrel(barrel_id)
    return {
        "pipeline_fresh": stale == 0,
        "stale_asset_count": stale,
        "required_pipeline_version": PIPELINE_VERSION,
    }


async def list_stale_indexed_assets(*, limit: int = 50) -> list[dict[str, Any]]:
    """Indexed assets needing force-reindex (pending/running already healing)."""

    capped = max(1, min(int(limit), 200))
    async with connection() as conn:
        rows = await conn.fetch(
            """
            SELECT a.id AS asset_id, a.barrel_id, a.status,
                   r.pipeline_version AS active_pipeline_version
            FROM kbsew.assets a
            JOIN kbsew.barrels b ON b.id = a.barrel_id AND b.enabled = true
            LEFT JOIN kbsew.asset_revisions r ON r.id = a.active_revision_id
            WHERE a.status = 'indexed'
              AND (
                a.active_revision_id IS NULL
                OR COALESCE(r.pipeline_version, '') <> $1
              )
            ORDER BY a.updated_at ASC
            LIMIT $2
            """,
            PIPELINE_VERSION,
            capped,
        )
    return [dict(row) for row in rows]
