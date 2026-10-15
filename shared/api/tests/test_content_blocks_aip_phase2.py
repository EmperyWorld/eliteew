# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# AIP Phase 2 — block append/patch/remove and stitcher regression tests.
# Related:
# - api/services/unified_content/content_blocks.py
# - api/services/unified_content/content_storage_service.py
# ---

from __future__ import annotations

import logging
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

import pytest

from api.schemas.unified_content import Content, ContentType, ProcessingStatus, StorageBackendType, Visibility
from api.services.unified_content.content_blocks import (
    append_blocks,
    blocks_to_markdown,
    load_blocks_from_row,
    new_content_block,
    serialize_content_payload,
)
from api.services.unified_content.content_storage_service import (
    ContentStorageService,
    ContentVersionConflictError,
)


def _sample_content(*, version: int = 1) -> Content:
    cid = UUID("12345678-1234-5678-1234-567812345678")
    uid = UUID("22345678-1234-5678-1234-567812345678")
    now = datetime.now(UTC)
    return Content(
        id=cid,
        user_id=uid,
        name="report.md",
        title="report.md",
        content_type=ContentType.DOCUMENT,
        file_size=10,
        mime_type="text/markdown",
        storage_backend=StorageBackendType.POSTGRESQL,
        visibility=Visibility.PRIVATE,
        processing_status=ProcessingStatus.COMPLETED,
        version=version,
        original_filename="report.md",
        created_at=now,
        updated_at=now,
    )


def test_blocks_to_markdown_preserves_order_and_attribution() -> None:
    roles = ["marketing", "audit", "legal", "ops", "synthesis"]
    blocks = [
        new_content_block(content=f"Section {idx + 1}", author_role=role, order_index=idx)
        for idx, role in enumerate(roles)
    ]
    stitched = blocks_to_markdown(blocks)
    for idx, role in enumerate(roles):
        assert f"role={role}" in stitched
        assert f"Section {idx + 1}" in stitched
    assert stitched.index("Section 1") < stitched.index("Section 5")


def test_sequential_append_from_five_roles_structural_integrity() -> None:
    doc: list = []
    roles = ["marketing", "audit", "legal", "ops", "synthesis"]
    for idx, role in enumerate(roles):
        doc = append_blocks(doc, [new_content_block(content=f"Block {idx + 1}", author_role=role)])
    payload = serialize_content_payload(doc)
    assert len(payload["blocks"]) == 5
    assert [b["order_index"] for b in payload["blocks"]] == [0, 1, 2, 3, 4]
    assert [b["author_role"] for b in payload["blocks"]] == roles
    markdown = blocks_to_markdown(doc)
    assert "Block 1" in markdown and "Block 5" in markdown


def test_load_blocks_from_monolithic_extracted_text() -> None:
    blocks = load_blocks_from_row(None, "# Legacy\n\nBody")
    assert len(blocks) == 1
    assert blocks[0].author_role == "human"
    assert "Legacy" in blocks[0].content


@pytest.mark.asyncio
async def test_parallel_append_second_writer_gets_version_conflict() -> None:
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
        # Simulate stale read before append (agent still holds expected_version=1).
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
            if query.strip().startswith("UPDATE unified_content"):
                update_calls["n"] += 1
                if update_calls["n"] == 1:
                    db_version["value"] = 2
                    return "UPDATE 1"
                return "UPDATE 0"
            return "OK"

        async def fetchrow(self, query: str, *_args: object) -> dict[str, object] | SimpleNamespace | None:
            if "SELECT content_payload" in query:
                return {
                    "content_payload": None,
                    "version": 1 if update_calls["n"] == 0 else db_version["value"],
                    "extracted_text": "",
                    "mime_type": "text/markdown",
                    "original_filename": "report.md",
                    "storage_backend": "postgresql",
                    "file_path": None,
                    "file_size": 0,
                }
            if "SELECT version FROM unified_content" in query:
                return {"version": db_version["value"]}
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
    service._sync_text_bytes_in_transaction = AsyncMock()  # type: ignore[method-assign]

    block_a = new_content_block(content="Block A", author_role="auditor")
    block_b = new_content_block(content="Block B", author_role="marketing")

    with patch.object(service, "get_content", side_effect=get_content_side_effect):
        await service.append_to_content(
            content.id,
            str(content.user_id),
            [block_a.model_dump(mode="json")],
            expected_version=1,
        )
        with pytest.raises(ContentVersionConflictError) as exc_info:
            await service.append_to_content(
                content.id,
                str(content.user_id),
                [block_b.model_dump(mode="json")],
                expected_version=1,
            )
    err = exc_info.value
    assert err.expected_version == 1
    assert err.current_version == 2


@pytest.mark.asyncio
async def test_doc_append_block_logs_success_trace(caplog: pytest.LogCaptureFixture) -> None:
    from api.ewa_platform.companion.orchestration.tools.handlers_files import _handle_doc_append_block
    from api.ewa_platform.companion.orchestration.tools.registry_types import ToolContext

    content = _sample_content(version=3)
    block_id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"

    class FakeStorage:
        async def get_content(self, *_a: object, **_k: object) -> Content:
            return content

        async def append_to_content(self, *_a: object, **kwargs: object) -> Content:
            assert kwargs.get("expected_version") == 3
            return _sample_content(version=4)

    with (
        patch(
            "api.ewa_platform.companion.orchestration.tools.handlers_files._resolve_main_pool",
            AsyncMock(return_value=object()),
        ),
        patch(
            "api.ewa_platform.companion.storage.catalog_pipeline.make_content_storage_service",
            lambda _pool: FakeStorage(),
        ),
        patch(
            "api.services.unified_content.content_blocks.new_content_block",
            return_value=SimpleNamespace(
                id=block_id,
                model_dump=lambda **_kw: {"id": block_id, "content": "Audit section", "author_role": "auditor"},
            ),
        ),
        caplog.at_level(logging.INFO, logger="api.ewa_platform.companion.orchestration.tools.handlers_files"),
    ):
        result = await _handle_doc_append_block(
            {
                "unified_content_id": str(content.id),
                "block_content": "Audit section",
                "author_role": "auditor",
            },
            ToolContext(
                principal_id="p1",
                user_line="append audit section",
                content_catalog_user_id=str(content.user_id),
                oauth2_sub_for_content_alternate=None,
            ),
        )

    assert result is not None
    assert result.get("status") == "ok"
    messages = [r.getMessage() for r in caplog.records]
    assert any(
        "doc_append_block_success" in m
        and "role=auditor" in m
        and f"block_id={block_id}" in m
        and "expected_version=3" in m
        for m in messages
    )
