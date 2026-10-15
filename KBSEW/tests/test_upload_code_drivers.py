# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lock: multipart upload path accepts code_python (not PDF-only).
# Related:
# - api/services/ingestion_service.py
# - api/drivers/code_python.py
# ---

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest
from api.services import ingestion_index, ingestion_service, revision_service
from api.services.ingestion_service import _guess_upload_content_type, _require_bytes_upload_driver


def test_guess_upload_content_type_by_driver() -> None:
    assert _guess_upload_content_type(filename="a.pdf", driver_type="pdf") == "application/pdf"
    assert "markdown" in _guess_upload_content_type(filename="x.md", driver_type="markdown")
    assert "python" in _guess_upload_content_type(filename="m.py", driver_type="code_python")
    assert "plain" in _guess_upload_content_type(filename="a.tsx", driver_type="code_typescript")


def test_require_bytes_upload_driver_rejects_url_only() -> None:
    class UrlOnly:
        driver_type = "url_only"

        async def validate(self, source_url: str) -> bool:
            return True

    with pytest.raises(ValueError, match="File upload is not supported"):
        _require_bytes_upload_driver(UrlOnly())


@pytest.mark.asyncio
async def test_execute_upload_ingestion_accepts_code_python(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from api.drivers.code_python import CodePythonIngestionDriver

    driver = CodePythonIngestionDriver()
    body = (
        "# EliteEW module for knowledge indexing of Python APIs and services.\n"
        "def search_barrels(query: str) -> list[str]:\n"
        "    return [query]\n"
    ).encode()
    # Pad for ingest quality gate (readable letter ratio).
    body = body + (b"# context line about barrels search and embeddings\n" * 40)

    monkeypatch.setattr(
        ingestion_service.barrel_service,
        "get_barrel",
        AsyncMock(
            return_value={
                "enabled": True,
                "driver_type": "code_python",
                "qdrant_collection": "kbsew_barrel_code",
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
        AsyncMock(return_value={"object_key": "kbsew/a/hash.py", "metadata": {}}),
    )
    monkeypatch.setattr(
        ingestion_service.barrel_service,
        "touch_job_progress",
        AsyncMock(return_value=True),
    )
    monkeypatch.setattr(ingestion_service.barrel_service, "update_asset", AsyncMock())
    monkeypatch.setattr(ingestion_index, "delete_stale_points_after_upsert", AsyncMock())
    monkeypatch.setattr(revision_service, "record_successful_index", AsyncMock(return_value={"id": "rev"}))
    monkeypatch.setattr(
        driver,
        "index_to_qdrant",
        AsyncMock(return_value=1),
    )
    # Bypass quality gate for unit lock on PDF-only removal.
    monkeypatch.setattr(
        ingestion_index,
        "assert_chunks_ingest_quality",
        lambda chunks, **_kwargs: None,
    )

    indexed = await ingestion_service.execute_upload_ingestion(
        barrel_id="barrel-code",
        asset_id="asset-code",
        job_id="job-code",
        source_url="kbsew-upload://barrel-code/hash/mod.py",
        file_data=body,
        filename="shared/api/mod.py",
        driver_type="code_python",
        worker_id="worker-a",
        trace_id="trace-code",
    )
    assert indexed >= 1
