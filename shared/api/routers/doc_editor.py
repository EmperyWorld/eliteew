#!/usr/bin/env python3
# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   HTTP/SSE для документного редактора: unified_content, AI, экспорт, совместная работа.
# Invariants:
#   - Привязка к user_id и контрактам unified_content; серверное время — UTC (naive/ISO по слою).
# Related:
#   - doc_editor_service, unified_content, Socket.IO
# ------------------------------------------------------------------------------
"""
🔥💎 ULTIMATE DOCUMENT EDITOR ROUTER 💎🔥

Single unified router for all document operations with AI integration.

Features:
✅ CRUD with user_id binding (PostgreSQL + asyncpg)
✅ Llama AI streaming completions
✅ ComfyUI image generation
✅ Tika document parsing
✅ Gotenberg export (PDF/DOCX)
✅ PostgreSQL full-text search
✅ Real-time collaboration (Socket.IO)
✅ Version history (DB trigger-based)

REFACTORED: 2025-10-19
- Migrated from SQLAlchemy ORM to asyncpg
- Using unified_content table instead of ultimate_documents
- Automatic versioning via trigger_unified_content_versioning
- Using unified_content schemas

Architecture: Clean 3-layer separation (Router → Service → Infrastructure)
"""

import builtins
import contextlib
import hashlib
import logging
import os
import re
import unicodedata
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any, Literal, NoReturn
from urllib.parse import quote
from uuid import UUID, uuid4

import httpx  # type: ignore[import-not-found]

from api.utils.datetime_helpers import utc_now_naive

try:
    import asyncpg  # type: ignore[import-not-found,import-untyped]
except ImportError:
    asyncpg = None  # type: ignore[assignment,misc]

if TYPE_CHECKING:
    from api.services.doc_editor_service import DocEditorService

from fastapi import (  # type: ignore[import-untyped]
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.responses import StreamingResponse  # type: ignore[import-untyped]
from pydantic import BaseModel, ConfigDict, Field, field_validator  # type: ignore[import-untyped]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.core.auth import User
from api.core.database_manager import get_asyncpg_pool, get_postgres_session
from api.core.http_clients import get_httpx_client
from api.core.oauth2_auth import require_oauth2_user
from api.core.user_identity import resolve_db_user_uuid_with_session
from api.schemas.doc_conversion import ConvertRequest, ConvertResponse
from api.schemas.doc_editor_documents import (
    DocumentCreate,
    DocumentListResponse,
    DocumentResponse,
    DocumentUpdate,
)
from api.schemas.notifications import NotificationAction, NotificationCreate, NotificationPriority, NotificationType
from api.services.cache_service import best_effort_invalidate_dashboard_user_cache
from api.services.notification_service import get_notification_service
from api.services.redis_service import RedisService
from api.services.ugs.unified_generation_service import UnifiedGenerationService
from api.utils.json_safe import json_safe_api_detail
from api.utils.llama_models import DEFAULT_MODEL

logger = logging.getLogger(__name__)


def _doc_collab_invite_notification_id(invite_id: str) -> str:
    return f"doc_collab_invite_{invite_id}"


async def _notify_collaboration_invite_socket(
    *,
    to_user_id: str,
    invite_id: str,
    document_id: UUID,
    document_title: str,
    from_display_name: str,
) -> None:
    """Push persistent in-app notification (Socket.IO) to the invited user."""
    try:
        ns = get_notification_service()
        title_short = document_title[:120] + ("…" if len(document_title) > 120 else "")
        await ns.send_to_user(
            to_user_id,
            NotificationCreate(
                notification_id=_doc_collab_invite_notification_id(invite_id),
                type=NotificationType.INFO,
                title="Приглашение к совместной работе",
                message=f"{from_display_name} пригласил вас к документу «{title_short}». Примите или отклоните приглашение.",
                priority=NotificationPriority.HIGH,
                persistent=True,
                source="doc_editor",
                actions=[
                    NotificationAction(label="Принять", action="doc_collab_invite_accept"),
                    NotificationAction(label="Отклонить", action="doc_collab_invite_decline"),
                    NotificationAction(
                        label="Только панель",
                        action="doc_collab_invite_open_collab",
                    ),
                ],
                metadata={
                    "kind": "doc_collaboration_invite",
                    "invite_id": invite_id,
                    "document_id": str(document_id),
                    "open_app": {
                        "appComponent": "DocEditor",
                        "documentId": str(document_id),
                    },
                },
            ),
        )
    except Exception:
        logger.warning(
            "Failed to send collaboration invite notification to user=%s",
            to_user_id,
            exc_info=True,
        )


router = APIRouter(tags=["Ultimate Document Editor"])


DOC_EDITOR_PLUGIN_CATALOG_FALLBACK: list[dict[str, Any]] = [
    {
        "id": "advanced-math",
        "name": "Advanced Math Editor",
        "description": "LaTeX equation editor with real-time rendering and symbol palette",
        "version": "2.1.0",
        "author": "EliteEW Team",
        "category": "editor",
        "rating": 4.8,
        "downloads": 15420,
        "tags": ["math", "latex", "equations", "stem"],
        "icon": "📐",
        "permissions": ["editor:modify", "content:insert"],
        "isOfficial": True,
        "isGPUAccelerated": False,
        "price": None,
        "lastUpdated": "2025-10-15T00:00:00Z",
    },
    {
        "id": "ai-writer-pro",
        "name": "AI Writer Pro",
        "description": "Advanced AI writing assistant with customizable prompts",
        "version": "3.0.2",
        "author": "AI Labs Inc",
        "category": "ai",
        "rating": 4.9,
        "downloads": 45230,
        "tags": ["ai", "writing", "productivity"],
        "icon": "🤖",
        "permissions": ["ai:generate", "content:modify"],
        "isOfficial": False,
        "isGPUAccelerated": True,
        "price": None,
        "lastUpdated": "2025-10-18T00:00:00Z",
    },
    {
        "id": "code-highlighter",
        "name": "Code Syntax Highlighter",
        "description": "Advanced code highlighting with 100+ languages and themes",
        "version": "1.8.0",
        "author": "Code Masters",
        "category": "editor",
        "rating": 4.5,
        "downloads": 52340,
        "tags": ["code", "syntax", "highlighting", "programming"],
        "icon": "💻",
        "permissions": ["content:highlight"],
        "isOfficial": False,
        "isGPUAccelerated": False,
        "price": None,
        "lastUpdated": "2025-10-12T00:00:00Z",
    },
]

DOC_EDITOR_TEMPLATES_FALLBACK: list[dict[str, Any]] = [
    {
        "id": "business-project-brief",
        "name": "Project Brief",
        "description": "Короткий шаблон постановки проекта: цель, scope, метрики, риски.",
        "category": "business",
        "content": """# Project Brief

## Цель

Кратко сформулируйте, какой результат нужен заказчику и почему проект запускается сейчас.

## Scope

Перечислите, что входит в работы, и что явно **не входит** (out of scope).

## KPI

| Метрика | Базовое значение | Цель | Срок |
|---------|------------------|------|------|
|         |                  |      |      |

## Риски

- **Риск** — вероятность / влияние — меры смягчения.
""",
        "tags": ["brief", "project", "kpi"],
        "estimatedTime": "10-15 мин",
        "difficulty": "easy",
    },
    {
        "id": "academic-research-note",
        "name": "Research Note",
        "description": "Шаблон исследовательской заметки с гипотезами и результатами.",
        "category": "academic",
        "content": "# Research Note\n\n## Гипотеза\n\n## Метод\n\n## Наблюдения\n\n## Вывод\n",
        "tags": ["research", "analysis"],
        "estimatedTime": "20-30 мин",
        "difficulty": "medium",
    },
    {
        "id": "legal-service-agreement",
        "name": "Service Agreement (Draft)",
        "description": "Черновик структуры договора об оказании услуг.",
        "category": "legal",
        "content": "# Service Agreement\n\n## Стороны\n\n## Предмет\n\n## Оплата\n\n## Ответственность\n",
        "tags": ["legal", "agreement"],
        "estimatedTime": "30-45 мин",
        "difficulty": "hard",
    },
]


# === HELPER FUNCTIONS ===


def _raise_document_not_found() -> NoReturn:
    """Raise HTTPException for document not found."""
    raise HTTPException(status_code=404, detail="Document not found")


def _raise_version_not_found() -> NoReturn:
    """Raise HTTPException for version not found."""
    raise HTTPException(status_code=404, detail="Version not found")


def _raise_prompt_not_found() -> NoReturn:
    """Raise HTTPException for prompt not found."""
    raise HTTPException(status_code=404, detail="Prompt not found")


def _raise_content_not_found() -> NoReturn:
    """Raise HTTPException for content not found."""
    raise HTTPException(status_code=404, detail="Content not found")


def _raise_access_denied() -> NoReturn:
    """Raise HTTPException for access denied."""
    raise HTTPException(status_code=403, detail="Access denied")


def _raise_no_file_data() -> NoReturn:
    """Raise HTTPException for no file data."""
    raise HTTPException(status_code=400, detail="No file data available")


def _raise_unsupported_format(format_info: dict[str, Any], supported: dict[str, Any]) -> NoReturn:
    """Raise HTTPException for unsupported format."""
    input_formats = supported.get("input_formats")
    if not isinstance(input_formats, list):
        input_formats = list(supported.keys())
    filename = format_info.get("filename") or "unknown"
    raise HTTPException(
        status_code=400,
        detail=(
            f"Unsupported format: {format_info.get('mime_type', 'unknown')} "
            f"(file: {filename}). Supported input formats: {input_formats}"
        ),
    )


def _raise_max_batch_size_exceeded() -> NoReturn:
    """Raise HTTPException for batch size exceeded."""
    raise HTTPException(status_code=400, detail="Maximum batch size exceeded (10 documents)")


def _raise_missing_parameters() -> NoReturn:
    """Raise HTTPException for missing parameters."""
    raise HTTPException(status_code=400, detail="Either content_id or pattern must be provided")


def _raise_redis_not_available() -> NoReturn:
    """Raise HTTPException for Redis not available."""
    raise HTTPException(status_code=503, detail="Redis cache service is not available")


def _raise_redis_not_configured() -> NoReturn:
    """Raise HTTPException for Redis not configured."""
    raise HTTPException(status_code=503, detail="Redis cache is not configured")


async def get_db_pool() -> Any:
    """Get shared asyncpg pool from DatabaseManager."""
    return await get_asyncpg_pool()


async def _require_unified_content_readable(document_id: UUID, user: User, db: AsyncSession) -> None:
    """Readable like GET /api/v1/content/{id}, plus accepted doc collaboration invite.

    Draft GET uses ContentStorageService first; if that denies, allow when the user is an
    accepted collaborator (same gate as opening the document in the editor).
    """
    from api.services.unified_content.audit_logger import AuditLogger
    from api.services.unified_content.content_storage_service import ContentStorageService
    from api.services.unified_content.storage_backends.factory import get_storage_factory

    db_pool = await get_db_pool()
    storage_factory = get_storage_factory(db_pool)
    audit_logger = AuditLogger(db_pool)
    service = ContentStorageService(db_pool, storage_factory, audit_logger)
    try:
        await service.get_content(document_id, str(user.id), check_permissions=True)
        return
    except ValueError:
        _raise_content_not_found()
    except PermissionError:
        access = await _get_content_access_context(document_id, user.id, db)
        if access.is_collaborator:
            return
        _raise_access_denied()


def _to_ascii_filename(raw: str) -> str:
    normalized = unicodedata.normalize("NFKD", raw or "")
    ascii_chars = [char for char in normalized if char.isascii() and (char.isalnum() or char in {" ", "-", "_", "."})]
    ascii_name = "".join(ascii_chars).strip().replace(" ", "_")
    return ascii_name or "document"


async def get_doc_editor_service(ugs_service=None) -> DocEditorService:
    """
    Helper function to create DocEditorService with Redis caching.

    Returns:
        DocEditorService instance with Redis cache enabled
    """
    from api.services.doc_editor_service import DocEditorService

    db_pool = await get_db_pool()

    # Initialize Redis service for caching
    redis_service = None
    try:
        redis_service = RedisService()
        await redis_service.initialize()
    except (ValueError, RuntimeError, ConnectionError) as e:
        logger.warning("Redis service not available for caching: %s", e)
        # Continue without cache - graceful degradation
    except Exception as e:
        logger.warning("Redis service not available for caching: unexpected error: %s", e)
        # Continue without cache - graceful degradation

    return DocEditorService(db_pool, ugs_service=ugs_service, redis_service=redis_service)


def build_content_disposition(filename: str, extension: str) -> str:
    safe_extension = (extension or "").lower().strip() or "dat"
    base_name = filename or "document"
    suffix = f".{safe_extension}"
    if base_name.lower().endswith(suffix) and len(base_name) > len(suffix):
        base_name = base_name[: -len(suffix)]
    ascii_name = _to_ascii_filename(base_name)
    ascii_filename = f"{ascii_name}.{safe_extension}"
    utf8_filename = f"{base_name}.{safe_extension}"
    encoded_filename = quote(utf8_filename)
    return f"attachment; filename=\"{ascii_filename}\"; filename*=UTF-8''{encoded_filename}"


async def get_ugs_service(
    db: AsyncSession = Depends(get_postgres_session),
) -> AsyncGenerator[UnifiedGenerationService]:
    """Get UGS service instance"""
    service = UnifiedGenerationService(db)
    try:
        yield service
    finally:
        await service.close()


# ========================================
# PYDANTIC MODELS - REQUEST/RESPONSE
# ========================================
# DocumentCreate / DocumentUpdate / DocumentResponse / DocumentListResponse — см. api.schemas.doc_editor_documents


class ServerDraftUpsertRequest(BaseModel):
    content: str = Field(..., description="Draft html content")
    base_document_version: int = Field(default=0, ge=0)
    expected_draft_version: int | None = Field(default=None, ge=0)
    source_session_id: str | None = Field(default=None, max_length=128)


class ServerDraftPublishRequest(BaseModel):
    expected_document_version: int = Field(..., ge=0)
    expected_draft_version: int | None = Field(default=None, ge=0)


class AICompleteRequest(BaseModel):
    """AI completion request"""

    prompt: str = Field(..., min_length=1, description="AI prompt")
    context: str | None = Field(default=None, description="Context text (selected text from editor)")
    model: str = Field(default=DEFAULT_MODEL, description="Llama model")
    temperature: float = Field(default=0.7, ge=0.0, le=1.0, description="Temperature")
    max_tokens: int | None = Field(default=2000, description="Max tokens to generate")
    stream: bool = Field(default=True, description="Stream response")
    action_mode: str | None = Field(default="free", description="AI action mode for provenance")
    context_scope: str | None = Field(default="selection", description="Context scope for provenance")
    document_id: UUID | None = Field(default=None, description="Current document id for provenance linkage")
    companion_seed_persona_id: str | None = Field(
        default=None,
        max_length=96,
        description="Companion seed persona id (style prism)",
    )
    companion_name: str | None = Field(
        default=None,
        max_length=128,
        description="Companion display name for style prism",
    )
    companion_character_state: dict[str, Any] | None = Field(
        default=None,
        description="Companion character state snapshot (no dialogue lines)",
    )
    companion_style_parameters: dict[str, Any] | None = Field(
        default=None,
        description="Companion style parameters snapshot",
    )
    companion_baseline: dict[str, Any] | None = Field(
        default=None,
        description="Companion baseline snapshot",
    )
    companion_no_dialogue: bool = Field(
        default=False,
        description="Force non-dialogue transform output mode",
    )


class AIPreInsertCheckRequest(BaseModel):
    text: str = Field(..., min_length=1, description="AI output candidate text/html")
    context_scope: str | None = Field(default="selection")
    document_id: UUID | None = Field(default=None)


class AIAnalyzeRequest(BaseModel):
    """Document analysis request"""

    document_id: UUID
    analysis_type: str = Field(
        default="summary",
        description="Analysis type: summary, keywords, questions, structure, sentiment",
    )
    custom_prompt: str | None = Field(None, description="Custom analysis prompt")


class ImageGenerateRequest(BaseModel):
    """ComfyUI image generation request"""

    prompt: str = Field(..., min_length=1, description="Image generation prompt")
    negative_prompt: str | None = Field(default="blurry, low quality", description="Negative prompt")
    workflow_type: str = Field(default="text2img", description="Workflow: text2img, inpaint, upscale")
    width: int = Field(default=1024, ge=512, le=2048, description="Image width")
    height: int = Field(default=1024, ge=512, le=2048, description="Image height")
    steps: int = Field(default=20, ge=1, le=50, description="Generation steps")


class PromptCreate(BaseModel):
    """Create AI prompt"""

    name: str = Field(..., min_length=1, max_length=255)
    prompt: str = Field(..., min_length=1)
    category: str = Field(default="general")
    model: str | None = Field(default=DEFAULT_MODEL)
    temperature: float = Field(default=0.7, ge=0.0, le=1.0)
    is_public: bool = Field(default=False)


class PromptResponse(BaseModel):
    """AI prompt response"""

    id: UUID
    user_id: str
    name: str
    prompt: str
    category: str
    model: str | None
    temperature: float
    is_public: bool
    usage_count: int
    last_used_at: datetime | None

    @field_validator("user_id", mode="before")
    @classmethod
    def normalize_user_id(cls, value: Any) -> str:
        return str(value)

    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ========================================
# DOCUMENT CRUD ENDPOINTS
# ========================================


@router.post("/documents", response_model=DocumentResponse, status_code=201)
async def create_document(data: DocumentCreate, user: User = Depends(require_oauth2_user)) -> DocumentResponse:
    """
    Create new document with user binding.

    - Automatically calculates word_count and character_count
    - Creates initial version via DB trigger
    - Uses unified_content table
    """
    try:
        service = await get_doc_editor_service()

        document = await service.create_document(
            user_id=user.id,  # type: ignore[arg-type]
            title=data.title,
            content=data.content,
            content_type=data.content_type,
            metadata=data.metadata,
            tags=data.tags,
            is_public=data.is_public,
        )

        await best_effort_invalidate_dashboard_user_cache(str(user.id))

        logger.info("Document created: %s by user %s", document["id"], user.id)
        # Convert metadata to doc_metadata for DocumentResponse
        doc_dict: dict[str, Any] = {}
        for key, value in document.items():
            doc_dict[key] = value
        if "metadata" in doc_dict:
            doc_dict["doc_metadata"] = doc_dict.pop("metadata")
        return DocumentResponse(**doc_dict)

    except Exception as e:
        logger.exception("Error creating document")
        raise HTTPException(status_code=500, detail=f"Failed to create document: {e!s}") from e


@router.get("/documents", response_model=DocumentListResponse)
async def list_documents(
    skip: int = Query(0, ge=0, description="Number of documents to skip"),
    limit: int = Query(50, ge=1, le=100, description="Number of documents to return"),
    search: str | None = Query(None, description="Search query (full-text search)"),
    tags: str | None = Query(None, description="Filter by tags (comma-separated)"),
    list_profile: Literal["full", "compact"] = Query(
        "full",
        description="compact: лёгкий список без полного HTML (поле preview_text)",
    ),
    user: User = Depends(require_oauth2_user),
) -> DocumentListResponse:
    """
    List user's documents with optional filtering.

    - Returns only user's own documents (user_id binding)
    - Supports full-text search
    - Supports filtering by tags
    - Pagination with skip/limit
    """
    try:
        from api.services.doc_editor_service import DocEditorService

        # 🔍 DEBUG: Log user info
        user_id_str = str(user.id)  # type: ignore[arg-type]
        logger.info(
            "🔍 [DOC EDITOR ROUTER] list_documents called with user_id=%s (type=%s, email=%s, username=%s)",
            user_id_str,
            type(user.id).__name__,
            user.email,
            user.username,
        )

        db_pool = await get_db_pool()
        service = DocEditorService(db_pool)

        # Parse tags if provided
        tag_list = [t.strip() for t in tags.split(",")] if tags else None

        documents, total = await service.list_documents(
            user_id=user_id_str,
            skip=skip,
            limit=limit,
            search=search,
            tags=tag_list,
            list_profile=list_profile,
        )

        # 🔍 DEBUG: Log result
        if documents:
            unique_user_ids = {str(doc.get("user_id", "")) for doc in documents if doc.get("user_id")}
            logger.info(
                "🔍 [DOC EDITOR ROUTER] Returning %s documents, unique user_ids in result: %s",
                len(documents),
                unique_user_ids,
            )
            if unique_user_ids and (len(unique_user_ids) > 1 or str(next(iter(unique_user_ids))) != user_id_str):
                logger.error(
                    "❌ [DOC EDITOR ROUTER] WARNING: Wrong user_ids in result! Expected only %s, but got: %s",
                    user_id_str,
                    unique_user_ids,
                )
        else:
            logger.info("[DOC EDITOR ROUTER] No documents found for user_id=%s", user_id_str)

        return DocumentListResponse(
            documents=[DocumentResponse(**doc) for doc in documents],
            total=total,
            skip=skip,
            limit=limit,
        )

    except Exception as e:
        logger.exception("Error listing documents")
        raise HTTPException(status_code=500, detail=f"Failed to list documents: {e!s}") from e


@router.get("/documents/{document_id}", response_model=DocumentResponse)
async def get_document(document_id: UUID, user: User = Depends(require_oauth2_user)) -> DocumentResponse:
    """
    Get document by ID.

    - Checks ownership (only user's own documents)
    - Updates last_accessed_at timestamp
    - Returns 404 if not found or not owned by user
    """
    try:
        from api.services.doc_editor_service import DocEditorService

        db_pool = await get_db_pool()
        service = DocEditorService(db_pool)

        document = await service.get_document(document_id, user.id)

        if not document:
            _raise_document_not_found()

        # Convert metadata to doc_metadata for DocumentResponse
        # Type narrowing: document is guaranteed to be not None here
        assert document is not None  # Type narrowing for type checker
        doc_dict: dict[str, Any] = {}
        for key, value in document.items():
            doc_dict[key] = value
        if "metadata" in doc_dict:
            doc_dict["doc_metadata"] = doc_dict.pop("metadata")
        return DocumentResponse(**doc_dict)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error getting document {document_id}")
        raise HTTPException(status_code=500, detail=f"Failed to get document: {e!s}") from e


@router.put("/documents/{document_id}", response_model=DocumentResponse)
async def update_document(
    document_id: UUID, data: DocumentUpdate, user: User = Depends(require_oauth2_user)
) -> DocumentResponse:
    """
    Update document.

    - Checks ownership
    - Auto-creates version via DB trigger (trigger_unified_content_versioning)
    - Auto-increments version number
    - Updates word_count and character_count
    """
    try:
        from api.services.doc_editor_service import (
            CollaborationSaveForbiddenError,
            DocEditorService,
            DocumentVersionConflictError,
        )

        db_pool = await get_db_pool()
        service = DocEditorService(db_pool)

        # Build update dict (only non-None values)
        updates = {k: v for k, v in data.model_dump().items() if v is not None}

        user_id_str = str(user.id)  # type: ignore[arg-type]
        logger.info(
            "🔍 [DOC EDITOR] update_document called with document_id=%s, user_id=%s (email=%s, updates=%s)",
            document_id,
            user_id_str,
            user.email,
            list(updates.keys()),
        )
        try:
            document = await service.update_document(document_id, user_id_str, **updates)
        except CollaborationSaveForbiddenError as e:
            raise HTTPException(status_code=403, detail=str(e)) from e
        except DocumentVersionConflictError as conflict:
            raise HTTPException(
                status_code=409,
                detail=json_safe_api_detail(
                    {
                        "code": "document_version_conflict",
                        "expectedVersion": conflict.expected_version,
                        "currentVersion": conflict.current_version,
                        "serverDocument": conflict.server_document,
                    }
                ),
            ) from conflict

        if not document:
            _raise_document_not_found()

        logger.info("Document updated: %s by user %s", document_id, user.id)
        # Convert metadata to doc_metadata for DocumentResponse
        # Type narrowing: document is guaranteed to be not None here
        assert document is not None  # Type narrowing for type checker
        doc_dict: dict[str, Any] = {}
        for key, value in document.items():
            doc_dict[key] = value
        if "metadata" in doc_dict:
            doc_dict["doc_metadata"] = doc_dict.pop("metadata")
        return DocumentResponse(**doc_dict)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error updating document {document_id}")
        raise HTTPException(status_code=500, detail=f"Failed to update document: {e!s}") from e


@router.delete("/documents/{document_id}", status_code=204)
async def delete_document(document_id: UUID, user: User = Depends(require_oauth2_user)) -> None:
    """
    Delete document (soft delete).

    - Checks ownership
    - Sets deleted_at timestamp
    - Keeps in database for potential recovery
    """
    try:
        from api.services.doc_editor_service import DocEditorService

        db_pool = await get_db_pool()
        service = DocEditorService(db_pool)

        user_id_str = str(user.id)  # type: ignore[arg-type]
        logger.info(
            "🔍 [DOC EDITOR] delete_document called with document_id=%s, user_id=%s (email=%s)",
            document_id,
            user_id_str,
            user.email,
        )
        success = await service.delete_document(document_id, user_id_str)

        if not success:
            _raise_document_not_found()

        logger.info("Document deleted: %s by user %s", document_id, user.id)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error deleting document {document_id}")
        raise HTTPException(status_code=500, detail=f"Failed to delete document: {e!s}") from e


# ========================================
# SERVER DRAFT SNAPSHOTS (optimistic concurrency)
# ========================================


@router.get("/documents/{document_id}/draft")
async def get_server_draft(
    document_id: UUID,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> dict[str, Any]:
    from api.services.doc_editor_service import DocEditorService

    await _require_unified_content_readable(document_id, user, db)
    await _ensure_server_draft_table(db)

    db_pool = await get_db_pool()
    service = DocEditorService(db_pool)
    draft = await service.get_server_draft(document_id, str(user.id))
    return {"draft": draft}


@router.put("/documents/{document_id}/draft")
async def upsert_server_draft(
    document_id: UUID,
    body: ServerDraftUpsertRequest,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> dict[str, Any]:
    from api.services.doc_editor_service import CollaborationSaveForbiddenError, DocEditorService

    await _require_content_access(document_id, user, db, "comment")
    await _ensure_server_draft_table(db)

    db_pool = await get_db_pool()
    service = DocEditorService(db_pool)
    try:
        result = await service.save_server_draft(
            document_id,
            str(user.id),
            content=body.content,
            base_document_version=body.base_document_version,
            expected_draft_version=body.expected_draft_version,
            source_session_id=body.source_session_id,
        )
    except CollaborationSaveForbiddenError as e:
        raise HTTPException(status_code=403, detail=str(e)) from e
    if result.get("status") == "conflict":
        raise HTTPException(
            status_code=409,
            detail=json_safe_api_detail(
                {
                    "code": "draft_version_conflict",
                    "expectedDraftVersion": result.get("expectedDraftVersion"),
                    "currentDraftVersion": result.get("currentDraftVersion"),
                    "serverDraft": result.get("serverDraft"),
                }
            ),
        )
    return result


@router.delete("/documents/{document_id}/draft")
async def discard_server_draft(
    document_id: UUID,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> dict[str, Any]:
    from api.services.doc_editor_service import DocEditorService

    await _require_content_access(document_id, user, db, "comment")
    await _ensure_server_draft_table(db)

    db_pool = await get_db_pool()
    service = DocEditorService(db_pool)
    deleted = await service.delete_server_draft(document_id, str(user.id))
    return {"status": "ok", "deleted": deleted}


@router.post("/documents/{document_id}/draft/publish")
async def publish_server_draft(
    document_id: UUID,
    body: ServerDraftPublishRequest,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> DocumentResponse:
    from api.services.doc_editor_service import (
        CollaborationSaveForbiddenError,
        DocEditorService,
        DocumentVersionConflictError,
    )

    await _require_content_access(document_id, user, db, "comment")
    await _ensure_server_draft_table(db)

    db_pool = await get_db_pool()
    service = DocEditorService(db_pool)
    draft = await service.get_server_draft(document_id, str(user.id))
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    if body.expected_draft_version is not None and int(draft.get("draftVersion") or 0) != body.expected_draft_version:
        raise HTTPException(
            status_code=409,
            detail=json_safe_api_detail(
                {
                    "code": "draft_version_conflict",
                    "expectedDraftVersion": body.expected_draft_version,
                    "currentDraftVersion": int(draft.get("draftVersion") or 0),
                    "serverDraft": draft,
                }
            ),
        )
    try:
        updated_doc = await service.update_document(
            document_id,
            str(user.id),
            content=str(draft.get("content") or ""),
            expected_version=body.expected_document_version,
        )
    except CollaborationSaveForbiddenError as e:
        raise HTTPException(status_code=403, detail=str(e)) from e
    except DocumentVersionConflictError as conflict:
        raise HTTPException(
            status_code=409,
            detail=json_safe_api_detail(
                {
                    "code": "document_version_conflict",
                    "expectedVersion": conflict.expected_version,
                    "currentVersion": conflict.current_version,
                    "serverDocument": conflict.server_document,
                }
            ),
        ) from conflict

    if not updated_doc:
        _raise_document_not_found()

    await service.delete_server_draft(document_id, str(user.id))

    assert updated_doc is not None
    doc_dict: dict[str, Any] = {}
    for key, value in updated_doc.items():
        doc_dict[key] = value
    if "metadata" in doc_dict:
        doc_dict["doc_metadata"] = doc_dict.pop("metadata")
    return DocumentResponse(**doc_dict)


# ========================================
# DOCUMENT COMMENTS (unified_content)
# ========================================


class CommentThreadCreate(BaseModel):
    """Request body for creating a comment thread."""

    selection: dict[str, Any] = Field(default_factory=dict, description="start, end, text")


class CommentCreate(BaseModel):
    """Request body for adding a comment."""

    content: str = Field(..., min_length=1)


class CommentThreadsBulkRequest(BaseModel):
    """Request body for bulk comment-thread operations."""

    thread_ids: list[UUID] = Field(..., min_length=1, max_length=200)


class CommentThreadAssignRequest(BaseModel):
    """Assign (or clear) reviewer for thread."""

    reviewer_id: UUID | None = None


class DocEditorTemplatePreflightRequest(BaseModel):
    content: str = Field(..., min_length=1)
    mode: str = Field(default="replace")

    @field_validator("mode")
    @classmethod
    def validate_mode(cls, value: str) -> str:
        normalized = (value or "").strip().lower()
        if normalized not in {"replace", "insert", "append"}:
            raise ValueError("mode must be one of: replace, insert, append")
        return normalized


MENTION_HANDLE_RE = re.compile(r"(?<![\\w.-])@([a-z0-9_.-]{1,32})", re.IGNORECASE)


class ContentAccessContext(BaseModel):
    is_owner: bool
    is_collaborator: bool
    owner_user_id: str


async def _get_content_access_context(
    content_id: UUID,
    user_id: Any,
    db: AsyncSession,
) -> ContentAccessContext:
    from sqlalchemy import text

    r = await db.execute(
        text("SELECT id, user_id FROM unified_content WHERE id = :id AND deleted_at IS NULL"),
        {"id": str(content_id)},
    )
    row = r.fetchone()
    if row is None:
        _raise_content_not_found()
    owner_user_id = str(row[1])
    is_owner = owner_user_id == str(user_id)
    if is_owner:
        return ContentAccessContext(is_owner=True, is_collaborator=False, owner_user_id=owner_user_id)

    invite_ok = await db.execute(
        text(
            """
            SELECT 1
            FROM doc_collaboration_invites
            WHERE document_id = :document_id
              AND to_user_id = :user_id
              AND status = 'accepted'
            """
        ),
        {"document_id": str(content_id), "user_id": str(user_id)},
    )
    is_collaborator = invite_ok.first() is not None
    return ContentAccessContext(
        is_owner=False,
        is_collaborator=is_collaborator,
        owner_user_id=owner_user_id,
    )


def _can_manage_review(access: ContentAccessContext, user: User) -> bool:
    if access.is_owner:
        return True
    role = str(getattr(user, "role", "") or "").strip().lower()
    return access.is_collaborator and role in {
        "reviewer",
        "moderator",
        "admin",
        "emperyworld_admin",
    }


def _build_comment_capabilities(access: ContentAccessContext, user: User) -> dict[str, bool]:
    can_comment = access.is_owner or access.is_collaborator
    can_review_manage = _can_manage_review(access, user)
    return {
        "comment.read": can_comment,
        "comment.write": can_comment,
        "review.assign": can_review_manage,
        "review.resolve": can_review_manage,
    }


async def _require_content_access(
    content_id: UUID,
    user: User,
    db: AsyncSession,
    capability: str,
) -> ContentAccessContext:
    access = await _get_content_access_context(content_id, user.id, db)
    if capability == "owner":
        if not access.is_owner:
            _raise_access_denied()
        return access
    if capability == "comment":
        if not (access.is_owner or access.is_collaborator):
            _raise_access_denied()
        return access
    if capability == "review_manage":
        if not _can_manage_review(access, user):
            _raise_access_denied()
        return access
    if capability == "read":
        if not (access.is_owner or access.is_collaborator):
            _raise_access_denied()
        return access
    raise HTTPException(status_code=500, detail=f"Unsupported capability check: {capability}")


async def _table_exists(db: AsyncSession, table_name: str) -> bool:
    from sqlalchemy import text

    result = await db.execute(
        text("SELECT to_regclass(:table_name) IS NOT NULL AS table_exists"),
        {"table_name": table_name},
    )
    row = result.mappings().first()
    return bool(row and row["table_exists"])


async def _table_has_column(db: AsyncSession, table_name: str, column_name: str) -> bool:
    from sqlalchemy import text

    result = await db.execute(
        text(
            """
            SELECT EXISTS(
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = :table_name
                  AND column_name = :column_name
            ) AS has_column
            """
        ),
        {"table_name": table_name, "column_name": column_name},
    )
    row = result.mappings().first()
    return bool(row and row["has_column"])


async def _require_table(db: AsyncSession, table_name: str, migration_hint: str) -> None:
    if await _table_exists(db, table_name):
        return
    raise HTTPException(
        status_code=503,
        detail=f"Required table '{table_name}' is missing. Run migration: {migration_hint}",
    )


def _extract_mentions(value: str) -> list[str]:
    handles: list[str] = []
    for match in MENTION_HANDLE_RE.findall(value or ""):
        normalized = (match or "").strip().lower()
        if normalized and normalized not in handles:
            handles.append(normalized)
    return handles[:25]


def _hash_text(value: str | None) -> str:
    normalized = (value or "").strip()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def _ai_policy_check(candidate_text: str) -> tuple[bool, list[str]]:
    lower = (candidate_text or "").lower()
    blocked_markers = [
        "-----begin private key-----",
        "sk-",
        "xoxb-",
        "aws_secret_access_key",
        "password=",
    ]
    warnings: list[str] = []
    for marker in blocked_markers:
        if marker in lower:
            warnings.append(f"potential_sensitive_token:{marker}")

    unsafe_words_env = os.environ.get("DOC_EDITOR_AI_GUARDRAIL_WORDS", "")
    for token in [part.strip().lower() for part in unsafe_words_env.split(",") if part.strip()]:
        if token and token in lower:
            warnings.append(f"guardrail_word:{token}")
    return (len(warnings) == 0, warnings)


def _companion_scalar_summary(
    value: dict[str, Any] | None,
    *,
    keys: tuple[str, ...],
) -> list[str]:
    if not value:
        return []
    out: list[str] = []
    for key in keys:
        raw = value.get(key)
        if isinstance(raw, bool):
            out.append(f"{key}={str(raw).lower()}")
            continue
        if isinstance(raw, (int, float)):
            out.append(f"{key}={raw}")
            continue
        if isinstance(raw, str) and raw.strip():
            out.append(f"{key}={raw.strip()[:80]}")
    return out[:6]


def _build_companion_transform_directive(data: AICompleteRequest) -> str:
    should_attach = bool(
        data.companion_no_dialogue
        or data.companion_seed_persona_id
        or data.companion_name
        or data.companion_character_state
        or data.companion_style_parameters
        or data.companion_baseline
    )
    if not should_attach:
        return ""
    lines = [
        "Companion transform mode:",
        "- Rewrite through the active companion persona, not as a generic assistant.",
    ]
    if data.companion_name:
        lines.append(f"- Companion name: {data.companion_name.strip()[:96]}")
    if data.companion_seed_persona_id:
        lines.append(f"- Persona id: {data.companion_seed_persona_id.strip()[:96]}")
    char_state = _companion_scalar_summary(
        data.companion_character_state,
        keys=("mood", "tone", "warmth", "directness", "curiosity", "patience"),
    )
    if char_state:
        lines.append(f"- Character hints: {', '.join(char_state)}")
    style_state = _companion_scalar_summary(
        data.companion_style_parameters,
        keys=("tone", "style", "voice", "temperature", "max_tokens", "model"),
    )
    if style_state:
        lines.append(f"- Style hints: {', '.join(style_state)}")
    baseline_state = _companion_scalar_summary(
        data.companion_baseline,
        keys=("voice", "tone", "energy", "formality", "language"),
    )
    if baseline_state:
        lines.append(f"- Baseline hints: {', '.join(baseline_state)}")
    if data.companion_no_dialogue:
        lines.append(
            "- Return only the transformed document text, with no roleplay lines, no dialogue wrappers, and no prefatory chatter."
        )
    return "\n".join(lines).strip()


async def _ensure_comment_thread_support_tables(db: AsyncSession) -> None:
    await _require_table(
        db,
        "doc_editor_comment_thread_meta",
        "20260321_01_doc_editor_comment_thread_review_meta.sql",
    )
    await _require_table(
        db,
        "doc_editor_comment_thread_user_state",
        "20260321_01_doc_editor_comment_thread_review_meta.sql",
    )


async def _ensure_server_draft_table(db: AsyncSession) -> None:
    await _require_table(
        db,
        "doc_editor_document_drafts",
        "20260322_01_doc_editor_drafts_and_governance.sql",
    )


async def _upsert_thread_user_state(
    db: AsyncSession,
    thread_id: UUID,
    user_id: Any,
    *,
    is_following: bool | None = None,
    last_read_at: datetime | None = None,
) -> None:
    from sqlalchemy import text

    await _ensure_comment_thread_support_tables(db)
    await db.execute(
        text(
            """
            INSERT INTO doc_editor_comment_thread_user_state (
                thread_id, user_id, is_following, last_read_at
            )
            VALUES (
                :thread_id,
                :user_id,
                COALESCE(:is_following, TRUE),
                :last_read_at
            )
            ON CONFLICT(thread_id, user_id) DO UPDATE
            SET
                is_following = COALESCE(:is_following, doc_editor_comment_thread_user_state.is_following),
                last_read_at = COALESCE(:last_read_at, doc_editor_comment_thread_user_state.last_read_at),
                updated_at = NOW()
            """
        ),
        {
            "thread_id": str(thread_id),
            "user_id": str(user_id),
            "is_following": is_following,
            "last_read_at": last_read_at,
        },
    )


@router.get("/documents/{document_id}/comments")
async def list_document_comments(
    document_id: UUID,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> dict[str, Any]:
    """
    List comment threads and comments for a document (unified_content).

    Returns threads with nested comments and author names.
    """
    from sqlalchemy import select, text
    from sqlalchemy.orm import selectinload

    from api.models.database_models import (
        UnifiedContentComment,
        UnifiedContentCommentThread,
    )

    access = await _require_content_access(document_id, user, db, "comment")
    await _ensure_comment_thread_support_tables(db)

    stmt = (
        select(UnifiedContentCommentThread)
        .where(UnifiedContentCommentThread.content_id == document_id)
        .options(
            selectinload(UnifiedContentCommentThread.comments).selectinload(UnifiedContentComment.author),
            selectinload(UnifiedContentCommentThread.creator),
        )
        .order_by(UnifiedContentCommentThread.created_at.desc())
    )
    result = await db.execute(stmt)
    threads = list(result.unique().scalars().all())

    thread_ids = [str(thread.id) for thread in threads]
    thread_meta_by_id: dict[str, dict[str, Any]] = {}
    thread_state_by_id: dict[str, dict[str, Any]] = {}
    reviewer_ids: set[str] = set()
    if thread_ids:
        meta_result = await db.execute(
            text(
                """
                SELECT thread_id, assigned_reviewer_id, is_pinned, pinned_by, pinned_at
                FROM doc_editor_comment_thread_meta
                WHERE thread_id = ANY(:thread_ids)
                """
            ),
            {"thread_ids": thread_ids},
        )
        for row in meta_result.mappings().all():
            thread_id = str(row["thread_id"])
            assigned_reviewer_id = str(row["assigned_reviewer_id"]) if row["assigned_reviewer_id"] else None
            if assigned_reviewer_id:
                reviewer_ids.add(assigned_reviewer_id)
            thread_meta_by_id[thread_id] = {
                "assigned_reviewer_id": assigned_reviewer_id,
                "is_pinned": bool(row["is_pinned"]),
                "pinned_by": str(row["pinned_by"]) if row["pinned_by"] else None,
                "pinned_at": row["pinned_at"].isoformat() if row["pinned_at"] else None,
            }

        state_result = await db.execute(
            text(
                """
                SELECT thread_id, is_following, last_read_at
                FROM doc_editor_comment_thread_user_state
                WHERE user_id = :user_id AND thread_id = ANY(:thread_ids)
                """
            ),
            {"user_id": str(user.id), "thread_ids": thread_ids},
        )
        for row in state_result.mappings().all():
            thread_state_by_id[str(row["thread_id"])] = {
                "is_following": bool(row["is_following"]),
                "last_read_at": row["last_read_at"],
            }

    reviewer_by_id: dict[str, dict[str, Any]] = {}
    if reviewer_ids:
        reviewers_result = await db.execute(
            text(
                """
                SELECT id, username, email
                FROM users
                WHERE id = ANY(:ids)
                """
            ),
            {"ids": list(reviewer_ids)},
        )
        for row in reviewers_result.mappings().all():
            reviewer_by_id[str(row["id"])] = {
                "id": str(row["id"]),
                "name": str(row["username"] or row["email"] or "User"),
                "avatar": None,
            }

    def author_payload(u: Any) -> dict[str, Any]:
        if u is None:
            return {"id": "", "name": "Unknown", "avatar": None}
        return {
            "id": str(u.id),
            "name": getattr(u, "username", None) or getattr(u, "email", "") or "User",
            "avatar": None,
        }

    out = []
    for t in threads:
        thread_id = str(t.id)
        comments_out = []
        latest_activity: datetime | None = None
        for c in t.comments:
            if getattr(c, "status", "active") == "deleted":
                continue
            mention_handles = _extract_mentions(c.content or "")
            c_created = getattr(c, "created_at", None)
            comment_created_at = c_created if isinstance(c_created, datetime) else None
            if comment_created_at and (latest_activity is None or comment_created_at > latest_activity):
                latest_activity = comment_created_at
            comments_out.append(
                {
                    "id": str(c.id),
                    "threadId": thread_id,
                    "author": author_payload(c.author),
                    "content": c.content,
                    "createdAt": comment_created_at.isoformat() if comment_created_at else None,
                    "resolved": getattr(c, "status", "active") == "resolved",
                    "mentions": mention_handles,
                }
            )
        if latest_activity is None:
            t_created = getattr(t, "created_at", None)
            latest_activity = t_created if isinstance(t_created, datetime) else None
        meta = thread_meta_by_id.get(thread_id, {})
        state = thread_state_by_id.get(thread_id, {})
        last_read_at = state.get("last_read_at")
        unread = bool(latest_activity and (last_read_at is None or latest_activity > last_read_at))
        assigned_reviewer_id = meta.get("assigned_reviewer_id")
        out.append(
            {
                "id": thread_id,
                "documentId": str(document_id),
                "selection": t.selection or {},
                "comments": comments_out,
                "assignedReviewer": reviewer_by_id.get(assigned_reviewer_id) if assigned_reviewer_id else None,
                "isPinned": bool(meta.get("is_pinned", False)),
                "isFollowing": bool(state.get("is_following", True)),
                "unread": unread,
                "lastActivityAt": latest_activity.isoformat() if latest_activity else None,
            }
        )

    return {
        "threads": out,
        "capabilities": _build_comment_capabilities(access, user),
    }


@router.post("/documents/{document_id}/comments/threads", status_code=201)
async def create_comment_thread(
    document_id: UUID,
    body: CommentThreadCreate,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> dict[str, Any]:
    """Create a new comment thread on a document."""
    from api.models.database_models import UnifiedContentCommentThread

    await _require_content_access(document_id, user, db, "comment")

    thread = UnifiedContentCommentThread(
        content_id=document_id,
        selection=body.selection,
        created_by=user.id,  # type: ignore[assignment]
    )
    db.add(thread)
    await db.flush()
    await _upsert_thread_user_state(
        db,
        thread.id,
        user.id,
        is_following=True,
        last_read_at=utc_now_naive(),
    )
    await db.commit()
    await db.refresh(thread)

    return {
        "id": str(thread.id),
        "documentId": str(document_id),
        "selection": thread.selection or {},
        "comments": [],
        "assignedReviewer": None,
        "isPinned": False,
        "isFollowing": True,
        "unread": False,
        "lastActivityAt": thread.created_at.isoformat() if thread.created_at else None,
    }


@router.post("/documents/{document_id}/comments/threads/{thread_id}/comments", status_code=201)
async def add_comment(
    document_id: UUID,
    thread_id: UUID,
    body: CommentCreate,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> dict[str, Any]:
    """Add a comment (or reply) to a thread."""
    from sqlalchemy import select

    from api.models.database_models import (
        UnifiedContentComment,
        UnifiedContentCommentThread,
    )

    await _require_content_access(document_id, user, db, "comment")

    r = await db.execute(
        select(UnifiedContentCommentThread).where(
            UnifiedContentCommentThread.id == thread_id,
            UnifiedContentCommentThread.content_id == document_id,
        )
    )
    thread = r.scalar_one_or_none()
    if thread is None:
        raise HTTPException(status_code=404, detail="Comment thread not found")

    comment = UnifiedContentComment(
        thread_id=thread_id,
        author_id=user.id,  # type: ignore[assignment]
        content=body.content,
        status="active",
    )
    db.add(comment)
    await _upsert_thread_user_state(
        db,
        thread_id,
        user.id,
        is_following=True,
        last_read_at=utc_now_naive(),
    )
    await db.commit()
    await db.refresh(comment)

    author_payload = {
        "id": str(user.id),
        "name": (user.username or user.email or "User") if user else "User",
        "avatar": None,
    }

    return {
        "id": str(comment.id),
        "threadId": str(thread_id),
        "author": author_payload,
        "content": comment.content,
        "createdAt": comment.created_at.isoformat() if comment.created_at else None,
        "resolved": False,
        "mentions": _extract_mentions(comment.content or ""),
    }


@router.patch("/documents/{document_id}/comments/threads/{thread_id}/resolve")
async def resolve_comment_thread(
    document_id: UUID,
    thread_id: UUID,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> dict[str, str]:
    """Mark all comments in a thread as resolved."""
    from sqlalchemy import select, update

    from api.models.database_models import UnifiedContentComment, UnifiedContentCommentThread

    await _require_content_access(document_id, user, db, "review_manage")

    r = await db.execute(
        select(UnifiedContentCommentThread).where(
            UnifiedContentCommentThread.id == thread_id,
            UnifiedContentCommentThread.content_id == document_id,
        )
    )
    thread = r.scalar_one_or_none()
    if thread is None:
        raise HTTPException(status_code=404, detail="Comment thread not found")

    # `resolved_at` is stored as a naive timestamp in this table, so use naive UTC
    # to avoid asyncpg "can't subtract offset-naive and offset-aware datetimes" errors.
    now = utc_now_naive()
    await db.execute(
        update(UnifiedContentComment)
        .where(UnifiedContentComment.thread_id == thread_id)
        .values(status="resolved", resolved_at=now, resolved_by=user.id)
    )
    await db.commit()

    return {"status": "ok"}


@router.patch("/documents/{document_id}/comments/threads/{thread_id}/reopen")
async def reopen_comment_thread(
    document_id: UUID,
    thread_id: UUID,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> dict[str, str]:
    """Mark all non-deleted comments in a thread as active (reopen)."""
    from sqlalchemy import select, update

    from api.models.database_models import UnifiedContentComment, UnifiedContentCommentThread

    await _require_content_access(document_id, user, db, "review_manage")

    r = await db.execute(
        select(UnifiedContentCommentThread).where(
            UnifiedContentCommentThread.id == thread_id,
            UnifiedContentCommentThread.content_id == document_id,
        )
    )
    thread = r.scalar_one_or_none()
    if thread is None:
        raise HTTPException(status_code=404, detail="Comment thread not found")

    await db.execute(
        update(UnifiedContentComment)
        .where(
            UnifiedContentComment.thread_id == thread_id,
            UnifiedContentComment.status != "deleted",
        )
        .values(status="active", resolved_at=None, resolved_by=None)
    )
    await db.commit()

    return {"status": "ok"}


@router.post("/documents/{document_id}/comments/threads/bulk-resolve")
async def resolve_comment_threads_bulk(
    document_id: UUID,
    body: CommentThreadsBulkRequest,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> dict[str, Any]:
    """Resolve multiple comment threads in one request."""
    from sqlalchemy import select, update

    from api.models.database_models import UnifiedContentComment, UnifiedContentCommentThread

    await _require_content_access(document_id, user, db, "review_manage")

    requested_ids = list(dict.fromkeys(body.thread_ids))
    requested_id_set = set(requested_ids)
    r = await db.execute(
        select(UnifiedContentCommentThread.id).where(
            UnifiedContentCommentThread.content_id == document_id,
            UnifiedContentCommentThread.id.in_(requested_ids),
        )
    )
    existing_ids = [row[0] for row in r.fetchall()]
    existing_id_set = set(existing_ids)

    missing_ids = [thread_id for thread_id in requested_ids if thread_id not in existing_id_set]
    if existing_ids:
        now = utc_now_naive()
        await db.execute(
            update(UnifiedContentComment)
            .where(
                UnifiedContentComment.thread_id.in_(existing_ids),
                UnifiedContentComment.status != "deleted",
            )
            .values(status="resolved", resolved_at=now, resolved_by=user.id)
        )
        await db.commit()

    return {
        "status": "ok",
        "requested": len(requested_id_set),
        "updated": len(existing_ids),
        "failed": len(missing_ids),
        "updatedThreadIds": [str(thread_id) for thread_id in existing_ids],
        "failedThreads": [{"threadId": str(thread_id), "error": "not_found"} for thread_id in missing_ids],
    }


@router.post("/documents/{document_id}/comments/threads/bulk-reopen")
async def reopen_comment_threads_bulk(
    document_id: UUID,
    body: CommentThreadsBulkRequest,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> dict[str, Any]:
    """Reopen multiple comment threads in one request."""
    from sqlalchemy import select, update

    from api.models.database_models import UnifiedContentComment, UnifiedContentCommentThread

    await _require_content_access(document_id, user, db, "review_manage")

    requested_ids = list(dict.fromkeys(body.thread_ids))
    requested_id_set = set(requested_ids)
    r = await db.execute(
        select(UnifiedContentCommentThread.id).where(
            UnifiedContentCommentThread.content_id == document_id,
            UnifiedContentCommentThread.id.in_(requested_ids),
        )
    )
    existing_ids = [row[0] for row in r.fetchall()]
    existing_id_set = set(existing_ids)

    missing_ids = [thread_id for thread_id in requested_ids if thread_id not in existing_id_set]
    if existing_ids:
        await db.execute(
            update(UnifiedContentComment)
            .where(
                UnifiedContentComment.thread_id.in_(existing_ids),
                UnifiedContentComment.status != "deleted",
            )
            .values(status="active", resolved_at=None, resolved_by=None)
        )
        await db.commit()

    return {
        "status": "ok",
        "requested": len(requested_id_set),
        "updated": len(existing_ids),
        "failed": len(missing_ids),
        "updatedThreadIds": [str(thread_id) for thread_id in existing_ids],
        "failedThreads": [{"threadId": str(thread_id), "error": "not_found"} for thread_id in missing_ids],
    }


async def _ensure_thread_belongs_to_document(
    db: AsyncSession,
    document_id: UUID,
    thread_id: UUID,
) -> None:
    from sqlalchemy import select

    from api.models.database_models import UnifiedContentCommentThread

    r = await db.execute(
        select(UnifiedContentCommentThread.id).where(
            UnifiedContentCommentThread.id == thread_id,
            UnifiedContentCommentThread.content_id == document_id,
        )
    )
    exists = r.scalar_one_or_none()
    if exists is None:
        raise HTTPException(status_code=404, detail="Comment thread not found")


@router.patch("/documents/{document_id}/comments/threads/{thread_id}/assign")
async def assign_comment_thread_reviewer(
    document_id: UUID,
    thread_id: UUID,
    body: CommentThreadAssignRequest,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> dict[str, Any]:
    from sqlalchemy import text

    await _require_content_access(document_id, user, db, "review_manage")
    await _ensure_comment_thread_support_tables(db)
    await _ensure_thread_belongs_to_document(db, document_id, thread_id)

    reviewer_id = str(body.reviewer_id) if body.reviewer_id else None
    if reviewer_id:
        reviewer_exists = await db.execute(
            text("SELECT id, username, email FROM users WHERE id = :id"),
            {"id": reviewer_id},
        )
        reviewer = reviewer_exists.mappings().first()
        if reviewer is None:
            raise HTTPException(status_code=404, detail="Reviewer not found")
        reviewer_payload = {
            "id": str(reviewer["id"]),
            "name": str(reviewer["username"] or reviewer["email"] or "User"),
            "avatar": None,
        }
    else:
        reviewer_payload = None

    await db.execute(
        text(
            """
            INSERT INTO doc_editor_comment_thread_meta (thread_id, assigned_reviewer_id)
            VALUES (:thread_id, :assigned_reviewer_id)
            ON CONFLICT(thread_id) DO UPDATE
            SET assigned_reviewer_id = :assigned_reviewer_id, updated_at = NOW()
            """
        ),
        {
            "thread_id": str(thread_id),
            "assigned_reviewer_id": reviewer_id,
        },
    )
    await db.commit()
    return {"status": "ok", "threadId": str(thread_id), "assignedReviewer": reviewer_payload}


@router.post("/documents/{document_id}/comments/threads/{thread_id}/pin")
async def pin_comment_thread(
    document_id: UUID,
    thread_id: UUID,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> dict[str, Any]:
    from sqlalchemy import text

    await _require_content_access(document_id, user, db, "review_manage")
    await _ensure_comment_thread_support_tables(db)
    await _ensure_thread_belongs_to_document(db, document_id, thread_id)
    await db.execute(
        text(
            """
            INSERT INTO doc_editor_comment_thread_meta (thread_id, is_pinned, pinned_by, pinned_at)
            VALUES (:thread_id, TRUE, :user_id, NOW())
            ON CONFLICT(thread_id) DO UPDATE
            SET is_pinned = TRUE, pinned_by = :user_id, pinned_at = NOW(), updated_at = NOW()
            """
        ),
        {"thread_id": str(thread_id), "user_id": str(user.id)},
    )
    await db.commit()
    return {"status": "ok", "threadId": str(thread_id), "isPinned": True}


@router.post("/documents/{document_id}/comments/threads/{thread_id}/unpin")
async def unpin_comment_thread(
    document_id: UUID,
    thread_id: UUID,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> dict[str, Any]:
    from sqlalchemy import text

    await _require_content_access(document_id, user, db, "comment")
    await _ensure_comment_thread_support_tables(db)
    await _ensure_thread_belongs_to_document(db, document_id, thread_id)
    await db.execute(
        text(
            """
            INSERT INTO doc_editor_comment_thread_meta (thread_id, is_pinned, pinned_by, pinned_at)
            VALUES (:thread_id, FALSE, NULL, NULL)
            ON CONFLICT(thread_id) DO UPDATE
            SET is_pinned = FALSE, pinned_by = NULL, pinned_at = NULL, updated_at = NOW()
            """
        ),
        {"thread_id": str(thread_id)},
    )
    await db.commit()
    return {"status": "ok", "threadId": str(thread_id), "isPinned": False}


@router.post("/documents/{document_id}/comments/threads/{thread_id}/follow")
async def follow_comment_thread(
    document_id: UUID,
    thread_id: UUID,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> dict[str, Any]:
    await _require_content_access(document_id, user, db, "comment")
    await _ensure_thread_belongs_to_document(db, document_id, thread_id)
    await _upsert_thread_user_state(
        db,
        thread_id,
        user.id,
        is_following=True,
    )
    await db.commit()
    return {"status": "ok", "threadId": str(thread_id), "isFollowing": True}


@router.post("/documents/{document_id}/comments/threads/{thread_id}/unfollow")
async def unfollow_comment_thread(
    document_id: UUID,
    thread_id: UUID,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> dict[str, Any]:
    await _require_content_access(document_id, user, db, "comment")
    await _ensure_thread_belongs_to_document(db, document_id, thread_id)
    await _upsert_thread_user_state(
        db,
        thread_id,
        user.id,
        is_following=False,
    )
    await db.commit()
    return {"status": "ok", "threadId": str(thread_id), "isFollowing": False}


@router.post("/documents/{document_id}/comments/threads/{thread_id}/mark-read")
async def mark_comment_thread_read(
    document_id: UUID,
    thread_id: UUID,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> dict[str, Any]:
    await _require_content_access(document_id, user, db, "comment")
    await _ensure_thread_belongs_to_document(db, document_id, thread_id)
    await _upsert_thread_user_state(
        db,
        thread_id,
        user.id,
        last_read_at=utc_now_naive(),
    )
    await db.commit()
    return {"status": "ok", "threadId": str(thread_id), "unread": False}


async def _load_doc_editor_templates(
    db: AsyncSession,
) -> tuple[list[dict[str, Any]], str, str | None]:
    from sqlalchemy import text

    if not await _table_exists(db, "doc_editor_templates"):
        logger.warning("doc_editor_templates table is missing, using fallback catalog from code")
        return (
            DOC_EDITOR_TEMPLATES_FALLBACK,
            "fallback",
            "schema_missing_doc_editor_templates",
        )
    has_lifecycle_state = await _table_has_column(db, "doc_editor_templates", "lifecycle_state")
    has_release_version = await _table_has_column(db, "doc_editor_templates", "release_version")
    has_release_channel = await _table_has_column(db, "doc_editor_templates", "release_channel")
    has_owner_user_id = await _table_has_column(db, "doc_editor_templates", "owner_user_id")
    has_published_at = await _table_has_column(db, "doc_editor_templates", "published_at")
    governance_select = f"""
            {("lifecycle_state," if has_lifecycle_state else "'published'::text AS lifecycle_state,")}
            {("release_version," if has_release_version else "1::int AS release_version,")}
            {("release_channel," if has_release_channel else "'stable'::text AS release_channel,")}
            {("owner_user_id," if has_owner_user_id else "NULL::uuid AS owner_user_id,")}
            {("published_at" if has_published_at else "NULL::timestamptz AS published_at")}
    """
    result = await db.execute(
        text(
            """
            SELECT
                id,
                name,
                description,
                category,
                content,
                tags,
                estimated_time,
                difficulty,
            """
            + governance_select
            + """
            FROM doc_editor_templates
            WHERE is_enabled = TRUE
            ORDER BY sort_order ASC, id ASC
            """
        )
    )
    rows = result.mappings().all()
    if not rows:
        return (DOC_EDITOR_TEMPLATES_FALLBACK, "fallback", "empty_doc_editor_templates")

    out: list[dict[str, Any]] = []
    for row in rows:
        published_raw = row.get("published_at")
        published_at_str = published_raw.isoformat() if isinstance(published_raw, datetime) else None
        out.append(
            {
                "id": str(row["id"]),
                "name": str(row["name"]),
                "description": str(row["description"] or ""),
                "category": str(row["category"] or "business"),
                "content": str(row["content"] or ""),
                "tags": row["tags"] if isinstance(row["tags"], list) else [],
                "estimatedTime": str(row["estimated_time"] or "15-20 мин"),
                "difficulty": str(row["difficulty"] or "easy"),
                "lifecycleState": str(row.get("lifecycle_state") or "published"),
                "releaseVersion": int(row.get("release_version") or 1),
                "releaseChannel": str(row.get("release_channel") or "stable"),
                "ownerUserId": str(row.get("owner_user_id")) if row.get("owner_user_id") else None,
                "publishedAt": published_at_str,
            }
        )
    return (out, "db", None)


@router.get("/templates")
async def list_doc_editor_templates(
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> dict[str, Any]:
    del user
    templates, source, degraded_reason = await _load_doc_editor_templates(db)
    return {
        "templates": templates,
        "source": source,
        "degradedReason": degraded_reason,
    }


@router.post("/templates/preflight")
async def preflight_doc_editor_template_apply(
    body: DocEditorTemplatePreflightRequest,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> dict[str, Any]:
    del user, db
    warnings: list[str] = []
    content = body.content or ""
    safe_to_apply = True
    if "<script" in content.lower():
        warnings.append("Обнаружены script-теги, они будут удалены при рендеринге.")
    if len(content) > 25000:
        warnings.append("Шаблон очень большой, вставка может занять больше времени.")
    if body.mode == "insert" and not content.strip():
        warnings.append("Пустой шаблон не будет вставлен.")
        safe_to_apply = False

    return {
        "status": "ok",
        "mode": body.mode,
        "warnings": warnings,
        "safeToApply": safe_to_apply,
    }


def _normalize_installed_plugin_ids(value: Any, available_plugin_ids: set[str]) -> list[str]:
    if not isinstance(value, list):
        return []
    out: list[str] = []
    for item in value:
        plugin_id = str(item).strip()
        if plugin_id and plugin_id in available_plugin_ids and plugin_id not in out:
            out.append(plugin_id)
    return out


def _require_doc_editor_plugin_admin(user: User) -> None:
    role = str(getattr(user, "role", "") or "")
    if role not in {"admin", "emperyworld_admin"}:
        raise HTTPException(status_code=403, detail="Administrator privileges required")


def _normalize_plugin_string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    out: list[str] = []
    for item in value:
        normalized = str(item).strip()
        if normalized:
            out.append(normalized)
    return out


def _map_doc_editor_plugin_row(row: Any, include_admin_fields: bool = False) -> dict[str, Any]:
    payload = {
        "id": str(row["id"]),
        "name": str(row["name"]),
        "description": str(row["description"] or ""),
        "version": str(row["version"] or "1.0.0"),
        "author": str(row["author"] or "Unknown"),
        "category": str(row["category"] or "productivity"),
        "rating": float(row["rating"] or 0),
        "downloads": int(row["downloads"] or 0),
        "tags": row["tags"] if isinstance(row["tags"], list) else [],
        "icon": str(row["icon"] or "🧩"),
        "permissions": row["permissions"] if isinstance(row["permissions"], list) else [],
        "isOfficial": bool(row["is_official"]),
        "isGPUAccelerated": bool(row["is_gpu_accelerated"]),
        "price": float(row["price"]) if row["price"] is not None else None,
        "lastUpdated": row["last_updated"].isoformat() if row["last_updated"] else None,
        "minEditorVersion": str(row["min_editor_version"] or "0.0.0"),
        "maxEditorVersion": str(row["max_editor_version"]) if row["max_editor_version"] else None,
        "requiredCapabilities": row["required_capabilities"] if isinstance(row["required_capabilities"], list) else [],
        "lifecycleState": str(row.get("lifecycle_state") or "published"),
        "releaseVersion": int(row.get("release_version") or 1),
        "releaseChannel": str(row.get("release_channel") or "stable"),
        "ownerUserId": str(row.get("owner_user_id")) if row.get("owner_user_id") else None,
        "publishedAt": row.get("published_at").isoformat() if row.get("published_at") else None,
    }
    if include_admin_fields:
        payload["isEnabled"] = bool(row["is_enabled"])
        payload["sortOrder"] = int(row["sort_order"] or 100)
    return payload


async def _append_catalog_audit_log(
    db: AsyncSession,
    *,
    entity_type: str,
    entity_id: str,
    action: str,
    actor_user_id: str | None,
    previous_payload: dict[str, Any] | None,
    next_payload: dict[str, Any] | None,
) -> None:
    from sqlalchemy import text

    if not await _table_exists(db, "doc_editor_catalog_audit_log"):
        return
    await db.execute(
        text(
            """
            INSERT INTO doc_editor_catalog_audit_log (
                id, entity_type, entity_id, action, actor_user_id, previous_payload, next_payload
            )
            VALUES (
                :id, :entity_type, :entity_id, :action, :actor_user_id, :previous_payload, :next_payload
            )
            """
        ),
        {
            "id": str(uuid4()),
            "entity_type": entity_type,
            "entity_id": entity_id,
            "action": action,
            "actor_user_id": actor_user_id,
            "previous_payload": previous_payload,
            "next_payload": next_payload,
        },
    )


class DocEditorPluginAdminCreateRequest(BaseModel):
    id: str = Field(..., min_length=1, max_length=120)
    name: str = Field(..., min_length=1, max_length=255)
    description: str = Field(default="")
    version: str = Field(default="1.0.0", min_length=1, max_length=32)
    author: str = Field(default="Unknown", min_length=1, max_length=255)
    category: str = Field(default="productivity", min_length=1, max_length=64)
    rating: float = Field(default=0, ge=0, le=5)
    downloads: int = Field(default=0, ge=0)
    tags: list[str] = Field(default_factory=list)
    icon: str = Field(default="🧩")
    permissions: list[str] = Field(default_factory=list)
    is_official: bool = Field(default=False)
    is_gpu_accelerated: bool = Field(default=False)
    price: float | None = Field(default=None, ge=0)
    min_editor_version: str = Field(default="0.0.0", min_length=1, max_length=32)
    max_editor_version: str | None = Field(default=None, max_length=32)
    required_capabilities: list[str] = Field(default_factory=list)
    is_enabled: bool = Field(default=True)
    sort_order: int = Field(default=100)
    lifecycle_state: str = Field(default="published", min_length=1, max_length=24)
    release_version: int = Field(default=1, ge=1)
    release_channel: str = Field(default="stable", min_length=1, max_length=24)
    owner_user_id: UUID | None = None


class DocEditorPluginAdminUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    version: str | None = Field(default=None, min_length=1, max_length=32)
    author: str | None = Field(default=None, min_length=1, max_length=255)
    category: str | None = Field(default=None, min_length=1, max_length=64)
    rating: float | None = Field(default=None, ge=0, le=5)
    downloads: int | None = Field(default=None, ge=0)
    tags: list[str] | None = None
    icon: str | None = None
    permissions: list[str] | None = None
    is_official: bool | None = None
    is_gpu_accelerated: bool | None = None
    price: float | None = Field(default=None, ge=0)
    min_editor_version: str | None = Field(default=None, min_length=1, max_length=32)
    max_editor_version: str | None = Field(default=None, max_length=32)
    required_capabilities: list[str] | None = None
    is_enabled: bool | None = None
    sort_order: int | None = None
    lifecycle_state: str | None = Field(default=None, min_length=1, max_length=24)
    release_version: int | None = Field(default=None, ge=1)
    release_channel: str | None = Field(default=None, min_length=1, max_length=24)
    owner_user_id: UUID | None = None


async def _load_doc_editor_plugin_catalog(
    db: AsyncSession,
) -> tuple[list[dict[str, Any]], str, str | None]:
    from sqlalchemy import text

    if not await _table_exists(db, "doc_editor_plugins"):
        logger.warning("doc_editor_plugins table is missing, using fallback catalog")
        return (
            DOC_EDITOR_PLUGIN_CATALOG_FALLBACK,
            "fallback",
            "schema_missing_doc_editor_plugins",
        )

    try:
        has_min_editor_version = await _table_has_column(db, "doc_editor_plugins", "min_editor_version")
        has_max_editor_version = await _table_has_column(db, "doc_editor_plugins", "max_editor_version")
        has_required_capabilities = await _table_has_column(db, "doc_editor_plugins", "required_capabilities")
        has_lifecycle_state = await _table_has_column(db, "doc_editor_plugins", "lifecycle_state")
        has_release_version = await _table_has_column(db, "doc_editor_plugins", "release_version")
        has_release_channel = await _table_has_column(db, "doc_editor_plugins", "release_channel")
        has_owner_user_id = await _table_has_column(db, "doc_editor_plugins", "owner_user_id")
        has_published_at = await _table_has_column(db, "doc_editor_plugins", "published_at")
        compatibility_select = f"""
                    {("min_editor_version," if has_min_editor_version else "'0.0.0'::varchar(32) AS min_editor_version,")}
                    {("max_editor_version," if has_max_editor_version else "NULL::varchar(32) AS max_editor_version,")}
                    {("required_capabilities," if has_required_capabilities else "'[]'::jsonb AS required_capabilities,")}
        """
        governance_select = f"""
                    {("lifecycle_state," if has_lifecycle_state else "'published'::text AS lifecycle_state,")}
                    {("release_version," if has_release_version else "1::int AS release_version,")}
                    {("release_channel," if has_release_channel else "'stable'::text AS release_channel,")}
                    {("owner_user_id," if has_owner_user_id else "NULL::uuid AS owner_user_id,")}
                    {("published_at" if has_published_at else "NULL::timestamptz AS published_at")}
        """
        result = await db.execute(
            text(
                """
                SELECT
                    id,
                    name,
                    description,
                    version,
                    author,
                    category,
                    rating,
                    downloads,
                    tags,
                    icon,
                    permissions,
                    is_official,
                    is_gpu_accelerated,
                    price,
                    last_updated,
                    """
                + compatibility_select
                + governance_select
                + """
                FROM doc_editor_plugins
                WHERE is_enabled = TRUE
                ORDER BY sort_order ASC, downloads DESC, id ASC
                """
            )
        )
        rows = result.mappings().all()
        if not rows:
            return (
                DOC_EDITOR_PLUGIN_CATALOG_FALLBACK,
                "fallback",
                "empty_doc_editor_plugins",
            )

        catalog: list[dict[str, Any]] = [_map_doc_editor_plugin_row(row) for row in rows]
        return (catalog, "db", None)
    except Exception:
        # Degrade like missing table: UI stays usable with built-in catalog; avoid 503 for transient DB/SQL issues.
        logger.exception("Doc editor plugin catalog DB query failed; serving fallback catalog")
        return (
            DOC_EDITOR_PLUGIN_CATALOG_FALLBACK,
            "fallback",
            "catalog_query_failed",
        )


async def _get_installed_doc_editor_plugins(db: AsyncSession, user: User, available_plugin_ids: set[str]) -> list[str]:
    from sqlalchemy import select

    from api.models.database_models import User as DatabaseUser

    db_user_id = await resolve_db_user_uuid_with_session(user, db)
    result = await db.execute(select(DatabaseUser).where(DatabaseUser.id == db_user_id))
    row = result.scalar_one_or_none()
    if row is None:
        _raise_access_denied()
    preferences = getattr(row, "preferences", {}) or {}
    if not isinstance(preferences, dict):
        return []
    doc_editor_prefs = preferences.get("ultimate_doc_editor", {})
    if not isinstance(doc_editor_prefs, dict):
        return []
    return _normalize_installed_plugin_ids(doc_editor_prefs.get("installed_plugins", []), available_plugin_ids)


async def _set_installed_doc_editor_plugins(
    db: AsyncSession,
    user: User,
    installed_ids: list[str],
    available_plugin_ids: set[str],
) -> list[str]:
    from sqlalchemy import select

    from api.models.database_models import User as DatabaseUser

    db_user_id = await resolve_db_user_uuid_with_session(user, db)
    result = await db.execute(select(DatabaseUser).where(DatabaseUser.id == db_user_id))
    row = result.scalar_one_or_none()
    if row is None:
        _raise_access_denied()

    preferences = getattr(row, "preferences", {}) or {}
    if not isinstance(preferences, dict):
        preferences = {}
    doc_editor_prefs = preferences.get("ultimate_doc_editor", {})
    if not isinstance(doc_editor_prefs, dict):
        doc_editor_prefs = {}

    normalized_ids = _normalize_installed_plugin_ids(installed_ids, available_plugin_ids)
    doc_editor_prefs["installed_plugins"] = normalized_ids
    preferences["ultimate_doc_editor"] = doc_editor_prefs

    row_mut: Any = row
    row_mut.preferences = preferences
    await db.commit()
    return normalized_ids


@router.get("/plugins")
async def list_doc_editor_plugins(
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> dict[str, Any]:
    """List available UltimateDocEditor plugins with installation status for current user."""
    catalog, source, degraded_reason = await _load_doc_editor_plugin_catalog(db)
    available_plugin_ids = {str(item.get("id", "")) for item in catalog if str(item.get("id", "")).strip()}
    installed_ids = set(await _get_installed_doc_editor_plugins(db, user, available_plugin_ids))
    plugins = []
    for plugin in catalog:
        item = dict(plugin)
        item["status"] = "installed" if plugin["id"] in installed_ids else "available"
        plugins.append(item)
    return {
        "plugins": plugins,
        "installedPluginIds": sorted(installed_ids),
        "source": source,
        "degradedReason": degraded_reason,
    }


@router.post("/plugins/{plugin_id}/install")
async def install_doc_editor_plugin(
    plugin_id: str,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> dict[str, Any]:
    """Mark plugin as installed for current user in `users.preferences`."""
    normalized_plugin_id = plugin_id.strip()
    catalog, _, _ = await _load_doc_editor_plugin_catalog(db)
    available_plugin_ids = {str(item.get("id", "")) for item in catalog if str(item.get("id", "")).strip()}
    if normalized_plugin_id not in available_plugin_ids:
        raise HTTPException(status_code=404, detail="Plugin not found")

    installed_ids = await _get_installed_doc_editor_plugins(db, user, available_plugin_ids)
    if normalized_plugin_id not in installed_ids:
        installed_ids.append(normalized_plugin_id)
    installed_ids = await _set_installed_doc_editor_plugins(db, user, installed_ids, available_plugin_ids)
    return {
        "status": "ok",
        "pluginId": normalized_plugin_id,
        "installed": True,
        "installedPluginIds": installed_ids,
    }


@router.delete("/plugins/{plugin_id}/install")
async def uninstall_doc_editor_plugin(
    plugin_id: str,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> dict[str, Any]:
    """Mark plugin as uninstalled for current user in `users.preferences`."""
    normalized_plugin_id = plugin_id.strip()
    catalog, _, _ = await _load_doc_editor_plugin_catalog(db)
    available_plugin_ids = {str(item.get("id", "")) for item in catalog if str(item.get("id", "")).strip()}
    if normalized_plugin_id not in available_plugin_ids:
        raise HTTPException(status_code=404, detail="Plugin not found")

    installed_ids = [
        item
        for item in await _get_installed_doc_editor_plugins(db, user, available_plugin_ids)
        if item != normalized_plugin_id
    ]
    installed_ids = await _set_installed_doc_editor_plugins(db, user, installed_ids, available_plugin_ids)
    return {
        "status": "ok",
        "pluginId": normalized_plugin_id,
        "installed": False,
        "installedPluginIds": installed_ids,
    }


@router.get("/plugins/admin")
async def list_doc_editor_plugins_admin(
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> dict[str, Any]:
    """Admin: list full plugin catalog, including disabled entries."""
    from sqlalchemy import text

    _require_doc_editor_plugin_admin(user)
    await _require_table(
        db,
        "doc_editor_plugins",
        "20260320_03_doc_editor_plugins_catalog.sql",
    )
    has_min = await _table_has_column(db, "doc_editor_plugins", "min_editor_version")
    has_max = await _table_has_column(db, "doc_editor_plugins", "max_editor_version")
    has_req = await _table_has_column(db, "doc_editor_plugins", "required_capabilities")
    admin_compat_select = f"""
                {("min_editor_version," if has_min else "'0.0.0'::varchar(32) AS min_editor_version,")}
                {("max_editor_version," if has_max else "NULL::varchar(32) AS max_editor_version,")}
                {("required_capabilities," if has_req else "'[]'::jsonb AS required_capabilities,")}
    """
    governance_select = f"""
                {("lifecycle_state," if await _table_has_column(db, "doc_editor_plugins", "lifecycle_state") else "'published'::text AS lifecycle_state,")}
                {("release_version," if await _table_has_column(db, "doc_editor_plugins", "release_version") else "1::int AS release_version,")}
                {("release_channel," if await _table_has_column(db, "doc_editor_plugins", "release_channel") else "'stable'::text AS release_channel,")}
                {("owner_user_id," if await _table_has_column(db, "doc_editor_plugins", "owner_user_id") else "NULL::uuid AS owner_user_id,")}
                {("published_at" if await _table_has_column(db, "doc_editor_plugins", "published_at") else "NULL::timestamptz AS published_at")}
    """
    result = await db.execute(
        text(
            """
            SELECT
                id,
                name,
                description,
                version,
                author,
                category,
                rating,
                downloads,
                tags,
                icon,
                permissions,
                is_official,
                is_gpu_accelerated,
                price,
                last_updated,
                """
            + admin_compat_select
            + """
                is_enabled,
                sort_order,
                """
            + governance_select
            + """
            FROM doc_editor_plugins
            ORDER BY sort_order ASC, downloads DESC, id ASC
            """
        )
    )
    rows = result.mappings().all()
    return {"plugins": [_map_doc_editor_plugin_row(row, include_admin_fields=True) for row in rows]}


@router.post("/plugins/admin", status_code=201)
async def create_doc_editor_plugin_admin(
    body: DocEditorPluginAdminCreateRequest,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> dict[str, Any]:
    """Admin: create a new plugin catalog entry."""
    from sqlalchemy import text

    _require_doc_editor_plugin_admin(user)
    plugin_id = body.id.strip()
    if not plugin_id:
        raise HTTPException(status_code=400, detail="Plugin id is required")

    existing = await db.execute(text("SELECT id FROM doc_editor_plugins WHERE id = :id"), {"id": plugin_id})
    if existing.first() is not None:
        raise HTTPException(status_code=409, detail="Plugin already exists")

    params: dict[str, Any] = {
        "id": plugin_id,
        "name": body.name.strip(),
        "description": body.description or "",
        "version": body.version.strip(),
        "author": body.author.strip(),
        "category": body.category.strip(),
        "rating": body.rating,
        "downloads": body.downloads,
        "tags": _normalize_plugin_string_list(body.tags),
        "icon": body.icon or "🧩",
        "permissions": _normalize_plugin_string_list(body.permissions),
        "is_official": body.is_official,
        "is_gpu_accelerated": body.is_gpu_accelerated,
        "price": body.price,
        "min_editor_version": body.min_editor_version.strip(),
        "max_editor_version": body.max_editor_version.strip() if body.max_editor_version else None,
        "required_capabilities": _normalize_plugin_string_list(body.required_capabilities),
        "is_enabled": body.is_enabled,
        "sort_order": body.sort_order,
    }
    insert_columns = [
        "id",
        "name",
        "description",
        "version",
        "author",
        "category",
        "rating",
        "downloads",
        "tags",
        "icon",
        "permissions",
        "is_official",
        "is_gpu_accelerated",
        "price",
        "last_updated",
        "min_editor_version",
        "max_editor_version",
        "required_capabilities",
        "is_enabled",
        "sort_order",
    ]
    insert_values = [
        ":id",
        ":name",
        ":description",
        ":version",
        ":author",
        ":category",
        ":rating",
        ":downloads",
        ":tags",
        ":icon",
        ":permissions",
        ":is_official",
        ":is_gpu_accelerated",
        ":price",
        "NOW()",
        ":min_editor_version",
        ":max_editor_version",
        ":required_capabilities",
        ":is_enabled",
        ":sort_order",
    ]
    if await _table_has_column(db, "doc_editor_plugins", "lifecycle_state"):
        insert_columns.append("lifecycle_state")
        insert_values.append(":lifecycle_state")
        params["lifecycle_state"] = body.lifecycle_state.strip().lower()
    if await _table_has_column(db, "doc_editor_plugins", "release_version"):
        insert_columns.append("release_version")
        insert_values.append(":release_version")
        params["release_version"] = body.release_version
    if await _table_has_column(db, "doc_editor_plugins", "release_channel"):
        insert_columns.append("release_channel")
        insert_values.append(":release_channel")
        params["release_channel"] = body.release_channel.strip().lower()
    if await _table_has_column(db, "doc_editor_plugins", "owner_user_id"):
        insert_columns.append("owner_user_id")
        insert_values.append(":owner_user_id")
        params["owner_user_id"] = str(body.owner_user_id) if body.owner_user_id else None
    if await _table_has_column(db, "doc_editor_plugins", "published_at"):
        insert_columns.append("published_at")
        insert_values.append("CASE WHEN :lifecycle_state = 'published' THEN NOW() ELSE NULL END")
        params.setdefault("lifecycle_state", body.lifecycle_state.strip().lower())

    await db.execute(
        text(
            f"""
            INSERT INTO doc_editor_plugins ({", ".join(insert_columns)})
            VALUES ({", ".join(insert_values)})
            """  # noqa: S608
        ),
        params,
    )
    await _append_catalog_audit_log(
        db,
        entity_type="plugin",
        entity_id=plugin_id,
        action="create",
        actor_user_id=str(user.id),
        previous_payload=None,
        next_payload=params,
    )
    await db.commit()
    return {"status": "ok", "pluginId": plugin_id}


@router.patch("/plugins/admin/{plugin_id}")
async def update_doc_editor_plugin_admin(
    plugin_id: str,
    body: DocEditorPluginAdminUpdateRequest,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> dict[str, Any]:
    """Admin: update plugin catalog entry fields."""
    from sqlalchemy import text

    _require_doc_editor_plugin_admin(user)
    normalized_plugin_id = plugin_id.strip()
    if not normalized_plugin_id:
        raise HTTPException(status_code=400, detail="Plugin id is required")

    current_result = await db.execute(
        text(
            """
            SELECT
                id, name, description, version, author, category,
                rating, downloads, tags, icon, permissions,
                is_official, is_gpu_accelerated, price,
                min_editor_version, max_editor_version, required_capabilities,
                is_enabled, sort_order
            FROM doc_editor_plugins
            WHERE id = :id
            """
        ),
        {"id": normalized_plugin_id},
    )
    current = current_result.mappings().first()
    if current is None:
        raise HTTPException(status_code=404, detail="Plugin not found")

    payload = body.model_dump(exclude_unset=True)
    merged = {
        "name": payload.get("name", current["name"]),
        "description": payload.get("description", current["description"]),
        "version": payload.get("version", current["version"]),
        "author": payload.get("author", current["author"]),
        "category": payload.get("category", current["category"]),
        "rating": payload.get("rating", current["rating"]),
        "downloads": payload.get("downloads", current["downloads"]),
        "tags": _normalize_plugin_string_list(payload["tags"]) if "tags" in payload else current["tags"],
        "icon": payload.get("icon", current["icon"]),
        "permissions": _normalize_plugin_string_list(payload["permissions"])
        if "permissions" in payload
        else current["permissions"],
        "is_official": payload.get("is_official", current["is_official"]),
        "is_gpu_accelerated": payload.get("is_gpu_accelerated", current["is_gpu_accelerated"]),
        "price": payload.get("price", current["price"]),
        "min_editor_version": payload.get("min_editor_version", current["min_editor_version"]),
        "max_editor_version": payload.get("max_editor_version", current["max_editor_version"]),
        "required_capabilities": _normalize_plugin_string_list(payload["required_capabilities"])
        if "required_capabilities" in payload
        else current["required_capabilities"],
        "is_enabled": payload.get("is_enabled", current["is_enabled"]),
        "sort_order": payload.get("sort_order", current["sort_order"]),
        "lifecycle_state": payload.get("lifecycle_state", current.get("lifecycle_state", "published")),
        "release_version": payload.get("release_version", current.get("release_version", 1)),
        "release_channel": payload.get("release_channel", current.get("release_channel", "stable")),
        "owner_user_id": (
            str(payload["owner_user_id"]) if payload.get("owner_user_id") is not None else current.get("owner_user_id")
        ),
    }
    set_clauses = [
        "name = :name",
        "description = :description",
        "version = :version",
        "author = :author",
        "category = :category",
        "rating = :rating",
        "downloads = :downloads",
        "tags = :tags",
        "icon = :icon",
        "permissions = :permissions",
        "is_official = :is_official",
        "is_gpu_accelerated = :is_gpu_accelerated",
        "price = :price",
        "min_editor_version = :min_editor_version",
        "max_editor_version = :max_editor_version",
        "required_capabilities = :required_capabilities",
        "is_enabled = :is_enabled",
        "sort_order = :sort_order",
        "updated_at = NOW()",
        "last_updated = NOW()",
    ]
    if await _table_has_column(db, "doc_editor_plugins", "lifecycle_state"):
        set_clauses.append("lifecycle_state = :lifecycle_state")
    if await _table_has_column(db, "doc_editor_plugins", "release_version"):
        set_clauses.append("release_version = :release_version")
    if await _table_has_column(db, "doc_editor_plugins", "release_channel"):
        set_clauses.append("release_channel = :release_channel")
    if await _table_has_column(db, "doc_editor_plugins", "owner_user_id"):
        set_clauses.append("owner_user_id = :owner_user_id")
    if await _table_has_column(db, "doc_editor_plugins", "published_at"):
        set_clauses.append(
            "published_at = CASE WHEN :lifecycle_state = 'published' THEN COALESCE(published_at, NOW()) ELSE published_at END"
        )

    await db.execute(
        text(
            f"""
            UPDATE doc_editor_plugins
            SET {", ".join(set_clauses)}
            WHERE id = :id
            """  # noqa: S608
        ),
        {"id": normalized_plugin_id, **merged},
    )
    await _append_catalog_audit_log(
        db,
        entity_type="plugin",
        entity_id=normalized_plugin_id,
        action="update",
        actor_user_id=str(user.id),
        previous_payload=dict(current),
        next_payload=merged,
    )
    await db.commit()
    return {"status": "ok", "pluginId": normalized_plugin_id}


@router.delete("/plugins/admin/{plugin_id}")
async def disable_doc_editor_plugin_admin(
    plugin_id: str,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> dict[str, Any]:
    """Admin: soft-disable plugin catalog entry."""
    from sqlalchemy import text

    _require_doc_editor_plugin_admin(user)
    normalized_plugin_id = plugin_id.strip()
    result = await db.execute(
        text(
            """
            UPDATE doc_editor_plugins
            SET is_enabled = FALSE, updated_at = NOW(), last_updated = NOW()
            WHERE id = :id
            RETURNING id
            """
        ),
        {"id": normalized_plugin_id},
    )
    row = result.first()
    if row is None:
        raise HTTPException(status_code=404, detail="Plugin not found")
    await _append_catalog_audit_log(
        db,
        entity_type="plugin",
        entity_id=normalized_plugin_id,
        action="disable",
        actor_user_id=str(user.id),
        previous_payload=None,
        next_payload={"is_enabled": False},
    )
    await db.commit()
    return {"status": "ok", "pluginId": normalized_plugin_id, "isEnabled": False}


@router.post("/plugins/admin/{plugin_id}/enable")
async def enable_doc_editor_plugin_admin(
    plugin_id: str,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> dict[str, Any]:
    """Admin: re-enable plugin catalog entry."""
    from sqlalchemy import text

    _require_doc_editor_plugin_admin(user)
    normalized_plugin_id = plugin_id.strip()
    result = await db.execute(
        text(
            """
            UPDATE doc_editor_plugins
            SET is_enabled = TRUE, updated_at = NOW(), last_updated = NOW()
            WHERE id = :id
            RETURNING id
            """
        ),
        {"id": normalized_plugin_id},
    )
    row = result.first()
    if row is None:
        raise HTTPException(status_code=404, detail="Plugin not found")
    await _append_catalog_audit_log(
        db,
        entity_type="plugin",
        entity_id=normalized_plugin_id,
        action="enable",
        actor_user_id=str(user.id),
        previous_payload=None,
        next_payload={"is_enabled": True},
    )
    await db.commit()
    return {"status": "ok", "pluginId": normalized_plugin_id, "isEnabled": True}


# ========================================
# COLLABORATION INVITES (friends only)
# ========================================


class InviteCreateBody(BaseModel):
    """Body to create a collaboration invite (invite a friend)."""

    to_user_id: str = Field(..., min_length=1, description="Friend user ID to invite")
    allow_collaborators_save: bool = Field(
        default=False,
        description="Если true — приглашённый может сохранять документ владельца (PUT и серверный черновик). Иначе только совместное редактирование в реальном времени (Yjs).",
    )


@router.post("/documents/{document_id}/invites")
async def create_collaboration_invite(
    document_id: UUID,
    body: InviteCreateBody,
    user: User = Depends(require_oauth2_user),
) -> dict[str, Any]:
    """
    Send collaboration invite to a friend. Only document owner can invite.
    The invited user will see the invite in the Collaboration panel and can accept/decline.
    """
    try:
        service = await get_doc_editor_service()
        result = await service.create_collaboration_invite(
            document_id=document_id,
            from_user_id=str(user.id),
            to_user_id=body.to_user_id.strip(),
            allow_collaborators_save=body.allow_collaborators_save,
        )
        await _notify_collaboration_invite_socket(
            to_user_id=body.to_user_id.strip(),
            invite_id=str(result["id"]),
            document_id=document_id,
            document_title=str(result.get("document_title") or "Документ"),
            from_display_name=str(result.get("from_display_name") or "Пользователь"),
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        if asyncpg is not None:
            if isinstance(e, asyncpg.exceptions.UndefinedTableError):  # type: ignore[union-attr]
                logger.warning("doc_collaboration_invites table missing: %s", e)
                raise HTTPException(
                    status_code=503,
                    detail="Collaboration invites not configured. Run migration: doc_collaboration_invites.sql",
                ) from e
            if isinstance(e, asyncpg.exceptions.UniqueViolationError):  # type: ignore[union-attr]
                raise HTTPException(status_code=400, detail="Приглашение уже отправлено") from e
            if isinstance(e, asyncpg.exceptions.ForeignKeyViolationError):  # type: ignore[union-attr]
                raise HTTPException(status_code=400, detail="Пользователь или документ не найден") from e
        logger.exception("Error creating collaboration invite: %s", e)
        raise HTTPException(status_code=500, detail="Failed to create invite") from e


@router.get("/documents/{document_id}/invites")
async def list_document_invites(
    document_id: UUID,
    user: User = Depends(require_oauth2_user),
) -> list[dict[str, Any]]:
    """List pending invites sent by the current user for this document (for Revoke UI)."""
    try:
        service = await get_doc_editor_service()
        return await service.list_sent_invites_for_document(document_id, str(user.id))
    except Exception as e:
        logger.warning("Error listing document invites (returning []): %s", e)
        return []


@router.get("/invites")
async def list_my_pending_invites(
    user: User = Depends(require_oauth2_user),
) -> list[dict[str, Any]]:
    """List pending collaboration invites for the current user (incoming)."""
    try:
        service = await get_doc_editor_service()
        return await service.list_pending_invites_for_user(str(user.id))
    except Exception as e:
        logger.exception("Error listing pending invites")
        raise HTTPException(status_code=500, detail="Failed to list invites") from e


@router.post("/invites/{invite_id}/accept")
async def accept_collaboration_invite(
    invite_id: UUID,
    user: User = Depends(require_oauth2_user),
) -> dict[str, Any]:
    """
    Accept a collaboration invite. Returns document_id so the client can open the document.
    """
    try:
        service = await get_doc_editor_service()
        return await service.accept_collaboration_invite(invite_id, str(user.id))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.exception("Error accepting invite")
        raise HTTPException(status_code=500, detail="Failed to accept invite") from e


@router.post("/invites/{invite_id}/decline")
async def decline_collaboration_invite(
    invite_id: UUID,
    user: User = Depends(require_oauth2_user),
) -> dict[str, Any]:
    """Decline a collaboration invite."""
    try:
        service = await get_doc_editor_service()
        await service.decline_collaboration_invite(invite_id, str(user.id))
        return {"status": "declined"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.exception("Error declining invite")
        raise HTTPException(status_code=500, detail="Failed to decline invite") from e


@router.delete("/invites/{invite_id}")
async def revoke_collaboration_invite(
    invite_id: UUID,
    user: User = Depends(require_oauth2_user),
) -> dict[str, Any]:
    """Revoke a collaboration invite (only the sender can revoke)."""
    try:
        service = await get_doc_editor_service()
        await service.revoke_collaboration_invite(invite_id, str(user.id))
        return {"status": "revoked"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.exception("Error revoking invite")
        raise HTTPException(status_code=500, detail="Failed to revoke invite") from e


# ========================================
# VERSION HISTORY ENDPOINTS
# ========================================


@router.get("/documents/{document_id}/versions")
async def get_versions(
    document_id: UUID,
    limit: int = Query(10, ge=1, le=50, description="Number of versions to return"),
    user: User = Depends(require_oauth2_user),
) -> dict[str, Any]:
    """
    Get document version history.

    - Returns versions in descending order (newest first)
    - Checks document ownership
    - Uses content_versions table
    """
    try:
        from api.services.doc_editor_service import DocEditorService

        db_pool = await get_db_pool()
        service = DocEditorService(db_pool)

        result = await service.get_versions(document_id, user.id, limit)  # type: ignore[arg-type]
        versions = result.get("versions", []) if isinstance(result, dict) else result
        current_version = result.get("current_version") if isinstance(result, dict) else None

        return {"versions": versions, "current_version": current_version, "total": len(versions)}

    except Exception as e:
        logger.exception("Error getting versions for {document_id}")
        raise HTTPException(status_code=500, detail=f"Failed to get versions: {e!s}") from e


@router.post("/documents/{document_id}/restore/{version_number}", response_model=DocumentResponse)
async def restore_version(
    document_id: UUID, version_number: int, user: User = Depends(require_oauth2_user)
) -> DocumentResponse:
    """
    Restore document to specific version.

    - Creates new version with restored content
    - Increments version number
    - Checks ownership
    """
    try:
        from api.services.doc_editor_service import DocEditorService

        db_pool = await get_db_pool()
        service = DocEditorService(db_pool)

        document = await service.restore_version(document_id, version_number, user.id)  # type: ignore[arg-type]

        if not document:
            _raise_version_not_found()

        logger.info("Document %s restored to version %s", document_id, version_number)
        # Convert metadata to doc_metadata for DocumentResponse
        # Type narrowing: document is guaranteed to be not None here
        if document is None:
            _raise_version_not_found()
        assert document is not None  # Type narrowing for type checker
        doc_dict: dict[str, Any] = {}
        for key, value in document.items():
            doc_dict[key] = value
        if "metadata" in doc_dict:
            doc_dict["doc_metadata"] = doc_dict.pop("metadata")
        return DocumentResponse(**doc_dict)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error restoring version")
        raise HTTPException(status_code=500, detail=f"Failed to restore version: {e!s}") from e


# ========================================
# AI INTEGRATION - LLAMA
# ========================================


@router.post("/ai/pre-insert-check")
async def ai_pre_insert_check(
    data: AIPreInsertCheckRequest,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> dict[str, Any]:
    if data.document_id is not None:
        await _require_content_access(data.document_id, user, db, "comment")
    allowed, warnings = _ai_policy_check(data.text)
    return {
        "allowed": allowed,
        "warnings": warnings,
        "textHash": _hash_text(data.text),
        "checkedAt": datetime.now(UTC).isoformat(),
        "contextScope": data.context_scope or "selection",
        "documentId": str(data.document_id) if data.document_id else None,
    }


@router.post("/ai/complete", response_model=None)
async def ai_complete(
    data: AICompleteRequest,
    user: User = Depends(require_oauth2_user),
    ugs_service: UnifiedGenerationService = Depends(get_ugs_service),
    db: AsyncSession = Depends(get_postgres_session),
) -> dict[str, Any] | StreamingResponse:
    """
    Llama AI text completion with streaming support.

    Models available:
    - default model from LLAMA_MODEL env (fast, general purpose)
    - mistral:latest (instruction following)
    - gemma2:latest (multilingual)

    Supports streaming responses for real-time UI updates.
    """
    try:
        from api.services.doc_editor_service import DocEditorService

        db_pool = await get_db_pool()
        service = DocEditorService(db_pool, ugs_service)
        request_id = str(uuid4())
        companion_directive = _build_companion_transform_directive(data)
        prompt_for_generation = f"{companion_directive}\n\n{data.prompt}" if companion_directive else data.prompt
        prompt_hash = _hash_text(prompt_for_generation)
        context_hash = _hash_text(data.context)
        if data.document_id is not None:
            await _require_content_access(data.document_id, user, db, "comment")

        # Use default max_tokens if None
        max_tokens_value = data.max_tokens if data.max_tokens is not None else 2000

        if data.stream:
            # Return streaming response
            return StreamingResponse(
                service.ai_complete_streaming(
                    prompt=prompt_for_generation,
                    context=data.context,
                    model=data.model,
                    temperature=data.temperature,
                    max_tokens=max_tokens_value,
                    user_id=str(user.id),
                    action_mode=data.action_mode,
                    context_scope=data.context_scope,
                    request_id=request_id,
                    document_id=str(data.document_id) if data.document_id else None,
                    prompt_hash=prompt_hash,
                    context_hash=context_hash,
                ),
                media_type="text/event-stream",
            )
        # Return complete response
        result = await service.ai_complete(
            prompt=prompt_for_generation,
            context=data.context,
            model=data.model,
            temperature=data.temperature,
            max_tokens=max_tokens_value,
            user_id=str(user.id),
            action_mode=data.action_mode,
            context_scope=data.context_scope,
        )
        policy_allowed, policy_warnings = _ai_policy_check(result)
        return {
            "response": result,
            "meta": {
                "requestId": request_id,
                "model": data.model,
                "actionMode": data.action_mode or "free",
                "contextScope": data.context_scope or "selection",
                "provider": "ugs_or_llama",
                "generatedAt": datetime.now(UTC).isoformat(),
                "documentId": str(data.document_id) if data.document_id else None,
                "promptHash": prompt_hash,
                "contextHash": context_hash,
                "responseHash": _hash_text(result),
                "usage": {"maxTokens": max_tokens_value},
                "companion": {
                    "seedPersonaId": data.companion_seed_persona_id,
                    "name": data.companion_name,
                    "noDialogue": data.companion_no_dialogue,
                },
                "policy": {
                    "allowed": policy_allowed,
                    "warnings": policy_warnings,
                },
            },
        }  # noqa: TRY300 - return after try is intentional

    except Exception as e:
        logger.exception("Error in AI completion")
        raise HTTPException(status_code=500, detail=f"AI completion failed: {e!s}") from e


@router.post("/ai/analyze")
async def ai_analyze_document(
    data: AIAnalyzeRequest,
    user: User = Depends(require_oauth2_user),
    ugs_service: UnifiedGenerationService = Depends(get_ugs_service),
) -> dict[str, Any]:
    """
    Analyze document with AI.

    Analysis types:
    - summary: Generate brief summary
    - keywords: Extract key terms
    - questions: Generate comprehension questions
    - structure: Analyze document structure
    - sentiment: Sentiment analysis
    """
    try:
        from api.services.doc_editor_service import DocEditorService

        db_pool = await get_db_pool()
        service = DocEditorService(db_pool, ugs_service)

        return await service.ai_analyze(
            document_id=data.document_id,
            analysis_type=data.analysis_type,
            user_id=user.id,  # type: ignore[arg-type]
            custom_prompt=data.custom_prompt,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error in AI analysis")
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {e!s}") from e


# ========================================
# AI INTEGRATION - COMFYUI
# ========================================


@router.post("/ai/image")
async def generate_image(
    data: ImageGenerateRequest,
    user: User = Depends(require_oauth2_user),
    ugs_service: UnifiedGenerationService = Depends(get_ugs_service),
) -> dict[str, Any]:
    """
    Generate image via UGS (Unified Generation System) or ComfyUI fallback.

    Workflows:
    - text2img: Generate image from text prompt
    - inpaint: Edit specific area of image
    - upscale: Upscale existing image (2x, 4x)

    Uses Stable Diffusion XL by default.
    """
    try:
        from api.services.doc_editor_service import DocEditorService

        db_pool = await get_db_pool()
        service = DocEditorService(db_pool, ugs_service)

        # Use default negative_prompt if None
        negative_prompt_value = data.negative_prompt if data.negative_prompt is not None else "blurry, low quality"

        result = await service.generate_image(
            prompt=data.prompt,
            negative_prompt=negative_prompt_value,
            workflow_type=data.workflow_type,
            width=data.width,
            height=data.height,
            steps=data.steps,
            user_id=str(user.id),
        )

        logger.info("Image generated for user %s", user.id)
        return result  # noqa: TRY300 - return after try is intentional

    except Exception as e:
        logger.exception("Error generating image")
        raise HTTPException(status_code=500, detail=f"Image generation failed: {e!s}") from e


@router.get("/ai/image/{job_id}/status")
async def check_image_status(
    job_id: str,
    user: User = Depends(require_oauth2_user),
    ugs_service: UnifiedGenerationService = Depends(get_ugs_service),
) -> dict[str, Any]:
    """
    Check UGS or ComfyUI job status and save to unified_content when ready.

    Statuses:
    - queued: Job submitted, waiting in queue
    - processing: Job is being executed
    - completed: Image generated, saved to unified_content
    - failed: Generation failed

    Returns:
        {
            "status": "completed",
            "content_id": "uuid",
            "image_url": "/api/content/{id}/download",
            "filename": "...",
            "width": 1024,
            "height": 1024
        }
    """
    try:
        from api.services.doc_editor_service import DocEditorService

        db_pool = await get_db_pool()
        service = DocEditorService(db_pool, ugs_service)

        # Get cached prompt for this job_id
        prompt = service._comfyui_jobs.get(job_id, "")

        # Check status and save to unified_content
        result = await service.check_image_status(
            job_id=job_id, user_id=str(user.id), prompt=prompt, save_to_content=True
        )

        logger.info("Image status checked for job %s: %s", job_id, result.get("status"))

        # Clean up cache if completed or failed
        if result.get("status") in ["completed", "failed"] and job_id in service._comfyui_jobs:
            del service._comfyui_jobs[job_id]

        return result  # noqa: TRY300 - return after try is intentional

    except Exception as e:
        logger.exception("Error checking image status")
        raise HTTPException(status_code=500, detail=f"Status check failed: {e!s}") from e


@router.get("/ai/image/view")
async def proxy_comfyui_image(
    filename: str = Query(..., description="Image filename from ComfyUI"),
    subfolder: str = Query(default="", description="Subfolder path"),
    type: str = Query(default="output", description="Image type (output, input, temp)"),
    user: User = Depends(require_oauth2_user),  # noqa: ARG001 - required for authentication
) -> StreamingResponse:
    """
    Proxy endpoint to serve ComfyUI images through our API.

    This solves the CORS and mixed-content issues when accessing ComfyUI
    images directly from the browser (internal Docker URL not accessible).

    Example: /api/doc-editor/ai/image/view?filename=image.png&subfolder=&type=output
    """
    try:
        COMFYUI_URL = (os.environ.get("COMFYUI_URL") or "").strip().rstrip("/")

        # Build ComfyUI image URL
        image_url = f"{COMFYUI_URL}/view?filename={filename}&subfolder={subfolder}&type={type}"

        client = get_httpx_client()
        response = await client.get(image_url, timeout=30.0)
        response.raise_for_status()

        # Stream image back to client
        return StreamingResponse(
            iter([response.content]),
            media_type=response.headers.get("content-type", "image/png"),
            headers={
                "Cache-Control": "public, max-age=3600",
                "Content-Disposition": f'inline; filename="{filename}"',
            },
        )

    except httpx.HTTPStatusError:
        logger.exception("ComfyUI image not found: %s", filename)
        raise HTTPException(status_code=404, detail=f"Image not found: {filename}") from None
    except Exception as e:
        logger.exception("Error proxying ComfyUI image")
        raise HTTPException(status_code=500, detail=f"Failed to load image: {e!s}") from e


# ========================================
# FILE OPERATIONS
# ========================================


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    *,
    parse: bool = Query(True, description="Parse document with Tika"),
    user: User = Depends(require_oauth2_user),
) -> dict[str, Any]:
    """
    Upload document and optionally parse with Tika.

    Supported formats:
    - DOC (Legacy Word Document - Enhanced processing)
    - DOCX (Modern Word Document)
    - PDF, TXT, HTML, MD, RTF, ODT

    Returns parsed content ready for editor.
    """
    try:
        from api.services.doc_editor_service import DocEditorService

        db_pool = await get_db_pool()
        service = DocEditorService(db_pool)

        # Read file content
        content = await file.read()

        # Parse with Tika if requested
        if parse:
            # Use default filename if None
            filename_value = file.filename if file.filename is not None else "uploaded_file"
            parsed = await service.parse_file_with_tika(content, filename_value)

            # Create document automatically
            document = await service.create_document(
                user_id=user.id,  # type: ignore[arg-type]
                title=filename_value,
                content=parsed["content"],
                content_type="html",
                metadata={
                    "original_filename": filename_value,
                    "file_size": len(content),
                    "mime_type": file.content_type,
                    "tika_metadata": parsed["metadata"],
                },
                tags=[],
            )

            return {
                "document_id": document["id"],
                "title": document["title"],
                "content": parsed["content"],
                "metadata": parsed["metadata"],
            }
        # Just return file info without parsing
        return {"filename": file.filename, "size": len(content), "content_type": file.content_type}

    except Exception as e:
        logger.exception("Error uploading file")
        raise HTTPException(status_code=500, detail=f"Upload failed: {e!s}") from e


@router.post("/export/{document_id}")
async def export_document(
    document_id: UUID,
    format: str = Query("pdf", description="Export format: pdf, docx, html, txt, md"),
    user: User = Depends(require_oauth2_user),
) -> StreamingResponse:
    """
    Export document to various formats via Gotenberg.

    Formats:
    - pdf: PDF via Gotenberg (high quality)
    - docx: Microsoft Word
    - html: Clean HTML
    - txt: Plain text
    - md: Markdown
    """
    try:
        from api.services.doc_editor_service import DocEditorService

        db_pool = await get_db_pool()
        service = DocEditorService(db_pool)

        # Get document
        document = await service.get_document(document_id, user.id)
        if not document:
            _raise_document_not_found()

        # Export - document is guaranteed to be not None here
        # Type narrowing: after check, document is dict[str, Any]
        if document is None:
            _raise_document_not_found()
        assert document is not None  # Type narrowing for type checker
        document_dict: dict[str, Any] = document
        file_content = await service.export_document(document_dict, format)

        # Determine filename and media type
        export_title = document_dict.get("title") or "document"
        media_types = {
            "pdf": "application/pdf",
            "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "html": "text/html",
            "txt": "text/plain",
            "md": "text/markdown",
        }

        content_disposition = build_content_disposition(export_title, format)

        return StreamingResponse(
            iter([file_content]),
            media_type=media_types.get(format, "application/octet-stream"),
            headers={"Content-Disposition": content_disposition, "X-Generated-Format": format},
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error exporting document")
        raise HTTPException(status_code=500, detail=f"Export failed: {e!s}") from e


# ========================================
# SEARCH ENDPOINTS
# ========================================


@router.get("/search")
async def search_documents(
    query: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(20, ge=1, le=100),
    user: User = Depends(require_oauth2_user),
) -> dict[str, Any]:
    """
    Search user's documents.

    Uses PostgreSQL full-text search (fast, keyword-based, Russian support).
    """
    try:
        from api.services.doc_editor_service import DocEditorService

        db_pool = await get_db_pool()
        service = DocEditorService(db_pool)

        results = await service.search_fulltext(query, user.id, limit)

        return {"results": results, "query": query, "total": len(results)}

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error searching documents")
        raise HTTPException(status_code=500, detail=f"Search failed: {e!s}") from e


# ========================================
# PROMPTS LIBRARY ENDPOINTS
# ========================================


@router.post("/prompts", response_model=PromptResponse, status_code=201)
async def save_prompt(data: PromptCreate, user: User = Depends(require_oauth2_user)) -> PromptResponse:
    """Save AI prompt to user's library."""
    try:
        from api.services.doc_editor_service import DocEditorService

        db_pool = await get_db_pool()
        service = DocEditorService(db_pool)

        prompt = await service.save_prompt(
            user_id=user.id,
            name=data.name,
            prompt=data.prompt,
            category=data.category,
            model=data.model,
            temperature=data.temperature,
            is_public=data.is_public,
        )

        logger.info("Prompt saved: %s by user %s", prompt["id"], user.id)
        return PromptResponse(**prompt)

    except Exception as e:
        logger.exception("Error saving prompt")
        raise HTTPException(status_code=500, detail=f"Failed to save prompt: {e!s}") from e


@router.get("/prompts", response_model=list[PromptResponse])
async def list_prompts(
    *,
    category: str | None = Query(None, description="Filter by category"),
    include_public: bool = Query(True, description="Include public prompts from other users"),
    user: User = Depends(require_oauth2_user),
) -> list[PromptResponse]:
    """
    List user's saved prompts.

    - Returns user's own prompts + public prompts if include_public=True
    - Can filter by category
    """
    try:
        from api.services.doc_editor_service import DocEditorService

        db_pool = await get_db_pool()
        service = DocEditorService(db_pool)

        prompts = await service.list_prompts(user_id=user.id, category=category, include_public=include_public)

        return [PromptResponse(**p) for p in prompts]

    except Exception as e:
        logger.exception("Error listing prompts")
        raise HTTPException(status_code=500, detail=f"Failed to list prompts: {e!s}") from e


@router.delete("/prompts/{prompt_id}", status_code=204)
async def delete_prompt(prompt_id: UUID, user: User = Depends(require_oauth2_user)) -> None:
    """Delete user's prompt."""
    try:
        from api.services.doc_editor_service import DocEditorService

        db_pool = await get_db_pool()
        service = DocEditorService(db_pool)

        success = await service.delete_prompt(prompt_id, user.id)

        if not success:
            _raise_prompt_not_found()

        logger.info("Prompt deleted: %s", prompt_id)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error deleting prompt")
        raise HTTPException(status_code=500, detail=f"Failed to delete prompt: {e!s}") from e


# ========================================
# DOCUMENT CONVERSION
# ========================================


@router.post("/convert")
async def convert_document(data: ConvertRequest, user: User = Depends(require_oauth2_user)) -> dict[str, Any]:
    """
    Convert document to different format.

    Supports conversion from:
    - DOCX, PDF, ODT, RTF, MD, TXT
    - XLSX, XLS, CSV
    - Images (JPG, PNG, GIF, BMP, WEBP)

    To formats:
    - HTML (for editing)
    - Text (plain text)
    - JSON (for structured data)
    - CSV (for spreadsheets)
    - Markdown
    - PDF (base64-encoded office/spreadsheet preview)

    Uses Redis caching with 1-hour TTL for improved performance.
    """
    from api.services.doc_converter_service import (
        ConversionError,
        DocConverterService,
        UnsupportedFormatError,
    )
    from api.services.redis_service import RedisService

    try:
        db_pool = await get_db_pool()

        # Initialize Redis client for caching
        redis_client = None
        try:
            redis_service = RedisService()
            await redis_service.initialize()
            if redis_service.is_available and redis_service.redis_pool:
                redis_client = redis_service.redis_pool
        except (TimeoutError, ConnectionError, ValueError) as redis_error:
            logger.warning("Redis not available for caching: %s", redis_error)

        # Initialize converter
        converter = DocConverterService(db_pool, redis_client)

        # Get content from unified_content
        async with db_pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT id, user_id, file_data, original_filename, mime_type, file_hash
                FROM unified_content
                WHERE id = $1 AND deleted_at IS NULL
                """,
                data.content_id,
            )

            if not row:
                _raise_content_not_found()

            # Check ownership
            if row["user_id"] != user.id:
                _raise_access_denied()

            # Get file data
            file_data = row["file_data"]
            if not file_data:
                _raise_no_file_data()

            # Detect source format
            format_info = await converter.detect_format(file_data, row["original_filename"], row["mime_type"])

            if not format_info["is_supported"]:
                supported = converter.get_supported_formats()
                _raise_unsupported_format(format_info, supported)

            # Perform conversion
            result = await converter.convert(
                file_data=file_data,
                source_format=format_info["extension"],
                target_format=data.target_format.value,
                filename=row["original_filename"],
                options=data.options.model_dump() if data.options else None,
            )

            # Convert ConvertResponse to dict for return
            return ConvertResponse(**result).model_dump()

    except HTTPException:
        raise
    except UnsupportedFormatError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except ConversionError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    except Exception as e:
        logger.exception("Conversion failed")
        raise HTTPException(status_code=500, detail=f"Conversion failed: {e!s}") from e


@router.post("/convert/upload")
async def convert_uploaded_file(
    file: UploadFile = File(...),
    target_format: str = Query(..., description="Target format (html, text, json, csv, markdown)"),
    user: User = Depends(require_oauth2_user),  # noqa: ARG001 - required for authentication
) -> dict[str, Any]:
    """
    Convert uploaded file without saving to database.

    Useful for quick conversions and previews.
    For `target_format=pdf`, `content` is base64-encoded PDF bytes.
    Results are cached in Redis for 1 hour.
    """
    from api.services.doc_converter_service import (
        ConversionError,
        DocConverterService,
        UnsupportedFormatError,
    )
    from api.services.redis_service import RedisService

    try:
        # Read file
        file_data = await file.read()

        db_pool = await get_db_pool()

        # Initialize Redis client
        redis_client = None
        try:
            redis_service = RedisService()
            await redis_service.initialize()
            if redis_service.is_available and redis_service.redis_pool:
                redis_client = redis_service.redis_pool
        except (TimeoutError, ConnectionError, ValueError) as redis_error:
            logger.warning("Redis not available for caching: %s", redis_error)

        # Initialize converter
        converter = DocConverterService(db_pool, redis_client)

        # Detect format
        format_info = await converter.detect_format(file_data, file.filename, file.content_type)

        if not format_info["is_supported"]:
            supported = converter.get_supported_formats()
            _raise_unsupported_format(format_info, supported)

        # Convert
        return await converter.convert(
            file_data=file_data,
            source_format=format_info["extension"],
            target_format=target_format,
            filename=file.filename,
            options=None,
        )

    except HTTPException:
        raise
    except UnsupportedFormatError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except ConversionError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    except Exception as e:
        logger.exception("Upload conversion failed")
        raise HTTPException(status_code=500, detail=f"Conversion failed: {e!s}") from e


@router.get("/convert/formats")
async def get_supported_formats(user: User = Depends(require_oauth2_user)) -> dict[str, Any]:  # noqa: ARG001 - required for authentication
    """
    Get list of supported conversion formats.

    Returns conversion matrix showing which formats can be converted to which.
    """
    from api.services.doc_converter_service import DocConverterService

    try:
        db_pool = await get_db_pool()
        converter = DocConverterService(db_pool, None)

        return converter.get_supported_formats()

    except Exception as e:
        logger.exception("Get formats failed")
        raise HTTPException(status_code=500, detail=f"Failed to get formats: {e!s}") from e


@router.post("/convert/detect")
async def detect_file_format(
    file: UploadFile = File(...),
    user: User = Depends(require_oauth2_user),  # noqa: ARG001 - required for authentication
) -> dict[str, Any]:
    """
    Detect file format using magic bytes.

    Returns detailed format information including:
    - MIME type
    - File extension
    - Whether format is supported for conversion
    - Detection method used
    """
    from api.services.doc_converter_service import DocConverterService

    try:
        # Read file
        file_data = await file.read()

        db_pool = await get_db_pool()
        converter = DocConverterService(db_pool, None)

        # Detect format
        return await converter.detect_format(file_data, file.filename, file.content_type)

    except Exception as e:
        logger.exception("Format detection failed")
        raise HTTPException(status_code=500, detail=f"Detection failed: {e!s}") from e


@router.post("/convert/batch")
async def batch_convert_documents(
    content_ids: list[UUID],
    target_format: str = Query(..., description="Target format for all conversions"),
    user: User = Depends(require_oauth2_user),
) -> dict[str, Any]:
    """
    Convert multiple documents in batch.

    Maximum 10 documents per request.
    Returns results for all conversions (including failures).
    """
    from datetime import datetime

    from api.services.doc_converter_service import DocConverterService
    from api.services.redis_service import RedisService

    if len(content_ids) > 10:
        _raise_max_batch_size_exceeded()

    start_time = datetime.now(UTC)
    results = []

    try:
        db_pool = await get_db_pool()

        # Initialize Redis client
        redis_client = None
        try:
            redis_service = RedisService()
            await redis_service.initialize()
            if redis_service.is_available and redis_service.redis_pool:
                redis_client = redis_service.redis_pool
        except (TimeoutError, ConnectionError, ValueError):  # fmt: skip
            logger.debug("Redis client initialization failed, continuing without cache")

        converter = DocConverterService(db_pool, redis_client)

        # Process each document
        for content_id in content_ids:
            try:
                # Get content
                async with db_pool.acquire() as conn:
                    row = await conn.fetchrow(
                        """
                        SELECT id, user_id, file_data, original_filename, mime_type
                        FROM unified_content
                        WHERE id = $1 AND deleted_at IS NULL
                        """,
                        content_id,
                    )

                    if not row or row["user_id"] != user.id:
                        results.append(
                            {
                                "content_id": content_id,
                                "success": False,
                                "error": "Content not found or access denied",
                            }
                        )
                        continue

                    # Detect format
                    format_info = await converter.detect_format(
                        row["file_data"], row["original_filename"], row["mime_type"]
                    )

                    if not format_info["is_supported"]:
                        results.append(
                            {
                                "content_id": content_id,
                                "success": False,
                                "error": f"Unsupported format: {format_info['mime_type']}",
                            }
                        )
                        continue

                    # Convert
                    result = await converter.convert(
                        file_data=row["file_data"],
                        source_format=format_info["extension"],
                        target_format=target_format,
                        filename=row["original_filename"],
                        options=None,
                    )

                    results.append(
                        {
                            "content_id": content_id,
                            "success": True,
                            "content": result["content"],
                            "metadata": result["metadata"],
                            "cached": result["cached"],
                            "conversion_time": result["conversion_time"],
                        }
                    )

            except (
                ValueError,
                RuntimeError,
                ConnectionError,
                TimeoutError,
                httpx.HTTPStatusError,
                httpx.RequestError,
            ) as e:
                logger.exception("Batch conversion failed for {content_id}")
                results.append({"content_id": content_id, "success": False, "error": str(e)})

        # Calculate stats
        total_time = (datetime.now(UTC) - start_time).total_seconds()
        successful = sum(1 for r in results if r["success"])
        failed = len(results) - successful

        return {
            "results": results,
            "total": len(content_ids),
            "successful": successful,
            "failed": failed,
            "total_time": total_time,
        }

    except Exception as e:
        logger.exception("Batch conversion failed")
        raise HTTPException(status_code=500, detail=f"Batch conversion failed: {e!s}") from e


@router.delete("/convert/cache")
async def invalidate_conversion_cache(
    content_id: UUID | None = Query(None, description="Content ID to invalidate"),
    pattern: str | None = Query(None, description="Redis key pattern to delete"),
    user: User = Depends(require_oauth2_user),  # noqa: ARG001 - required for authentication
) -> dict[str, Any]:
    """
    Invalidate conversion cache.

    Useful after updating a document to ensure fresh conversions.
    """
    from api.services.doc_converter_service import DocConverterService
    from api.services.redis_service import RedisService

    if not content_id and not pattern:
        _raise_missing_parameters()

    try:
        db_pool = await get_db_pool()

        # Initialize Redis client
        redis_client = None
        try:
            redis_service = RedisService()
            await redis_service.initialize()
            if redis_service.is_available and redis_service.redis_pool:
                redis_client = redis_service.redis_pool
        except (TimeoutError, ConnectionError, ValueError):  # fmt: skip
            _raise_redis_not_available()

        if not redis_client:
            _raise_redis_not_configured()

        converter = DocConverterService(db_pool, redis_client)

        # Invalidate cache
        await converter.invalidate_cache(content_id, pattern)

        return {"success": True, "message": "Cache invalidated successfully"}  # noqa: TRY300 - return after try is intentional

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Cache invalidation failed")
        raise HTTPException(status_code=500, detail=f"Cache invalidation failed: {e!s}") from e


# ========================================
# OCR OPERATIONS
# ========================================


@router.post("/ocr")
async def perform_ocr(
    request: Request,
    file: UploadFile = File(...),
    language: str | None = Form(
        default=None,
        description="OCR language sent by frontend multipart form (e.g. 'rus+eng', 'eng')",
    ),
    user: User = Depends(require_oauth2_user),  # noqa: ARG001 - required for authentication
) -> dict[str, Any]:
    """
    Perform OCR on uploaded image/file.

    Supported formats: PNG, JPG, JPEG, GIF, BMP, WEBP, PDF, TIFF
    Uses Tesseract OCR via Tika server.
    """
    try:
        from api.services.doc_editor_service import DocEditorService

        # Read file
        file_data = await file.read()
        ocr_language = (language or request.query_params.get("language") or "rus+eng").strip() or "rus+eng"

        db_pool = await get_db_pool()
        service = DocEditorService(db_pool)

        # Perform OCR
        # Use default filename if None
        filename_value = file.filename if file.filename is not None else "uploaded_file"
        return await service.perform_ocr(
            file_data,
            ocr_language,
            filename_value,
            file.content_type,
        )

    except Exception as e:
        logger.exception("OCR failed")
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {e!s}") from e


# ========================================
# TABLE EDITOR OPERATIONS
# ========================================


@router.post("/table/insert")
async def insert_table(data: dict[str, Any], user: User = Depends(require_oauth2_user)) -> dict[str, Any]:
    """
    Insert table into document.

    Data format:
    {
        "document_id": "uuid",
        "table_html": "<table>...</table>",
        "position": "cursor" | "end"
    }
    """
    try:
        from api.services.doc_editor_service import DocEditorService

        db_pool = await get_db_pool()
        service = DocEditorService(db_pool)

        return await service.insert_table(
            document_id=data["document_id"],
            table_html=data["table_html"],
            position=data.get("position", "cursor"),
            user_id=user.id,
        )

    except Exception as e:
        logger.exception("Table insert failed")
        raise HTTPException(status_code=500, detail=f"Table insertion failed: {e!s}") from e


# ========================================
# CHARTS & DIAGRAMS OPERATIONS
# ========================================


@router.post("/chart/generate")
async def generate_chart(data: dict[str, Any], user: User = Depends(require_oauth2_user)) -> dict[str, Any]:
    """
    Generate chart/diagram.

    Data format:
    {
        "type": "bar" | "line" | "pie" | "mermaid",
        "data": {...},
        "config": {...}
    }
    """
    try:
        from api.services.doc_editor_service import DocEditorService

        db_pool = await get_db_pool()
        service = DocEditorService(db_pool)

        return await service.generate_chart(
            chart_type=data["type"],
            chart_data=data["data"],
            config=data.get("config", {}),
            user_id=user.id,
        )

    except Exception as e:
        logger.exception("Chart generation failed")
        raise HTTPException(status_code=500, detail=f"Chart generation failed: {e!s}") from e


# ========================================
# HEALTH CHECK
# ========================================


@router.get("/health")
async def health_check() -> dict[str, Any]:
    """Health check endpoint for Ultimate Document Editor."""
    return {
        "status": "healthy",
        "service": "Ultimate Document Editor",
        "version": "2.1.0",
        "database": "unified_content (asyncpg)",
        "features": [
            "CRUD with user binding",
            "Llama AI integration",
            "ComfyUI image generation",
            "Tika document parsing",
            "Gotenberg export",
            "Full-text search",
            "Version history (DB trigger)",
            "Prompts library",
            "Document conversion (10+ formats)",
        ],
    }


# ========================================
# YJS COLLABORATION WEBSOCKET
# ========================================

# document_id -> list of WebSocket; used to broadcast Yjs updates to all clients in the room
_yjs_document_connections: dict[str, list[WebSocket]] = {}


@router.websocket("/collaboration/{document_id}")
async def yjs_collaboration_websocket(websocket: WebSocket, document_id: str, token: str | None = Query(None)) -> None:
    """
    WebSocket endpoint for Yjs real-time collaboration.

    This endpoint handles Yjs synchronization protocol for collaborative editing.
    Yjs uses a binary protocol for efficient document synchronization.

    Connection (canon `/api/v1`; legacy `/api/doc-editor` alias still mounted):
    ws://localhost:29000/api/v1/doc-editor/collaboration/{document_id}?token=<jwt_token>
    wss://app.eliteew.ru/api/v1/doc-editor/collaboration/{document_id}

    Protocol:
    - Yjs uses binary messages for synchronization
    - Messages are broadcast to all other clients in the same document room.

    Authentication: token query parameter (JWT). Connection closed with code 1008 if invalid.
    """
    await websocket.accept()

    from api.core.websocket_auth import get_ws_auth_close_code, validate_websocket_token
    from api.services.auth_provider_service import get_auth_provider_service
    from api.services.doc_editor_service import DocEditorService

    auth_provider = get_auth_provider_service()
    user, auth_error_reason = await validate_websocket_token(token, auth_provider)
    if user is None:
        reason = (auth_error_reason or "auth:token_missing")[:123]
        await websocket.close(code=get_ws_auth_close_code(), reason=reason)
        return

    document_uuid: UUID | None = None
    try:
        document_uuid = UUID(document_id)
    except ValueError:
        await websocket.close(code=1008, reason="auth:invalid_document_id")
        return

    # Security hardening: allow websocket room only for owner or accepted collaborator.
    db_pool = await get_db_pool()
    service = DocEditorService(db_pool)
    allowed_doc = await service.get_document(document_uuid, str(user.id))
    if allowed_doc is None:
        await websocket.close(code=1008, reason="auth:document_access_denied")
        return

    user_email = user.email or user.username or "user"
    from api.core.realtime_trace_context import (
        RealtimeTraceBootstrap,
        bind_realtime_trace,
        resolve_realtime_correlation_id,
    )

    correlation_id = resolve_realtime_correlation_id(
        explicit=websocket.headers.get("x-correlation-id") or websocket.headers.get("x-request-id"),
        environ={
            "QUERY_STRING": str(websocket.url.query or ""),
            "HTTP_X_CORRELATION_ID": websocket.headers.get("x-correlation-id"),
            "HTTP_X_REQUEST_ID": websocket.headers.get("x-request-id"),
        },
    )
    bind_realtime_trace(
        RealtimeTraceBootstrap(
            correlation_id=correlation_id,
            transport="native_ws",
            auth_subject_id=str(user.id),
        )
    )
    logger.info(
        "Yjs collaboration WebSocket connected: document_id=%s, user=%s, correlation_id=%s",
        document_id,
        user_email,
        correlation_id,
    )

    # Register this connection for the document room
    if document_id not in _yjs_document_connections:
        _yjs_document_connections[document_id] = []
    _yjs_document_connections[document_id].append(websocket)
    is_first_client_in_room = len(_yjs_document_connections[document_id]) == 1

    from api.services.doc_editor_yjs_store import (  # noqa: PLC0415
        get_doc_editor_yjs_store,
        is_yjs_update_message,
    )

    yjs_store = get_doc_editor_yjs_store()
    if is_first_client_in_room:
        try:
            replay_chunks = await yjs_store.load_updates(document_id)
            for chunk in replay_chunks:
                await websocket.send_bytes(chunk)
            if replay_chunks:
                logger.info(
                    "Yjs cold start replay: document_id=%s, chunks=%s",
                    document_id,
                    len(replay_chunks),
                )
        except Exception:
            logger.exception("Yjs cold start replay failed for document_id=%s", document_id)

    try:
        while True:
            # Receive binary data from Yjs client
            data = await websocket.receive_bytes()

            # Yjs protocol: first byte indicates message type
            # 0 = sync step 1, 1 = sync step 2, 2 = update
            message_type = data[0] if len(data) > 0 else None
            logger.debug("Yjs message received: type=%s, size=%s bytes", message_type, len(data))

            if is_yjs_update_message(data):
                try:
                    await yjs_store.append_update(document_id, data)
                except Exception:
                    logger.exception("Yjs persist update failed for document_id=%s", document_id)

            # Broadcast to all other clients in this document (excluding sender)
            conns = _yjs_document_connections.get(document_id, [])
            for conn in conns:
                if conn is websocket:
                    continue
                try:
                    await conn.send_bytes(data)
                except Exception:
                    logger.debug("Yjs broadcast to one client failed (may be closed)", exc_info=True)
    except WebSocketDisconnect:
        logger.info(
            "Yjs collaboration WebSocket disconnected: document_id=%s, user=%s",
            document_id,
            user_email,
        )
    except Exception:
        logger.exception("Yjs collaboration WebSocket error")
        with contextlib.suppress(builtins.BaseException):
            await websocket.close(code=1011, reason="Internal server error")
    finally:
        # Unregister this connection
        conns = _yjs_document_connections.get(document_id, [])
        with contextlib.suppress(ValueError):
            conns.remove(websocket)
        if not conns:
            _yjs_document_connections.pop(document_id, None)
