#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Normalize Content Manager query aliases (pdf, text, code, archive) into canonical ContentType and mime filters.
# Invariants:
# - Empty, whitespace, and "all" omit the content_type filter.
# - Unknown aliases omit content_type rather than failing list/folder-view reads.
# Related:
# - api/routers/unified_content_query.py
# - api/services/unified_content/content_storage_list.py
# ---
"""Query-side normalization for unified content type filters."""

from __future__ import annotations

from api.schemas.unified_content import ContentType

_CONTENT_TYPE_QUERY_ALIASES: dict[str, ContentType] = {
    "pdf": ContentType.DOCUMENT,
    "text": ContentType.DOCUMENT,
    "code": ContentType.DOCUMENT,
    "archive": ContentType.OTHER,
}

_MIME_BY_CONTENT_TYPE_ALIAS: dict[str, str] = {
    "pdf": "application/pdf",
    "text": "text/",
}


def resolve_content_type_query_filters(
    *,
    content_type: str | None,
    mime_type: str | None = None,
) -> tuple[ContentType | None, str | None]:
    """Map UI/content-manager filter tokens to storage-safe filters."""
    raw = (content_type or "").strip().lower()
    resolved_mime = (mime_type or "").strip() or None

    if not raw or raw == "all":
        return None, resolved_mime

    if raw in _MIME_BY_CONTENT_TYPE_ALIAS and resolved_mime is None:
        resolved_mime = _MIME_BY_CONTENT_TYPE_ALIAS[raw]

    if raw in _CONTENT_TYPE_QUERY_ALIASES:
        return _CONTENT_TYPE_QUERY_ALIASES[raw], resolved_mime

    try:
        return ContentType(raw), resolved_mime
    except ValueError:
        return None, resolved_mime
