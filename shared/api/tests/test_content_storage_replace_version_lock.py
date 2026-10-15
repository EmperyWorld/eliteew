# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# AIP Phase 1 — optimistic locking on ContentStorageService.replace_file_content.
# Invariants:
# - expected_version mismatch must raise ContentVersionConflictError (preflight or UPDATE 0 rows).
# Related:
# - api/services/unified_content/content_storage_service.py
# ---

from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

import pytest

from api.schemas.unified_content import Content, ContentType, ProcessingStatus, StorageBackendType, Visibility
from api.services.unified_content.content_storage_service import (
    ContentStorageService,
    ContentVersionConflictError,
    extracted_text_from_file_data,
)


def _sample_content(*, version: int = 1) -> Content:
    cid = UUID("12345678-1234-5678-1234-567812345678")
    uid = UUID("22345678-1234-5678-1234-567812345678")
    now = datetime.now(UTC)
    return Content(
        id=cid,
        user_id=uid,
        name="notes.md",
        title="notes.md",
        description=None,
        sub_type=None,
        word_count=0,
        character_count=0,
        access_level="private",
        is_public=False,
        content_type=ContentType.DOCUMENT,
        file_size=10,
        mime_type="text/markdown",
        storage_backend=StorageBackendType.POSTGRESQL,
        visibility=Visibility.PRIVATE,
        processing_status=ProcessingStatus.COMPLETED,
        version=version,
        original_filename="notes.md",
        created_at=now,
        updated_at=now,
    )


def test_extracted_text_from_markdown_bytes() -> None:
    text = extracted_text_from_file_data(b"# Title\n\nBody", "text/markdown")
    assert text == "# Title\n\nBody"


@pytest.mark.asyncio
async def test_replace_file_content_preflight_version_conflict() -> None:
    service = ContentStorageService(
        db_pool=MagicMock(),
        storage_factory=MagicMock(),
        audit_logger=MagicMock(),
    )
    content = _sample_content(version=2)
    with patch.object(service, "get_content", AsyncMock(return_value=content)):
        with pytest.raises(ContentVersionConflictError) as exc_info:
            await service.replace_file_content(
                content.id,
                str(content.user_id),
                b"new body",
                mime_type="text/markdown",
                expected_version=1,
                preserve_version=False,
            )
    err = exc_info.value
    assert err.expected_version == 1
    assert err.current_version == 2


@pytest.mark.asyncio
async def test_parallel_replace_second_writer_gets_version_conflict() -> None:
    """First writer succeeds at v1; second writer still passes stale read but UPDATE returns 0 rows."""
    service = ContentStorageService(
        db_pool=MagicMock(),
        storage_factory=MagicMock(),
        audit_logger=MagicMock(),
        search_service=None,
    )
    content = _sample_content(version=1)
    db_version = {"value": 1}
    get_calls = {"n": 0}

    async def get_content_side_effect(*_args: object, **_kwargs: object) -> Content:
        get_calls["n"] += 1
        if get_calls["n"] == 3:
            return _sample_content(version=db_version["value"])
        return _sample_content(version=1)

    class FakeBackend:
        def get_backend_name(self) -> str:
            return "postgresql"

        async def store(self, *args: object, **kwargs: object) -> None:
            return None

    service.storage_factory.get_backend = MagicMock(return_value=FakeBackend())

    class FakeTransaction:
        async def __aenter__(self) -> None:
            return None

        async def __aexit__(self, *_exc: object) -> None:
            return None

    update_calls = {"n": 0}

    class FakeConn:
        def transaction(self) -> FakeTransaction:
            return FakeTransaction()

        async def execute(self, query: str, *args: object) -> str:
            if query.strip().startswith("UPDATE unified_content SET"):
                update_calls["n"] += 1
                if update_calls["n"] == 1:
                    db_version["value"] = 2
                    return "UPDATE 1"
                return "UPDATE 0"
            return "OK"

        async def fetchrow(self, query: str, *_args: object) -> SimpleNamespace | None:
            if "SELECT version FROM unified_content" in query:
                return SimpleNamespace(version=db_version["value"])
            return None

        async def __aenter__(self) -> FakeConn:
            return self

        async def __aexit__(self, *_exc: object) -> None:
            return None

    fake_conn = FakeConn()
    fake_pool = MagicMock()
    fake_pool.acquire.return_value = fake_conn
    service.db_pool = fake_pool
    service.audit_logger.log = AsyncMock()
    service._check_quota = AsyncMock()

    with (
        patch.object(service, "get_content", side_effect=get_content_side_effect),
        patch(
            "api.services.unified_content.version_manager.VersionManager.should_create_version",
            new=AsyncMock(return_value=False),
        ),
    ):
        await service.replace_file_content(
            content.id,
            str(content.user_id),
            b"writer-a",
            mime_type="text/markdown",
            expected_version=1,
        )
        with pytest.raises(ContentVersionConflictError) as exc_info:
            await service.replace_file_content(
                content.id,
                str(content.user_id),
                b"writer-b",
                mime_type="text/markdown",
                expected_version=1,
            )
    err = exc_info.value
    assert err.expected_version == 1
    assert err.current_version == 2
