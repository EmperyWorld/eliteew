# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Build normalized text-like Unified Content document body projections for embedded editors and companion tools.
# Invariants:
# - Projection never performs storage or permission I/O; callers must authorize and provide bytes/metadata first.
# - Markdown/HTML/plain text fields come from the shared DocEditor normalizer for stable frontend contracts.
# Related:
# - api/routers/unified_content.py
# - api/services/doc_editor_text_normalizer.py
# ---

from __future__ import annotations

from pathlib import Path

from api.schemas.unified_content import Content, UnifiedContentDocumentBodyResponse
from api.services.doc_editor_text_normalizer import normalize_text_document
from api.utils.content_mime_normalization import normalized_mime_type

_DOCUMENT_BODY_TEXT_SUFFIXES = frozenset({".txt", ".md", ".markdown", ".html", ".htm"})
_DOCUMENT_BODY_TEXT_MIME_TYPES = frozenset({"text/plain", "text/markdown", "text/x-markdown", "text/html"})


def document_body_preferred_format(content: Content) -> str | None:
    metadata = content.metadata if isinstance(content.metadata, dict) else {}
    raw = metadata.get("source_format") or metadata.get("content_type") or metadata.get("format") or content.mime_type
    return str(raw or "").strip().lower() or None


def document_body_can_project_from_metadata(content: Content) -> bool:
    metadata = content.metadata if isinstance(content.metadata, dict) else {}
    return bool(
        str(metadata.get("rendered_html") or "").strip()
        or str(metadata.get("content_markdown") or "").strip()
        or str(content.extracted_text or "").strip()
    )


def document_body_is_text_like(content: Content) -> bool:
    suffix = Path(str(content.original_filename or content.name or "")).suffix.lower()
    mime_raw = normalized_mime_type(content.mime_type, content.original_filename)
    mime = mime_raw.strip().lower() if isinstance(mime_raw, str) and mime_raw else ""
    return suffix in _DOCUMENT_BODY_TEXT_SUFFIXES or mime in _DOCUMENT_BODY_TEXT_MIME_TYPES


def build_unified_content_document_body_projection(
    *,
    content: Content,
    file_data: bytes | None,
) -> UnifiedContentDocumentBodyResponse:
    metadata = content.metadata if isinstance(content.metadata, dict) else {}
    title = str(content.title or content.name or content.original_filename or "Document").strip() or "Document"
    filename = str(content.original_filename or content.name or title)
    mime_type = normalized_mime_type(content.mime_type, filename) or content.mime_type or "text/plain"
    source_seed: str | bytes = file_data if file_data is not None else str(content.extracted_text or "")
    normalized = normalize_text_document(
        source_seed,
        filename=filename,
        mime_type=mime_type,
        preferred_format=document_body_preferred_format(content),
    )
    content_html = str(metadata.get("rendered_html") or normalized.rendered_html)
    content_markdown = str(metadata.get("content_markdown") or normalized.markdown)
    plain_text = str(metadata.get("plain_text") or content.extracted_text or normalized.plain_text)
    parse_warnings_raw = metadata.get("parse_warnings")
    parse_warnings = (
        [str(item).strip() for item in parse_warnings_raw if str(item).strip()]
        if isinstance(parse_warnings_raw, list)
        else list(normalized.warnings)
    )
    source_format = str(metadata.get("source_format") or normalized.source_format).strip() or normalized.source_format
    return UnifiedContentDocumentBodyResponse(
        id=content.id,
        title=title,
        content=content_html,
        content_markdown=content_markdown,
        content_html=content_html,
        plain_text=plain_text,
        mime_type=mime_type,
        content_type=content.content_type.value
        if hasattr(content.content_type, "value")
        else str(content.content_type),
        source_format=source_format,
        parse_warnings=parse_warnings,
        version=int(content.version or 0),
        can_save=content.can_edit is True,
        is_owner=content.is_owner is True,
        original_filename=content.original_filename,
        file_hash=content.file_hash,
        updated_at=content.updated_at,
    )
