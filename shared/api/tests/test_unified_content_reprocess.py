# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral tests for unified_content reprocess queue helper (ACL + conflict guard).
# Invariants:
# - Write-only in CI agent sessions; run via pytest -k unified_content_reprocess.
# Related:
# - api/services/unified_content/processing_reprocess.py
# ---

from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

import pytest
from fastapi import HTTPException

from api.schemas.unified_content import Content, ContentType, ProcessingStatus, StorageBackendType, Visibility
from api.services.unified_content.processing_reprocess import (
    ContentReprocessConflictError,
    assert_may_reprocess_content,
    http_exception_for_reprocess_error,
    queue_unified_content_reprocess,
)


def _sample_content(*, processing_status: ProcessingStatus = ProcessingStatus.FAILED) -> Content:
    cid = UUID("12345678-1234-5678-1234-567812345678")
    uid = UUID("22345678-1234-5678-1234-567812345678")
    now = datetime.now(UTC)
    return Content(
        id=cid,
        user_id=str(uid),
        name="clip.mp4",
        title=None,
        description=None,
        sub_type=None,
        word_count=0,
        character_count=0,
        access_level="private",
        is_public=False,
        content_type=ContentType.VIDEO,
        file_size=100,
        mime_type="video/mp4",
        storage_backend=StorageBackendType.POSTGRESQL,
        visibility=Visibility.PRIVATE,
        processing_status=processing_status,
        processing_error="ffmpeg timeout",
        can_edit=True,
        version=1,
        tags=[],
        metadata={},
        created_at=now,
        updated_at=now,
    )


def test_assert_may_reprocess_content_rejects_non_editor() -> None:
    item = _sample_content().model_copy(update={"can_edit": False})
    with pytest.raises(PermissionError, match="owner"):
        assert_may_reprocess_content(item)


def test_assert_may_reprocess_content_rejects_in_flight_status() -> None:
    item = _sample_content(processing_status=ProcessingStatus.PROCESSING)
    with pytest.raises(ContentReprocessConflictError, match="already being processed"):
        assert_may_reprocess_content(item)


def test_http_exception_for_reprocess_error_maps_conflict_to_409() -> None:
    exc = http_exception_for_reprocess_error(ContentReprocessConflictError("busy"))
    assert isinstance(exc, HTTPException)
    assert exc.status_code == 409


@pytest.mark.asyncio
async def test_queue_unified_content_reprocess_resets_status_and_enqueues() -> None:
    content = _sample_content()
    conn = AsyncMock()
    conn.execute = AsyncMock()
    acquire_cm = AsyncMock()
    acquire_cm.__aenter__.return_value = conn
    acquire_cm.__aexit__.return_value = None
    db_pool = MagicMock()
    db_pool.acquire.return_value = acquire_cm

    service = MagicMock()
    service.db_pool = db_pool
    service.get_content = AsyncMock(return_value=content)
    service.read_file_bytes_for_owner = AsyncMock(return_value=(b"bytes", {"original_filename": "clip.mp4"}))

    background_tasks = MagicMock()
    bg_fn = AsyncMock()

    with (
        patch(
            "api.services.unified_content.processing_reprocess.is_queue_enabled",
            return_value=False,
        ),
        patch(
            "api.services.cache_service.best_effort_invalidate_after_content_mutation",
            new_callable=AsyncMock,
        ),
    ):
        queued_id = await queue_unified_content_reprocess(
            content_id=content.id,
            content_user_id=str(content.user_id),
            current_user=SimpleNamespace(id=str(content.user_id)),
            service=service,
            background_tasks=background_tasks,
            process_content_background=bg_fn,
        )

    assert queued_id == content.id
    conn.execute.assert_awaited_once()
    assert conn.execute.await_args.args[1] == ProcessingStatus.PENDING.value
    background_tasks.add_task.assert_called_once()
