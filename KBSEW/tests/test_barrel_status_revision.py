# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for barrel list/status revision summary + job monitor fields.
# ---

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID

import pytest

import api.services.barrel_service as barrel_service
from api.schemas.barrels import BarrelResponse, BarrelStatusResponse
from api.services.barrel_revision_api import (
    revision_badge_label,
    revision_summary_fields,
)


def test_revision_badge_prefers_sha_prefix() -> None:
    assert revision_badge_label("abcdef1234567890", "rev-uuid") == "abcdef123456"
    assert revision_badge_label(None, "12345678-aaaa") == "12345678"
    assert revision_badge_label(None, None) is None
    assert revision_badge_label("  ", None) is None


def test_revision_summary_fields_null_and_mapped() -> None:
    assert revision_summary_fields(None) == {
        "revision": None,
        "active_revision_id": None,
        "revision_indexed_at": None,
        "revision_chunk_count": None,
    }
    indexed = datetime(2026, 7, 22, tzinfo=timezone.utc)
    out = revision_summary_fields(
        {
            "id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
            "content_sha256": "deadbeefcafebabe01234567",
            "indexed_at": indexed,
            "chunk_count": 12,
        }
    )
    assert out["revision"] == "deadbeefcafe"
    assert out["active_revision_id"] == "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
    assert out["revision_indexed_at"] == indexed
    assert out["revision_chunk_count"] == 12


def test_barrel_status_schema_exposes_revision_fields() -> None:
    rid = UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
    indexed = datetime(2026, 7, 22, 1, 2, 3, tzinfo=timezone.utc)
    model = BarrelStatusResponse(
        barrel_id=UUID("11111111-2222-3333-4444-555555555555"),
        name="docs",
        enabled=True,
        driver_type="pdf",
        asset_count=1,
        assets_by_status={"completed": 1},
        active_jobs=[],
        qdrant_collection="kbsew_barrel_x",
        revision="deadbeefcafe",
        active_revision_id=rid,
        revision_indexed_at=indexed,
        revision_chunk_count=12,
    )
    payload = model.model_dump(mode="json")
    assert payload["revision"] == "deadbeefcafe"
    assert payload["active_revision_id"] == str(rid)
    assert payload["revision_chunk_count"] == 12
    assert "revision_indexed_at" in payload
    assert payload["completed_jobs"] == []


def test_barrel_list_schema_optional_revision_defaults_null() -> None:
    model = BarrelResponse(
        id=UUID("11111111-2222-3333-4444-555555555555"),
        name="empty",
        description=None,
        driver_type="pdf",
        enabled=True,
        qdrant_collection="kbsew_barrel_x",
        asset_count=0,
        created_at=datetime(2026, 7, 22, tzinfo=timezone.utc),
        updated_at=datetime(2026, 7, 22, tzinfo=timezone.utc),
    )
    payload = model.model_dump(mode="json")
    assert payload["revision"] is None
    assert payload["active_revision_id"] is None


@pytest.mark.asyncio
async def test_get_barrel_status_attaches_latest_active_revision(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    barrel_id = "11111111-2222-3333-4444-555555555555"
    rev_id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
    indexed = datetime(2026, 7, 22, tzinfo=timezone.utc)
    monkeypatch.setattr(
        barrel_service,
        "get_barrel",
        AsyncMock(
            return_value={
                "id": barrel_id,
                "name": "docs",
                "enabled": True,
                "driver_type": "pdf",
                "asset_count": 1,
                "qdrant_collection": "kbsew_barrel_x",
            }
        ),
    )

    status_rows = [{"status": "completed", "cnt": 1}]
    jobs: list[dict] = []
    completed: list[dict] = []
    rev_row = {
        "active_revision_id": rev_id,
        "content_sha256": "deadbeefcafebabe01234567",
        "indexed_at": indexed,
        "chunk_count": 4,
    }

    conn = MagicMock()
    conn.fetch = AsyncMock(side_effect=[status_rows, jobs, completed])
    conn.fetchrow = AsyncMock(return_value=rev_row)
    conn.__aenter__ = AsyncMock(return_value=conn)
    conn.__aexit__ = AsyncMock(return_value=None)
    monkeypatch.setattr(barrel_service, "connection", lambda: conn)
    monkeypatch.setattr(
        barrel_service,
        "_row_dict",
        lambda row: None if row is None else dict(row),
    )
    monkeypatch.setattr(
        barrel_service,
        "_record_to_dict",
        lambda row: dict(row),
    )

    status = await barrel_service.get_barrel_status(barrel_id)
    assert status is not None
    assert status["revision"] == "deadbeefcafe"
    assert status["active_revision_id"] == rev_id
    assert status["revision_chunk_count"] == 4
    assert status["revision_indexed_at"] == indexed
    assert status["assets_by_status"] == {"completed": 1}
    assert status["active_jobs"] == []
    assert status["completed_jobs"] == []


@pytest.mark.asyncio
async def test_get_barrel_status_jobs_include_trace_id_and_completed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    barrel_id = "11111111-2222-3333-4444-555555555555"

    job_active_id = "22222222-3333-4444-5555-666666666666"
    job_done_id = "33333333-4444-5555-6666-777777777777"
    asset_id = "44444444-5555-6666-7777-888888888888"
    updated = datetime(2026, 7, 22, 3, 0, 0, tzinfo=timezone.utc)
    monkeypatch.setattr(
        barrel_service,
        "get_barrel",
        AsyncMock(
            return_value={
                "id": barrel_id,
                "name": "docs",
                "enabled": True,
                "driver_type": "pdf",
                "asset_count": 1,
                "qdrant_collection": "kbsew_barrel_x",
            }
        ),
    )
    status_rows = [{"status": "processing", "cnt": 1}]
    jobs = [
        {
            "id": job_active_id,
            "asset_id": asset_id,
            "status": "running",
            "progress_pct": 40,
            "message": "embedding",
            "updated_at": updated,
            "trace_id": "trace-active-01",
            "driver_type": "pdf",
        }
    ]
    completed = [
        {
            "id": job_done_id,
            "asset_id": asset_id,
            "status": "completed",
            "progress_pct": 100,
            "message": "ok",
            "updated_at": updated,
            "trace_id": "trace-done-01",
            "driver_type": "pdf",
        }
    ]
    conn = MagicMock()
    conn.fetch = AsyncMock(side_effect=[status_rows, jobs, completed])
    conn.fetchrow = AsyncMock(return_value=None)
    conn.__aenter__ = AsyncMock(return_value=conn)
    conn.__aexit__ = AsyncMock(return_value=None)
    monkeypatch.setattr(barrel_service, "connection", lambda: conn)
    monkeypatch.setattr(
        barrel_service,
        "_row_dict",
        lambda row: None if row is None else dict(row),
    )
    monkeypatch.setattr(
        barrel_service,
        "_record_to_dict",
        lambda row: dict(row),
    )

    status = await barrel_service.get_barrel_status(barrel_id)
    assert status is not None
    assert status["active_jobs"][0]["trace_id"] == "trace-active-01"
    assert status["completed_jobs"][0]["trace_id"] == "trace-done-01"
    assert status["completed_jobs"][0]["status"] == "completed"

    model = BarrelStatusResponse(
        barrel_id=UUID(barrel_id),
        name="docs",
        enabled=True,
        driver_type="pdf",
        asset_count=1,
        assets_by_status={"processing": 1},
        active_jobs=status["active_jobs"],
        completed_jobs=status["completed_jobs"],
        qdrant_collection="kbsew_barrel_x",
    )
    payload = model.model_dump(mode="json")
    assert payload["active_jobs"][0]["trace_id"] == "trace-active-01"
    assert payload["completed_jobs"][0]["id"] == job_done_id
    assert payload["completed_jobs"][0]["message"] == "ok"
