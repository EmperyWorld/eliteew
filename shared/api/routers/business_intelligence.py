#!/usr/bin/env python3
# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   BUSINESS INTELLIGENCE ROUTER - PRODUCTION READY
# Invariants:
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
# Related:
#   - shared/api/main.py (регистрация роутеров); см. затронутые services/models.
# ------------------------------------------------------------------------------
"""
BUSINESS INTELLIGENCE ROUTER - PRODUCTION READY
Clean architecture router with full integration of all services

Features:
✅ Elasticsearch for storage & search
✅ Tika for text extraction
✅ Llama for AI analysis
✅ Socket.IO real-time updates
✅ Multiple output formats
✅ User statistics & history

Architecture:
- Router handles HTTP only
- All logic delegated to services
- Dependency injection
- Proper error handling
- Progress tracking via Socket.IO

Created: 2025-10-01
Updated: 2025-10-01 (Socket.IO integration)
Author: Emperyworld Elite Development Team
"""

import asyncio
import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from elasticsearch import ConflictError
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query  # type: ignore[import-untyped]
from fastapi.responses import FileResponse  # type: ignore[import-untyped]

from api.core.auth import User  # type: ignore[import-untyped]
from api.core.oauth2_auth import require_oauth2_user
from api.core.websocket_auth import resolve_db_user_id_by_email

# Import Socket.IO functions for real-time updates
from api.routers.socketio_handler import (
    send_bi_completed,
    send_bi_error,
    send_bi_progress,
)
from api.schemas.business_intelligence import (
    GenerationRequest,
    GenerationResult,
    ModelInfo,
    SearchRequest,
    SearchResult,
    SystemHealth,
    UserStatistics,
)
from api.schemas.notifications import NotificationCreate, NotificationPriority, NotificationType
from api.services.auth_provider_service import get_auth_provider_service
from api.services.business_intelligence import (
    BusinessAnalyzer,
    ElasticsearchService,
    LlamaAIService,
    TemplateEngine,
    TikaService,
)
from api.services.notification_service import get_notification_service
from api.services.queue_features import QUEUE_FLAG_BI, is_queue_enabled
from api.services.rabbitmq_service import get_rabbitmq_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/business-intelligence", tags=["Business Intelligence - Production AI Analysis"])

# ========================================
# DEPENDENCY INJECTION
# ========================================


# Service state holder (replaces global variables)
class _ServiceState:
    """State holder for service instances."""

    def __init__(self) -> None:
        self.es_service: ElasticsearchService | None = None
        self.tika_service: TikaService | None = None
        self.llama_service: LlamaAIService | None = None
        self.business_analyzer: BusinessAnalyzer | None = None
        self.template_engine: TemplateEngine | None = None


_service_state = _ServiceState()
_bi_es_init_started = False


async def get_services() -> dict[str, Any]:
    """Get or initialize services (singleton pattern)"""

    global _bi_es_init_started
    if not _service_state.es_service:
        _service_state.es_service = ElasticsearchService()
        # Don't block startup on ES (cluster.health / _create_indices can hang)
        if not _bi_es_init_started:
            _bi_es_init_started = True
            asyncio.create_task(_service_state.es_service.initialize())

    if not _service_state.tika_service:
        _service_state.tika_service = TikaService()

    if not _service_state.llama_service:
        _service_state.llama_service = LlamaAIService()

    if not _service_state.business_analyzer:
        _service_state.business_analyzer = BusinessAnalyzer(
            _service_state.es_service, _service_state.tika_service, _service_state.llama_service
        )

    if not _service_state.template_engine:
        _service_state.template_engine = TemplateEngine()

    return {
        "elasticsearch": _service_state.es_service,
        "tika": _service_state.tika_service,
        "llama": _service_state.llama_service,
        "analyzer": _service_state.business_analyzer,
        "template": _service_state.template_engine,
    }


# ========================================
# HEALTH & STATUS ENDPOINTS
# ========================================


@router.get("/health", response_model=SystemHealth)
async def health_check() -> SystemHealth:
    """
    Check system health

    Returns comprehensive health status of all services
    """
    try:
        services = await get_services()

        # Check Elasticsearch (yellow = OK for single-node)
        es_healthy = False
        if services["elasticsearch"].client:
            try:
                if await services["elasticsearch"].client.ping():
                    health = await services["elasticsearch"].client.cluster.health()
                    status = health.get("status", "red")
                    es_healthy = status in ["green", "yellow"]
            except (ConnectionError, TimeoutError):  # fmt: skip
                logger.debug("Elasticsearch health check failed")

        # Check Tika
        tika_health = await services["tika"].health_check()

        # Check Llama
        llama_health = await services["llama"].health_check()

        overall_status = "healthy" if all([es_healthy, tika_health, llama_health]) else "degraded"

        from api.schemas.business_intelligence import ServiceHealth  # noqa: PLC0415

        return SystemHealth(
            status=overall_status,
            elasticsearch=ServiceHealth(
                service="Elasticsearch",
                status="healthy" if es_healthy else "unhealthy",
                url=services["elasticsearch"].es_url,
                details={"indices": 3, "note": "Yellow status is OK for single-node cluster"},
            ),
            tika=ServiceHealth(
                service="Apache Tika",
                status="healthy" if tika_health else "unhealthy",
                url=services["tika"].tika_url,
                details={"supported_formats": len(services["tika"].SUPPORTED_EXTENSIONS)},
            ),
            llama=ServiceHealth(
                service="Llama AI",
                status="healthy" if llama_health else "unhealthy",
                url=services["llama"].llama_url,
                details={},
            ),
        )

    except Exception:
        logger.exception("Health check failed")
        detail_msg = "Health check failed"
        raise HTTPException(status_code=500, detail=detail_msg) from None


@router.get("/models", response_model=list[ModelInfo])
async def list_models(
    user: User = Depends(require_oauth2_user),  # noqa: ARG001, B008
) -> list[ModelInfo]:
    """
    Get list of available AI models

    Returns:
        List of model information
    """
    try:
        services = await get_services()
        return await services["llama"].list_models()

    except Exception:
        logger.exception("Failed to list models")
        detail_msg = "Failed to list models"
        raise HTTPException(status_code=500, detail=detail_msg) from None


# ========================================
# GENERATION ENDPOINTS
# ========================================


@router.post("/generate", response_model=GenerationResult, status_code=202)
async def generate_analysis(
    request: GenerationRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> GenerationResult:
    """
    Generate business analysis (async)

    DEBUG: Log incoming request
    """
    logger.info(
        "📥 GENERATE REQUEST: analysis_types=%s, output_formats=%s",
        request.analysis_types,
        request.output_formats,
    )
    logger.info("📥 GENERATE REQUEST: documents count=%s", len(request.documents))

    """
    Original docstring:

    Initiates analysis generation and returns immediately.
    Use WebSocket to monitor progress.

    Args:
        request: Generation request with documents and settings

    Returns:
        Initial generation result with session_id
    """
    try:
        services = await get_services()

        # Generate session ID if not provided
        session_id = request.session_id or str(uuid.uuid4())

        # Index session in Elasticsearch
        reserved = await services["elasticsearch"].index_session(
            session_id=session_id,
            user_id=str(user.id),
            settings=request.settings.model_dump(),
            status="pending",
        )

        if not reserved:
            raise HTTPException(status_code=503, detail="Session storage unavailable")

        # Prepare documents with file data
        documents_data = []
        for doc in request.documents:
            doc_dict = doc.model_dump()
            # Add user_id for tracking
            doc_dict["user_id"] = str(user.id)
            # Storage identifiers are server-owned, fixed before queue delivery.
            doc_dict["id"] = str(uuid.uuid4())

            # DEBUG: Log what we receive
            logger.info(
                "📥 Received document: name=%s, type=%s",
                doc_dict.get("name"),
                doc_dict.get("type"),
            )
            logger.info("📥 Document keys: %s", list(doc_dict.keys()))
            has_file_data = "file_data" in doc_dict and bool(doc_dict.get("file_data"))
            logger.info("📥 Has file_data: %s", has_file_data)
            if "file_data" in doc_dict:
                file_data_len = len(doc_dict["file_data"]) if doc_dict["file_data"] else 0
                logger.info("📥 file_data length: %s chars", file_data_len)

            documents_data.append(doc_dict)

        analysis_types = [at.value for at in request.analysis_types]
        output_formats = [of.value for of in request.output_formats]
        if is_queue_enabled(QUEUE_FLAG_BI, default=True):
            published = await get_rabbitmq_service().publish_ai_generation(
                request_id=session_id,
                type_key="bi_generation",
                payload={
                    "task_type": "bi_generation",
                    "session_id": session_id,
                    "user_id": str(user.id),
                    "documents": documents_data,
                    "analysis_types": analysis_types,
                    "output_formats": output_formats,
                    "settings": request.settings.model_dump(),
                    "context": request.context,
                },
            )
            if not published:
                background_tasks.add_task(
                    _run_generation,
                    session_id=session_id,
                    user_id=user.id,
                    documents=documents_data,
                    analysis_types=analysis_types,
                    output_formats=output_formats,
                    settings=request.settings.model_dump(),
                    context=request.context,
                    services=services,
                )
        else:
            background_tasks.add_task(
                _run_generation,
                session_id=session_id,
                user_id=user.id,
                documents=documents_data,
                analysis_types=analysis_types,
                output_formats=output_formats,
                settings=request.settings.model_dump(),
                context=request.context,
                services=services,
            )

        logger.info("Started generation: session=%s, user=%s", session_id, user.id)

        from api.schemas.business_intelligence import AnalysisSummary  # noqa: PLC0415

        return GenerationResult(
            session_id=session_id,
            status="pending",
            analyses=[],
            summary=AnalysisSummary(
                total_analyses=0,
                successful=0,
                failed=0,
                total_tokens_used=0,
                average_quality_score=0,
                analyses_breakdown={},
            ),
            documents_processed=0,
            metrics={"message": "Generation started. Connect to WebSocket for progress updates."},
            error=None,
        )

    except ConflictError:
        raise HTTPException(status_code=409, detail="Session ID already exists") from None
    except HTTPException:
        raise
    except Exception:
        logger.exception("Generation request failed")
        detail_msg = "Generation request failed"
        raise HTTPException(status_code=500, detail=detail_msg) from None


async def _run_generation(
    session_id: str,
    user_id: str,
    documents: list[dict],
    analysis_types: list[str],
    output_formats: list[str],
    settings: dict,
    context: str | None,  # noqa: ARG001
    services: dict,
) -> None:
    """Background task for running generation"""
    # Old queued jobs must not operate on another owner's reserved session.
    await _owned_session(services, session_id, user_id)
    claim_key = f"bi:generation:{session_id}"
    redis = None
    manifest_pending = False
    try:
        try:
            from api.core.database_manager import get_database_manager  # noqa: PLC0415

            manager = await get_database_manager()
            redis = await manager.get_redis_client()
            if redis is not None:
                claimed = await redis.set(claim_key, "in_progress", nx=True, ex=60 * 60 * 6)
                if not claimed:
                    logger.info("BI generation duplicate skipped: session=%s", session_id)
                    return
        except Exception:
            logger.debug("BI generation idempotency claim skipped: session=%s", session_id, exc_info=True)

        # Progress callback using Socket.IO
        async def progress_callback(update: dict) -> None:
            await send_bi_progress(
                session_id=session_id,
                stage=update.get("stage", "processing"),
                progress=update.get("progress", 0),
                message=update.get("message", "Processing..."),
                details=update.get("details"),
            )

        # Run analysis
        result = await services["analyzer"].analyze_business(
            session_id=session_id,
            user_id=user_id,
            documents=documents,
            analysis_types=analysis_types,
            settings=settings,
            progress_callback=progress_callback,
        )

        if result.get("status") == "completed":
            # Generate documents
            generated_docs = await services["template"].generate_documents(
                session_id=session_id,
                analyses=result.get("analyses", []),
                summary=result.get("summary", {}),
                formats=output_formats,
                metadata={"user_id": user_id},
            )

            result["documents"] = generated_docs

            # Keep manifest persistence retryable without releasing completed jobs.
            manifest_pending = True
            persisted = await services["elasticsearch"].update_session(
                session_id=session_id,
                updates={
                    "status": "completed",
                    "generated_files": [doc["file_name"] for doc in generated_docs],
                    "completed_at": datetime.now(UTC).isoformat(),
                    "analysis_count": len(result.get("analyses", [])),
                    "total_tokens": result.get("metrics", {}).get("total_tokens", 0),
                },
            )

            if not persisted:
                raise RuntimeError("Generated-file manifest could not be persisted")
            manifest_pending = False

            # Send completion via Socket.IO
            await send_bi_completed(session_id, result)
            if redis is not None:
                await redis.set(claim_key, "completed", ex=60 * 60 * 24)

            # In-app notification (desktop)
            try:
                notification_service = get_notification_service()
                await notification_service.send_to_user(
                    user_id,
                    NotificationCreate(
                        type=NotificationType.SUCCESS,
                        title="BI анализ завершён",
                        message=f"Сессия {session_id[:8]} успешно завершена.",
                        priority=NotificationPriority.HIGH,
                        persistent=True,
                        source="business_intelligence",
                    ),
                )
            except Exception:
                logger.debug("NotificationService: failed to send BI completion notification", exc_info=True)

            logger.info("Generation completed: session=%s", session_id)

        else:
            # Send error via Socket.IO
            error = result.get("error", "Unknown error")
            await services["elasticsearch"].update_session(
                session_id=session_id,
                updates={
                    "status": "failed",
                    "completed_at": datetime.now(UTC).isoformat(),
                    "analysis_count": len(result.get("analyses", [])),
                    "total_tokens": result.get("metrics", {}).get("total_tokens", 0),
                    "error": str(error),
                },
            )
            await send_bi_error(session_id, error)
            if redis is not None:
                await redis.set(claim_key, "failed", ex=60 * 60 * 24)
            logger.error("Generation failed: session=%s, error=%s", session_id, error)
            raise RuntimeError(str(error))

            # In-app notification (desktop) for error
            try:
                notification_service = get_notification_service()
                await notification_service.send_to_user(
                    user_id,
                    NotificationCreate(
                        type=NotificationType.ERROR,
                        title="Ошибка BI анализа",
                        message=str(error),
                        priority=NotificationPriority.HIGH,
                        persistent=True,
                        source="business_intelligence",
                    ),
                )
            except Exception:
                logger.debug("NotificationService: failed to send BI error notification", exc_info=True)

    except Exception:
        logger.exception("Background generation failed")
        error_msg = "Background generation failed"
        await send_bi_error(session_id, error_msg)
        if redis is not None:
            if manifest_pending:
                # A queue redelivery may regenerate files and persist the manifest.
                await redis.delete(claim_key)
            else:
                await redis.set(claim_key, "failed", ex=60 * 60 * 24)

        # Best-effort in-app notification without user context
        try:
            # user context is not available here; skip explicit notification
            notification_service = get_notification_service()
            _ = notification_service  # keep linters happy if unused
        except Exception:
            logger.debug("NotificationService: background failure notification skipped", exc_info=True)
        raise


async def _owned_session(services: dict, session_id: str, user_id: str) -> dict:
    """Fail closed for missing storage, missing identity and foreign sessions."""
    es = services.get("elasticsearch")
    session = await es.get_session(session_id) if es is not None else None
    if not user_id or not session or str(session.get("user_id") or "") != str(user_id):
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.get("/session/{session_id}", response_model=GenerationResult)
async def get_session_status(
    session_id: str,
    user: User = Depends(require_oauth2_user),  # noqa: ARG001, B008
) -> dict[str, Any]:
    """
    Get session generation status

    Args:
        session_id: Session ID

    Returns:
        Current session status and results
    """
    try:
        services = await get_services()

        session_data = await _owned_session(services, session_id, user.id)

        # Historical records must match both the session and its owner.
        analyses_query = {
            "query": {"bool": {"filter": [{"term": {"session_id": session_id}}, {"term": {"user_id": str(user.id)}}]}},
            "size": 100,
        }
        analyses_result = await services["elasticsearch"].client.search(
            index=services["elasticsearch"].ANALYSES_INDEX, body=analyses_query
        )

        analyses = [hit["_source"] for hit in analyses_result["hits"]["hits"]]

        total_analyses = len(analyses)
        successful = sum(1 for analysis in analyses if analysis.get("success", True))
        failed = max(total_analyses - successful, 0)
        total_tokens_used = sum(
            int((analysis.get("metrics") or {}).get("tokens_used") or 0)
            for analysis in analyses
            if isinstance(analysis, dict)
        )
        quality_scores = [
            float((analysis.get("metrics") or {}).get("quality_score") or 0)
            for analysis in analyses
            if isinstance(analysis, dict)
        ]
        average_quality_score = sum(quality_scores) / len(quality_scores) if quality_scores else 0.0

        return {
            "session_id": session_id,
            "status": session_data.get("status", "unknown"),
            "analyses": analyses,
            "summary": {
                "total_analyses": total_analyses,
                "successful": successful,
                "failed": failed,
                "total_tokens_used": total_tokens_used,
                "average_quality_score": average_quality_score,
                "analyses_breakdown": {},
            },
            "documents_processed": session_data.get("document_count", 0),
            "metrics": {"total_tokens": session_data.get("total_tokens", 0)},
        }

    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to get session status")
        detail_msg = "Failed to get session status"
        raise HTTPException(status_code=500, detail=detail_msg) from None


# ========================================
# REAL-TIME UPDATES VIA SOCKET.IO
# ========================================
# Socket.IO events are handled in api/routers/socketio_handler.py
# Events: bi_progress, bi_completed, bi_error
# Frontend subscribes to channel: business_intelligence_{session_id}

# ========================================
# SEARCH & HISTORY ENDPOINTS
# ========================================


@router.post("/search", response_model=list[SearchResult])
async def search_analyses(
    search: SearchRequest,
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> list[SearchResult]:
    """
    Search user's analyses

    Args:
        search: Search parameters

    Returns:
        List of matching analyses
    """
    try:
        services = await get_services()

        results = await services["analyzer"].search_analyses(user_id=user.id, query=search.query, limit=search.limit)

        return [
            SearchResult(
                analysis_id=r.get("analysis_id", ""),
                title=r.get("title", ""),
                analysis_type=r.get("analysis_type", ""),
                summary=r.get("summary", "")[:200],
                created_at=r.get("created_at", ""),
                quality_score=r.get("metrics", {}).get("quality_score", 0),
            )
            for r in results
        ]

    except Exception:
        logger.exception("Search failed")
        detail_msg = "Search failed"
        raise HTTPException(status_code=500, detail=detail_msg) from None


@router.get("/statistics", response_model=UserStatistics)
async def get_user_statistics(user: User = Depends(require_oauth2_user)) -> UserStatistics:  # noqa: B008
    """
    Get user's usage statistics

    Returns:
        Comprehensive user statistics
    """
    try:
        services = await get_services()

        stats = await services["analyzer"].get_user_stats(user.id)

        # Get recent analyses
        recent = await services["elasticsearch"].get_user_analyses_history(user.id, limit=5)

        return UserStatistics(
            total_analyses=stats.get("total_analyses", 0),
            total_documents=stats.get("total_documents", 0),
            total_tokens_used=stats.get("total_tokens_used", 0),
            average_quality=stats.get("average_quality", 0),
            analysis_types_distribution=stats.get("analysis_types_distribution", []),
            recent_analyses=[
                SearchResult(
                    analysis_id=r.get("analysis_id", ""),
                    title=r.get("title", ""),
                    analysis_type=r.get("analysis_type", ""),
                    summary=r.get("summary", "")[:200],
                    created_at=r.get("created_at", ""),
                    quality_score=r.get("metrics", {}).get("quality_score", 0),
                )
                for r in recent
            ],
        )

    except Exception:
        logger.exception("Failed to get statistics")
        detail_msg = "Failed to get statistics"
        raise HTTPException(status_code=500, detail=detail_msg) from None


# ========================================
# DOWNLOAD ENDPOINTS
# ========================================


@router.get("/download/{session_id}/{file_name}")
async def download_document(
    session_id: str,  # noqa: ARG001
    file_name: str,
    token: str | None = Query(None),
) -> FileResponse:
    """
    Download generated document

    Supports authentication via token query parameter for direct browser downloads

    Args:
        session_id: Session ID
        file_name: File name
        token: Authentication token in query params (required)

    Returns:
        File download response
    """
    try:
        # Validate token from query parameter
        if not token:
            detail_msg = "Token required in query parameter"
            raise HTTPException(status_code=401, detail=detail_msg)  # noqa: TRY301

        # Validate token with configured auth provider
        auth_provider = get_auth_provider_service()

        try:
            user_info = await auth_provider.validate_token(token)
            if not user_info:
                detail_msg = "Invalid token"
                raise HTTPException(status_code=401, detail=detail_msg)  # noqa: TRY301

            # Сессии в ES индексируются с user.id из OAuth (= users.id при синхронизации), не с sub.
            sub_id = str(user_info.get("sub") or "").strip()
            email_raw = user_info.get("email")
            email = email_raw.strip() if isinstance(email_raw, str) else None
            db_uid = await resolve_db_user_id_by_email(email)
            user_id = db_uid if db_uid else sub_id
            if not user_id:
                detail_msg = "Invalid token: missing user ID"
                raise HTTPException(status_code=401, detail=detail_msg)  # noqa: TRY301

        except HTTPException:
            raise
        except Exception:
            logger.exception("Token validation failed")
            detail_msg = "Token validation failed"
            raise HTTPException(status_code=401, detail=detail_msg) from None

        services = await get_services()

        session_doc = await _owned_session(services, session_id, user_id)
        # Legacy files without a durable binding are intentionally unavailable.
        if (
            not file_name
            or file_name in {".", ".."}
            or "/" in file_name
            or "\\" in file_name
            or file_name not in session_doc.get("generated_files", [])
        ):
            raise HTTPException(status_code=404, detail="File not found")
        output_root = services["template"].output_dir.resolve()
        file_path = (output_root / file_name).resolve()
        if file_path.parent != output_root or not file_path.is_file():
            raise HTTPException(status_code=404, detail="File not found")

    except HTTPException:
        raise
    except Exception:
        logger.exception("Download failed")
        detail_msg = "Download failed"
        raise HTTPException(status_code=500, detail=detail_msg) from None
    else:
        return FileResponse(path=str(file_path), filename=file_name, media_type="application/octet-stream")


# ========================================
# CLEANUP ENDPOINTS (Admin)
# ========================================


def require_admin_role(user: User = Depends(require_oauth2_user)) -> User:  # noqa: B008
    """Require admin or emperyworld_admin role for admin-only endpoints."""
    if user.role not in ("admin", "emperyworld_admin"):
        raise HTTPException(status_code=403, detail="Administrator privileges required")
    return user


@router.post("/admin/cleanup")
async def cleanup_old_files(
    days: int = Query(default=7, ge=1, le=365),
    _admin: User = Depends(require_admin_role),  # noqa: B008
) -> dict[str, Any]:
    """
    Cleanup old generated files (Admin only)

    Args:
        days: Delete files older than N days

    Returns:
        Cleanup result
    """
    try:
        services = await get_services()

        await services["template"].cleanup_old_files(days=days)

        message = f"Cleaned up files older than {days} days"
        return {
            "status": "success",
            "message": message,
            "timestamp": datetime.now(UTC).isoformat(),
        }

    except Exception:
        logger.exception("Cleanup failed")
        detail_msg = "Cleanup failed"
        raise HTTPException(status_code=500, detail=detail_msg) from None


# ========================================
# STARTUP & SHUTDOWN HANDLERS
# ========================================


@router.on_event("startup")
async def startup() -> None:
    """Initialize services on startup"""
    logger.info("Business Intelligence module starting...")
    await get_services()
    logger.info("Business Intelligence module ready!")


@router.on_event("shutdown")
async def shutdown() -> None:
    """Cleanup on shutdown"""
    logger.info("🛑 Business Intelligence module shutting down...")

    if _service_state.es_service:
        await _service_state.es_service.close()

    if _service_state.tika_service:
        await _service_state.tika_service.close()

    if _service_state.llama_service:
        await _service_state.llama_service.close()

    logger.info("Business Intelligence module shutdown complete")
