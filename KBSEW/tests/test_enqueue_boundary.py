# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Enqueue boundary tests: disabled barrel, size cap, active-job reuse via enqueue_job.
# ---

from __future__ import annotations

from collections.abc import Iterator
from unittest.mock import AsyncMock

import api.services.ingestion_service as ingestion_service
import pytest
from api.core.config import get_settings
from api.core.ingest_errors import BarrelDisabledError, IngestPayloadTooLargeError


@pytest.fixture(autouse=True)
def _clear_settings() -> Iterator[None]:
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_start_ingestion_rejects_disabled_barrel(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        ingestion_service.barrel_service,
        "get_barrel",
        AsyncMock(return_value={"id": "barrel-a", "driver_type": "pdf", "enabled": False}),
    )
    with pytest.raises(BarrelDisabledError):
        await ingestion_service.start_ingestion(
            barrel_id="barrel-a",
            source_url="https://example.test/doc.pdf",
            driver_type=None,
        )


@pytest.mark.asyncio
async def test_start_ingestion_upload_rejects_oversize(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("KBSEW_INGEST_MAX_BYTES", "1048576")
    get_settings.cache_clear()
    monkeypatch.setattr(
        ingestion_service.barrel_service,
        "get_barrel",
        AsyncMock(return_value={"id": "barrel-a", "driver_type": "pdf", "enabled": True}),
    )
    with pytest.raises(IngestPayloadTooLargeError):
        await ingestion_service.start_ingestion_upload(
            barrel_id="barrel-a",
            file_data=b"x" * 2_000_000,
            filename="big.pdf",
            driver_type=None,
        )


@pytest.mark.asyncio
async def test_force_reindex_reuses_active_via_enqueue(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    barrel = {"id": "barrel-a", "driver_type": "pdf", "enabled": True}
    asset = {
        "id": "asset-a",
        "barrel_id": "barrel-a",
        "object_key": "kbsew/barrel-a/hash.pdf",
        "source_url": "kbsew-upload://x",
        "content_sha256": "abc",
        "metadata": {"filename": "doc.pdf", "driver_type": "pdf"},
    }
    active = {"id": "job-active", "status": "queued", "message": "Queued"}
    monkeypatch.setattr(ingestion_service.barrel_service, "get_barrel", AsyncMock(return_value=barrel))
    monkeypatch.setattr(ingestion_service.barrel_service, "get_asset", AsyncMock(return_value=asset))
    monkeypatch.setattr(
        ingestion_service.barrel_service,
        "latest_job_for_asset",
        AsyncMock(return_value=active),
    )
    monkeypatch.setattr(ingestion_service.barrel_service, "update_asset", AsyncMock())
    enqueue = AsyncMock(return_value=(active, False))
    monkeypatch.setattr(ingestion_service.barrel_service, "enqueue_job", enqueue)

    result = await ingestion_service.force_reindex_asset(barrel_id="barrel-a", asset_id="asset-a")

    assert result["queued"] is False
    assert result["reason"] == "already_active"
    assert result["job_id"] == "job-active"
    enqueue.assert_awaited_once()
