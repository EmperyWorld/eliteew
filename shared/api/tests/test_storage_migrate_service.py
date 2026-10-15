# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for StorageMigrateService candidate rules, dry-run, migrate verify gate,
# and hard-purge retention boundary.
# Invariants:
# - BYTEA must not be cleared when Seaweed verify fails.
# - Audio below 40MB must not be selected for Seaweed migration.
# Related:
# - api/services/unified_content/storage_migrate_service.py
# ---

from __future__ import annotations

import sys
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest

# Host venv may lack asyncpg/minio; stub before package imports.
sys.modules.setdefault("asyncpg", MagicMock())
sys.modules.setdefault("minio", MagicMock())
sys.modules.setdefault("minio.error", MagicMock())
sys.modules.setdefault("minio.sseconfig", MagicMock())

from api.services.unified_content.storage_backends.factory import StorageBackendFactory  # noqa: E402
from api.services.unified_content.storage_migrate_service import (  # noqa: E402
    StorageMigrateService,
    should_migrate_to_seaweed,
)


def test_should_migrate_non_audio_at_threshold() -> None:
    assert should_migrate_to_seaweed(file_size=StorageBackendFactory.SIZE_THRESHOLD, content_type="document")
    assert not should_migrate_to_seaweed(
        file_size=StorageBackendFactory.SIZE_THRESHOLD - 1,
        content_type="document",
    )


def test_should_migrate_audio_stays_in_pg_below_40mb() -> None:
    assert not should_migrate_to_seaweed(
        file_size=StorageBackendFactory.AUDIO_POSTGRES_MAX_BYTES - 1,
        content_type="audio",
    )
    assert should_migrate_to_seaweed(
        file_size=StorageBackendFactory.AUDIO_POSTGRES_MAX_BYTES,
        content_type="audio",
    )


@pytest.mark.asyncio
async def test_migrate_dry_run_does_not_write() -> None:
    pool = MagicMock()
    factory = MagicMock()
    seaweed = MagicMock()
    seaweed.store = AsyncMock()
    factory.get_backend_by_name.return_value = seaweed
    service = StorageMigrateService(pool, storage_factory=factory)
    cid = uuid4()
    row = {
        "id": cid,
        "content_type": "document",
        "mime_type": "application/pdf",
        "original_filename": "big.pdf",
        "file_size": 2_000_000,
        "bytea_len": 2_000_000,
        "file_data": b"x" * 100,
    }
    with patch.object(service, "_fetch_migrate_candidates", AsyncMock(return_value=[row])):
        result = await service.migrate_pg_blobs_to_seaweed(dry_run=True, limit=10)
    assert result["migrated"] == 1
    assert result["dry_run"] is True
    seaweed.store.assert_not_called()


@pytest.mark.asyncio
async def test_migrate_keeps_bytea_when_verify_fails() -> None:
    pool = MagicMock()
    acquire_cm = MagicMock()
    conn = MagicMock()
    acquire_cm.__aenter__ = AsyncMock(return_value=conn)
    acquire_cm.__aexit__ = AsyncMock(return_value=None)
    pool.acquire = MagicMock(return_value=acquire_cm)
    conn.execute = AsyncMock(return_value="UPDATE 1")

    factory = MagicMock()
    seaweed = MagicMock()
    seaweed.store = AsyncMock(return_value="unified-content/x/file.bin")
    seaweed.exists = AsyncMock(return_value=False)
    factory.get_backend_by_name.return_value = seaweed
    service = StorageMigrateService(pool, storage_factory=factory)

    row_map = {
        "id": UUID("12345678-1234-5678-1234-567812345678"),
        "content_type": "document",
        "mime_type": "application/octet-stream",
        "original_filename": "file.bin",
        "file_size": 2_000_000,
        "bytea_len": 2_000_000,
        "file_data": b"payload-bytes",
    }

    with pytest.raises(RuntimeError, match="not visible"):
        await service._migrate_one_row(row_map)

    conn.execute.assert_not_called()


@pytest.mark.asyncio
async def test_hard_purge_dry_run_counts_only() -> None:
    pool = MagicMock()
    factory = MagicMock()
    service = StorageMigrateService(pool, storage_factory=factory)
    rows = [{"id": uuid4(), "sb": "postgresql", "file_path": None, "deleted_at": None}]
    with patch.object(service, "_fetch_purge_candidates", AsyncMock(return_value=rows)):
        with patch.object(service, "_purge_one_row", AsyncMock()) as purge:
            result = await service.hard_purge_soft_deleted(dry_run=True, limit=10, older_than_days=30)
    assert result["purged"] == 1
    assert result["older_than_days"] == 30
    purge.assert_not_called()


@pytest.mark.asyncio
async def test_hard_purge_days_zero_allowed() -> None:
    pool = MagicMock()
    factory = MagicMock()
    service = StorageMigrateService(pool, storage_factory=factory)
    with patch.object(service, "_fetch_purge_candidates", AsyncMock(return_value=[])) as fetch:
        result = await service.hard_purge_soft_deleted(dry_run=True, limit=10, older_than_days=0)
    assert result["older_than_days"] == 0
    fetch.assert_awaited_once()
    fetch_call = fetch.await_args
    assert fetch_call is not None
    assert fetch_call.kwargs["older_than_days"] == 0


@pytest.mark.asyncio
async def test_hard_purge_apply_deletes_row() -> None:
    pool = MagicMock()
    acquire_cm = MagicMock()
    conn = MagicMock()
    tx = MagicMock()
    tx.__aenter__ = AsyncMock(return_value=None)
    tx.__aexit__ = AsyncMock(return_value=None)
    conn.transaction = MagicMock(return_value=tx)
    conn.execute = AsyncMock(side_effect=["UPDATE 0", "DELETE 1"])
    acquire_cm.__aenter__ = AsyncMock(return_value=conn)
    acquire_cm.__aexit__ = AsyncMock(return_value=None)
    pool.acquire = MagicMock(return_value=acquire_cm)

    factory = MagicMock()
    seaweed = MagicMock()
    seaweed.delete = AsyncMock(return_value=True)
    factory.get_backend_by_name.return_value = seaweed
    service = StorageMigrateService(pool, storage_factory=factory)

    cid = uuid4()
    row = {"id": cid, "sb": "seaweedfs", "file_path": "unified-content/a/b.bin", "deleted_at": None}
    fake_qdrant = MagicMock()
    fake_qdrant.delete_qdrant_chunks_for_content = AsyncMock()
    with patch.dict(
        sys.modules,
        {"api.services.unified_content.unified_content_qdrant_service": fake_qdrant},
    ):
        await service._purge_one_row(row)

    seaweed.delete.assert_awaited_once()
    assert conn.execute.await_count == 2
