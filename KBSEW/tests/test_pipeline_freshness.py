# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for pipeline freshness: unchanged-byte skip blocked on stale
# revision; enqueue helper queues force-reindex for stale assets.
# ---

from __future__ import annotations

from unittest.mock import AsyncMock

import api.services.ingestion_service as ingestion_service
import api.services.revision_service as revision_service
import pytest
from api.services.revision_service import PIPELINE_VERSION


@pytest.mark.asyncio
async def test_unchanged_skip_blocked_when_pipeline_stale(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    asset = {
        "id": "asset-a",
        "content_sha256": "abc",
        "status": "indexed",
        "chunk_count": 12,
    }
    monkeypatch.setattr(
        revision_service,
        "get_active_revision",
        AsyncMock(return_value={"pipeline_version": "kbsew-ingest-v1"}),
    )
    skip = await ingestion_service._unchanged_index_skip(
        asset=asset,
        content_sha256="abc",
        force_reindex=False,
    )
    assert skip is None


@pytest.mark.asyncio
async def test_unchanged_skip_allowed_when_pipeline_current(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    asset = {
        "id": "asset-a",
        "content_sha256": "abc",
        "status": "indexed",
        "chunk_count": 12,
    }
    monkeypatch.setattr(
        revision_service,
        "get_active_revision",
        AsyncMock(return_value={"pipeline_version": PIPELINE_VERSION}),
    )
    skip = await ingestion_service._unchanged_index_skip(
        asset=asset,
        content_sha256="abc",
        force_reindex=False,
    )
    assert skip == 12


@pytest.mark.asyncio
async def test_enqueue_stale_pipeline_reindexes_queues(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        revision_service,
        "list_stale_indexed_assets",
        AsyncMock(
            return_value=[
                {"asset_id": "a1", "barrel_id": "b1"},
                {"asset_id": "a2", "barrel_id": "b1"},
            ]
        ),
    )
    force = AsyncMock(
        side_effect=[
            {"queued": True, "reason": "force_reindex"},
            {"queued": False, "reason": "already_active"},
        ]
    )
    monkeypatch.setattr(ingestion_service, "force_reindex_asset", force)
    result = await ingestion_service.enqueue_stale_pipeline_reindexes(limit=10)
    assert result == {"scanned": 2, "queued": 1, "skipped_active": 1, "failed": 0}
    assert force.await_count == 2
