#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unified Content version management API for version history, reverts, byte downloads, and ticketed direct downloads.
# Invariants:
# - Version bytes require Bearer auth or a short-lived ticket scoped to the version and user.
# - Ticket consume re-checks version access before serving bytes; no JWT is placed in URLs.
# Related:
# - api/services/unified_content/version_manager.py
# - api/services/unified_content/content_download_ticket_service.py
# ---
"""
Unified Content System - Version Management API Router

Week 5 Implementation - Version Control
Provides endpoints for version history, manual versioning, reversion, and downloads.

Endpoints:
- GET    /api/content/{content_id}/versions           - List version history
- POST   /api/content/{content_id}/versions           - Create manual version
- POST   /api/content/{content_id}/revert/{version_number} - Revert to version
- GET    /api/content/versions/{version_id}/download  - Download version file

Author: Claude Code AI Assistant
Created: 2025-10-05
"""

import logging
from datetime import datetime
from typing import Any, NoReturn
from urllib.parse import quote
from uuid import UUID, uuid4

import asyncpg  # type: ignore[import-not-found]
from fastapi import APIRouter, Depends, HTTPException, Query, Request  # type: ignore[import-untyped]
from fastapi.responses import StreamingResponse  # type: ignore[import-untyped]
from pydantic import BaseModel, ConfigDict, Field  # type: ignore[import-untyped]

from api.core.database_manager import get_asyncpg_pool
from api.core.oauth2_auth import require_oauth2_user, require_oauth2_user_short_session
from api.dependencies.user_context import get_current_user_db_id as get_content_user_id
from api.dependencies.user_context import (
    get_current_user_db_id_short_session as get_content_user_id_short_session,
)
from api.models import User
from api.services.unified_content.content_download_ticket_service import (
    ContentDownloadTicketService,
    ContentDownloadTicketUnavailableError,
)
from api.services.unified_content.storage_backends.factory import (
    get_storage_factory,
)
from api.services.unified_content.version_manager import VersionManager

# ============================================================================
# PYDANTIC MODELS
# ============================================================================


class VersionResponse(BaseModel):
    """Complete version information response"""

    version_id: UUID
    content_id: UUID
    version_number: int
    file_size: int
    file_hash: str
    mime_type: str
    name: str
    description: str | None = None
    tags: list[str] = []
    metadata: dict | None = None
    created_by: str
    created_at: datetime
    change_description: str | None = None

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "version_id": "123e4567-e89b-12d3-a456-426614174000",
                "content_id": "123e4567-e89b-12d3-a456-426614174001",
                "version_number": 3,
                "file_size": 1048576,
                "file_hash": "abc123...",
                "mime_type": "application/pdf",
                "name": "report_v3.pdf",
                "description": "Q3 Financial Report",
                "tags": ["finance", "q3", "2025"],
                "metadata": {"author": "John Doe"},
                "created_by": "user@example.com",
                "created_at": "2025-10-05T12:00:00Z",
                "change_description": "Updated financial figures",
            }
        }
    )


class VersionListItem(BaseModel):
    """Compact version info for list view"""

    version_id: UUID
    version_number: int
    file_size: int
    created_by: str
    created_at: datetime
    change_description: str | None = None

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "version_id": "123e4567-e89b-12d3-a456-426614174000",
                "version_number": 2,
                "file_size": 524288,
                "created_by": "user@example.com",
                "created_at": "2025-10-04T15:30:00Z",
                "change_description": "Fixed typos in section 3",
            }
        }
    )


class VersionListResponse(BaseModel):
    """Paginated version history response"""

    total: int
    versions: list[VersionListItem]
    limit: int
    offset: int

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "total": 15,
                "versions": [
                    {
                        "version_id": "123e4567-e89b-12d3-a456-426614174003",
                        "version_number": 3,
                        "file_size": 1048576,
                        "created_by": "user@example.com",
                        "created_at": "2025-10-05T12:00:00Z",
                        "change_description": "Updated financial figures",
                    }
                ],
                "limit": 50,
                "offset": 0,
            }
        }
    )


class VersionDownloadTicketResponse(BaseModel):
    """Relative direct-download URL and ticket TTL for a version file."""

    download_url: str
    expires_in_seconds: int


class CreateVersionRequest(BaseModel):
    """Request to create manual version snapshot"""

    change_description: str | None = Field(None, max_length=500, description="Description of changes in this version")

    model_config = ConfigDict(
        json_schema_extra={"example": {"change_description": "Created checkpoint before major edits"}}
    )


class RevertRequest(BaseModel):
    """Request to revert content to previous version"""

    change_description: str | None = Field(None, max_length=500, description="Reason for reverting to this version")

    model_config = ConfigDict(
        json_schema_extra={"example": {"change_description": "Reverting to stable version before bug was introduced"}}
    )


# ============================================================================
# DEPENDENCY INJECTION
# ============================================================================


async def get_db_pool() -> asyncpg.Pool:
    """Get shared asyncpg pool from DatabaseManager."""
    pool = await get_asyncpg_pool()
    assert isinstance(pool, asyncpg.Pool)
    return pool


async def get_version_manager() -> VersionManager:
    """
    Get VersionManager instance with database pool and storage backend.

    Raises:
        HTTPException: 503 if database is unavailable
    """

    db_pool = await get_db_pool()
    storage_factory = get_storage_factory(db_pool)
    return VersionManager(db_pool, storage_factory)


async def get_content_download_ticket_service() -> ContentDownloadTicketService:
    """Return the stateless Redis-backed content download ticket service."""
    return ContentDownloadTicketService()


# ============================================================================
# ROUTER SETUP
# ============================================================================

router = APIRouter(prefix="/content", tags=["Unified Content - Versioning"])
logger = logging.getLogger(__name__)


def _raise_internal_version_error(operation: str, error: Exception) -> NoReturn:
    error_id = uuid4().hex[:12]
    logger.exception("unified_content_versions: %s failed (error_id=%s)", operation, error_id)
    raise HTTPException(
        status_code=500,
        detail=f"{operation} failed. Reference: {error_id}",
        headers={"X-Error-ID": error_id},
    ) from None


# ============================================================================
# API ENDPOINTS
# ============================================================================


def _build_version_download_response(file_data: bytes, version_info: dict[str, Any]) -> StreamingResponse:
    """Build version byte response with RFC 5987 filename support."""
    raw_name = str(version_info.get("name") or "download")
    try:
        content_disposition = f"attachment; filename*=UTF-8''{quote(raw_name, safe='')}"
    except Exception:
        content_disposition = 'attachment; filename="download"'
    return StreamingResponse(
        iter([file_data]),
        media_type=str(version_info.get("mime_type") or "application/octet-stream"),
        headers={
            "Content-Disposition": content_disposition,
            "Content-Length": str(len(file_data)),
        },
    )


@router.post(
    "/versions/{version_id}/download-ticket",
    response_model=VersionDownloadTicketResponse,
)
async def create_version_download_ticket(
    version_id: UUID,
    current_user: User = Depends(require_oauth2_user),
    content_user_id: str = Depends(get_content_user_id),
    version_manager: VersionManager = Depends(get_version_manager),
    ticket_service: ContentDownloadTicketService = Depends(get_content_download_ticket_service),
) -> VersionDownloadTicketResponse:
    """Issue a short-lived ticket URL for direct version file download."""
    try:
        await version_manager.get_version(version_id, content_user_id)
        ticket, ttl = await ticket_service.issue(
            kind="version",
            user_id=content_user_id,
            resource_id=version_id,
        )
        return VersionDownloadTicketResponse(
            download_url=f"/api/v1/content/versions/{version_id}/download-by-ticket?ticket={ticket}",
            expires_in_seconds=ttl,
        )
    except ContentDownloadTicketUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        _raise_internal_version_error("Version download ticket issue", exc)


@router.get("/versions/{version_id}/download-by-ticket")
async def download_version_by_ticket(
    version_id: UUID,
    request: Request,
    ticket: str = Query(..., min_length=8, max_length=256),
    version_manager: VersionManager = Depends(get_version_manager),
    ticket_service: ContentDownloadTicketService = Depends(get_content_download_ticket_service),
) -> StreamingResponse:
    """Download version bytes using a short-lived ticket URL."""
    payload = await ticket_service.consume(ticket, expected_kind="version", request=request)
    if not payload or str(payload.get("resource_id") or "") != str(version_id):
        raise HTTPException(status_code=401, detail="Download ticket is invalid or expired.")
    user_id = str(payload.get("user_id") or "").strip()
    if not user_id:
        raise HTTPException(status_code=401, detail="Download ticket is invalid or expired.")
    try:
        file_data, version_info = await version_manager.download_version(version_id=version_id, user_id=user_id)
        return _build_version_download_response(file_data, version_info)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        _raise_internal_version_error("Version ticket download", exc)


@router.get(
    "/{content_id}/versions",
    response_model=VersionListResponse,
    summary="List version history",
    description="""
    Get paginated version history for a content item.

    **Features:**
    - Returns all versions ordered by version_number DESC (newest first)
    - Includes change descriptions if provided
    - Pagination support with limit/offset
    - Permission check: user must have read access to content

    **Use cases:**
    - View document edit history
    - Track who made changes and when
    - Find specific version to revert to
    """,
    responses={
        200: {"description": "Version history retrieved successfully"},
        401: {"description": "Not authenticated"},
        403: {"description": "No permission to view this content"},
        404: {"description": "Content not found"},
        503: {"description": "Database unavailable"},
    },
)
async def list_versions(
    content_id: UUID,
    limit: int = Query(50, ge=1, le=200, description="Max versions to return"),
    offset: int = Query(0, ge=0, description="Number of versions to skip"),
    current_user: User = Depends(require_oauth2_user),
    content_user_id: str = Depends(get_content_user_id),
    version_manager: VersionManager = Depends(get_version_manager),
) -> dict[str, Any]:
    """List all versions for a content item with pagination."""
    try:
        versions = await version_manager.list_versions(
            content_id=content_id, user_id=content_user_id, limit=limit, offset=offset
        )

        # Get total count for pagination
        db_pool = await get_db_pool()
        async with db_pool.acquire() as conn:
            total = await conn.fetchval("SELECT COUNT(*) FROM content_versions WHERE content_id = $1", content_id)

        # Return VersionListResponse structure
        return {"total": total, "versions": versions, "limit": limit, "offset": offset}

    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except Exception as e:
        _raise_internal_version_error("Version history lookup", e)


@router.post(
    "/{content_id}/versions",
    response_model=VersionResponse,
    status_code=201,
    summary="Create manual version",
    description="""
    Create a manual version snapshot of current content state.

    **Features:**
    - Creates version with current file data + metadata
    - Auto-increments version_number
    - Preserves all content attributes at time of snapshot
    - Optional change description

    **Use cases:**
    - Create checkpoint before major edits
    - Mark stable versions for production
    - Manually version content that doesn't auto-version on update

    **Note:** This creates a NEW version. For automatic versioning on updates,
    see PATCH /api/content/{id} endpoint.
    """,
    responses={
        201: {"description": "Version created successfully"},
        400: {"description": "Invalid request"},
        401: {"description": "Not authenticated"},
        403: {"description": "No permission to version this content"},
        404: {"description": "Content not found"},
        503: {"description": "Database or storage unavailable"},
    },
)
async def create_manual_version(
    content_id: UUID,
    request: CreateVersionRequest,
    current_user: User = Depends(require_oauth2_user),
    content_user_id: str = Depends(get_content_user_id),
    version_manager: VersionManager = Depends(get_version_manager),
) -> VersionResponse:
    """Create a manual version snapshot of current content."""
    try:
        version_id = await version_manager.create_version(
            content_id=content_id,
            user_id=content_user_id,
            change_description=request.change_description,
        )
        # Get version details to return as VersionResponse
        version_data = await version_manager.get_version(version_id, content_user_id)
        return VersionResponse(**version_data)

    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except Exception as e:
        _raise_internal_version_error("Version creation", e)


@router.post(
    "/{content_id}/revert/{version_number}",
    response_model=VersionResponse,
    status_code=201,
    summary="Revert to previous version",
    description="""
    Revert content to a specific version by creating a new version with old data.

    **How it works:**
    1. Fetches specified version data from storage
    2. Creates NEW version with that data (doesn't delete history)
    3. Updates main content record to point to new version
    4. Returns the newly created version

    **Features:**
    - Non-destructive: preserves all version history
    - Creates new version_number (e.g., v5 reverts to v2 → creates v6)
    - Optional description explaining why reverting
    - Full audit trail maintained

    **Use cases:**
    - Undo unwanted changes
    - Restore working version after bug
    - Rollback to last stable state

    **Example:**
    Current version is 5 → Revert to version 2 → Creates version 6 with v2 data
    """,
    responses={
        201: {"description": "Reverted successfully, new version created"},
        400: {"description": "Invalid version number"},
        401: {"description": "Not authenticated"},
        403: {"description": "No permission to modify this content"},
        404: {"description": "Content or version not found"},
        503: {"description": "Database or storage unavailable"},
    },
)
async def revert_to_version(
    content_id: UUID,
    version_number: int,
    request: RevertRequest,
    current_user: User = Depends(require_oauth2_user),
    content_user_id: str = Depends(get_content_user_id),
    version_manager: VersionManager = Depends(get_version_manager),
) -> VersionResponse:
    """Revert content to a previous version (creates new version)."""
    try:
        version_id = await version_manager.revert_to_version(
            content_id=content_id,
            version=version_number,
            user_id=content_user_id,
            change_description=request.change_description,
        )
        # Get version details to return as VersionResponse
        version_data = await version_manager.get_version(version_id, content_user_id)
        return VersionResponse(**version_data)

    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except Exception as e:
        _raise_internal_version_error("Version revert", e)


@router.get(
    "/versions/{version_id}/download",
    summary="Download version file",
    description="""
    Download file data from a specific version.

    **Features:**
    - Streams file data directly from storage (PostgreSQL or SeaweedFS)
    - Sets proper Content-Type and Content-Disposition headers
    - Permission check: user must have read access to parent content
    - Works with any version in history

    **Use cases:**
    - Download old version for comparison
    - Retrieve file before changes were made
    - Export version for external use

    **Response headers:**
    - Content-Type: Original file MIME type
    - Content-Disposition: attachment; filename="<name>"
    - Content-Length: File size in bytes
    """,
    responses={
        200: {
            "description": "File downloaded successfully",
            "content": {"application/octet-stream": {}},
        },
        401: {"description": "Not authenticated"},
        403: {"description": "No permission to access this version"},
        404: {"description": "Version not found"},
        503: {"description": "Storage service unavailable"},
    },
)
async def download_version(
    version_id: UUID,
    current_user: User = Depends(require_oauth2_user_short_session),
    content_user_id: str = Depends(get_content_user_id_short_session),
    version_manager: VersionManager = Depends(get_version_manager),
) -> StreamingResponse:
    """Download file data from a specific version."""
    try:
        file_data, version_info = await version_manager.download_version(version_id=version_id, user_id=content_user_id)
        return _build_version_download_response(file_data, version_info)

    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e)) from e
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except Exception as e:
        _raise_internal_version_error("Version download", e)
