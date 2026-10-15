# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for Unified Content list keyset cursor helpers.
# Invariants:
# - Write-only in CI task; run locally with pytest -k unified_content_list_cursor.
# Related:
# - api/services/unified_content/unified_content_list.py
# ---

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

import pytest

from api.schemas.unified_content import Content, ContentType, Visibility
from api.services.unified_content.unified_content_list import (
    build_next_content_list_cursor,
    content_list_supports_keyset,
    decode_content_list_cursor,
    encode_content_list_cursor,
)


def _sample_content(*, updated_at: datetime | None = None) -> Content:
    now = datetime(2026, 1, 15, 12, 0, 0, tzinfo=UTC)
    return Content(
        id=UUID("11111111-1111-1111-1111-111111111111"),
        name="report.pdf",
        title="report.pdf",
        description=None,
        sub_type=None,
        word_count=0,
        character_count=0,
        access_level="private",
        is_public=False,
        content_type=ContentType.DOCUMENT,
        visibility=Visibility.PRIVATE,
        user_id="22222222-2222-2222-2222-222222222222",
        storage_backend=None,
        file_size=1024,
        mime_type="application/pdf",
        version=1,
        created_at=now,
        updated_at=updated_at or now,
    )


def test_encode_decode_cursor_roundtrip() -> None:
    published = datetime(2026, 2, 1, 8, 30, 0, tzinfo=UTC)
    post_id = UUID("33333333-3333-3333-3333-333333333333")
    token = encode_content_list_cursor(
        sort_field="modified",
        sort_order="desc",
        sort_value=published.isoformat(),
        content_id=post_id,
    )
    state = decode_content_list_cursor(token)
    assert state.sort_field == "modified"
    assert state.sort_order == "desc"
    assert state.sort_value == published.isoformat()
    assert state.content_id == post_id


def test_decode_rejects_garbage() -> None:
    with pytest.raises(ValueError, match="invalid cursor"):
        decode_content_list_cursor("not-a-valid-token")


def test_keyset_disabled_with_search_or_group_by() -> None:
    assert content_list_supports_keyset(search_query="invoice", group_by_type=False) is False
    assert content_list_supports_keyset(search_query=None, group_by_type=True) is False
    assert content_list_supports_keyset(search_query="  ", group_by_type=False) is True


def test_build_next_cursor_when_page_full() -> None:
    row = _sample_content()
    token = build_next_content_list_cursor(
        items=[row],
        sort_field="modified",
        sort_order="desc",
        limit=1,
        search_query=None,
        group_by_type=False,
    )
    assert token is not None
    decoded = decode_content_list_cursor(token)
    assert decoded.content_id == row.id


def test_build_next_cursor_none_when_short_page() -> None:
    assert (
        build_next_content_list_cursor(
            items=[_sample_content()],
            sort_field="modified",
            sort_order="desc",
            limit=5,
            search_query=None,
            group_by_type=False,
        )
        is None
    )
