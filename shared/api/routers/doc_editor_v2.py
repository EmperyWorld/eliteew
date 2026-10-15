#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Thin FastAPI router for the Document Editor V2 backend contour.
# It exposes safe unified_content-backed document, draft, import/export, structure, collaboration and EWA suggestion endpoints.
# Invariants:
# - Mounted only under /api/v1/doc-editor-v2; no legacy /api alias is registered.
# - Writes go through DocumentEditorV2Service and never call legacy doc_editor/unified_editor/elite_editor paths.
# - Version conflicts and guarded EWA apply return machine-readable 409 payloads.
# Related:
# - api/services/doc_editor_v2/document_service.py
# - api/schemas/doc_editor_v2.py
# - documentation/product/DOCUMENT-EDITOR-V2.md
# ---
"""Document Editor V2 router."""

from __future__ import annotations

import logging
from typing import NoReturn
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]
from fastapi import APIRouter, Depends, HTTPException, status  # type: ignore[import-untyped]

from api.core.database_manager import get_asyncpg_pool
from api.dependencies.user_context import get_current_user_db_id
from api.schemas.doc_editor_v2 import (
    DocEditorV2CapabilitiesResponse,
    DocEditorV2CollaborationSnapshotRequest,
    DocEditorV2CollaborationSnapshotResponse,
    DocEditorV2CollaborationStateResponse,
    DocEditorV2ConflictDetail,
    DocEditorV2CreateRequest,
    DocEditorV2DocumentResponse,
    DocEditorV2DraftRequest,
    DocEditorV2DraftResponse,
    DocEditorV2EwaSuggestRequest,
    DocEditorV2ExportRequest,
    DocEditorV2ExportResponse,
    DocEditorV2HealthResponse,
    DocEditorV2ImportRequest,
    DocEditorV2ImportResponse,
    DocEditorV2StructureResponse,
    DocEditorV2SuggestionApplyRequest,
    DocEditorV2SuggestionApplyResponse,
    DocEditorV2SuggestionResponse,
    DocEditorV2UpdateRequest,
)
from api.services.doc_editor_v2 import (
    DocumentEditorV2Service,
    DocumentEditorV2UnsupportedError,
    DocumentEditorV2VersionConflictError,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Document Editor V2"])


def _raise_doc_editor_v2_http_error(exc: Exception) -> NoReturn:
    if isinstance(exc, DocumentEditorV2VersionConflictError):
        detail = DocEditorV2ConflictDetail(
            expected_version=exc.expected_version,
            current_version=exc.current_version,
            server_document=exc.server_document,
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=detail.model_dump(mode="json"),
        ) from exc
    if isinstance(exc, DocumentEditorV2UnsupportedError):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    if isinstance(exc, PermissionError):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    if isinstance(exc, ValueError):
        message = str(exc)
        http_status = status.HTTP_404_NOT_FOUND if "not found" in message.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=http_status, detail=message) from exc
    logger.exception("Document Editor V2 request failed")
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="doc_editor_v2_request_failed"
    ) from exc


async def get_doc_editor_v2_service(pool: asyncpg.Pool = Depends(get_asyncpg_pool)) -> DocumentEditorV2Service:
    """Build the V2 service from the shared DatabaseManager asyncpg pool."""

    return DocumentEditorV2Service(pool)


@router.get("/health", response_model=DocEditorV2HealthResponse)
async def doc_editor_v2_health() -> DocEditorV2HealthResponse:
    """Return a narrow health contract for the V2 contour."""

    return DocEditorV2HealthResponse()


@router.get("/capabilities", response_model=DocEditorV2CapabilitiesResponse)
async def doc_editor_v2_capabilities() -> DocEditorV2CapabilitiesResponse:
    """Return the enabled V2 feature surface for frontend rollout decisions."""

    return DocEditorV2CapabilitiesResponse()


@router.post(
    "/documents",
    response_model=DocEditorV2DocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_doc_editor_v2_document(
    request: DocEditorV2CreateRequest,
    content_user_id: str = Depends(get_current_user_db_id),
    service: DocumentEditorV2Service = Depends(get_doc_editor_v2_service),
) -> DocEditorV2DocumentResponse:
    """Create a new V2-owned document in unified_content."""

    try:
        return await service.create_document(content_user_id, request)
    except Exception as exc:
        _raise_doc_editor_v2_http_error(exc)


@router.get("/documents/{document_id}", response_model=DocEditorV2DocumentResponse)
async def get_doc_editor_v2_document(
    document_id: UUID,
    content_user_id: str = Depends(get_current_user_db_id),
    service: DocumentEditorV2Service = Depends(get_doc_editor_v2_service),
) -> DocEditorV2DocumentResponse:
    """Read a unified_content-backed V2 document projection."""

    try:
        return await service.get_document(document_id, content_user_id)
    except Exception as exc:
        _raise_doc_editor_v2_http_error(exc)


@router.put("/documents/{document_id}", response_model=DocEditorV2DocumentResponse)
async def update_doc_editor_v2_document(
    document_id: UUID,
    request: DocEditorV2UpdateRequest,
    content_user_id: str = Depends(get_current_user_db_id),
    service: DocumentEditorV2Service = Depends(get_doc_editor_v2_service),
) -> DocEditorV2DocumentResponse:
    """Canonical save for a V2-owned document."""

    try:
        return await service.update_document(document_id, content_user_id, request)
    except Exception as exc:
        _raise_doc_editor_v2_http_error(exc)


@router.get("/documents/{document_id}/draft", response_model=DocEditorV2DraftResponse)
async def get_doc_editor_v2_draft(
    document_id: UUID,
    content_user_id: str = Depends(get_current_user_db_id),
    service: DocumentEditorV2Service = Depends(get_doc_editor_v2_service),
) -> DocEditorV2DraftResponse:
    """Return the current server draft for a V2 document."""

    try:
        return await service.get_draft(document_id, content_user_id)
    except Exception as exc:
        _raise_doc_editor_v2_http_error(exc)


@router.put("/documents/{document_id}/draft", response_model=DocEditorV2DraftResponse)
async def put_doc_editor_v2_draft(
    document_id: UUID,
    request: DocEditorV2DraftRequest,
    content_user_id: str = Depends(get_current_user_db_id),
    service: DocumentEditorV2Service = Depends(get_doc_editor_v2_service),
) -> DocEditorV2DraftResponse:
    """Store a server draft without changing the canonical document."""

    try:
        return await service.put_draft(document_id, content_user_id, request)
    except Exception as exc:
        _raise_doc_editor_v2_http_error(exc)


@router.delete("/documents/{document_id}/draft", response_model=DocEditorV2DraftResponse)
async def delete_doc_editor_v2_draft(
    document_id: UUID,
    content_user_id: str = Depends(get_current_user_db_id),
    service: DocumentEditorV2Service = Depends(get_doc_editor_v2_service),
) -> DocEditorV2DraftResponse:
    """Delete a stored server draft."""

    try:
        return await service.delete_draft(document_id, content_user_id)
    except Exception as exc:
        _raise_doc_editor_v2_http_error(exc)


@router.post("/import", response_model=DocEditorV2ImportResponse, status_code=status.HTTP_201_CREATED)
async def import_doc_editor_v2_document(
    request: DocEditorV2ImportRequest,
    content_user_id: str = Depends(get_current_user_db_id),
    service: DocumentEditorV2Service = Depends(get_doc_editor_v2_service),
) -> DocEditorV2ImportResponse:
    """Import a supported body/file payload into a V2-owned document."""

    try:
        return await service.import_document(content_user_id, request)
    except Exception as exc:
        _raise_doc_editor_v2_http_error(exc)


@router.post("/documents/{document_id}/export", response_model=DocEditorV2ExportResponse)
async def export_doc_editor_v2_document(
    document_id: UUID,
    request: DocEditorV2ExportRequest,
    content_user_id: str = Depends(get_current_user_db_id),
    service: DocumentEditorV2Service = Depends(get_doc_editor_v2_service),
) -> DocEditorV2ExportResponse:
    """Export a V2 document projection."""

    try:
        return await service.export_document(document_id, content_user_id, request)
    except Exception as exc:
        _raise_doc_editor_v2_http_error(exc)


@router.get("/documents/{document_id}/structure", response_model=DocEditorV2StructureResponse)
async def get_doc_editor_v2_structure(
    document_id: UUID,
    content_user_id: str = Depends(get_current_user_db_id),
    service: DocumentEditorV2Service = Depends(get_doc_editor_v2_service),
) -> DocEditorV2StructureResponse:
    """Return backend-derived document structure."""

    try:
        return await service.get_structure(document_id, content_user_id)
    except Exception as exc:
        _raise_doc_editor_v2_http_error(exc)


@router.post("/documents/{document_id}/ewa/suggest", response_model=DocEditorV2SuggestionResponse)
async def create_doc_editor_v2_ewa_suggestion(
    document_id: UUID,
    request: DocEditorV2EwaSuggestRequest,
    content_user_id: str = Depends(get_current_user_db_id),
    service: DocumentEditorV2Service = Depends(get_doc_editor_v2_service),
) -> DocEditorV2SuggestionResponse:
    """Create an EWA suggestion without mutating the document."""

    try:
        return await service.create_ewa_suggestion(document_id, content_user_id, request)
    except Exception as exc:
        _raise_doc_editor_v2_http_error(exc)


@router.post(
    "/documents/{document_id}/suggestions/{suggestion_id}/apply",
    response_model=DocEditorV2SuggestionApplyResponse,
)
async def apply_doc_editor_v2_ewa_suggestion(
    document_id: UUID,
    suggestion_id: str,
    request: DocEditorV2SuggestionApplyRequest,
    content_user_id: str = Depends(get_current_user_db_id),
    service: DocumentEditorV2Service = Depends(get_doc_editor_v2_service),
) -> DocEditorV2SuggestionApplyResponse:
    """Apply a stored EWA suggestion after explicit user approval."""

    try:
        return await service.apply_ewa_suggestion(document_id, suggestion_id, content_user_id, request)
    except Exception as exc:
        _raise_doc_editor_v2_http_error(exc)


@router.get("/documents/{document_id}/collaboration", response_model=DocEditorV2CollaborationStateResponse)
async def get_doc_editor_v2_collaboration_state(
    document_id: UUID,
    content_user_id: str = Depends(get_current_user_db_id),
    service: DocumentEditorV2Service = Depends(get_doc_editor_v2_service),
) -> DocEditorV2CollaborationStateResponse:
    """Return collaboration room and snapshot metadata."""

    try:
        return await service.get_collaboration_state(document_id, content_user_id)
    except Exception as exc:
        _raise_doc_editor_v2_http_error(exc)


@router.put(
    "/documents/{document_id}/collaboration/snapshot",
    response_model=DocEditorV2CollaborationSnapshotResponse,
)
async def put_doc_editor_v2_collaboration_snapshot(
    document_id: UUID,
    request: DocEditorV2CollaborationSnapshotRequest,
    content_user_id: str = Depends(get_current_user_db_id),
    service: DocumentEditorV2Service = Depends(get_doc_editor_v2_service),
) -> DocEditorV2CollaborationSnapshotResponse:
    """Store a compact collaboration snapshot."""

    try:
        return await service.put_collaboration_snapshot(document_id, content_user_id, request)
    except Exception as exc:
        _raise_doc_editor_v2_http_error(exc)
