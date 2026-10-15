# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit coverage for Content Manager query alias normalization on list/folder-view filters.
# Related:
# - api/services/unified_content/content_type_filters.py
# ---

from __future__ import annotations

import pytest

from api.schemas.unified_content import ContentType
from api.services.unified_content.content_type_filters import resolve_content_type_query_filters


@pytest.mark.parametrize(
    ("raw", "expected_type", "expected_mime"),
    [
        (None, None, None),
        ("", None, None),
        ("all", None, None),
        ("document", ContentType.DOCUMENT, None),
        ("pdf", ContentType.DOCUMENT, "application/pdf"),
        ("text", ContentType.DOCUMENT, "text/"),
        ("code", ContentType.DOCUMENT, None),
        ("archive", ContentType.OTHER, None),
        ("not-a-type", None, None),
    ],
)
def test_resolve_content_type_query_filters(
    raw: str | None,
    expected_type: ContentType | None,
    expected_mime: str | None,
) -> None:
    content_type, mime_type = resolve_content_type_query_filters(content_type=raw)
    assert content_type == expected_type
    assert mime_type == expected_mime


def test_resolve_content_type_query_filters_explicit_mime_wins() -> None:
    content_type, mime_type = resolve_content_type_query_filters(
        content_type="pdf",
        mime_type="application/octet-stream",
    )
    assert content_type == ContentType.DOCUMENT
    assert mime_type == "application/octet-stream"
