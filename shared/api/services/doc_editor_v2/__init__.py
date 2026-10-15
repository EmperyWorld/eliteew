#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Document Editor V2 service package exports the unified_content-backed document adapter.
# Invariants:
# - V2 services must not import legacy doc_editor_service, unified_editor or elite_editor as write paths.
# - Database access comes from project DI-managed pools.
# Related:
# - api/services/doc_editor_v2/document_service.py
# - documentation/product/DOCUMENT-EDITOR-V2.md
# ---
"""Document Editor V2 services."""

from api.services.doc_editor_v2.document_service import (
    DOC_EDITOR_V2_SOURCE_SERVICE,
    DocumentEditorV2Service,
    DocumentEditorV2UnsupportedError,
    DocumentEditorV2VersionConflictError,
)

__all__ = [
    "DOC_EDITOR_V2_SOURCE_SERVICE",
    "DocumentEditorV2Service",
    "DocumentEditorV2UnsupportedError",
    "DocumentEditorV2VersionConflictError",
]
