# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Queue creation and idempotency tests for KBSEW ingestion entrypoints.
# ---

from __future__ import annotations

from unittest.mock import AsyncMock

import api.services.ingestion_index as ingestion_index
import api.services.ingestion_service as ingestion_service
import api.services.revision_service as revision_service
import pytest


@pytest.fixture(autouse=True)
def _allow_example_ingest_urls(monkeypatch: pytest.MonkeyPatch) -> None:
    """URL safety is covered in test_safe_http; queue tests use public example hosts."""

    async def _ok(url: str) -> str:
        return url

    monkeypatch.setattr(ingestion_service, "assert_url_safe_for_ingest", _ok)


@pytest.mark.asyncio
async def test_start_ingestion_upload_persists_object_and_queues_job(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    barrel = {"id": "barrel-a", "driver_type": "pdf", "enabled": True}
    asset = {"id": "asset-a", "status": "pending"}
    job = {"id": "job-a", "status": "queued", "message": "Queued"}
    monkeypatch.setattr(ingestion_service.barrel_service, "get_barrel", AsyncMock(return_value=barrel))
    monkeypatch.setattr(
        ingestion_service.barrel_service,
        "find_asset_by_idempotency_key",
        AsyncMock(return_value=None),
    )
    monkeypatch.setattr(
        ingestion_service.barrel_service,
        "find_asset_by_content_sha256",
        AsyncMock(return_value=None),
    )
    create_asset = AsyncMock(return_value=asset)
    enqueue_job = AsyncMock(return_value=(job, True))
    monkeypatch.setattr(ingestion_service.barrel_service, "create_asset", create_asset)
    monkeypatch.setattr(ingestion_service.barrel_service, "enqueue_job", enqueue_job)
    monkeypatch.setattr(ingestion_service.barrel_service, "update_asset", AsyncMock())
    monkeypatch.setattr(
        ingestion_service.barrel_service,
        "latest_job_for_asset",
        AsyncMock(return_value=None),
    )
    upload = AsyncMock(return_value="kbsew/barrel-a/hash_doc.pdf")
    monkeypatch.setattr(ingestion_service, "upload_bytes", upload)

    result = await ingestion_service.start_ingestion_upload(
        barrel_id="barrel-a",
        file_data=b"%PDF durable upload",
        filename="doc.pdf",
        driver_type=None,
    )

    assert result == {
        "job_id": "job-a",
        "asset_id": "asset-a",
        "status": "queued",
        "message": "Queued",
    }
    upload.assert_awaited_once()
    create_asset.assert_awaited_once()
    assert create_asset.await_args is not None
    create_asset_call = create_asset.await_args
    assert create_asset_call.kwargs["content_sha256"]
    assert create_asset_call.kwargs["idempotency_key"].startswith("upload:")
    enqueue_job.assert_awaited_once()
    assert enqueue_job.await_args is not None
    assert enqueue_job.await_args.kwargs["source_kind"] == "upload"


@pytest.mark.asyncio
async def test_start_ingestion_reuses_active_idempotent_asset(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    barrel = {"id": "barrel-a", "driver_type": "pdf", "enabled": True}
    asset = {"id": "asset-a", "status": "running"}
    latest_job = {"id": "job-a", "status": "running", "message": "Processing"}
    monkeypatch.setattr(ingestion_service.barrel_service, "get_barrel", AsyncMock(return_value=barrel))
    monkeypatch.setattr(
        ingestion_service.barrel_service,
        "find_asset_by_idempotency_key",
        AsyncMock(return_value=asset),
    )
    monkeypatch.setattr(
        ingestion_service.barrel_service,
        "latest_job_for_asset",
        AsyncMock(return_value=latest_job),
    )
    enqueue_job = AsyncMock(return_value=(latest_job, False))
    monkeypatch.setattr(ingestion_service.barrel_service, "enqueue_job", enqueue_job)

    result = await ingestion_service.start_ingestion(
        barrel_id="barrel-a",
        source_url="https://example.test/doc.pdf",
        driver_type=None,
    )

    assert result["job_id"] == "job-a"
    assert result["asset_id"] == "asset-a"
    assert result["status"] == "running"
    enqueue_job.assert_awaited_once()


@pytest.mark.asyncio
async def test_force_reindex_asset_queues_new_job_when_completed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    barrel = {"id": "barrel-a", "driver_type": "pdf", "enabled": True}
    asset = {
        "id": "asset-a",
        "barrel_id": "barrel-a",
        "status": "indexed",
        "object_key": "kbsew/barrel-a/hash_doc.pdf",
        "content_sha256": "abc123",
        "source_url": "kbsew-upload://barrel-a/abc123/doc.pdf",
        "metadata": {"filename": "doc.pdf", "driver_type": "pdf", "enabled": True},
    }
    latest_job = {
        "id": "job-done",
        "status": "completed",
        "message": "Indexed 3 chunks",
    }
    new_job = {"id": "job-reindex", "status": "queued", "message": "Queued"}
    monkeypatch.setattr(ingestion_service.barrel_service, "get_barrel", AsyncMock(return_value=barrel))
    monkeypatch.setattr(ingestion_service.barrel_service, "get_asset", AsyncMock(return_value=asset))
    monkeypatch.setattr(
        ingestion_service.barrel_service,
        "latest_job_for_asset",
        AsyncMock(return_value=latest_job),
    )
    update_asset = AsyncMock()
    enqueue_job = AsyncMock(return_value=(new_job, True))
    monkeypatch.setattr(ingestion_service.barrel_service, "update_asset", update_asset)
    monkeypatch.setattr(ingestion_service.barrel_service, "enqueue_job", enqueue_job)

    result = await ingestion_service.force_reindex_asset(barrel_id="barrel-a", asset_id="asset-a")

    assert result["job_id"] == "job-reindex"
    assert result["queued"] is True
    assert result["reason"] == "force_reindex"
    enqueue_job.assert_awaited_once()
    assert enqueue_job.await_args is not None
    assert enqueue_job.await_args.kwargs["source_kind"] == "upload"
    assert enqueue_job.await_args.kwargs["payload"]["force_reindex"] is True
    update_asset.assert_awaited()


@pytest.mark.asyncio
async def test_force_reindex_asset_skips_when_already_active(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    barrel = {"id": "barrel-a", "driver_type": "pdf", "enabled": True}
    asset = {
        "id": "asset-a",
        "barrel_id": "barrel-a",
        "object_key": "kbsew/barrel-a/hash_doc.pdf",
        "metadata": {},
    }
    latest_job = {"id": "job-run", "status": "running", "message": "Processing"}
    monkeypatch.setattr(ingestion_service.barrel_service, "get_barrel", AsyncMock(return_value=barrel))
    monkeypatch.setattr(ingestion_service.barrel_service, "get_asset", AsyncMock(return_value=asset))
    monkeypatch.setattr(
        ingestion_service.barrel_service,
        "latest_job_for_asset",
        AsyncMock(return_value=latest_job),
    )
    enqueue_job = AsyncMock(return_value=(latest_job, False))
    monkeypatch.setattr(ingestion_service.barrel_service, "enqueue_job", enqueue_job)

    result = await ingestion_service.force_reindex_asset(barrel_id="barrel-a", asset_id="asset-a")

    assert result["job_id"] == "job-run"
    assert result["queued"] is False
    assert result["reason"] == "already_active"
    enqueue_job.assert_awaited_once()


@pytest.mark.asyncio
async def test_force_reindex_barrel_aggregates(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    barrel = {"id": "barrel-a", "driver_type": "pdf", "enabled": True}
    assets = [
        {"id": "asset-1", "barrel_id": "barrel-a"},
        {"id": "asset-2", "barrel_id": "barrel-a"},
    ]
    monkeypatch.setattr(ingestion_service.barrel_service, "get_barrel", AsyncMock(return_value=barrel))
    monkeypatch.setattr(
        ingestion_service.barrel_service,
        "list_assets_for_barrel",
        AsyncMock(return_value=assets),
    )
    force_one = AsyncMock(
        side_effect=[
            {
                "job_id": "j1",
                "asset_id": "asset-1",
                "status": "queued",
                "message": "Queued",
                "queued": True,
                "reason": "force_reindex",
            },
            {
                "job_id": "j2",
                "asset_id": "asset-2",
                "status": "running",
                "message": "Processing",
                "queued": False,
                "reason": "already_active",
            },
        ]
    )
    monkeypatch.setattr(ingestion_service, "force_reindex_asset", force_one)

    result = await ingestion_service.force_reindex_barrel(barrel_id="barrel-a")

    assert result["queued"] == 1
    assert result["skipped_active"] == 1
    assert result["failed"] == 0
    assert len(result["jobs"]) == 2
    assert force_one.await_count == 2


@pytest.mark.asyncio
async def test_start_ingestion_upload_completed_is_idempotent(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    file_data = b"%PDF same bytes again"
    content_sha256 = ingestion_service._sha256_hex(file_data)
    barrel = {"id": "barrel-a", "driver_type": "pdf", "enabled": True}
    asset = {
        "id": "asset-a",
        "status": "indexed",
        "object_key": "kbsew/barrel-a/hash_doc.pdf",
        "content_sha256": content_sha256,
    }
    latest_job = {
        "id": "job-done",
        "status": "completed",
        "message": "Indexed 3 chunks",
    }
    monkeypatch.setattr(ingestion_service.barrel_service, "get_barrel", AsyncMock(return_value=barrel))
    monkeypatch.setattr(
        ingestion_service,
        "_resolve_existing_upload_asset",
        AsyncMock(return_value=asset),
    )
    monkeypatch.setattr(
        ingestion_service.barrel_service,
        "latest_job_for_asset",
        AsyncMock(return_value=latest_job),
    )
    enqueue_job = AsyncMock()
    monkeypatch.setattr(ingestion_service.barrel_service, "enqueue_job", enqueue_job)

    result = await ingestion_service.start_ingestion_upload(
        barrel_id="barrel-a",
        file_data=file_data,
        filename="doc.pdf",
        driver_type=None,
    )

    assert result["job_id"] == "job-done"
    assert result["status"] == "completed"
    enqueue_job.assert_not_awaited()


@pytest.mark.asyncio
async def test_start_ingestion_url_completed_without_digest_requeues(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """URL completed jobs must requeue when request has no content_sha256 (origin may drift)."""

    barrel = {"id": "barrel-a", "driver_type": "pdf", "enabled": True}
    asset = {
        "id": "asset-a",
        "status": "indexed",
        "content_sha256": "old-digest",
        "source_url": "https://example.test/doc.pdf",
    }
    latest_job = {"id": "job-old", "status": "completed", "message": "Indexed 2 chunks"}
    monkeypatch.setattr(ingestion_service.barrel_service, "get_barrel", AsyncMock(return_value=barrel))
    monkeypatch.setattr(
        ingestion_service.barrel_service,
        "find_asset_by_idempotency_key",
        AsyncMock(return_value=asset),
    )
    monkeypatch.setattr(
        ingestion_service.barrel_service,
        "latest_job_for_asset",
        AsyncMock(return_value=latest_job),
    )
    update_asset = AsyncMock()
    enqueue_job = AsyncMock(return_value=({"id": "job-new", "status": "queued", "message": "Queued"}, True))
    monkeypatch.setattr(ingestion_service.barrel_service, "update_asset", update_asset)
    monkeypatch.setattr(ingestion_service.barrel_service, "enqueue_job", enqueue_job)

    result = await ingestion_service.start_ingestion(
        barrel_id="barrel-a",
        source_url="https://example.test/doc.pdf",
        driver_type=None,
    )

    assert result["job_id"] == "job-new"
    assert result["status"] == "queued"
    enqueue_job.assert_awaited_once()


@pytest.mark.asyncio
async def test_start_ingestion_upload_failed_is_requeued(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    barrel = {"id": "barrel-a", "driver_type": "pdf", "enabled": True}
    asset = {
        "id": "asset-a",
        "status": "failed",
        "object_key": "kbsew/barrel-a/hash_doc.pdf",
        "content_sha256": "x",
        "metadata": {},
    }
    latest_job = {"id": "job-old", "status": "failed", "message": "boom"}
    new_job = {"id": "job-new", "status": "queued", "message": "Queued"}
    monkeypatch.setattr(ingestion_service.barrel_service, "get_barrel", AsyncMock(return_value=barrel))
    monkeypatch.setattr(
        ingestion_service,
        "_resolve_existing_upload_asset",
        AsyncMock(return_value=asset),
    )
    monkeypatch.setattr(
        ingestion_service.barrel_service,
        "latest_job_for_asset",
        AsyncMock(return_value=latest_job),
    )
    update_asset = AsyncMock()
    enqueue_job = AsyncMock(return_value=(new_job, True))
    monkeypatch.setattr(ingestion_service.barrel_service, "update_asset", update_asset)
    monkeypatch.setattr(ingestion_service.barrel_service, "enqueue_job", enqueue_job)

    result = await ingestion_service.start_ingestion_upload(
        barrel_id="barrel-a",
        file_data=b"%PDF retry failed asset",
        filename="doc.pdf",
        driver_type=None,
    )

    assert result == {
        "job_id": "job-new",
        "asset_id": "asset-a",
        "status": "queued",
        "message": "Queued",
    }
    update_asset.assert_awaited()
    enqueue_job.assert_awaited_once()
    assert enqueue_job.await_args is not None
    assert enqueue_job.await_args.kwargs["asset_id"] == "asset-a"


@pytest.mark.asyncio
async def test_resolve_existing_upload_asset_falls_back_to_content_sha(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    legacy = {
        "id": "asset-legacy",
        "content_sha256": "abc",
        "idempotency_key": None,
    }
    monkeypatch.setattr(
        ingestion_service.barrel_service,
        "find_asset_by_idempotency_key",
        AsyncMock(return_value=None),
    )
    monkeypatch.setattr(
        ingestion_service.barrel_service,
        "find_asset_by_content_sha256",
        AsyncMock(return_value=legacy),
    )
    update_asset = AsyncMock()
    get_asset = AsyncMock(return_value={**legacy, "idempotency_key": "upload:abc"})
    monkeypatch.setattr(ingestion_service.barrel_service, "update_asset", update_asset)
    monkeypatch.setattr(ingestion_service.barrel_service, "get_asset", get_asset)

    found = await ingestion_service._resolve_existing_upload_asset(
        barrel_id="barrel-a",
        content_sha256="abc",
        idempotency_key="upload:abc",
    )

    assert found is not None
    assert found["id"] == "asset-legacy"
    update_asset.assert_awaited_once()
    assert update_asset.await_args is not None
    assert update_asset.await_args.kwargs["idempotency_key"] == "upload:abc"


@pytest.mark.asyncio
async def test_execute_persisted_job_accepts_str_jsonb_payload(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """asyncpg may return jsonb as str when no codec is registered."""

    asset = {
        "id": "asset-a",
        "source_url": "kbsew-upload://barrel-a/hash/doc.pdf",
        "object_key": "kbsew/barrel-a/hash_doc.pdf",
        "metadata": '{"filename": "doc.pdf", "object_key": "kbsew/barrel-a/hash_doc.pdf"}',
    }
    job = {
        "id": "job-a",
        "barrel_id": "barrel-a",
        "asset_id": "asset-a",
        "source_kind": "upload",
        "driver_type": "pdf",
        "trace_id": "trace-a",
        "locked_by": "worker-a",
        "payload": (
            '{"source_url": "kbsew-upload://barrel-a/hash/doc.pdf",'
            ' "filename": "doc.pdf",'
            ' "object_key": "kbsew/barrel-a/hash_doc.pdf",'
            ' "driver_type": "pdf"}'
        ),
    }
    monkeypatch.setattr(
        ingestion_service.barrel_service,
        "get_asset",
        AsyncMock(return_value=asset),
    )
    download = AsyncMock(return_value=b"%PDF stored")
    execute_upload = AsyncMock(return_value=3)
    monkeypatch.setattr(ingestion_service, "download_bytes", download)
    monkeypatch.setattr(ingestion_service, "execute_upload_ingestion", execute_upload)

    indexed = await ingestion_service.execute_persisted_job(job)

    assert indexed == 3
    download.assert_awaited_once_with("kbsew/barrel-a/hash_doc.pdf")
    execute_upload.assert_awaited_once()
    assert execute_upload.await_args is not None
    assert execute_upload.await_args.kwargs["filename"] == "doc.pdf"
    assert execute_upload.await_args.kwargs["file_data"] == b"%PDF stored"


@pytest.mark.asyncio
async def test_execute_persisted_job_str_payload_url_path(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    asset = {
        "id": "asset-b",
        "source_url": "https://example.test/doc.pdf",
        "metadata": "{}",
    }
    job = {
        "id": "job-b",
        "barrel_id": "barrel-b",
        "asset_id": "asset-b",
        "source_kind": "url",
        "driver_type": "pdf",
        "trace_id": "trace-b",
        "locked_by": "worker-b",
        "payload": '{"source_url": "https://example.test/doc.pdf", "driver_type": "pdf"}',
    }
    monkeypatch.setattr(
        ingestion_service.barrel_service,
        "get_asset",
        AsyncMock(return_value=asset),
    )
    execute_url = AsyncMock(return_value=2)
    monkeypatch.setattr(ingestion_service, "execute_url_ingestion", execute_url)

    indexed = await ingestion_service.execute_persisted_job(job)

    assert indexed == 2
    execute_url.assert_awaited_once()
    assert execute_url.await_args is not None
    assert execute_url.await_args.kwargs["source_url"] == "https://example.test/doc.pdf"


@pytest.mark.asyncio
async def test_start_ingestion_upload_failed_requeue_with_str_metadata(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    barrel = {"id": "barrel-a", "driver_type": "pdf", "enabled": True}
    asset = {
        "id": "asset-a",
        "status": "failed",
        "object_key": "kbsew/barrel-a/hash_doc.pdf",
        "content_sha256": "x",
        "metadata": '{"source_kind": "upload", "filename": "doc.pdf"}',
    }
    latest_job = {"id": "job-old", "status": "failed", "message": "boom"}
    new_job = {"id": "job-new", "status": "queued", "message": "Queued"}
    monkeypatch.setattr(ingestion_service.barrel_service, "get_barrel", AsyncMock(return_value=barrel))
    monkeypatch.setattr(
        ingestion_service,
        "_resolve_existing_upload_asset",
        AsyncMock(return_value=asset),
    )
    monkeypatch.setattr(
        ingestion_service.barrel_service,
        "latest_job_for_asset",
        AsyncMock(return_value=latest_job),
    )
    update_asset = AsyncMock()
    enqueue_job = AsyncMock(return_value=(new_job, True))
    monkeypatch.setattr(ingestion_service.barrel_service, "update_asset", update_asset)
    monkeypatch.setattr(ingestion_service.barrel_service, "enqueue_job", enqueue_job)

    result = await ingestion_service.start_ingestion_upload(
        barrel_id="barrel-a",
        file_data=b"%PDF retry failed asset with str metadata",
        filename="doc.pdf",
        driver_type=None,
    )

    assert result["job_id"] == "job-new"
    enqueue_job.assert_awaited_once()


@pytest.mark.asyncio
async def test_execute_url_ingestion_reuses_stored_object_without_source_validate(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from api.models.chunk import Chunk

    driver = object.__new__(ingestion_service.PDFIngestionDriver)
    driver.validate = AsyncMock(return_value=False)
    driver.process_and_chunk = AsyncMock()
    driver.process_and_chunk_bytes = AsyncMock(
        return_value=[
            Chunk(
                text=(
                    "Бренд — это обещание качества и набор ассоциаций вокруг товара на рынке. "
                    "Компания строит узнаваемость через последовательную коммуникацию."
                ),
                chunk_index=0,
            )
        ]
    )
    driver.index_to_qdrant = AsyncMock(return_value=1)
    driver.extract_metadata = AsyncMock()
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
        AsyncMock(
            return_value={
                "object_key": "kbsew/barrel/hash_doc.pdf",
                "metadata": {
                    "filename": "doc.pdf",
                    "object_key": "kbsew/barrel/hash_doc.pdf",
                },
            }
        ),
    )
    monkeypatch.setattr(
        ingestion_service.barrel_service,
        "touch_job_progress",
        AsyncMock(return_value=True),
    )
    monkeypatch.setattr(ingestion_service.barrel_service, "update_asset", AsyncMock())
    monkeypatch.setattr(ingestion_service, "download_bytes", AsyncMock(return_value=b"%PDF stored"))
    prune = AsyncMock()
    monkeypatch.setattr(ingestion_index, "delete_stale_points_after_upsert", prune)
    monkeypatch.setattr(
        revision_service,
        "record_successful_index",
        AsyncMock(return_value=None),
    )

    indexed = await ingestion_service.execute_url_ingestion(
        barrel_id="barrel-a",
        asset_id="asset-a",
        job_id="job-a",
        source_url="https://offline.example/doc.pdf",
        driver_type="pdf",
        worker_id="worker-a",
        trace_id="trace-a",
    )

    assert indexed == 1
    driver.validate.assert_not_awaited()
    driver.extract_metadata.assert_not_awaited()
    driver.process_and_chunk_bytes.assert_awaited_once()
    prune.assert_awaited_once()
    assert prune.await_args is not None
    assert prune.await_args.kwargs["keep_chunk_count"] == 1
    # Upsert before prune — never wipe-first.
    driver.index_to_qdrant.assert_awaited_once()


@pytest.mark.asyncio
async def test_execute_url_ingestion_rejects_zero_readable_chunks(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    driver = object.__new__(ingestion_service.PDFIngestionDriver)
    driver.validate = AsyncMock(return_value=False)
    driver.process_and_chunk_bytes = AsyncMock(return_value=[])
    driver.index_to_qdrant = AsyncMock(return_value=0)
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
        AsyncMock(
            return_value={
                "object_key": "kbsew/barrel/hash_doc.pdf",
                "metadata": {"filename": "doc.pdf"},
            }
        ),
    )
    monkeypatch.setattr(
        ingestion_service.barrel_service,
        "touch_job_progress",
        AsyncMock(return_value=True),
    )
    monkeypatch.setattr(ingestion_service.barrel_service, "update_asset", AsyncMock())
    monkeypatch.setattr(ingestion_service, "download_bytes", AsyncMock(return_value=b"%PDF empty"))
    prune = AsyncMock()
    monkeypatch.setattr(ingestion_index, "delete_stale_points_after_upsert", prune)

    with pytest.raises(ValueError, match="No readable chunks"):
        await ingestion_service.execute_url_ingestion(
            barrel_id="barrel-a",
            asset_id="asset-a",
            job_id="job-a",
            source_url="https://offline.example/doc.pdf",
            driver_type="pdf",
            worker_id="worker-a",
        )

    driver.index_to_qdrant.assert_not_awaited()
    prune.assert_not_awaited()
