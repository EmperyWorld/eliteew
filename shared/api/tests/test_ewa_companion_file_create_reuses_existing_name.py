# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lock: companion ``create_unified_companion_document`` reuses exact EwaFile name via versioned replace.
# Invariants:
# - Exact name hit → replace_file_content, not create_content.
# - Returned Content has deduplicated_reused=True when model_copy is available.
# Related:
# - api/ewa_platform/companion/storage/catalog_pipeline.py
# ---

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

import pytest

from api.ewa_platform.companion.storage import catalog_pipeline as catpipe


@pytest.mark.asyncio
async def test_create_unified_companion_document_reuses_exact_name() -> None:
    uid = "22345678-1234-5678-1234-567812345678"
    cid = UUID("12345678-1234-5678-1234-567812345678")
    existing = SimpleNamespace(
        id=cid,
        name="notes.md",
        original_filename="notes.md",
        title="notes.md",
    )
    replaced = MagicMock()
    replaced.model_copy = MagicMock(return_value=SimpleNamespace(id=cid, deduplicated_reused=True))

    storage = MagicMock()
    storage.replace_file_content = AsyncMock()
    storage.get_content = AsyncMock(return_value=replaced)
    storage.create_content = AsyncMock()

    with patch.object(
        catpipe,
        "find_owner_ewa_file_by_exact_name",
        new=AsyncMock(return_value=existing),
    ):
        out = await catpipe.create_unified_companion_document(
            storage,
            content_user_id=uid,
            name="notes.md",
            body="# New body",
        )

    storage.create_content.assert_not_awaited()
    storage.replace_file_content.assert_awaited_once()
    kwargs = storage.replace_file_content.await_args.kwargs
    assert kwargs.get("change_description")
    assert "snapshot" in str(kwargs.get("change_description") or "").lower()
    assert getattr(out, "deduplicated_reused", False) is True


@pytest.mark.asyncio
async def test_find_owner_ewa_file_by_exact_name_casefold() -> None:
    uid = "u1"
    row = SimpleNamespace(
        id=UUID(int=1),
        name="Notes.MD",
        original_filename="notes.md",
        title="Notes.MD",
    )

    class FakeQuery:
        async def list_content(self, **kwargs: object) -> tuple[list[object], int]:
            return [row], 1

    found = await catpipe.find_owner_ewa_file_by_exact_name(
        content_user_id=uid,
        name="notes.md",
        query_svc=FakeQuery(),
    )
    assert found is row
