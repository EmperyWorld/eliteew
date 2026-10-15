# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Contract tests for Unified Content document-body projections consumed by EWA embedded document surfaces.
# Invariants:
# - Projection keeps permission checks delegated to ContentStorageService before reading storage bytes.
# - Text-like source bytes return stable markdown/html/plain fields without Tika or LLM calls.
# Related:
# - api/routers/unified_content.py
# - api/services/doc_editor_text_normalizer.py
# ---

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from typing import Any
from uuid import UUID

from api.schemas.unified_content import Content, ContentType, ProcessingStatus, StorageBackendType, Visibility

_MODULE_PATH = Path(__file__).resolve().parents[1] / "services" / "unified_content" / "document_body_projection.py"
_SPEC = spec_from_file_location("document_body_projection", _MODULE_PATH)
if _SPEC is None or _SPEC.loader is None:
    raise RuntimeError(f"Cannot load module spec for {_MODULE_PATH}")
_MODULE = module_from_spec(_SPEC)
_SPEC.loader.exec_module(_MODULE)

build_unified_content_document_body_projection = _MODULE.build_unified_content_document_body_projection
document_body_can_project_from_metadata = _MODULE.document_body_can_project_from_metadata
document_body_is_text_like = _MODULE.document_body_is_text_like


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
        "storage_backend": StorageBackendType.POSTGRESQL,
        "file_path": "",
        "file_size": 14,
        "file_hash": "hash",
        "original_filename": "notes.md",
        "processing_status": ProcessingStatus.COMPLETED,
        "metadata": {},
        "created_at": now,
        "updated_at": now,
        "version": 3,
        "is_owner": True,
        "can_edit": True,
    }
    payload.update(overrides)
    return Content(**payload)


async def _project(content: Content, body: bytes) -> Any:
    return build_unified_content_document_body_projection(content=content, file_data=body)


def test_document_body_projection_returns_normalized_text_fields() -> None:
    result = asyncio.run(_project(_content(), b"# Hello\n\nBody"))

    assert result.content_markdown.startswith("# Hello")
    assert "<h1" in result.content_html
    assert "Hello" in result.plain_text
    assert "Body" in result.plain_text
    assert result.source_format == "markdown"
    assert result.can_save is True
    assert result.version == 3


def test_document_body_projection_rejects_unprocessed_binary_without_text_metadata() -> None:
    content = _content(
        name="photo.png",
        title="Photo",
        content_type=ContentType.IMAGE,
        mime_type="image/png",
        original_filename="photo.png",
        metadata={},
        extracted_text=None,
    )
    assert document_body_is_text_like(content) is False
    assert document_body_can_project_from_metadata(content) is False
