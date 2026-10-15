#!/usr/bin/env python3
# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   🔥💎 UNIFIED EDITOR ROUTER - PRODUCTION READY 💎🔥
# Invariants:
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
# Related:
#   - shared/api/main.py (регистрация роутеров); см. затронутые services/models.
# ------------------------------------------------------------------------------
"""
🔥💎 UNIFIED EDITOR ROUTER - PRODUCTION READY 💎🔥
Clean architecture router с полной интеграцией всех сервисов

Features:
✅ Document processing (DOCX/PDF/HTML/TXT)
✅ AI analysis with Llama
✅ Text extraction with Tika
✅ Full-text search with Elasticsearch
✅ PostgreSQL storage
✅ Export to multiple formats

Architecture:
- Router handles HTTP only
- All logic delegated to services
- Dependency injection
- Proper error handling
- Graceful degradation

Created: 2025-10-02
Author: Empery World Elite Development Team
"""

import asyncio
import builtins
import contextlib
import logging
from datetime import UTC, datetime
from typing import Any

ES_INIT_TIMEOUT = 5.0  # seconds; avoid blocking startup if ES unreachable
EXPORT_ENGINE_INIT_TIMEOUT = 5.0  # seconds; mkdir/gettempdir can block on NFS/slow FS

from fastapi import APIRouter, Depends, HTTPException, Query  # type: ignore[import-untyped]
from pydantic import BaseModel, Field  # type: ignore[import-untyped]

from api.core.auth import User
from api.core.database_manager import get_asyncpg_pool, get_database_manager
from api.core.oauth2_auth import require_oauth2_user
from api.services.business_intelligence.elasticsearch_service import ElasticsearchService
from api.services.business_intelligence.llama_ai_service import LlamaAIService
from api.services.cache_service import best_effort_invalidate_dashboard_user_cache
from api.services.unified_editor import (
    DocumentAnalyzer,
    ExportEngine,
    PostgresDocumentStorage,
    TikaService,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/unified-editor", tags=["Unified Editor - AI Document Processing"])

# ========================================
# REQUEST/RESPONSE MODELS
# ========================================


class ProcessDocumentRequest(BaseModel):
    """Request for processing document"""

    fileName: str = Field(..., description="Original file name")
    fileType: str = Field(..., description="File type (.docx, .pdf, .html, .txt)")
    fileData: str = Field(..., description="Base64 encoded file content")
    extractQuestions: bool = Field(True, description="Extract )*(...)* patterns")
    extractJSONFlags: bool = Field(True, description="Extract {JSON(...)} flags")
    enableAIAnalysis: bool = Field(False, description="Enable AI analysis")


class ProcessedDocument(BaseModel):
    """Processed document response"""

    html: str
    content: str
    extractedData: list[dict[str, Any]] = Field(default_factory=list)
    ai_analysis: dict[str, Any] | None = None
    processing_time: float


class CreateDocumentRequest(BaseModel):
    """Request to create document"""

    title: str = Field(..., min_length=1, max_length=255)
    content: str
    document_type: str = Field(default="text")
    metadata: dict[str, Any] | None = None


class UpdateDocumentRequest(BaseModel):
    """Request to update document"""

    title: str | None = None
    content: str | None = None
    metadata: dict[str, Any] | None = None


class ExportDocumentRequest(BaseModel):
    """Request to export document"""

    document_id: str
    format: str = Field(..., description="Export format: docx, html, txt, md")


# ========================================
# DEPENDENCY INJECTION
# ========================================

_storage: PostgresDocumentStorage | None = None
_tika_service: TikaService | None = None
_llama_service: LlamaAIService | None = None
_es_service: ElasticsearchService | None = None
_es_init_started = False  # so we only start background init once
_analyzer: DocumentAnalyzer | None = None
_export_engine: ExportEngine | None = None


async def _init_es_background() -> None:
    """Initialize Elasticsearch in background; do not block startup."""
    global _es_service, _analyzer
    logger.info("Initializing Elasticsearch for Unified Editor (background)...")
    es_instance: ElasticsearchService | None = None
    try:
        es_instance = ElasticsearchService()
        await es_instance.initialize()
        _es_service = es_instance
        logger.info("ElasticsearchService initialized (background)")
        if _analyzer is not None and _tika_service is not None and _llama_service is not None:
            _analyzer = DocumentAnalyzer(_tika_service, _llama_service, _es_service)
    except Exception as e:  # noqa: BLE001
        logger.warning("Elasticsearch not available for Unified Editor: %s", e)


async def get_services() -> dict[str, Any]:
    """Get or initialize services (singleton pattern)"""
    global _storage, _tika_service, _llama_service, _es_service, _es_init_started, _analyzer, _export_engine

    if not _storage:
        try:
            db_pool = await get_asyncpg_pool()
            _storage = PostgresDocumentStorage(db_pool)
            logger.info("PostgresDocumentStorage initialized")
        except Exception:
            logger.exception("Storage initialization failed")
            _storage = None

    if not _tika_service:
        try:
            _tika_service = TikaService()
            logger.info("TikaService initialized")
        except Exception:
            logger.exception("Tika initialization failed")
            _tika_service = None

    if not _llama_service:
        try:
            _llama_service = LlamaAIService()
            logger.info("LlamaAIService initialized")
        except Exception:
            logger.exception("Llama initialization failed")
            _llama_service = None

    # ES init in background so startup never blocks on ES (DNS/slow cluster)
    if not _es_service and not _es_init_started:
        _es_init_started = True
        asyncio.create_task(_init_es_background())

    if not _analyzer and _tika_service and _llama_service:
        logger.info("Initializing DocumentAnalyzer...")
        try:
            _analyzer = DocumentAnalyzer(_tika_service, _llama_service, _es_service)
            logger.info("DocumentAnalyzer initialized")
        except Exception:
            logger.exception("Analyzer initialization failed")
            _analyzer = None

    if not _export_engine:
        logger.info("Initializing ExportEngine...")
        try:
            # ExportEngine() does mkdir(gettempdir()/...) which can block on NFS/slow FS
            async with asyncio.timeout(EXPORT_ENGINE_INIT_TIMEOUT):
                _export_engine = await asyncio.to_thread(ExportEngine)
            logger.info("ExportEngine initialized")
        except TimeoutError:
            logger.warning(
                "⚠️ ExportEngine init timed out (%.1fs), continuing without export",
                EXPORT_ENGINE_INIT_TIMEOUT,
            )
            _export_engine = None
        except Exception:
            logger.exception("Export engine initialization failed")
            _export_engine = None

    return {
        "storage": _storage,
        "tika": _tika_service,
        "llama": _llama_service,
        "elasticsearch": _es_service,
        "analyzer": _analyzer,
        "export": _export_engine,
    }


# ========================================
# HEALTH & STATUS ENDPOINTS
# ========================================


@router.get("/health")
async def health_check() -> dict[str, Any]:
    """
    Check system health

    Returns comprehensive health status of all services
    """
    try:
        services = await get_services()

        # Check PostgreSQL via DatabaseManager (AsyncSession)
        postgres_healthy = False
        try:
            manager = await get_database_manager()
            async with manager.get_postgres_session() as session:
                from sqlalchemy import text as sa_text

                await session.execute(sa_text("SELECT 1"))
            postgres_healthy = True
        except (ConnectionError, TimeoutError, RuntimeError):  # fmt: skip  # noqa: BLE001
            logger.debug("PostgreSQL health check failed")

        # Check Tika
        tika_healthy = await services["tika"].health_check()

        # Check Llama
        llama_healthy = await services["llama"].health_check()

        # Check Elasticsearch
        es_healthy = False
        if services["elasticsearch"] and services["elasticsearch"].client:
            with contextlib.suppress(builtins.BaseException):
                es_healthy = await services["elasticsearch"].client.ping()

        overall_status = "healthy" if postgres_healthy and tika_healthy else "degraded"

        return {
            "status": overall_status,
            "services": {
                "postgres": "healthy" if postgres_healthy else "unhealthy",
                "tika": "healthy" if tika_healthy else "unhealthy",
                "llama": "healthy" if llama_healthy else "unhealthy",
                "elasticsearch": "healthy" if es_healthy else "unhealthy",
            },
            "timestamp": datetime.now(UTC).isoformat(),
        }

    except Exception as e:
        logger.exception("Health check failed")
        raise HTTPException(status_code=500, detail=str(e)) from e


# ========================================
# DOCUMENT PROCESSING ENDPOINTS
# ========================================


@router.post("/process", response_model=ProcessedDocument)
async def process_document(
    request: ProcessDocumentRequest, user: User = Depends(require_oauth2_user)
) -> ProcessedDocument:
    """
    Process uploaded document file:
    - Parse DOCX/PDF/HTML/TXT with Tika
    - Extract )*(...)* question patterns
    - Extract {JSON(...)} flags
    - Optional AI analysis with Llama
    """
    try:
        logger.info("📄 Processing document: %s", request.fileName)

        services = await get_services()
        analyzer = services["analyzer"]

        if not analyzer:
            raise HTTPException(status_code=503, detail="Document analyzer not available")

        # Process document
        result = await analyzer.process_document(
            file_name=request.fileName,
            file_type=request.fileType,
            file_data=request.fileData,
            user_id=user.id,
            options={
                "extractQuestions": request.extractQuestions,
                "extractJSONFlags": request.extractJSONFlags,
                "enableAIAnalysis": request.enableAIAnalysis,
            },
        )

        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error", "Processing failed"))

        return ProcessedDocument(
            html=result["html"],
            content=result["content"],
            extractedData=result.get("extractedData", []),
            ai_analysis=result.get("ai_analysis"),
            processing_time=result.get("processing_time", 0),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Processing failed")
        raise HTTPException(status_code=500, detail=str(e)) from e


# ========================================
# CRUD ENDPOINTS
# ========================================


@router.post("/documents")
async def create_document(request: CreateDocumentRequest, user: User = Depends(require_oauth2_user)) -> dict[str, Any]:
    """Create new document"""
    try:
        services = await get_services()
        storage = services["storage"]

        if not storage:
            raise HTTPException(status_code=503, detail="Storage not available")

        result = await storage.create_document(
            user_id=user.id,
            title=request.title,
            content=request.content,
            document_type=request.document_type,
            metadata=request.metadata,
        )
        await best_effort_invalidate_dashboard_user_cache(str(user.id))
        return result

    except Exception as e:
        logger.exception("Create document failed")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/documents/{document_id}")
async def get_document(document_id: str, user: User = Depends(require_oauth2_user)) -> dict[str, Any]:
    """Get document by ID"""
    try:
        services = await get_services()
        storage = services["storage"]

        if not storage:
            raise HTTPException(status_code=503, detail="Storage not available")

        document = await storage.get_document(document_id, user.id)

        if not document:
            raise HTTPException(status_code=404, detail="Document not found")

        return document

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Get document failed: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.patch("/documents/{document_id}")
async def update_document(
    document_id: str, request: UpdateDocumentRequest, user: User = Depends(require_oauth2_user)
) -> dict[str, Any]:
    """Update document"""
    try:
        services = await get_services()
        storage = services["storage"]

        if not storage:
            raise HTTPException(status_code=503, detail="Storage not available")

        updates = request.model_dump(exclude_unset=True)
        document = await storage.update_document(document_id, user.id, updates)

        if not document:
            raise HTTPException(status_code=404, detail="Document not found")

        return document

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Update document failed: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/documents/{document_id}")
async def delete_document(document_id: str, user: User = Depends(require_oauth2_user)) -> dict[str, Any]:
    """Delete document"""
    try:
        services = await get_services()
        storage = services["storage"]

        if not storage:
            raise HTTPException(status_code=503, detail="Storage not available")

        deleted = await storage.delete_document(document_id, user.id)

        if not deleted:
            raise HTTPException(status_code=404, detail="Document not found")

        return {"success": True, "message": "Document deleted"}

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Delete document failed: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/documents")
async def list_documents(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(require_oauth2_user),
) -> dict[str, Any]:
    """List user's documents"""
    try:
        services = await get_services()
        storage = services["storage"]

        if not storage:
            raise HTTPException(status_code=503, detail="Storage not available")

        documents = await storage.list_user_documents(user.id, limit, offset)

        return {"documents": documents, "total": len(documents)}

    except Exception as e:
        logger.exception(f"List documents failed: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


# ========================================
# EXPORT ENDPOINTS
# ========================================


@router.post("/export")
async def export_document(request: ExportDocumentRequest, user: User = Depends(require_oauth2_user)) -> dict[str, Any]:
    """Export document to specified format"""
    try:
        services = await get_services()
        storage = services["storage"]
        export_engine = services["export"]

        if not storage or not export_engine:
            raise HTTPException(status_code=503, detail="Services not available")

        # Get document
        document = await storage.get_document(request.document_id, user.id)
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")

        # Export
        result = await export_engine.export_document(
            content=document["content"],
            format=request.format,
            title=document["title"],
            metadata=document.get("metadata"),
        )

        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error"))

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Export failed: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


#
# Startup/shutdown are handled at application level.
