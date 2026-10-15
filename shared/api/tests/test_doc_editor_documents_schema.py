# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Contract smoke tests for DocEditor HTTP schemas used by web editor and EWA document surfaces.
# Invariants:
# - Save requests may declare source format without losing force-save conflict controls.
# - Response schemas expose normalized document projections alongside legacy content.
# Related:
# - api/schemas/doc_editor_documents.py
# ---
"""Contract smoke tests for doc editor HTTP schemas."""

from datetime import UTC, datetime
from uuid import UUID

from api.schemas.doc_editor_documents import DocumentResponse, DocumentUpdate


def test_document_update_force_save_field() -> None:
    body = DocumentUpdate(content="# A", content_type="markdown", force_save=True)
    dumped = body.model_dump(exclude_none=True)
    assert dumped.get("force_save") is True
    assert dumped.get("content_type") == "markdown"


def test_document_response_accepts_normalized_projection_fields() -> None:
    body = DocumentResponse(
        id=UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"),
        user_id="11111111-1111-1111-1111-111111111111",
        title="notes.md",
        content="<h1>A</h1>",
        content_markdown="# A\n",
        content_html="<h1>A</h1>",
        plain_text="A",
        source_format="markdown",
        parse_warnings=["markdown_glue_normalized"],
        mime_type="text/markdown",
        tags=[],
        is_public=False,
        word_count=1,
        character_count=1,
        version=1,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )

    assert body.content_markdown == "# A\n"
    assert body.content_html == "<h1>A</h1>"
    assert body.source_format == "markdown"
    assert body.parse_warnings == ["markdown_glue_normalized"]
