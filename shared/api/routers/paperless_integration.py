# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared Paperless-ngx integration API for UltimateDocEditor, DocEditorV2 and operator browse flows.
# Invariants:
# - Requires OAuth user; token stays server-side (PAPERLESS_API_TOKEN env).
# - Import endpoints delegate to domain services; this router does not persist documents itself.
# Related:
# - api/services/stack4/paperless_gateway.py
# - api/routers/elite_editor.py, doc_editor_v2.py
# ---

"""Paperless-ngx integration routes."""

from __future__ import annotations

import base64
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status  # type: ignore[import-untyped]
from pydantic import BaseModel, Field

from api.core.auth import User
from api.core.oauth2_auth import require_oauth2_user
from api.services.stack4.paperless_gateway import (
    PaperlessGatewayError,
    PaperlessNotConfigured,
    get_paperless_gateway,
    paperless_configured,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/paperless", tags=["Paperless Integration"])


class PaperlessHealthResponse(BaseModel):
    configured: bool
    reachable: bool


class PaperlessDocumentItem(BaseModel):
    id: int
    title: str
    created: str | None = None
    modified: str | None = None
    file_type: str | None = None
    original_file_name: str | None = None
    tags: list[int] = Field(default_factory=list)


class PaperlessDocumentListResponse(BaseModel):
    items: list[PaperlessDocumentItem]
    total: int
    page: int
    page_size: int


class PaperlessImportPayload(BaseModel):
    paperless_id: int = Field(ge=1)


@router.get("/health", response_model=PaperlessHealthResponse)
async def paperless_health() -> PaperlessHealthResponse:
    gateway = get_paperless_gateway()
    configured = paperless_configured()
    reachable = configured and await gateway.health_ok()
    return PaperlessHealthResponse(configured=configured, reachable=reachable)


@router.get("/documents", response_model=PaperlessDocumentListResponse)
async def list_paperless_documents(
    query: str | None = Query(default=None, max_length=500),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    _user: User = Depends(require_oauth2_user),
) -> PaperlessDocumentListResponse:
    gateway = get_paperless_gateway()
    try:
        summaries, total = await gateway.list_documents(query=query, page=page, page_size=page_size)
    except PaperlessNotConfigured as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except PaperlessGatewayError as exc:
        logger.warning("paperless_list_failed err=%s", exc)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    items = [
        PaperlessDocumentItem(
            id=s.id,
            title=s.title,
            created=s.created,
            modified=s.modified,
            file_type=s.file_type,
            original_file_name=s.original_file_name,
            tags=list(s.tags),
        )
        for s in summaries
    ]
    return PaperlessDocumentListResponse(items=items, total=total, page=page, page_size=page_size)


@router.post("/import/{paperless_id}/elite-editor")
async def import_paperless_to_elite_editor(
    paperless_id: int,
    current_user: User = Depends(require_oauth2_user),
) -> dict:
    from api.services.elite_editor import get_orchestrator

    try:
        orchestrator = await get_orchestrator()
        return await orchestrator.import_from_paperless(paperless_id, str(current_user.id))
    except PaperlessNotConfigured as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("paperless_elite_import_failed paperless_id=%s", paperless_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="paperless_import_failed"
        ) from exc


@router.post("/import/{paperless_id}/doc-editor-v2")
async def import_paperless_to_doc_editor_v2(
    paperless_id: int,
    current_user: User = Depends(require_oauth2_user),
) -> dict:
    from api.core.database_manager import get_asyncpg_pool
    from api.schemas.doc_editor_v2 import DocEditorV2ImportRequest, DocEditorV2SourceFormat
    from api.services.doc_editor_v2 import DocumentEditorV2Service
    from api.services.stack4.paperless_gateway import get_paperless_gateway

    gateway = get_paperless_gateway()
    try:
        file_bytes, meta = await gateway.download_document_bytes(paperless_id)
    except PaperlessNotConfigured as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except PaperlessGatewayError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    filename = meta.original_file_name or f"{meta.title}.pdf"
    suffix = filename.rsplit(".", 1)[-1].lower() if "." in filename else "pdf"
    try:
        source_format = DocEditorV2SourceFormat(suffix)
    except ValueError:
        source_format = DocEditorV2SourceFormat.PDF

    pool = await get_asyncpg_pool()
    service = DocumentEditorV2Service(pool)
    request = DocEditorV2ImportRequest(
        filename=filename,
        source_format=source_format,
        mime_type=None,
        content_text=None,
        content_base64=base64.b64encode(file_bytes).decode("ascii"),
        title=meta.title,
    )
    try:
        imported = await service.import_document(str(current_user.id), request)
    except Exception as exc:
        logger.exception("paperless_v2_import_failed paperless_id=%s", paperless_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="paperless_import_failed"
        ) from exc
    return imported.model_dump(mode="json")
