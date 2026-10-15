# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Regression tests for backend-first document structure extraction consumed by EWA embedded editor.
# Invariants:
# - Structure offsets are backend-derived and browser-compatible (UTF-16 code units).
# - Markdown headings inside fenced code blocks are ignored.
# Related:
# - api/services/doc_editor_document_structure.py
# - api/routers/unified_content.py
# ---

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any
from uuid import UUID

from api.routers.unified_content import get_content_document_structure
from api.schemas.unified_content import Content, ContentType, ProcessingStatus, Visibility
from api.services.doc_editor_document_structure import (
    build_document_structure_from_markdown,
)


def test_document_structure_parser_builds_nested_sections_and_unique_slugs() -> None:
    markdown = """# Intro

Opening text.

## Details

First details.

### Deep

Nested text.

## Details

Second details.

```md
# Not a heading
```
"""

    result = build_document_structure_from_markdown(
        document_id=UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"),
        title="Doc",
        markdown=markdown,
        source_format="markdown",
        version=7,
    )

    assert [section.title for section in result.sections] == ["Intro", "Details", "Deep", "Details"]
    assert [section.slug for section in result.sections] == ["intro", "details", "deep", "details-2"]
    assert result.sections[0].children_count == 2
    assert result.sections[1].children_count == 1
    assert result.sections[0].line_start == 1
    assert result.sections[0].line_end == 19
    assert result.sections[1].line_end == 12
    assert "Opening text" in result.sections[0].preview
    assert result.version == 7


def test_document_structure_parser_falls_back_to_single_document_section() -> None:
    result = build_document_structure_from_markdown(
        document_id=UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"),
        title="Plain",
        markdown="No headings here.\nJust text.",
        source_format="text",
        version=1,
    )

    assert len(result.sections) == 1
    section = result.sections[0]
    assert section.id == "document"
    assert section.title == "Plain"
    assert section.line_start == 1
    assert section.line_end == 2
    assert section.char_start == 0
    assert section.char_end == result.total_chars
    assert section.word_count == 5


def test_document_structure_parser_bounds_sections_and_uses_utf16_offsets() -> None:
    markdown = "# A😀\nText\n# B\nMore"
    result = build_document_structure_from_markdown(
        document_id=UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"),
        title="Emoji",
        markdown=markdown,
        source_format="markdown",
        version=1,
        max_sections=1,
    )

    assert result.truncated is True
    assert len(result.sections) == 1
    # UTF-16: "# A😀\n" is 6 code units, so the second heading starts at offset 11 after "Text\n".
    full = build_document_structure_from_markdown(
        document_id=UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"),
        title="Emoji",
        markdown=markdown,
        source_format="markdown",
        version=1,
    )
    assert full.sections[1].char_start == 11


class _FakeContentService:
    def __init__(self, content: Content) -> None:
        self.content = content
        self.calls: list[dict[str, Any]] = []

    async def get_content(self, content_id: UUID, user_id: str, *, check_permissions: bool = True) -> Content:
        self.calls.append(
            {
                "content_id": content_id,
                "user_id": user_id,
                "check_permissions": check_permissions,
            }
        )
        return self.content


def _content(**overrides: Any) -> Content:
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "id": UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"),
        "user_id": "11111111-1111-1111-1111-111111111111",
        "name": "notes.md",
        "title": "Notes",
        "content_type": ContentType.DOCUMENT,
        "mime_type": "text/markdown",
        "visibility": Visibility.PRIVATE,
        "storage_backend": None,
        "file_path": None,
        "file_size": None,
        "file_hash": "hash",
        "original_filename": "notes.md",
        "processing_status": ProcessingStatus.COMPLETED,
        "metadata": {"content_markdown": "# Plan\n\n## Step\n\nDo it."},
        "created_at": now,
        "updated_at": now,
        "version": 4,
        "is_owner": True,
        "can_edit": True,
    }
    payload.update(overrides)
    return Content(**payload)


def test_document_structure_route_reuses_permission_checked_content_projection() -> None:
    content = _content()
    service = _FakeContentService(content)

    response = asyncio.run(
        get_content_document_structure(
            content.id,
            current_user=SimpleNamespace(role="user"),  # type: ignore[arg-type]
            content_user_id="11111111-1111-1111-1111-111111111111",
            service=service,  # type: ignore[arg-type]
        )
    )

    assert service.calls == [
        {
            "content_id": content.id,
            "user_id": "11111111-1111-1111-1111-111111111111",
            "check_permissions": True,
        }
    ]
    assert response.id == content.id
    assert [section.title for section in response.sections] == ["Plan", "Step"]
    assert response.version == 4
