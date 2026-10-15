# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Vector index commit and unchanged-byte skip for KBSEW ingestion workers.
# Invariants:
# - Index commit: reject zero chunks; ingest quality gate (OCR profile for
#   documents; source_code profile skips OCR density for code_* drivers); upsert
#   then prune stale higher chunk_index.
# - Unchanged-byte skip only when active revision pipeline_version == PIPELINE_VERSION.
# - Successful index appends asset_revisions and updates active_revision_id.
# Related:
# - api/services/ingestion_service.py
# - api/services/revision_service.py
# - documentation/product/KBSEW.md
# ---

from __future__ import annotations

import logging
from typing import Any

import api.services.barrel_service as barrel_service
import api.services.revision_service as revision_service
from api.core.config import get_settings
from api.models.chunk import Chunk
from api.services.ingestion_support import job_log, progress
from api.services.qdrant_store import delete_stale_points_after_upsert
from api.services.text_quality import (
    assert_chunks_ingest_quality,
    ingest_quality_profile_for_driver,
)

logger = logging.getLogger(__name__)


async def unchanged_index_skip(
    *,
    asset: dict[str, Any],
    content_sha256: str,
    force_reindex: bool,
) -> int | None:
    """Return prior chunk_count when bytes + pipeline revision are current; else None."""

    if force_reindex:
        return None
    stored = str(asset.get("content_sha256") or "").strip()
    if not content_sha256 or not stored or content_sha256 != stored:
        return None
    if str(asset.get("status") or "") != "indexed":
        return None
    prior = int(asset.get("chunk_count") or 0)
    if prior < 1:
        return None
    asset_id = str(asset.get("id") or "")
    revision = await revision_service.get_active_revision(asset_id) if asset_id else None
    if revision is None:
        logger.info(
            "[STEP] kbsew_ingest_skip_blocked asset_id=%s reason=missing_revision",
            asset_id,
        )
        return None
    pipeline = str(revision.get("pipeline_version") or "").strip()
    if pipeline != revision_service.PIPELINE_VERSION:
        logger.info(
            "[STEP] kbsew_ingest_skip_blocked asset_id=%s reason=stale_pipeline active=%s required=%s",
            asset_id,
            pipeline or "—",
            revision_service.PIPELINE_VERSION,
        )
        return None
    return prior


async def commit_vector_index(
    *,
    driver: Any,
    chunks: list[Chunk],
    barrel_id: str,
    collection: str,
    asset_id: str,
    content_sha256: str | None,
    job_id: str,
    worker_id: str,
    barrel_id_for_log: str,
    trace_id: str | None,
) -> int:
    """Upsert chunks, prune orphans, mark asset indexed. Raises if zero chunks/points."""

    if not chunks:
        raise ValueError("No readable chunks extracted for indexing")
    driver_type = str(getattr(driver, "driver_type", "") or "")
    assert_chunks_ingest_quality(
        [str(chunk.text or "") for chunk in chunks],
        profile=ingest_quality_profile_for_driver(driver_type),
    )
    bind_ctx = getattr(driver, "bind_index_context", None)
    if callable(bind_ctx):
        bind_ctx(collection=collection, asset_id=asset_id)
    await progress(job_id, worker_id=worker_id, progress_pct=80, message="Indexing vectors")
    indexed = await driver.index_to_qdrant(chunks, barrel_id)
    if indexed <= 0:
        raise ValueError("Indexing produced zero Qdrant points")
    await delete_stale_points_after_upsert(
        collection=collection,
        asset_id=asset_id,
        keep_chunk_count=indexed,
    )
    await barrel_service.update_asset(asset_id, status="indexed", chunk_count=indexed, error_message=None)
    await revision_service.record_successful_index(
        asset_id=asset_id,
        content_sha256=content_sha256 or None,
        chunk_count=indexed,
        embed_model=get_settings().llama_embedding_model,
    )
    job_log(
        trace_id=trace_id,
        job_id=job_id,
        asset_id=asset_id,
        barrel_id=barrel_id_for_log,
        stage="done",
        status="completed",
    )
    return indexed
