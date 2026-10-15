#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Pydantic v2 contracts for the Document Editor V2 backend API contour.
# These schemas describe V2 documents, drafts, imports, exports, collaboration metadata and EWA suggestions.
# Invariants:
# - document_id is always unified_content.id.
# - Every document response includes explicit capabilities; clients must not infer rights from user roles.
# - EWA suggestions are suggestion-first: no schema here permits silent full-body replacement.
# Related:
# - api/routers/doc_editor_v2.py
# - api/services/doc_editor_v2/document_service.py
# - documentation/product/DOCUMENT-EDITOR-V2.md
# ---
"""Document Editor V2 HTTP contracts."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class DocEditorV2SourceFormat(StrEnum):
    """Source/import format for the canonical document projections."""

    HTML = "html"
    MARKDOWN = "markdown"
    TEXT = "text"
    DOCX = "docx"
    DOC = "doc"
    ODT = "odt"
    RTF = "rtf"
    PDF = "pdf"


class DocEditorV2EditorFormat(StrEnum):
    """Canonical editor-source format declared by the V2 service."""

    PROSE_MIRROR_JSON = "prose_mirror_json"
    HTML = "html"
    MARKDOWN = "markdown"
    TEXT = "text"


class DocEditorV2ExportFormat(StrEnum):
    """Requested export target. Implementation will be wired through Stack4/export adapters later."""

    PDF = "pdf"
    DOCX = "docx"
    HTML = "html"
    MARKDOWN = "markdown"
    TEXT = "text"


class DocEditorV2Capabilities(BaseModel):
    """Permission matrix returned with every V2 document response."""

    can_read: bool = False
    can_edit: bool = False
    can_comment: bool = False
    can_collaborate: bool = False
    can_apply_ewa: bool = False
    can_export: bool = False


class DocEditorV2HealthResponse(BaseModel):
    """Liveness and storage-policy contract for the new contour."""

    status: Literal["ok"] = "ok"
    api_version: Literal["doc-editor-v2"] = "doc-editor-v2"
    storage_table: Literal["unified_content"] = "unified_content"
    legacy_documents_table_used: bool = False
    legacy_editor_paths_used: bool = False


class DocEditorV2CapabilitiesResponse(BaseModel):
    """Static feature surface available in the backend contour."""

    api_version: Literal["doc-editor-v2"] = "doc-editor-v2"
    storage_table: Literal["unified_content"] = "unified_content"
    supports_create: bool = True
    supports_read: bool = True
    supports_update: bool = True
    supports_server_draft: bool = True
    supports_import: bool = True
    supports_export: bool = True
    supports_structure: bool = True
    supports_collaboration: bool = True
    supports_ewa_suggestions: bool = True
    supported_source_formats: list[DocEditorV2SourceFormat] = Field(
        default_factory=lambda: [
            DocEditorV2SourceFormat.HTML,
            DocEditorV2SourceFormat.MARKDOWN,
            DocEditorV2SourceFormat.TEXT,
            DocEditorV2SourceFormat.DOCX,
            DocEditorV2SourceFormat.DOC,
            DocEditorV2SourceFormat.ODT,
            DocEditorV2SourceFormat.RTF,
            DocEditorV2SourceFormat.PDF,
        ]
    )
    supported_export_formats: list[DocEditorV2ExportFormat] = Field(
        default_factory=lambda: [
            DocEditorV2ExportFormat.PDF,
            DocEditorV2ExportFormat.DOCX,
            DocEditorV2ExportFormat.HTML,
            DocEditorV2ExportFormat.MARKDOWN,
            DocEditorV2ExportFormat.TEXT,
        ]
    )


class DocEditorV2CreateRequest(BaseModel):
    """Create a V2-owned document in unified_content."""

    title: str = Field(default="Untitled document", min_length=1, max_length=500)
    editor_format: DocEditorV2EditorFormat = DocEditorV2EditorFormat.MARKDOWN
    editor_json: dict[str, Any] | None = None
    content_html: str | None = None
    content_markdown: str | None = None
    plain_text: str | None = None
    source_format: DocEditorV2SourceFormat | None = None
    tags: list[str] = Field(default_factory=list, max_length=50)

    @field_validator("tags")
    @classmethod
    def normalize_tags(cls, tags: list[str]) -> list[str]:
        """Trim, de-dupe and cap tags at the API boundary."""

        seen: set[str] = set()
        out: list[str] = []
        for raw in tags:
            tag = str(raw).strip()
            if not tag:
                continue
            if len(tag) > 100:
                msg = f"Tag too long (max 100 chars): {tag}"
                raise ValueError(msg)
            key = tag.lower()
            if key in seen:
                continue
            seen.add(key)
            out.append(tag)
        return out


class DocEditorV2UpdateRequest(BaseModel):
    """Canonical save payload with optimistic versioning."""

    expected_version: int = Field(..., ge=1)
    force_save: bool = False
    title: str | None = Field(default=None, min_length=1, max_length=500)
    editor_format: DocEditorV2EditorFormat | None = None
    editor_json: dict[str, Any] | None = None
    content_html: str | None = None
    content_markdown: str | None = None
    plain_text: str | None = None
    source_format: DocEditorV2SourceFormat | None = None
    tags: list[str] | None = Field(default=None, max_length=50)

    @field_validator("tags")
    @classmethod
    def normalize_tags(cls, tags: list[str] | None) -> list[str] | None:
        if tags is None:
            return None
        return DocEditorV2CreateRequest.normalize_tags(tags)


class DocEditorV2DocumentResponse(BaseModel):
    """Readable V2 document projection backed by unified_content."""

    document_id: UUID
    owner_user_id: str
    title: str
    editor_format: DocEditorV2EditorFormat
    editor_json: dict[str, Any] | None = None
    content_html: str
    content_markdown: str
    plain_text: str
    source_format: DocEditorV2SourceFormat
    parse_warnings: list[str] = Field(default_factory=list)
    version: int = Field(ge=0)
    capabilities: DocEditorV2Capabilities
    tags: list[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DocEditorV2ConflictDetail(BaseModel):
    """409 payload for canonical save version conflicts."""

    code: Literal["version_conflict"] = "version_conflict"
    expected_version: int
    current_version: int
    server_document: DocEditorV2DocumentResponse


class DocEditorV2DraftRequest(BaseModel):
    """Server-side draft payload bound to a canonical document version."""

    base_document_version: int = Field(..., ge=0)
    draft_version: int | None = Field(default=None, ge=0)
    title: str | None = Field(default=None, min_length=1, max_length=500)
    editor_format: DocEditorV2EditorFormat | None = None
    editor_json: dict[str, Any] | None = None
    content_html: str | None = None
    content_markdown: str | None = None
    plain_text: str | None = None
    source_session_id: str | None = Field(default=None, max_length=200)


class DocEditorV2DraftResponse(BaseModel):
    """Stored server draft projection."""

    document_id: UUID
    status: Literal["empty", "stored", "deleted"] = "empty"
    base_document_version: int = Field(ge=0)
    draft_version: int = Field(ge=0)
    title: str | None = None
    editor_format: DocEditorV2EditorFormat | None = None
    editor_json: dict[str, Any] | None = None
    content_html: str = ""
    content_markdown: str = ""
    plain_text: str = ""
    source_session_id: str | None = None
    updated_at: datetime | None = None


class DocEditorV2ImportRequest(BaseModel):
    """Import a supported file/body into an editable V2 document."""

    filename: str = Field(..., min_length=1, max_length=255)
    source_format: DocEditorV2SourceFormat | None = None
    mime_type: str | None = Field(default=None, max_length=200)
    content_text: str | None = None
    content_base64: str | None = None
    title: str | None = Field(default=None, min_length=1, max_length=500)
    tags: list[str] = Field(default_factory=list, max_length=50)


class DocEditorV2ImportResponse(BaseModel):
    """Imported editable document plus conversion warnings."""

    status: Literal["imported"] = "imported"
    document: DocEditorV2DocumentResponse
    parse_warnings: list[str] = Field(default_factory=list)


class DocEditorV2ExportRequest(BaseModel):
    """Placeholder request for future document export."""

    export_format: DocEditorV2ExportFormat


class DocEditorV2ExportResponse(BaseModel):
    """Exported document bytes encoded for JSON transport."""

    document_id: UUID
    export_format: DocEditorV2ExportFormat
    filename: str
    mime_type: str
    content_base64: str
    warnings: list[str] = Field(default_factory=list)


class DocEditorV2StructureItem(BaseModel):
    """One backend-derived outline item."""

    id: str
    title: str
    level: int = Field(ge=1, le=6)
    start_offset: int = Field(ge=0)
    end_offset: int = Field(ge=0)


class DocEditorV2StructureResponse(BaseModel):
    """Backend-first document structure used by UI and EWA context packets."""

    document_id: UUID
    version: int = Field(ge=0)
    items: list[DocEditorV2StructureItem] = Field(default_factory=list)
    summary: str = ""


class DocEditorV2SelectionRange(BaseModel):
    """Character offsets for selected document text."""

    start: int = Field(ge=0)
    end: int = Field(ge=0)

    @field_validator("end")
    @classmethod
    def validate_end(cls, end: int, info: object) -> int:
        data = getattr(info, "data", {}) if info is not None else {}
        start = data.get("start") if isinstance(data, dict) else None
        if isinstance(start, int) and end < start:
            raise ValueError("Selection end must be greater than or equal to start")
        return end


class DocEditorV2EwaAction(StrEnum):
    """Suggestion-first EWA document actions."""

    DISCUSS = "discuss"
    REWRITE_SELECTION = "rewrite_selection"
    SUMMARIZE_SECTION = "summarize_section"
    TRANSLATE_SELECTION = "translate_selection"
    MAKE_OUTLINE = "make_outline"
    CREATE_COMMENT = "create_comment"


class DocEditorV2EwaContextPacket(BaseModel):
    """Bounded context sent to EWA for document work."""

    document_id: UUID
    title: str
    version: int = Field(ge=0)
    capabilities: DocEditorV2Capabilities
    selected_range: DocEditorV2SelectionRange | None = None
    selected_text: str = ""
    nearby_excerpt: str = ""
    outline: list[DocEditorV2StructureItem] = Field(default_factory=list)
    source_format: DocEditorV2SourceFormat
    parse_warnings: list[str] = Field(default_factory=list)


class DocEditorV2EwaSuggestRequest(BaseModel):
    """Ask EWA for a suggestion without mutating the document."""

    action: DocEditorV2EwaAction
    instruction: str = Field(..., min_length=1, max_length=4000)
    selected_range: DocEditorV2SelectionRange | None = None
    selected_text: str | None = None
    language: str | None = Field(default=None, max_length=80)


class DocEditorV2SuggestionStatus(StrEnum):
    """Lifecycle status for a stored EWA suggestion."""

    NEEDS_APPROVAL = "needs_approval"
    APPLIED = "applied"
    REJECTED = "rejected"
    BLOCKED = "blocked"


class DocEditorV2SuggestionResponse(BaseModel):
    """Stored EWA suggestion and bounded context/audit payload."""

    id: str
    document_id: UUID
    action: DocEditorV2EwaAction
    status: DocEditorV2SuggestionStatus
    title: str
    explanation: str
    replacement_text: str | None = None
    comment_text: str | None = None
    selected_range: DocEditorV2SelectionRange | None = None
    base_document_version: int = Field(ge=0)
    context_packet: DocEditorV2EwaContextPacket
    created_at: datetime
    created_by: str
    applied_at: datetime | None = None
    applied_by: str | None = None


class DocEditorV2SuggestionApplyRequest(BaseModel):
    """Explicit user approval for applying one stored suggestion."""

    expected_version: int = Field(..., ge=1)
    force_save: bool = False


class DocEditorV2SuggestionApplyResponse(BaseModel):
    """Result of applying a guarded EWA suggestion."""

    suggestion: DocEditorV2SuggestionResponse
    document: DocEditorV2DocumentResponse


class DocEditorV2CollaborationParticipant(BaseModel):
    """One participant visible in the collaboration state."""

    user_id: str
    role: Literal["owner", "editor", "reviewer", "viewer"]
    can_save: bool = False
    is_active: bool = False


class DocEditorV2CollaborationStateResponse(BaseModel):
    """Collaboration capabilities and snapshot metadata for one document."""

    document_id: UUID
    room_id: str
    enabled: bool = True
    persistence: Literal["metadata_snapshot", "redis_yjs_log_pending"] = "metadata_snapshot"
    participants: list[DocEditorV2CollaborationParticipant] = Field(default_factory=list)
    snapshot_version: int = Field(ge=0)
    last_snapshot_at: datetime | None = None


class DocEditorV2CollaborationSnapshotRequest(BaseModel):
    """Persist a compact collaboration snapshot for reconnect/cold start."""

    base_document_version: int = Field(..., ge=0)
    snapshot_base64: str = Field(..., min_length=1)
    awareness: dict[str, Any] = Field(default_factory=dict)
    source_session_id: str | None = Field(default=None, max_length=200)


class DocEditorV2CollaborationSnapshotResponse(BaseModel):
    """Stored collaboration snapshot metadata."""

    document_id: UUID
    snapshot_version: int = Field(ge=1)
    last_snapshot_at: datetime
