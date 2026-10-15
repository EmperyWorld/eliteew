# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for kbsew.asset_revisions create/activate API.
# ---

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import api.services.ingestion_index as ingestion_index
import api.services.ingestion_service as ingestion_service
import api.services.revision_service as revision_service
import pytest
from api.models.chunk import Chunk


@pytest.mark.asyncio
async def test_record_successful_index_creates_and_activates(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    created = {
        "id": "rev-1",
        "asset_id": "asset-a",
        "content_sha256": "abc123",
        "chunk_count": 7,
        "embed_model": "nomic-embed-text:latest",
        "pipeline_version": revision_service.PIPELINE_VERSION,
    }
    create = AsyncMock(return_value=created)
    activate = AsyncMock()
    monkeypatch.setattr(revision_service, "create_revision", create)
    monkeypatch.setattr(revision_service, "set_active_revision", activate)

    result = await revision_service.record_successful_index(
        asset_id="asset-a",
        content_sha256="abc123",
        chunk_count=7,
        embed_model="nomic-embed-text:latest",
    )

    assert result == created
    create.assert_awaited_once()
    assert create.await_args is not None
    create_call = create.await_args
    assert create_call.kwargs["content_sha256"] == "abc123"
    assert create_call.kwargs["chunk_count"] == 7
    activate.assert_awaited_once_with(asset_id="asset-a", revision_id="rev-1")


@pytest.mark.asyncio
async def test_record_successful_index_skips_without_sha(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    create = AsyncMock()
    monkeypatch.setattr(revision_service, "create_revision", create)

    result = await revision_service.record_successful_index(
        asset_id="asset-a",
        content_sha256=None,
        chunk_count=3,
    )

    assert result is None
    create.assert_not_awaited()


@pytest.mark.asyncio
async def test_execute_upload_ingestion_records_revision(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    driver = object.__new__(ingestion_service.PDFIngestionDriver)
    driver.validate_bytes = AsyncMock(return_value=True)
    driver.extract_metadata_bytes = AsyncMock(return_value={"title": "t"})
    readable_a = (
        "Бренд — это обещание качества и набор ассоциаций вокруг товара на рынке. "
        "Компания строит узнаваемость через последовательную коммуникацию."
    )
    readable_b = (
        "Позиционирование описывает место продукта среди конкурентов и целевую аудиторию. "
        "Это отдельный управленческий контур от визуальной айдентики бренда."
    )
    driver.process_and_chunk_bytes = AsyncMock(
        return_value=[
            Chunk(text=readable_a, chunk_index=0),
            Chunk(text=readable_b, chunk_index=1),
        ]
    )
    driver.index_to_qdrant = AsyncMock(return_value=2)
    driver.bind_index_context = lambda *, collection, asset_id: None
    monkeypatch.setattr(
        ingestion_service.barrel_service,
        "get_barrel",
        AsyncMock(
            return_value={
                "enabled": True,
                "driver_type": "pdf",
                "qdrant_collection": "kbsew_barrel_test",
            }
        ),
    )
    monkeypatch.setattr(
        ingestion_service.barrel_service,
        "resolve_driver",
        lambda _driver_type, _barrel_driver: driver,
    )
    monkeypatch.setattr(
        ingestion_service.barrel_service,
        "get_asset",
        AsyncMock(return_value={"object_key": "kbsew/a/hash.pdf", "metadata": {}}),
    )
    monkeypatch.setattr(
        ingestion_service.barrel_service,
        "touch_job_progress",
        AsyncMock(return_value=True),
    )
    monkeypatch.setattr(ingestion_service.barrel_service, "update_asset", AsyncMock())
    monkeypatch.setattr(ingestion_index, "delete_stale_points_after_upsert", AsyncMock())
    record = AsyncMock(return_value={"id": "rev-x"})
    monkeypatch.setattr(revision_service, "record_successful_index", record)

    indexed = await ingestion_service.execute_upload_ingestion(
        barrel_id="barrel-a",
        asset_id="asset-a",
        job_id="job-a",
        source_url="kbsew-upload://barrel-a/hash/doc.pdf",
        file_data=b"%PDF revision wire",
        filename="doc.pdf",
        driver_type="pdf",
        worker_id="worker-a",
        trace_id="trace-a",
    )

    assert indexed == 2
    record.assert_awaited_once()
    assert record.await_args is not None
    record_call = record.await_args
    assert record_call.kwargs["asset_id"] == "asset-a"
    assert record_call.kwargs["chunk_count"] == 2
    assert record_call.kwargs["content_sha256"]


@pytest.mark.asyncio
async def test_create_revision_sql_shape(monkeypatch: pytest.MonkeyPatch) -> None:
    row = {
        "id": "rev-2",
        "asset_id": "asset-b",
        "content_sha256": "deadbeef",
        "chunk_count": 1,
        "embed_model": "model-x",
        "pipeline_version": revision_service.PIPELINE_VERSION,
        "indexed_at": "now",
        "created_at": "now",
    }
    conn = AsyncMock()
    conn.fetchrow = AsyncMock(return_value=row)
    ctx = MagicMock()
    ctx.__aenter__ = AsyncMock(return_value=conn)
    ctx.__aexit__ = AsyncMock(return_value=None)
    monkeypatch.setattr(revision_service, "connection", lambda: ctx)
    monkeypatch.setattr(
        revision_service,
        "get_settings",
        lambda: MagicMock(llama_embedding_model="model-x"),
    )

    result = await revision_service.create_revision(
        asset_id="asset-b",
        content_sha256="deadbeef",
        chunk_count=1,
    )

    assert result["id"] == "rev-2"
    assert conn.fetchrow.await_args is not None
    sql = conn.fetchrow.await_args.args[0]
    assert "INSERT INTO kbsew.asset_revisions" in sql
    assert "content_sha256" in sql
    assert "embed_model" in sql
    assert "pipeline_version" in sql
