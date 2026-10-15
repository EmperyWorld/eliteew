# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lock: text create_content syncs extracted_text so agentic driver load_blocks sees body.
# Related:
# - api/services/unified_content/content_storage_create.py
# - api/services/unified_content/content_blocks.py
# ---

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest

from api.schemas.unified_content import ContentCreate, ContentType, Visibility, build_content_create
from api.services.unified_content.content_blocks import load_blocks_from_row
from api.services.unified_content.content_storage_create import ContentStorageCreateMixin
from api.services.unified_content.content_storage_shared import extracted_text_from_file_data


def test_markdown_bytes_become_driver_blocks_via_extracted_text() -> None:
    body = "# Market\n\nFindings about EliteEW."
    extracted = extracted_text_from_file_data(body.encode("utf-8"), "text/markdown")
    assert extracted is not None
    blocks = load_blocks_from_row(None, extracted)
    assert len(blocks) == 1
    assert "EliteEW" in blocks[0].content


@pytest.mark.asyncio
async def test_create_content_updates_extracted_text_for_markdown() -> None:
    """create_content must SET extracted_text inside the create transaction (parity with replace)."""

    class _Svc(ContentStorageCreateMixin):
        def __init__(self) -> None:
            self.storage_factory = MagicMock()
            self.search_service = None
            setattr(self, "db_pool", MagicMock())
            setattr(self, "audit_logger", SimpleNamespace(log=AsyncMock()))

        def _calculate_hash(self, data: bytes) -> str:
            return "hash-" + str(len(data))

        async def _check_quota(self, user_id: str, size: int) -> None:
            return None

        async def _find_by_hash(self, file_hash: str, user_id: str):
            return None

        async def get_content(self, content_id: UUID, user_id: str):
            return SimpleNamespace(id=content_id, user_id=user_id, extracted_text="ok")

    svc = _Svc()
    backend = MagicMock()
    backend.get_backend_name.return_value = "postgresql"
    backend.store = AsyncMock(return_value=None)
    setattr(svc.storage_factory, "get_backend", lambda *_a, **_k: backend)

    executes: list[tuple[str, tuple]] = []

    class _Conn:
        async def fetchrow(self, sql: str, *args):
            return {"id": args[0]}

        async def execute(self, sql: str, *args):
            executes.append((sql, args))
            return "UPDATE 1"

        def transaction(self):
            return self

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

    class _Pool:
        def acquire(self):
            return _Conn()

    setattr(svc, "db_pool", _Pool())
    body = b"# Title\n\nBody for agentic observe."
    content_data = build_content_create(
        user_id=str(uuid4()),
        name="report.md",
        title="report.md",
        description="test",
        tags=["ewa-companion"],
        content_type=ContentType.DOCUMENT,
        mime_type="text/markdown",
        visibility=Visibility.PRIVATE,
        metadata={"source": "test"},
        original_filename="report.md",
        source_service="ewa_companion",
    )
    assert isinstance(content_data, ContentCreate)

    with patch.object(svc, "get_content", new=AsyncMock(return_value=SimpleNamespace(id=uuid4()))):
        await svc.create_content(content_data, body, user_id=str(content_data.user_id))

    extract_calls = [c for c in executes if "extracted_text" in c[0]]
    assert extract_calls, f"expected extracted_text UPDATE; got {executes!r}"
    sql, args = extract_calls[0]
    assert "word_count" in sql
    assert args[0].startswith("# Title")
    assert int(args[2]) == len(args[0])
