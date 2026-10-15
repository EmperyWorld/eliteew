#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Pydantic contracts for Unified Content records, folder views, create/update payloads, visibility, audit actions,
# and search metadata carried through API services.
# Invariants:
# - DB UUID/user ids are normalized at schema boundaries for API-safe JSON.
# - Optional search fields are read-only annotations; they must not affect storage identity or permissions.
# Related:
# - api/services/unified_content/content_storage_service.py
# - api/services/unified_content/folder_view_service.py
# - api/ewa_platform/gateways/runtime_gateway/runtime_context.py
# - tests/test_unified_content_copy.py (ContentCopyRequest)
# ---
"""
Pydantic Models for Unified Content System
Phase 1 Week 1
"""

from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from api.models.desktop import ItemType
from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator  # type: ignore[import-untyped]

# ============================================================================
# ENUMS
# ============================================================================


class ContentType(StrEnum):
    """Content type classification"""

    DOCUMENT = "document"
    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"
    AI_RESULT = "ai_result"
    PRESENTATION = "presentation"
    SPREADSHEET = "spreadsheet"
    OTHER = "other"


class Visibility(StrEnum):
    """Content visibility level. FROM_FRIENDS is filter-only (content shared with me by friends)."""

    PRIVATE = "private"
    SHARED = "shared"
    PUBLIC = "public"
    FRIENDS = "friends"
    FROM_FRIENDS = "from_friends"  # Filter: only content from others with visibility=friends


class ProcessingStatus(StrEnum):
    """Content processing status"""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class StorageBackendType(StrEnum):
    """Storage backend type"""

    POSTGRESQL = "postgresql"
    SEAWEEDFS = "seaweedfs"  # Changed from MINIO = "minio"
    MINIO = "minio"  # Backward compatibility alias
    LOCAL = "local"


class Permission(StrEnum):
    """Share permission level"""

    VIEW = "view"
    EDIT = "edit"
    ADMIN = "admin"


class ChangeType(StrEnum):
    """Version change type"""

    CREATE = "create"
    UPDATE = "update"
    REVERT = "revert"
    RESTORE = "restore"


# ============================================================================
# CONTENT MODELS
# ============================================================================


class ContentBase(BaseModel):
    """Base content model with common fields"""

    name: str = Field(..., max_length=500, description="Content name")
    description: str | None = Field(default=None, description="Content description")
    tags: list[str] = Field(default_factory=list, description="User-defined tags")
    content_type: ContentType = Field(..., description="Content type classification")
    mime_type: str | None = Field(default=None, max_length=100)
    sub_type: str | None = Field(default=None, max_length=50)
    visibility: Visibility = Field(default=Visibility.PRIVATE)
    metadata: dict[str, Any] = Field(default_factory=dict)

    # Classification fields (Plan 3: Content Manager Expansion)
    company_id: UUID | None = Field(default=None, description="Company classification")
    project_id: UUID | None = Field(default=None, description="Project classification")
    friend_visibility: bool = Field(
        default=False, description="Allow access for approved friends when visibility=shared"
    )

    # Document-specific fields (added for Ultimate Doc Editor integration)
    title: str | None = Field(default=None, max_length=500, description="Document title (for documents)")
    word_count: int | None = Field(default=None, ge=0, description="Word count (for documents)")
    character_count: int | None = Field(default=None, ge=0, description="Character count (for documents)")
    access_level: str | None = Field(default=None, description="Access level (private/shared/public)")
    is_public: bool | None = Field(default=None, description="Public visibility flag")

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, v: list[str]) -> list[str]:
        """Validate tags: max 50 tags, each max 100 chars"""
        if len(v) > 50:
            msg = "Maximum 50 tags allowed"
            raise ValueError(msg)
        for tag in v:
            if len(tag) > 100:
                msg = f"Tag too long (max 100 chars): {tag}"
                raise ValueError(msg)
        return v


def _normalize_folder_item_id(v: str | None) -> str | None:
    """Empty string -> None so DB gets NULL, not ''."""
    if v is None:
        return None
    return v.strip() or None


class ContentCreate(ContentBase):
    """Model for creating new content"""

    user_id: str = Field(..., max_length=255)
    original_filename: str = Field(..., max_length=255)
    source_service: str | None = Field(None, max_length=50)
    source_id: str | None = Field(None, max_length=255)
    related_content: list[UUID] = Field(default_factory=list)
    folder_item_id: str | None = Field(None, max_length=100, description="Desktop folder item_id (content group)")
    apply_project_desktop_folder: bool = Field(
        True,
        description="If True and project_id is set and folder_item_id is empty, set eliteew-proj-{project_id}",
    )
    # Note: company_id, project_id, friend_visibility inherited from ContentBase

    @field_validator("folder_item_id", mode="before")
    @classmethod
    def normalize_folder_item_id_create(cls, v: str | None) -> str | None:
        return _normalize_folder_item_id(v)


def build_content_create(
    *,
    user_id: str,
    original_filename: str,
    name: str,
    content_type: ContentType,
    description: str | None = None,
    tags: list[str] | None = None,
    mime_type: str | None = None,
    sub_type: str | None = None,
    visibility: Visibility = Visibility.PRIVATE,
    metadata: dict[str, Any] | None = None,
    company_id: UUID | None = None,
    project_id: UUID | None = None,
    friend_visibility: bool = False,
    title: str | None = None,
    word_count: int | None = None,
    character_count: int | None = None,
    access_level: str | None = None,
    is_public: bool | None = None,
    source_service: str | None = None,
    source_id: str | None = None,
    related_content: list[UUID] | None = None,
    folder_item_id: str | None = None,
    apply_project_desktop_folder: bool = True,
) -> ContentCreate:
    """Programmatic create payload with explicit optional defaults for static checkers."""

    return ContentCreate(
        user_id=user_id,
        original_filename=original_filename,
        name=name,
        content_type=content_type,
        description=description,
        tags=tags or [],
        mime_type=mime_type,
        sub_type=sub_type,
        visibility=visibility,
        metadata=metadata or {},
        company_id=company_id,
        project_id=project_id,
        friend_visibility=friend_visibility,
        title=title,
        word_count=word_count,
        character_count=character_count,
        access_level=access_level,
        is_public=is_public,
        source_service=source_service,
        source_id=source_id,
        related_content=related_content or [],
        folder_item_id=folder_item_id,
        apply_project_desktop_folder=apply_project_desktop_folder,
    )


class ContentUpdate(BaseModel):
    """Model for updating content (all fields optional)"""

    name: str | None = Field(None, max_length=500)
    description: str | None = None
    tags: list[str] | None = None
    visibility: Visibility | None = None
    metadata: dict[str, Any] | None = None
    sub_type: str | None = Field(None, max_length=50)
    source_service: str | None = Field(None, max_length=50)
    source_id: str | None = Field(None, max_length=255)

    # Classification updates (Plan 3: Content Manager Expansion)
    company_id: UUID | None = Field(None, description="Update company classification")
    project_id: UUID | None = Field(None, description="Update project classification")
    friend_visibility: bool | None = Field(None, description="Update friend visibility flag")
    shared_with_user_ids: list[str] | None = Field(
        None,
        description="When friend_visibility is true: friend user UUIDs who may access; empty list clears; omit to leave unchanged",
    )

    # Document-specific updates
    title: str | None = Field(None, max_length=500)
    extracted_text: str | None = None  # Allow updating document content
    word_count: int | None = Field(None, ge=0)
    character_count: int | None = Field(None, ge=0)
    access_level: str | None = None
    is_public: bool | None = None

    # Desktop folder (content group) - set to null to unassign
    folder_item_id: str | None = Field(None, max_length=100, description="Desktop folder item_id")

    @field_validator("folder_item_id", mode="before")
    @classmethod
    def normalize_folder_item_id_update(cls, v: str | None) -> str | None:
        return _normalize_folder_item_id(v)


def build_content_update(**fields: Any) -> ContentUpdate:
    """Partial update payload: only keys passed by the caller are applied on persist."""

    return ContentUpdate(**fields)


class ContentCopyRequest(BaseModel):
    """Request body for duplicating unified content under a new display name."""

    name: str = Field(..., min_length=1, max_length=500)


class Content(ContentBase):
    """Full content model"""

    id: UUID
    user_id: str  # DB returns UUID; validator coerces to str

    # Storage
    storage_backend: StorageBackendType | None = None
    file_path: str | None = None
    file_size: int | None = None
    file_hash: str | None = None
    original_filename: str | None = None

    # Extracted content
    extracted_text: str | None = None
    thumbnail_path: str | None = None

    @field_validator("user_id", mode="before")
    @classmethod
    def _user_id_to_str(cls, v: str | UUID) -> str:
        """Accept UUID from DB (unified_content.user_id) and coerce to str."""
        if isinstance(v, UUID):
            return str(v)
        return str(v) if v is not None else ""

    @computed_field
    @property
    def thumbnail_url(self) -> str | None:
        """URL to fetch thumbnail (same auth as download). None if no thumbnail."""
        if self.thumbnail_path and self.id is not None:
            return f"/api/v1/content/{self.id}/thumbnail"
        return None

    # Versioning
    version: int = 1
    parent_id: UUID | None = None
    is_latest_version: bool = True

    # Source tracking
    source_service: str | None = None
    source_id: str | None = None
    related_content: list[UUID] | None = Field(default_factory=list)

    # Access control
    shared_with_user_ids: list[str] | None = Field(default_factory=list)

    # Classification (Plan 3: Content Manager Expansion)
    company_id: UUID | None = None
    project_id: UUID | None = None
    friend_visibility: bool = False

    # Desktop folder (content group)
    folder_item_id: str | None = None

    # Processing
    processing_status: ProcessingStatus = ProcessingStatus.PENDING
    processing_error: str | None = None
    processed_at: datetime | None = None

    # Audit
    created_at: datetime
    updated_at: datetime
    updated_by: str | None = None
    deleted_at: datetime | None = None
    last_accessed_at: datetime | None = None  # For document tracking

    # Permission-aware UI: set by API from current user vs owner (read-only for frontend)
    is_owner: bool | None = None
    can_edit: bool | None = None
    can_delete: bool | None = None
    search_matched_scope: str | None = None
    search_snippet: str | None = None
    search_score: float | None = None
    search_degraded: bool | None = None

    # Populated on multi-version listings (content_versions row count for this content_id)
    version_snapshot_count: int | None = Field(
        default=None,
        description="Number of rows in content_versions for this item (multi-version list only)",
    )
    deduplicated_reused: bool = Field(
        default=False,
        description="True when POST upload matched an existing file hash and returned that row",
    )

    model_config = {"from_attributes": True}


class UnifiedContentDocumentBodyResponse(BaseModel):
    """Permission-aware normalized document body projection for embedded editors."""

    id: UUID
    title: str
    content: str
    content_markdown: str
    content_html: str
    plain_text: str
    mime_type: str
    content_type: str
    source_format: str
    parse_warnings: list[str] = Field(default_factory=list)
    version: int = 0
    can_save: bool = False
    is_owner: bool = False
    original_filename: str | None = None
    file_hash: str | None = None
    updated_at: datetime | None = None


class UnifiedContentDocumentStructureSection(BaseModel):
    """Backend-derived section range used by browser-only display/jump UI."""

    id: str = Field(..., min_length=1, max_length=160)
    level: int = Field(..., ge=1, le=6)
    title: str = Field(..., min_length=1, max_length=500)
    slug: str = Field(..., min_length=1, max_length=200)
    line_start: int = Field(..., ge=1)
    line_end: int = Field(..., ge=1)
    char_start: int = Field(..., ge=0)
    char_end: int = Field(..., ge=0)
    preview: str = Field(default="", max_length=500)
    word_count: int = Field(default=0, ge=0)
    children_count: int = Field(default=0, ge=0)


class UnifiedContentDocumentStructureResponse(BaseModel):
    """Permission-aware backend document outline/section structure."""

    id: UUID
    title: str
    source_format: str
    version: int = 0
    total_lines: int = Field(default=0, ge=0)
    total_chars: int = Field(default=0, ge=0)
    sections: list[UnifiedContentDocumentStructureSection] = Field(default_factory=list)
    truncated: bool = False
    max_sections: int = Field(default=0, ge=0)


class ContentListItemCompact(BaseModel):
    """
    List row for folder/catalog UIs: omits heavy fields (metadata, extracted_text,
    file_path, storage paths, related_content, document stats) present on full Content.
    """

    id: UUID
    name: str
    description: str | None = None
    content_type: ContentType
    mime_type: str | None = None
    original_filename: str | None = None
    file_size: int | None = None
    file_hash: str | None = None
    folder_item_id: str | None = None
    created_at: datetime
    updated_at: datetime
    processing_status: ProcessingStatus = ProcessingStatus.PENDING
    thumbnail_path: str | None = None
    visibility: Visibility = Visibility.PRIVATE
    tags: list[str] = Field(default_factory=list)
    is_owner: bool | None = None
    can_edit: bool | None = None
    can_delete: bool | None = None

    @computed_field
    @property
    def thumbnail_url(self) -> str | None:
        if self.thumbnail_path and self.id is not None:
            return f"/api/v1/content/{self.id}/thumbnail"
        return None

    @classmethod
    def from_content(cls, c: Content) -> ContentListItemCompact:
        return cls(
            id=c.id,
            name=c.name,
            description=c.description,
            content_type=c.content_type,
            mime_type=c.mime_type,
            original_filename=c.original_filename,
            file_size=c.file_size,
            file_hash=c.file_hash,
            folder_item_id=c.folder_item_id,
            created_at=c.created_at,
            updated_at=c.updated_at,
            processing_status=c.processing_status,
            thumbnail_path=c.thumbnail_path,
            visibility=c.visibility,
            tags=c.tags,
            is_owner=c.is_owner,
            can_edit=c.can_edit,
            can_delete=c.can_delete,
        )


# ============================================================================
# VERSION MODELS
# ============================================================================


class VersionBase(BaseModel):
    """Base version model"""

    version: int = Field(..., ge=1, description="Version number")
    changes_description: str | None = Field(None, max_length=500)
    metadata: dict[str, Any] = Field(default_factory=dict)


class VersionCreate(VersionBase):
    """Model for creating new version"""

    content_id: UUID
    changed_by: str = Field(..., max_length=255)
    change_type: ChangeType = ChangeType.UPDATE


class Version(VersionBase):
    """Full version model"""

    id: UUID
    content_id: UUID

    # Snapshot data
    file_path: str | None = None
    file_size: int | None = None
    file_hash: str | None = None

    # Document-specific version data (for UltimateDocEditor)
    title: str | None = None
    content: str | None = None  # Extracted text snapshot
    word_count: int | None = None
    character_count: int | None = None

    # Change tracking
    changed_by: str
    change_type: ChangeType
    content_size: int | None = None

    # Timestamp
    created_at: datetime

    model_config = {"from_attributes": True}


# ============================================================================
# SHARE MODELS
# ============================================================================


class ShareCreate(BaseModel):
    """Model for creating content share"""

    shared_with: str = Field(..., max_length=255, description="User ID or email to share with")
    permission_level: Permission = Field(default=Permission.VIEW, description="Permission level")
    expires_at: datetime | None = Field(None, description="Optional expiration date")


class ShareUpdate(BaseModel):
    """Model for updating share"""

    permission_level: Permission | None = Field(None, description="Updated permission level")
    expires_at: datetime | None = Field(None, description="Updated expiration date")


class Share(BaseModel):
    """Full share model"""

    id: UUID
    content_id: UUID
    shared_by: str
    shared_with: str
    permission_level: Permission
    expires_at: datetime | None = None
    created_at: datetime
    accessed_at: datetime | None = None
    access_count: int = 0

    model_config = {"from_attributes": True}


class ShareResponse(Share):
    """Share response with content details"""

    content_name: str | None = None
    content_type: ContentType | None = None

    model_config = {"from_attributes": True}


# ============================================================================
# TAG MODELS
# ============================================================================


class TagSuggestion(BaseModel):
    """Tag autocomplete suggestion"""

    tag: str
    usage_count: int
    last_used_at: datetime


# ============================================================================
# AUDIT LOG MODELS
# ============================================================================


class AuditAction(StrEnum):
    """Audit log action types"""

    CREATED = "created"
    UPDATED = "updated"
    DELETED = "deleted"
    RESTORED = "restored"
    SHARED = "shared"
    UNSHARED = "unshared"
    REMOVED_FROM_LIBRARY = "removed_from_library"
    ACCESSED_VIEW = "accessed_view"
    ACCESSED_DOWNLOAD = "accessed_download"
    VERSION_CREATED = "version_created"
    VERSION_REVERTED = "version_reverted"
    FILE_REPLACED = "file_replaced"
    QUARANTINE_BLOB_MISSING = "quarantine_blob_missing"
    STORAGE_QUARANTINE_BROKEN = "storage_quarantine_broken"
    STORAGE_RECHECK = "storage_recheck"
    STORAGE_PERMANENT_DELETE = "storage_permanent_delete"


class AuditLogCreate(BaseModel):
    """Model for creating audit log entry"""

    content_id: UUID
    user_id: str = Field(..., max_length=255)
    action: AuditAction
    details: dict[str, Any] = Field(default_factory=dict)
    ip_address: str | None = Field(None, max_length=45)
    user_agent: str | None = None


class AuditLog(AuditLogCreate):
    """Full audit log model"""

    id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}


# ============================================================================
# UPLOAD SESSION MODELS
# ============================================================================


class UploadStatus(StrEnum):
    """Upload session status"""

    ACTIVE = "active"
    COMPLETED = "completed"
    FAILED = "failed"
    EXPIRED = "expired"


class UploadSessionCreate(BaseModel):
    """Model for creating upload session"""

    user_id: str = Field(..., max_length=255)
    file_name: str = Field(..., max_length=500)
    file_size: int = Field(..., gt=0)
    mime_type: str | None = Field(None, max_length=100)
    chunk_size: int = Field(..., gt=0)
    total_chunks: int = Field(..., gt=0)


class UploadSession(UploadSessionCreate):
    """Full upload session model"""

    id: UUID
    uploaded_chunks: list[int] = Field(default_factory=list)
    temp_storage_path: str | None = None
    status: UploadStatus = UploadStatus.ACTIVE
    error_message: str | None = None
    created_at: datetime
    expires_at: datetime
    completed_at: datetime | None = None

    model_config = {"from_attributes": True}


# ============================================================================
# RESPONSE MODELS
# ============================================================================


class ContentListResponse(BaseModel):
    """Paginated content list response"""

    items: list[Content]
    total: int
    page: int
    page_size: int
    has_more: bool
    next_cursor: str | None = None


class ContentListCompactResponse(BaseModel):
    """Paginated list with compact rows (see ContentListItemCompact)."""

    items: list[ContentListItemCompact]
    total: int
    page: int
    page_size: int
    has_more: bool
    next_cursor: str | None = None


class FolderViewDesktopChild(BaseModel):
    """Desktop item wire projection returned alongside compact folder files."""

    id: UUID
    item_id: str
    item_type: ItemType
    name: str
    position: dict[str, Any]
    color: str | None
    gradient: str | None
    is_pinned: bool
    app_component: str | None
    parent_id: UUID | None = None
    parent_item_id: str | None = None
    is_system: bool = False
    system_key: str | None = None
    meta: dict[str, object] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FolderViewResponse(BaseModel):
    """Atomic desktop-child and compact-file view for one folder context."""

    folder_item_id: str | None
    unfiled: bool
    desktop_children: list[FolderViewDesktopChild]
    files: ContentListCompactResponse


class VersionListResponse(BaseModel):
    """Paginated version list response"""

    items: list[Version]
    total: int
    content_id: UUID
