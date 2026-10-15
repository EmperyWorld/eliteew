#!/usr/bin/env python3
# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   🔥💎⚡ ELITE DOCUMENT EDITOR - ULTIMATE PRODUCTION ROUTER ⚡💎🔥
# Invariants:
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
# Related:
#   - shared/api/main.py (регистрация роутеров); см. затронутые services/models.
# ------------------------------------------------------------------------------
"""
🔥💎⚡ ELITE DOCUMENT EDITOR - ULTIMATE PRODUCTION ROUTER ⚡💎🔥

Unified document editor integrating ALL EliteEW services:
- Stack 1: PostgreSQL, Redis, Elasticsearch, ChromaDB, MinIO
- Stack 2: Llama AI, WhisperX, LocalAI, LocalAGI
- Stack 4: Tika, Gotenberg, Tesseract, Paperless, PDF Tools

Architecture: Clean 3-layer separation
- Router: HTTP endpoints only (this file)
- Services: Business logic orchestration
- Infrastructure: External service integrations

Created: 2025-10-02
Author: Unified Code Master (Claude)
Version: 1.0.0
"""

import json
import logging
from datetime import UTC, datetime
from typing import Any, Literal

from fastapi import (  # type: ignore[import-untyped]
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
)
from fastapi.responses import FileResponse  # type: ignore[import-untyped]
from pydantic import BaseModel, Field  # type: ignore[import-untyped]# type: ignore[import-untyped]

from api.core.auth import User
from api.core.http_clients import get_httpx_client
from api.core.oauth2_auth import require_oauth2_user
from api.utils.llama_models import DEFAULT_MODEL

logger = logging.getLogger(__name__)

# Prefix is /elite-editor; main.py includes with prefix /api/v1 and /api for /api/v1/elite-editor/* and /api/elite-editor/*
router = APIRouter(prefix="/elite-editor", tags=["Elite Document Editor - Ultimate Edition"])

# ========================================
# PYDANTIC MODELS - API Contract
# ========================================


class DocumentMetadata(BaseModel):
    """Document metadata structure"""

    file_name: str | None = None
    file_size: int | None = None
    mime_type: str | None = None
    author: str | None = None
    created_date: datetime | None = None
    modified_date: datetime | None = None
    page_count: int | None = None
    word_count: int | None = None
    language: str | None = None
    tags: list[str] = Field(default_factory=list)
    custom_fields: dict[str, Any] = Field(default_factory=dict)


class ProcessDocumentRequest(BaseModel):
    """Request to process uploaded document"""

    fileName: str = Field(..., description="Original file name")
    fileType: str = Field(..., description="File extension (.docx, .pdf, etc.)")
    fileData: str = Field(..., description="Base64 encoded file content")

    # Processing options
    extractText: bool = Field(True, description="Extract text via Tika")
    performOCR: bool = Field(False, description="Perform OCR if no text found")
    extractTables: bool = Field(False, description="Extract tables from document")
    extractImages: bool = Field(False, description="Extract images")

    # AI analysis options
    enableAI: bool = Field(False, description="Enable AI analysis")
    aiPrompt: str | None = Field(None, description="Custom AI prompt")
    aiModel: str = Field(DEFAULT_MODEL, description="Llama model to use")

    # Pattern extraction
    extractQuestions: bool = Field(False, description="Extract )*(...)* patterns")
    extractJSONFlags: bool = Field(False, description="Extract {JSON(...)} patterns")

    # Storage options
    saveToDatabase: bool = Field(True, description="Save to PostgreSQL")
    saveToPaperless: bool = Field(False, description="Save to Paperless-ngx")
    saveToMinIO: bool = Field(False, description="Save to MinIO S3")

    # Search indexing
    indexInElasticsearch: bool = Field(True, description="Index in Elasticsearch")
    createEmbeddings: bool = Field(False, description="Create vector embeddings")


class ProcessedDocumentResponse(BaseModel):
    """Response from document processing"""

    # Document info
    document_id: str
    file_name: str
    file_type: str

    # Extracted content
    text_content: str
    html_content: str | None = None
    tables: list[dict[str, Any]] = Field(default_factory=list)
    images: list[dict[str, Any]] = Field(default_factory=list)

    # Pattern extraction results
    questions: list[dict[str, Any]] = Field(default_factory=list)
    json_flags: list[dict[str, Any]] = Field(default_factory=list)

    # AI analysis results
    ai_analysis: dict[str, Any] | None = None

    # Processing metadata
    processing_time_ms: float
    text_extraction_method: str  # "tika", "ocr", "fallback"
    ocr_performed: bool = False
    services_used: list[str] = Field(default_factory=list)

    # Storage locations
    postgres_id: str | None = None
    paperless_id: int | None = None
    minio_url: str | None = None
    elasticsearch_indexed: bool = False


class CreateDocumentRequest(BaseModel):
    """Request to create document from scratch"""

    title: str = Field(..., min_length=1, max_length=500)
    content: str = Field(..., min_length=0)
    document_type: Literal["text", "markdown", "html"] = "text"
    metadata: DocumentMetadata | None = None
    tags: list[str] = Field(default_factory=list)


class UpdateDocumentRequest(BaseModel):
    """Request to update existing document"""

    title: str | None = Field(None, max_length=500)
    content: str | None = None
    metadata: DocumentMetadata | None = None
    tags: list[str] | None = None


class DocumentResponse(BaseModel):
    """Standard document response"""

    id: str
    title: str
    content: str
    document_type: str
    user_id: str
    metadata: dict[str, Any] | None = None
    tags: list[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    # Stats
    word_count: int | None = None
    character_count: int | None = None

    # V2 Fields
    revision_count: int = 0
    updated_by: str | None = None


class SearchDocumentsRequest(BaseModel):
    """Advanced document search request"""

    query: str = Field(..., min_length=1)

    # Filters
    document_types: list[str] | None = None
    tags: list[str] | None = None
    date_from: datetime | None = None
    date_to: datetime | None = None

    # Search options
    search_in_content: bool = True
    search_in_metadata: bool = True
    use_vector_search: bool = False  # Use ChromaDB/Qdrant

    # Pagination
    offset: int = Field(0, ge=0)
    limit: int = Field(20, ge=1, le=100)


class ExportDocumentRequest(BaseModel):
    """Request to export document"""

    document_id: str
    format: Literal["docx", "pdf", "html", "txt", "md", "rtf", "odt"] = "pdf"

    # Export options
    include_metadata: bool = True
    include_images: bool = True
    page_size: Literal["A4", "Letter", "Legal"] | None = "A4"

    # PDF-specific
    pdf_engine: Literal["gotenberg", "wkhtmltopdf"] | None = "gotenberg"


class ConvertDocumentRequest(BaseModel):
    """Request to convert document format"""

    source_format: str = Field(..., description="Source format (e.g., 'docx')")
    target_format: str = Field(..., description="Target format (e.g., 'pdf')")
    file_data: str = Field(..., description="Base64 encoded file")

    # Conversion options
    preserve_formatting: bool = True
    optimize_size: bool = False


class OCRRequest(BaseModel):
    """Request for OCR processing"""

    file_data: str = Field(..., description="Base64 encoded image/PDF")
    file_type: str = Field(..., description="File type")

    # OCR options
    language: str = Field("eng+rus", description="Tesseract language codes")
    ocr_engine: Literal["tesseract", "ocrmypdf"] = "tesseract"
    deskew: bool = True
    remove_background: bool = False


class AIAnalysisRequest(BaseModel):
    """Request for AI document analysis"""

    document_id: str | None = None
    text_content: str | None = None

    # AI options
    task: Literal["summarize", "analyze", "extract", "translate", "qa", "custom"] = "analyze"
    prompt: str | None = None
    model: str = Field(DEFAULT_MODEL)
    temperature: float = Field(0.7, ge=0.0, le=2.0)
    max_tokens: int = Field(2048, ge=1, le=32000)


class SpeechToTextRequest(BaseModel):
    """Request for speech-to-text processing"""

    audio_data: str = Field(..., description="Base64 encoded audio file")
    audio_format: str = Field(..., description="Audio format (mp3, wav, etc.)")
    language: str = Field("auto", description="Language code or 'auto'")
    model: str = Field("large-v2", description="WhisperX model")


# ========================================
# V2 MODELS - EDITING & REVISIONS
# ========================================


class UpdateTableRequest(BaseModel):
    """Request to update specific table in document"""

    headers: list[str] = Field(..., description="Table headers")
    rows: list[list[str]] = Field(..., description="Table rows (2D array)")


class RevisionResponse(BaseModel):
    """Revision history item"""

    id: str
    revision_number: int
    content_preview: str
    content_size: int
    metadata: dict[str, Any]
    change_summary: str | None = None
    created_by: str
    created_at: datetime


class FieldInfo(BaseModel):
    """Fillable field information"""

    id: str
    type: Literal["standard", "bracket", "underline"]
    label: str
    position: dict[str, int]  # {start: int, end: int}
    current_value: str | None = None
    hint: str | None = None


class AIFillRequest(BaseModel):
    """Request to AI auto-fill document fields"""

    fields: list[str] | None = Field(None, description="Specific field IDs to fill (None = all)")
    context: dict[str, Any] = Field(default_factory=dict, description="Additional context for AI")
    model: str = Field(DEFAULT_MODEL, description="Llama model")
    temperature: float = Field(0.7, ge=0.0, le=2.0)
    preview: bool = Field(True, description="Preview mode - don't save changes")


class AIFillResponse(BaseModel):
    """Response from AI auto-fill"""

    filled_fields: dict[str, str]  # {field_id: generated_value}
    total_fields: int
    filled_count: int
    preview: bool
    document_id: str | None = None


# ========================================
# HEALTH & STATUS ENDPOINTS
# ========================================


@router.get("/health")
async def health_check() -> dict[str, Any]:
    """
    Comprehensive health check for all integrated services

    Returns:
        Service status for Stack 1 (DB), Stack 2 (AI), Stack 4 (Docs)
    """
    # Import services here to avoid circular imports
    from api.services.elite_editor import get_orchestrator

    try:
        orchestrator = await get_orchestrator()
        health_status = await orchestrator.check_all_services()

        return {
            "status": "healthy" if health_status["overall_health"] else "degraded",
            "timestamp": datetime.now(UTC).isoformat(),
            "services": health_status,
        }
    except Exception as e:
        logger.exception("Health check failed")
        return {"status": "error", "timestamp": datetime.now(UTC).isoformat(), "error": str(e)}


@router.get("/services/status")
async def get_services_status(current_user: User = Depends(require_oauth2_user)) -> dict[str, Any]:
    """
    Detailed status of all Stack 1/2/4 services

    Requires authentication
    """
    from api.services.elite_editor import get_orchestrator

    orchestrator = await get_orchestrator()
    return await orchestrator.get_detailed_status()


# ========================================
# DOCUMENT PROCESSING ENDPOINTS
# ========================================


@router.post("/process", response_model=ProcessedDocumentResponse)
async def process_document(
    request: ProcessDocumentRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_oauth2_user),
) -> ProcessedDocumentResponse:
    """
    Process uploaded document with full Stack 4 integration

    Processing pipeline:
    1. Text extraction: Tika (primary) → Document AI (fallback)
    2. OCR if needed: Tesseract → OCRmyPDF
    3. Table extraction: Tika parser
    4. AI analysis: Llama → Document AI
    5. Storage: PostgreSQL + optional (Paperless, MinIO)
    6. Indexing: Elasticsearch + optional (ChromaDB embeddings)

    Args:
        request: Processing configuration
        current_user: Authenticated user from Keycloak

    Returns:
        Processed document with extracted content and analysis
    """
    from api.services.elite_editor import get_orchestrator

    start_time = datetime.now(UTC)
    logger.info("Processing document: %s for user %s", request.fileName, current_user.email)

    try:
        orchestrator = await get_orchestrator()

        # Process document through orchestrator
        result = await orchestrator.process_document(
            file_name=request.fileName,
            file_type=request.fileType,
            file_data=request.fileData,
            user_id=str(current_user.id),
            options={
                "extract_text": request.extractText,
                "perform_ocr": request.performOCR,
                "extract_tables": request.extractTables,
                "extract_images": request.extractImages,
                "enable_ai": request.enableAI,
                "ai_prompt": request.aiPrompt,
                "ai_model": request.aiModel,
                "extract_questions": request.extractQuestions,
                "extract_json_flags": request.extractJSONFlags,
                "save_to_db": request.saveToDatabase,
                "save_to_paperless": request.saveToPaperless,
                "save_to_minio": request.saveToMinIO,
                "index_elasticsearch": request.indexInElasticsearch,
                "create_embeddings": request.createEmbeddings,
            },
        )

        processing_time = (datetime.now(UTC) - start_time).total_seconds() * 1000

        return ProcessedDocumentResponse(
            document_id=result["document_id"],
            file_name=request.fileName,
            file_type=request.fileType,
            text_content=result.get("text_content", ""),
            html_content=result.get("html_content"),
            tables=result.get("tables", []),
            images=result.get("images", []),
            questions=result.get("questions", []),
            json_flags=result.get("json_flags", []),
            ai_analysis=result.get("ai_analysis"),
            processing_time_ms=processing_time,
            text_extraction_method=result.get("extraction_method", "unknown"),
            ocr_performed=result.get("ocr_performed", False),
            services_used=result.get("services_used", []),
            postgres_id=result.get("postgres_id"),
            paperless_id=result.get("paperless_id"),
            minio_url=result.get("minio_url"),
            elasticsearch_indexed=result.get("elasticsearch_indexed", False),
        )

    except Exception as e:
        logger.exception("Document processing failed")
        raise HTTPException(status_code=500, detail=f"Processing failed: {e!s}") from e


@router.post("/upload", response_model=ProcessedDocumentResponse)
async def upload_document_file(
    file: UploadFile = File(...),
    extract_text: bool = True,
    perform_ocr: bool = False,
    enable_ai: bool = False,
    save_to_paperless: bool = False,
    current_user: User = Depends(require_oauth2_user),
) -> ProcessedDocumentResponse:
    """
    Upload document file directly (multipart/form-data)

    Alternative to /process endpoint for file uploads
    """
    import base64

    # Read file content
    content = await file.read()
    file_data = base64.b64encode(content).decode("utf-8")

    # Get file extension
    if file.filename is None:
        raise HTTPException(status_code=400, detail="Filename is required")
    file_type = file.filename.split(".")[-1] if "." in file.filename else ""

    # Create ProcessDocumentRequest
    request = ProcessDocumentRequest(
        fileName=file.filename,
        fileType=f".{file_type}",
        fileData=file_data,
        extractText=extract_text,
        performOCR=perform_ocr,
        enableAI=enable_ai,
        saveToPaperless=save_to_paperless,
        extractTables=False,
        extractImages=False,
        aiPrompt=None,
        aiModel=DEFAULT_MODEL,
        extractQuestions=False,
        extractJSONFlags=False,
        saveToDatabase=True,
        saveToMinIO=False,
        indexInElasticsearch=True,
        createEmbeddings=False,
    )

    # Reuse process_document logic
    return await process_document(request, BackgroundTasks(), current_user)


# ========================================
# DOCUMENT CRUD ENDPOINTS
# ========================================


@router.post("/documents", response_model=DocumentResponse)
async def create_document(
    request: CreateDocumentRequest,
    current_user: User = Depends(require_oauth2_user),
) -> DocumentResponse:
    """
    Create new document from scratch

    Supports plain text, Markdown, and HTML formats
    """
    from api.services.elite_editor import get_orchestrator

    try:
        orchestrator = await get_orchestrator()

        document = await orchestrator.create_document(
            title=request.title,
            content=request.content,
            document_type=request.document_type,
            user_id=str(current_user.id),
            metadata=request.metadata.model_dump() if request.metadata else None,
            tags=request.tags,
        )

        return DocumentResponse(**document)

    except Exception as e:
        logger.exception("Document creation failed")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/documents", response_model=list[DocumentResponse])
async def list_documents(
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    document_type: str | None = None,
    tags: str | None = None,  # Comma-separated
    current_user: User = Depends(require_oauth2_user),
) -> list[DocumentResponse]:
    """
    List user's documents with pagination and filtering
    """
    from api.services.elite_editor import get_orchestrator

    try:
        orchestrator = await get_orchestrator()

        tag_list = tags.split(",") if tags else None

        documents = await orchestrator.list_documents(
            user_id=str(current_user.id),
            offset=offset,
            limit=limit,
            document_type=document_type,
            tags=tag_list,
        )

        return [DocumentResponse(**doc) for doc in documents]

    except Exception as e:
        logger.exception("Document listing failed")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/documents/{document_id}", response_model=DocumentResponse)
async def get_document(document_id: str, current_user: User = Depends(require_oauth2_user)) -> DocumentResponse:
    """Get specific document by ID"""
    from api.services.elite_editor import get_orchestrator

    try:
        orchestrator = await get_orchestrator()
        document = await orchestrator.get_document(document_id, str(current_user.id))

        if not document:
            raise HTTPException(status_code=404, detail="Document not found")

        return DocumentResponse(**document)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Document retrieval failed")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.patch("/documents/{document_id}", response_model=DocumentResponse)
async def update_document(
    document_id: str,
    request: UpdateDocumentRequest,
    current_user: User = Depends(require_oauth2_user),
) -> DocumentResponse:
    """Update existing document"""
    from api.services.elite_editor import get_orchestrator

    try:
        orchestrator = await get_orchestrator()

        updates = {}
        if request.title is not None:
            updates["title"] = request.title
        if request.content is not None:
            updates["content"] = request.content
        if request.metadata is not None:
            updates["metadata"] = request.metadata.model_dump()
        if request.tags is not None:
            updates["tags"] = request.tags

        document = await orchestrator.update_document(document_id, str(current_user.id), updates)

        if not document:
            raise HTTPException(status_code=404, detail="Document not found")

        return DocumentResponse(**document)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Document update failed")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/documents/{document_id}")
async def delete_document(document_id: str, current_user: User = Depends(require_oauth2_user)) -> dict[str, Any]:
    """Delete document"""
    from api.services.elite_editor import get_orchestrator

    try:
        orchestrator = await get_orchestrator()
        success = await orchestrator.delete_document(document_id, str(current_user.id))

        if not success:
            raise HTTPException(status_code=404, detail="Document not found")

        return {"success": True, "document_id": document_id}

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Document deletion failed")
        raise HTTPException(status_code=500, detail=str(e)) from e


# ========================================
# V2 ENDPOINTS - TABLE EDITING & REVISIONS
# ========================================


@router.put("/documents/{document_id}/tables/{table_index}", response_model=DocumentResponse)
async def update_document_table(
    document_id: str,
    table_index: int,
    request: UpdateTableRequest,
    current_user: User = Depends(require_oauth2_user),
) -> DocumentResponse:
    """
    Update specific table in document

    Table editing with automatic revision tracking.
    table_index is 0-based (first table = 0)
    """
    from api.services.elite_editor import get_orchestrator

    try:
        orchestrator = await get_orchestrator()

        table_data = {"headers": request.headers, "rows": request.rows}

        document = await orchestrator.update_table(
            document_id=document_id,
            user_id=str(current_user.id),
            table_index=table_index,
            table_data=table_data,
        )

        if not document:
            raise HTTPException(
                status_code=404,
                detail=f"Document not found or table index {table_index} out of range",
            )

        return DocumentResponse(**document)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Table update failed")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/documents/{document_id}/revisions", response_model=list[RevisionResponse])
async def get_document_revisions(
    document_id: str,
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(require_oauth2_user),
) -> list[RevisionResponse]:
    """
    Get revision history for document

    Returns list of revisions ordered by revision_number DESC (newest first)
    """
    from api.services.elite_editor import get_orchestrator

    try:
        orchestrator = await get_orchestrator()
        revisions = await orchestrator.get_revisions(document_id=document_id, user_id=str(current_user.id), limit=limit)

        return [RevisionResponse(**rev) for rev in revisions]

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Revision retrieval failed")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/documents/{document_id}/revisions/{revision_number}/restore", response_model=DocumentResponse)
async def restore_document_revision(
    document_id: str, revision_number: int, current_user: User = Depends(require_oauth2_user)
) -> DocumentResponse:
    """
    Restore document to specific revision

    This creates a NEW revision with the old content (doesn't delete history)
    """
    from api.services.elite_editor import get_orchestrator

    try:
        orchestrator = await get_orchestrator()

        document = await orchestrator.restore_revision(
            document_id=document_id, user_id=str(current_user.id), revision_number=revision_number
        )

        if not document:
            raise HTTPException(status_code=404, detail=f"Document or revision {revision_number} not found")

        return DocumentResponse(**document)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Revision restore failed")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/documents/{document_id}/fields", response_model=list[FieldInfo])
async def get_document_fillable_fields(
    document_id: str, current_user: User = Depends(require_oauth2_user)
) -> list[FieldInfo]:
    """
    Get fillable fields from document

    Detects patterns:
    - )*(...)*( - standard pattern
    - [FIELD_NAME] - bracket pattern
    - _______ - underline pattern (3+ underscores)
    """
    from api.services.elite_editor import get_orchestrator

    try:
        orchestrator = await get_orchestrator()

        # Get document
        document = await orchestrator.get_document(document_id, str(current_user.id))
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")

        # Extract fields using Phase 4.1 implementation
        # Use same priority logic as frontend display: edited_content > metadata.html_content > content
        if document.get("edited_content"):
            content = document["edited_content"]
        elif document.get("metadata", {}).get("html_content"):
            # Extract body from Tika HTML
            html_content = document["metadata"]["html_content"]
            import re

            match = re.search(r"<body[^>]*>(.*?)</body>", html_content, re.DOTALL | re.IGNORECASE)
            content = match.group(1).strip() if match else html_content
        else:
            content = document.get("content", "")

        fields = orchestrator.extract_fillable_fields(content)

        return [FieldInfo(**field) for field in fields]

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Field extraction failed")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/documents/{document_id}/ai-fill", response_model=AIFillResponse)
async def ai_fill_document_fields(
    document_id: str, request: AIFillRequest, current_user: User = Depends(require_oauth2_user)
) -> AIFillResponse:
    """
    AI auto-fill document fields

    Uses Llama to generate appropriate values for fillable fields.

    Example request:
    ```json
    {
      "fields": ["field_1", "field_2"],  // Optional: specific fields
      "context": {                        // Additional context for AI
        "expert_name": "Татьяна Кундухова",
        "company_name": "ООО Тестовая Компания"
      },
      "model": DEFAULT_MODEL,
      "temperature": 0.7,
      "preview": true  // true = don't save, false = apply changes
    }
    ```
    """
    from api.services.elite_editor import get_orchestrator

    try:
        orchestrator = await get_orchestrator()

        result = await orchestrator.ai_fill_document(
            document_id=document_id,
            user_id=str(current_user.id),
            fields_to_fill=request.fields,
            context=request.context,
            model=request.model,
            temperature=request.temperature,
            preview=request.preview,
        )

        return AIFillResponse(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("AI fill failed")
        raise HTTPException(status_code=500, detail=str(e)) from e


# ========================================
# SEARCH ENDPOINTS
# ========================================


@router.post("/search")
async def search_documents(
    request: SearchDocumentsRequest, current_user: User = Depends(require_oauth2_user)
) -> dict[str, Any]:
    """
    Advanced document search using Elasticsearch + optional vector search
    """
    from api.services.elite_editor import get_orchestrator

    try:
        orchestrator = await get_orchestrator()

        return await orchestrator.search_documents(
            query=request.query,
            user_id=str(current_user.id),
            filters={
                "document_types": request.document_types,
                "tags": request.tags,
                "date_from": request.date_from,
                "date_to": request.date_to,
            },
            search_options={
                "search_in_content": request.search_in_content,
                "search_in_metadata": request.search_in_metadata,
                "use_vector_search": request.use_vector_search,
            },
            offset=request.offset,
            limit=request.limit,
        )

    except Exception as e:
        logger.exception("Document search failed")
        raise HTTPException(status_code=500, detail=str(e)) from e


# ========================================
# EXPORT & CONVERSION ENDPOINTS
# ========================================


@router.get("/documents/{document_id}/export")
async def export_document_get(
    document_id: str,
    format: str = Query(..., description="Export format: pdf, docx, html, markdown, txt"),
    current_user: User = Depends(require_oauth2_user),
):
    """
    Export document to various formats (GET method for EliteEditorV2)

    Supported formats: pdf, docx, html, markdown, txt
    """

    from api.services.elite_editor import get_orchestrator

    try:
        orchestrator = await get_orchestrator()

        # Get document
        document = await orchestrator.get_document(document_id, str(current_user.id))
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")

        # Export content priority: edited_content > metadata.html_content > content
        title = document.get("title", "document")

        # Priority 1: User-edited content (from TipTap)
        if document.get("edited_content"):
            content = document["edited_content"]
            logger.info("📝 Export using edited_content (edit_count: %s)", document.get("edit_count", 0))

        # Priority 2: Original HTML from Tika
        elif document.get("metadata", {}).get("html_content"):
            html_content = document["metadata"]["html_content"]
            # Extract body from Tika HTML
            import re

            match = re.search(r"<body[^>]*>(.*?)</body>", html_content, re.DOTALL | re.IGNORECASE)
            content = match.group(1).strip() if match else html_content
            logger.info("📄 Export using original HTML from metadata")

        # Priority 3: Plain text content
        else:
            content = document.get("content", "")
            # Convert plain text to HTML paragraphs
            if content and not content.strip().startswith("<"):
                content = "\n".join(f"<p>{line}</p>" for line in content.split("\n") if line.strip())
            logger.info("📝 Export using plain text content")

        # Determine page orientation from metadata or tables
        page_orientation = "portrait"  # default

        # Check if document has wide tables (likely landscape)
        if "<table" in content.lower():
            # If tables exist, check metadata for page size hints
            document.get("metadata", {})
            # Tika doesn't always provide page size, so we'll add Gotenberg option to auto-detect
            # For now, assume landscape if document type suggests it
            if document.get("document_type") in [".xlsx", ".xls", "spreadsheet"]:
                page_orientation = "landscape"

        # Wrap content in full HTML document for Gotenberg
        # Add @page CSS rule for orientation
        page_rule = "@page { size: landscape; }" if page_orientation == "landscape" else "@page { size: A4 portrait; }"

        full_html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>{title}</title>
    <style>
        {page_rule}

        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 20mm;
            line-height: 1.6;
            color: #333;
        }}
        table {{
            border-collapse: collapse;
            width: 100%;
            margin: 20px 0;
            border: 1px solid #999;
        }}
        td, th {{
            border: 1px solid #999;
            padding: 10px 12px;
            text-align: left;
            vertical-align: top;
        }}
        th {{
            background-color: #f0f0f0;
            font-weight: 600;
        }}
        p {{
            margin: 10px 0;
        }}
        b, strong {{
            font-weight: 700;
        }}
        h1, h2, h3, h4 {{
            margin: 20px 0 10px 0;
            font-weight: 600;
        }}
    </style>
</head>
<body>
{content}
</body>
</html>"""

        # Determine media type and content
        if format == "pdf":
            # Use Gotenberg for PDF generation
            media_type = "application/pdf"

            try:
                client = get_httpx_client()
                files = {"files": ("index.html", full_html.encode("utf-8"), "text/html")}

                # Gotenberg PDF options
                form_data = {
                    "landscape": "true" if page_orientation == "landscape" else "false",
                    "marginTop": "0.5",
                    "marginBottom": "0.5",
                    "marginLeft": "0.5",
                    "marginRight": "0.5",
                    "preferCssPageSize": "true",  # Respect CSS @page rules
                }

                response = await client.post(
                    "http://stack4-gotenberg:3000/forms/chromium/convert/html",
                    files=files,
                    data=form_data,
                    timeout=30.0,
                )
                export_content = response.content
                logger.info("📄 PDF generated with orientation: %s", page_orientation)
            except Exception:
                logger.exception("Gotenberg PDF conversion failed")
                # Fallback: return HTML as PDF (browser will handle)
                export_content = full_html.encode("utf-8")

            filename = f"{title}.pdf"

        elif format == "docx":
            # DOCX export: Return HTML with Word media-type (Word will open it correctly)
            # This preserves tables and formatting better than PDF->DOCX conversion
            media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            export_content = full_html.encode("utf-8")
            filename = f"{title}.docx"

        elif format == "html":
            # HTML export: Return full HTML document with styles
            media_type = "text/html"
            export_content = full_html.encode("utf-8")
            filename = f"{title}.html"
        elif format == "markdown":
            media_type = "text/markdown"
            # Simple HTML to Markdown conversion (basic)
            import re

            md_content = re.sub(r"<h1>(.*?)</h1>", r"# \1\n", content)
            md_content = re.sub(r"<h2>(.*?)</h2>", r"## \1\n", md_content)
            md_content = re.sub(r"<h3>(.*?)</h3>", r"### \1\n", md_content)
            md_content = re.sub(r"<p>(.*?)</p>", r"\1\n\n", md_content)
            md_content = re.sub(r"<strong>(.*?)</strong>", r"**\1**", md_content)
            md_content = re.sub(r"<em>(.*?)</em>", r"*\1*", md_content)
            md_content = re.sub(r"<[^>]+>", "", md_content)  # Remove remaining HTML tags
            export_content = md_content.encode("utf-8")
            filename = f"{title}.md"
        elif format == "txt":
            media_type = "text/plain"
            # Strip HTML tags for plain text
            import re

            txt_content = re.sub(r"<[^>]+>", "", content)
            export_content = txt_content.encode("utf-8")
            filename = f"{title}.txt"
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported format: {format}")

        # Return file as download
        # Use RFC 2231 encoding for non-ASCII characters in filename
        from urllib.parse import quote

        encoded_filename = quote(filename)

        # Use StreamingResponse for bytes content (FileResponse requires file path)
        from io import BytesIO

        from fastapi.responses import StreamingResponse

        return StreamingResponse(
            BytesIO(export_content),
            media_type=media_type,
            headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"},
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Document export failed")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/export")
async def export_document(
    request: ExportDocumentRequest, current_user: User = Depends(require_oauth2_user)
) -> FileResponse:
    """
    Export document to various formats using Gotenberg/Doc Converter (POST method - legacy)

    Supported formats: DOCX, PDF, HTML, TXT, MD, RTF, ODT
    """
    from api.services.elite_editor import get_orchestrator

    try:
        orchestrator = await get_orchestrator()

        # Get document
        document = await orchestrator.get_document(request.document_id, str(current_user.id))
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")

        # Export to format
        export_result = await orchestrator.export_document(
            document_id=request.document_id,
            export_format=request.format,
            options={
                "include_metadata": request.include_metadata,
                "include_images": request.include_images,
                "page_size": request.page_size,
                "pdf_engine": request.pdf_engine,
            },
        )

        # Return file
        return FileResponse(
            path=export_result["file_path"],
            filename=export_result["filename"],
            media_type=export_result["media_type"],
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Document export failed")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/convert")
async def convert_document(
    request: ConvertDocumentRequest, current_user: User = Depends(require_oauth2_user)
) -> dict[str, Any]:
    """
    Convert document between formats using Stack 4 converters

    Uses Gotenberg for Office formats, Pandoc for Markdown, etc.
    """
    from api.services.elite_editor import get_orchestrator

    try:
        orchestrator = await get_orchestrator()

        result = await orchestrator.convert_document(
            source_format=request.source_format,
            target_format=request.target_format,
            file_data=request.file_data,
            options={
                "preserve_formatting": request.preserve_formatting,
                "optimize_size": request.optimize_size,
            },
        )

        return {
            "converted_data": result["converted_data"],
            "format": request.target_format,
            "converter_used": result["converter_used"],
            "conversion_time_ms": result["conversion_time_ms"],
        }

    except Exception as e:
        logger.exception("Document conversion failed")
        raise HTTPException(status_code=500, detail=str(e)) from e


# ========================================
# OCR ENDPOINTS
# ========================================


@router.post("/ocr")
async def perform_ocr(request: OCRRequest, current_user: User = Depends(require_oauth2_user)) -> dict[str, Any]:
    """
    Perform OCR on image or PDF using Tesseract/OCRmyPDF
    """
    from api.services.elite_editor import get_orchestrator

    try:
        orchestrator = await get_orchestrator()

        result = await orchestrator.perform_ocr(
            file_data=request.file_data,
            file_type=request.file_type,
            options={
                "language": request.language,
                "ocr_engine": request.ocr_engine,
                "deskew": request.deskew,
                "remove_background": request.remove_background,
            },
        )

        return {
            "text": result["text"],
            "confidence": result.get("confidence"),
            "ocr_engine": result["ocr_engine"],
            "processing_time_ms": result["processing_time_ms"],
        }

    except Exception as e:
        logger.exception("OCR processing failed")
        raise HTTPException(status_code=500, detail=str(e)) from e


# ========================================
# AI ANALYSIS ENDPOINTS
# ========================================


@router.post("/ai/analyze")
async def analyze_with_ai(
    request: AIAnalysisRequest, current_user: User = Depends(require_oauth2_user)
) -> dict[str, Any]:
    """
    Analyze document using AI (Llama/Document AI/LocalAGI)

    Supports: summarization, analysis, extraction, translation, Q&A
    """
    from api.services.elite_editor import get_orchestrator

    try:
        orchestrator = await get_orchestrator()

        # Get text content
        if request.document_id:
            document = await orchestrator.get_document(request.document_id, str(current_user.id))
            if not document:
                raise HTTPException(status_code=404, detail="Document not found")
            text_content = document["content"]
        elif request.text_content:
            text_content = request.text_content
        else:
            raise HTTPException(status_code=400, detail="Either document_id or text_content required")

        # Perform AI analysis
        result = await orchestrator.analyze_with_ai(
            text=text_content,
            task=request.task,
            prompt=request.prompt,
            model=request.model,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
        )

        return {
            "analysis": result["analysis"],
            "model_used": result["model_used"],  # Fixed: use "model_used" instead of "model"
            "tokens_used": result.get("tokens_used"),
            "processing_time_ms": result["processing_time_ms"],
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("AI analysis failed")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/ai/speech-to-text")
async def speech_to_text(
    request: SpeechToTextRequest, current_user: User = Depends(require_oauth2_user)
) -> dict[str, Any]:
    """
    Convert speech to text using WhisperX (Stack 2)
    """
    from api.services.elite_editor import get_orchestrator

    try:
        orchestrator = await get_orchestrator()

        result = await orchestrator.speech_to_text(
            audio_data=request.audio_data,
            audio_format=request.audio_format,
            language=request.language,
            model=request.model,
        )

        return {
            "text": result["text"],
            "language_detected": result.get("language"),
            "segments": result.get("segments", []),
            "processing_time_ms": result["processing_time_ms"],
        }

    except Exception as e:
        logger.exception("Speech-to-text failed")
        raise HTTPException(status_code=500, detail=str(e)) from e


# ========================================
# ANALYTICS ENDPOINTS
# ========================================


@router.get("/analytics/stats")
async def get_analytics_stats(current_user: User = Depends(require_oauth2_user)) -> dict[str, Any]:
    """
    Get user's document analytics

    Returns statistics from Document Analytics service (Stack 4)
    """
    from api.services.elite_editor import get_orchestrator

    try:
        orchestrator = await get_orchestrator()

        return await orchestrator.get_user_analytics(str(current_user.id))

    except Exception as e:
        logger.exception("Analytics retrieval failed")
        raise HTTPException(status_code=500, detail=str(e)) from e


# ========================================
# INTEGRATION ENDPOINTS (Paperless, MinIO, etc.)
# ========================================


@router.post("/integrations/paperless/import/{paperless_id}")
async def import_from_paperless(
    paperless_id: int, current_user: User = Depends(require_oauth2_user)
) -> DocumentResponse:
    """
    Import document from Paperless-ngx
    """
    from api.services.elite_editor import get_orchestrator

    try:
        orchestrator = await get_orchestrator()

        document = await orchestrator.import_from_paperless(paperless_id, str(current_user.id))

        return DocumentResponse(**document)

    except Exception as e:
        logger.exception("Paperless import failed")
        raise HTTPException(status_code=500, detail=str(e)) from e


class MinioDocumentResponse(BaseModel):
    """MinIO document response model"""

    name: str
    size: int | None = None
    last_modified: datetime | None = None
    etag: str | None = None
    content_type: str | None = None


@router.get("/integrations/minio/list")
async def list_minio_documents(
    bucket: str = Query("documents"), current_user: User = Depends(require_oauth2_user)
) -> dict[str, list[MinioDocumentResponse]]:
    """
    List documents in MinIO bucket
    """
    from api.services.elite_editor import get_orchestrator

    try:
        orchestrator = await get_orchestrator()

        documents = await orchestrator.list_minio_documents(bucket, str(current_user.id))

        # Convert dict to MinioDocumentResponse
        minio_docs = [
            MinioDocumentResponse(
                name=doc.get("name", ""),
                size=doc.get("size"),
                last_modified=doc.get("last_modified"),
                etag=doc.get("etag"),
                content_type=doc.get("content_type"),
            )
            for doc in documents
        ]

        return {"documents": minio_docs}

    except Exception as e:
        logger.exception("MinIO listing failed")
        raise HTTPException(status_code=500, detail=str(e)) from e


logger.info("Elite Document Editor router initialized")


@router.post("/documents/{document_id}/revert-to-original")
async def revert_to_original(document_id: str, current_user: User = Depends(require_oauth2_user)) -> DocumentResponse:
    """
    Revert edited document back to original HTML from Tika extraction

    This clears edited_content and resets is_edited flag,
    effectively restoring the document to its uploaded state.
    """
    from api.services.elite_editor import get_orchestrator

    try:
        orchestrator = await get_orchestrator()

        # Get document to verify it exists and has original content
        document = await orchestrator.get_document(document_id, str(current_user.id))
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")

        if not document.get("metadata", {}).get("html_content"):
            raise HTTPException(status_code=400, detail="No original HTML content available to revert to")

        # Update document: clear edited content, reset flags
        if orchestrator.pg_pool is None:
            raise HTTPException(status_code=500, detail="Database pool not initialized")
        async with orchestrator.pg_pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                UPDATE elite_documents
                SET edited_content = NULL,
                    is_edited = FALSE,
                    last_edit_at = NULL,
                    edit_count = 0,
                    updated_at = NOW(),
                    updated_by = $2
                WHERE id = $1 AND user_id = $2
                RETURNING id, user_id, title, content, edited_content, is_edited,
                          document_type, metadata, tags, word_count, character_count,
                          created_at, updated_at, last_edit_at, edit_count, revision_count
            """,
                document_id,
                str(current_user.id),
            )

            if not row:
                raise HTTPException(status_code=404, detail="Document not found")

            result = {
                "id": str(row["id"]),
                "user_id": row["user_id"],
                "title": row["title"],
                "content": row["content"] or "",
                "edited_content": row["edited_content"] or "",
                "is_edited": row["is_edited"] or False,
                "document_type": row["document_type"],
                "metadata": json.loads(row["metadata"]) if row["metadata"] else {},
                "tags": row["tags"] or [],
                "word_count": row["word_count"],
                "character_count": row["character_count"],
                "created_at": row["created_at"].isoformat(),
                "updated_at": row["updated_at"].isoformat(),
                "last_edit_at": row["last_edit_at"].isoformat() if row["last_edit_at"] else None,
                "edit_count": row["edit_count"] or 0,
                "revision_count": row["revision_count"] or 0,
            }

            logger.info("🔄 Document %s reverted to original", document_id)
            return DocumentResponse(
                id=result["id"],
                title=result["title"],
                content=result["content"],
                document_type=result["document_type"],
                user_id=result["user_id"],
                metadata=result.get("metadata", {}),
                tags=result.get("tags", []),
                created_at=datetime.fromisoformat(result["created_at"]),
                updated_at=datetime.fromisoformat(result["updated_at"]),
                word_count=result.get("word_count"),
                character_count=result.get("character_count"),
                revision_count=result.get("revision_count", 0),
                updated_by=result.get("updated_by"),
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Revert to original failed")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/models")
async def get_available_models() -> dict[str, Any]:
    """
    Get list of available AI models from Llama

    Returns list of models with names and sizes
    """
    base = "http://stack2-llama:11434"
    try:
        client = get_httpx_client()
        for path, key, name_key in (("/v1/models", "data", "id"), ("/api/tags", "models", "name")):
            response = await client.get(f"{base}{path}", timeout=10.0)
            if response.status_code != 200:
                continue
            data = response.json()
            raw = data.get(key, [])
            models = []
            for model in raw:
                n = model.get(name_key) or model.get("name", "")
                if not n:
                    continue
                models.append(
                    {
                        "name": n,
                        "size": model.get("size", 0),
                        "modified": model.get("modified_at", ""),
                        "family": (model.get("details") or {}).get("family", ""),
                    }
                )
            if models:
                logger.info("Found %s LLM models", len(models))
                return {"models": models, "total": len(models)}
        return {"models": [], "total": 0}

    except Exception:
        logger.exception("Failed to fetch Llama models")
        # Return default fallback models
        return {
            "models": [
                {"name": DEFAULT_MODEL, "size": 0, "modified": "", "family": "default"},
                {"name": "llama3.1:latest", "size": 0, "modified": "", "family": "llama"},
                {"name": "qwen2.5-coder:latest", "size": 0, "modified": "", "family": "qwen"},
            ],
            "total": 3,
            "error": "Failed to fetch from Llama, showing defaults",
        }
