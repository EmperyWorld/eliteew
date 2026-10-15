# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lock: ``replace_file_content`` snapshots previous body via VersionManager **before** overwrite.
# Invariants:
# - When hash changes and preserve_version=True, create_version is called before storage delete/store.
# - Snapshot failure must abort replace (fail closed).
# Related:
# - api/services/unified_content/content_storage_service.py
# ---

from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest

from api.schemas.unified_content import Content, ContentType, ProcessingStatus, StorageBackendType, Visibility
from api.services.unified_content.content_storage_service import ContentStorageService


def _sample_content(*, version: int = 1, file_hash: str = "oldhash") -> Content:
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
        file_hash=file_hash,
        mime_type="text/markdown",
        storage_backend=StorageBackendType.POSTGRESQL,
        visibility=Visibility.PRIVATE,
        processing_status=ProcessingStatus.COMPLETED,
        version=version,
        original_filename="notes.md",
        created_at=now,
        updated_at=now,
    )


@pytest.mark.asyncio
async def test_replace_file_content_snapshots_before_overwrite() -> None:
    service = ContentStorageService(
        db_pool=MagicMock(),
        storage_factory=MagicMock(),
        audit_logger=MagicMock(),
        search_service=None,
    )
    content = _sample_content()
    call_order: list[str] = []
    snapshot_id = uuid4()

    class FakeBackend:
        def get_backend_name(self) -> str:
            return "postgresql"

        async def store(self, *args: object, **kwargs: object) -> None:
            call_order.append("store")

    service.storage_factory.get_backend = MagicMock(return_value=FakeBackend())

    class FakeTransaction:
        async def __aenter__(self) -> None:
            return None

        async def __aexit__(self, *_exc: object) -> None:
            return None

    class FakeConn:
        def transaction(self) -> FakeTransaction:
            return FakeTransaction()

        async def execute(self, *_a: object, **_k: object) -> str:
            call_order.append("execute")
            return "UPDATE 1"

        async def __aenter__(self) -> FakeConn:
            return self

        async def __aexit__(self, *_exc: object) -> None:
            return None

    fake_pool = MagicMock()
    fake_pool.acquire.return_value = FakeConn()
    service.db_pool = fake_pool
    service.audit_logger.log = AsyncMock()
    service._check_quota = AsyncMock()

    async def should_create(*_a: object, **_k: object) -> bool:
        call_order.append("should_create_version")
        return True

    async def create_version(*_a: object, **_k: object) -> UUID:
        call_order.append("create_version")
        return snapshot_id

    with (
        patch.object(service, "get_content", AsyncMock(return_value=content)),
        patch(
            "api.services.unified_content.version_manager.VersionManager.should_create_version",
            new=should_create,
        ),
        patch(
            "api.services.unified_content.version_manager.VersionManager.create_version",
            new=create_version,
        ),
    ):
        await service.replace_file_content(
            content.id,
            str(content.user_id),
            b"brand-new-body-bytes",
            mime_type="text/markdown",
            change_description="test snapshot",
        )

    assert call_order.index("should_create_version") < call_order.index("create_version")
    assert call_order.index("create_version") < call_order.index("store")


@pytest.mark.asyncio
async def test_replace_file_content_skips_snapshot_when_hash_unchanged() -> None:
    service = ContentStorageService(
        db_pool=MagicMock(),
        storage_factory=MagicMock(),
        audit_logger=MagicMock(),
        search_service=None,
    )
    content = _sample_content()
    create_mock = AsyncMock()

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

    class FakeConn:
        def transaction(self) -> FakeTransaction:
            return FakeTransaction()

        async def execute(self, *_a: object, **_k: object) -> str:
            return "UPDATE 1"

        async def __aenter__(self) -> FakeConn:
            return self

        async def __aexit__(self, *_exc: object) -> None:
            return None

    fake_pool = MagicMock()
    fake_pool.acquire.return_value = FakeConn()
    service.db_pool = fake_pool
    service.audit_logger.log = AsyncMock()
    service._check_quota = AsyncMock()

    with (
        patch.object(service, "get_content", AsyncMock(return_value=content)),
        patch.object(service, "_calculate_hash", return_value="oldhash"),
        patch(
            "api.services.unified_content.version_manager.VersionManager.should_create_version",
            new=AsyncMock(return_value=False),
        ),
        patch(
            "api.services.unified_content.version_manager.VersionManager.create_version",
            new=create_mock,
        ),
    ):
        await service.replace_file_content(
            content.id,
            str(content.user_id),
            b"same-hash-body",
            mime_type="text/markdown",
        )

    create_mock.assert_not_awaited()
