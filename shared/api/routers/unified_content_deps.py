# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared FastAPI dependencies, helpers, and error raisers for unified content child routers.
# Invariants:
# - Stateless validators/scanners are module-level singletons; DB/ES via DatabaseManager only.
# Related:
# - api/routers/unified_content.py (parent aggregator)
# - api/domains/content.py
# ---

from __future__ import annotations

import logging
from typing import NoReturn
from uuid import UUID, uuid4

import asyncpg  # type: ignore[import-not-found]  # type: ignore[import-untyped]
from elasticsearch import AsyncElasticsearch  # type: ignore[import-not-found,attr-defined]
from fastapi import Depends, HTTPException, Request  # type: ignore[import-untyped]
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.database_manager import get_asyncpg_pool, get_elasticsearch_client, get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.core.unified_config import unified_settings
from api.models import User
from api.schemas.unified_content import Content, ContentType
from api.services.rate_limiter import RateLimiter, get_upload_rate_limiter
from api.services.unified_content.audit_logger import AuditLogger
from api.services.unified_content.content_archive_service import ContentArchiveService
from api.services.unified_content.content_command_service import ContentCommandService
from api.services.unified_content.content_download_ticket_service import ContentDownloadTicketService
from api.services.unified_content.content_query_service import ContentQueryService
from api.services.unified_content.content_search_service import ContentSearchService
from api.services.unified_content.content_storage_service import ContentStorageService
from api.services.unified_content.folder_view_service import FolderViewService
from api.services.unified_content.processors import ProcessorFactory
from api.services.unified_content.security_validator import MalwareScanner, SecurityValidator
from api.services.unified_content.storage_backends.factory import get_storage_factory
from api.services.unified_content.storage_backends.minio_storage import (
    SeaweedFileCorruptedError,
    SeaweedFileNotFoundError,
    SeaweedStorageUnavailableError,
)
from api.services.unified_content.version_manager import VersionManager
from api.utils.content_storage_error_detail import (
    STORAGE_OBJECT_UNAVAILABLE_DETAIL as _STORAGE_OBJECT_UNAVAILABLE_DETAIL,
)
from api.utils.content_storage_error_detail import (
    STORAGE_TEMPORARILY_UNAVAILABLE_DETAIL as _STORAGE_TEMPORARILY_UNAVAILABLE_DETAIL,
)
from api.utils.content_storage_error_detail import internal_server_error_detail

logger = logging.getLogger(__name__)

ARCHIVE_AUDIT_ACTION = "accessed_download"
ARCHIVE_DOWNLOAD_CONCURRENCY = 4

ARCHIVE_AUDIT_ACTION = "accessed_download"
ARCHIVE_DOWNLOAD_CONCURRENCY = 4

# Global validators and scanners (stateless, re-used across requests)
_security_validator: SecurityValidator | None = None
_malware_scanner: MalwareScanner | None = None
_reindex_rate_limiter = RateLimiter(requests_per_minute=2, burst_capacity=2)


async def get_db_pool() -> asyncpg.Pool:
    """Get shared asyncpg pool from DatabaseManager."""
    pool = await get_asyncpg_pool()
    assert isinstance(pool, asyncpg.Pool)
    return pool


def get_es_client() -> AsyncElasticsearch:
    """Get shared Elasticsearch client from DatabaseManager."""
    return get_elasticsearch_client()


async def get_content_service() -> ContentStorageService:
    """Dependency for ContentStorageService with cached factory"""
    db_pool = await get_db_pool()

    # Use cached factory instead of creating a new one
    from api.services.unified_content.storage_backends.factory import (
        get_storage_factory,
    )

    storage_factory = get_storage_factory(db_pool)

    audit_logger = AuditLogger(db_pool)
    return ContentStorageService(db_pool, storage_factory, audit_logger)


async def get_content_download_ticket_service() -> ContentDownloadTicketService:
    """Return the stateless Redis-backed content download ticket service."""
    return ContentDownloadTicketService()


async def get_content_query_service(
    service: ContentStorageService = Depends(get_content_service),
) -> ContentQueryService:
    return ContentQueryService(service)


async def get_folder_view_service(
    db: AsyncSession = Depends(get_postgres_session),
    query_service: ContentQueryService = Depends(get_content_query_service),
) -> FolderViewService:
    return FolderViewService(db, query_service)


async def get_content_command_service(
    service: ContentStorageService = Depends(get_content_service),
) -> ContentCommandService:
    return ContentCommandService(service)


async def get_content_archive_service(
    service: ContentStorageService = Depends(get_content_service),
) -> ContentArchiveService:
    return ContentArchiveService(service, concurrency=ARCHIVE_DOWNLOAD_CONCURRENCY)


async def get_search_service() -> ContentSearchService:
    """Dependency for ContentSearchService"""
    es_client = get_es_client()
    db_pool = await get_db_pool()
    return ContentSearchService(es_client, db_pool)


def get_security_validator() -> SecurityValidator:
    """Dependency for SecurityValidator"""
    global _security_validator
    if _security_validator is None:
        _security_validator = SecurityValidator()
    return _security_validator


def get_malware_scanner() -> MalwareScanner:
    """Dependency for MalwareScanner"""
    global _malware_scanner
    if _malware_scanner is None:
        _malware_scanner = MalwareScanner(enabled=unified_settings.malware_scan_enabled)
    return _malware_scanner


def get_rate_limiter() -> RateLimiter:
    """Dependency for upload rate limiter"""
    return get_upload_rate_limiter()


def get_reindex_rate_limiter() -> RateLimiter:
    """Dependency for reindex endpoint rate limiter."""
    return _reindex_rate_limiter


async def get_version_manager_dep() -> VersionManager:
    """Version snapshots after file replace (same pattern as unified_content_versions)."""
    db_pool = await get_db_pool()
    return VersionManager(db_pool, get_storage_factory(db_pool))


def require_content_admin(user: User = Depends(require_oauth2_user)) -> User:
    """Allow only privileged users for admin-only content operations."""
    if user.role not in ("admin", "emperyworld_admin"):
        raise HTTPException(status_code=403, detail="Administrator privileges required")
    return user


def _content_blob_admin_read_bypass(current_user: User) -> bool:
    """Platform admins may fetch any unified_content blob (e.g. EWDesk attachment previews)."""
    return getattr(current_user, "role", None) in ("admin", "emperyworld_admin")


# Request is always available in FastAPI route context


def get_client_info(request: Request | None) -> tuple[str | None, str | None]:
    """Extract client IP and user agent from request"""
    if request is None:
        return None, None
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    return ip_address, user_agent


async def process_content_background(
    content_id: UUID, content_type: str, file_data: bytes, filename: str, mime_type: str
) -> None:
    """
    Background task for content processing

    Processes content using appropriate processor based on type
    """
    import logging

    logger = logging.getLogger(__name__)

    try:
        db_pool = await get_db_pool()
        processor_factory = ProcessorFactory(db_pool)

        logger.info("Starting background processing for content %s", content_id)

        result = await processor_factory.process_content(
            content_id=content_id,
            content_type=content_type,
            file_data=file_data,
            filename=filename,
            mime_type=mime_type,
        )

        processing_status = result.get("processing_status") if result else None
        logger.info(f"Background processing completed for {content_id}: Status={processing_status}")

        # Re-index to Elasticsearch after processing completes (updates extracted_text)
        try:
            es_client = get_es_client()
            db_pool = await get_db_pool()
            search_service = ContentSearchService(es_client, db_pool)

            # Fetch user_id from database
            async with db_pool.acquire() as conn:
                user_id = await conn.fetchval("SELECT user_id FROM unified_content WHERE id = $1", content_id)

            if user_id:
                await search_service.index_content(content_id, user_id)
                logger.info("Re-indexed processed content %s to Elasticsearch", content_id)

        except Exception:
            logger.exception("Failed to re-index %s to Elasticsearch", content_id)

    except Exception as e:
        logger.exception("Background processing failed for %s", content_id)

        # Update with error status
        try:
            db_pool = await get_db_pool()
            async with db_pool.acquire() as conn:
                await conn.execute(
                    """
                    UPDATE unified_content
                    SET processing_status = 'failed',
                        processing_error = $1,
                        processed_at = NOW()
                    WHERE id = $2
                    """,
                    str(e),
                    content_id,
                )
        except Exception:
            logger.warning("Failed to update error status for content %s", content_id)


def get_content_type_from_mime(mime_type: str, filename: str) -> ContentType:
    """
    Determine content type from MIME type and filename
    """
    mime_lower = mime_type.lower()
    filename_lower = filename.lower()

    # Documents
    if mime_lower in [
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
        "application/vnd.ms-word.document.macroenabled.12",
        "application/rtf",
        "text/rtf",
    ] or filename_lower.endswith((".doc", ".docx", ".rtf")):
        return ContentType.DOCUMENT

    if mime_lower in ["application/pdf"] or filename_lower.endswith(".pdf"):
        return ContentType.DOCUMENT

    # Spreadsheets
    if mime_lower in [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "application/vnd.ms-excel.sheet.macroenabled.12",
        "text/csv",
    ] or filename_lower.endswith((".xlsx", ".xls", ".csv")):
        return ContentType.SPREADSHEET

    # Presentations
    if mime_lower in [
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/vnd.ms-powerpoint",
        "application/vnd.ms-powerpoint.presentation.macroenabled.12",
    ] or filename_lower.endswith((".pptx", ".ppt")):
        return ContentType.PRESENTATION

    # Images
    if mime_lower.startswith("image/"):
        return ContentType.IMAGE

    # Videos
    if mime_lower.startswith("video/"):
        return ContentType.VIDEO

    # Audio
    if mime_lower.startswith("audio/"):
        return ContentType.AUDIO

    # Text files
    if mime_lower.startswith("text/"):
        return ContentType.DOCUMENT

    # Default
    return ContentType.OTHER


# Helper functions for HTTPException (TRY301 compliance)
def _raise_rate_limit_exceeded(retry_after: float | None) -> NoReturn:
    """Raise HTTPException for rate limit exceeded."""
    detail = f"Too many uploads. Retry after {retry_after:.0f} seconds."
    logger.warning("unified_content: rate limit exceeded → 429 (%s)", detail)
    raise HTTPException(
        status_code=429,
        detail=detail,
        headers={"Retry-After": str(int(retry_after)) if retry_after is not None else "60"},
    )


def _raise_internal_server_error(operation: str, error: Exception) -> NoReturn:
    """Raise safe 500 error and keep details in server logs only."""
    error_id = uuid4().hex[:12]
    logger.exception("unified_content: %s failed (error_id=%s)", operation, error_id)
    raise HTTPException(
        status_code=500,
        detail=internal_server_error_detail(error_id),
        headers={"X-Error-ID": error_id},
    ) from None


def _raise_reindex_rate_limit_exceeded(retry_after: float | None) -> NoReturn:
    """Raise HTTPException for reindex rate limit exceeded."""
    detail = "Too many reindex requests. Try again later."
    raise HTTPException(
        status_code=429,
        detail=detail,
        headers={"Retry-After": str(int(retry_after)) if retry_after is not None else "60"},
    )


def _raise_file_size_error(size_error: str) -> NoReturn:
    """Raise HTTPException for file size error."""
    logger.warning("unified_content: file size error → 413 (%s)", size_error)
    raise HTTPException(status_code=413, detail=size_error)


def _raise_filename_required() -> NoReturn:
    """Raise HTTPException for missing filename."""
    logger.warning("unified_content: filename required → 400")
    raise HTTPException(status_code=400, detail="Filename is required")


def _raise_file_extension_error(ext_error: str) -> NoReturn:
    """Raise HTTPException for file extension error."""
    logger.warning("unified_content: file extension error → 400 (%s)", ext_error)
    raise HTTPException(status_code=400, detail=ext_error)


def _raise_magic_byte_error(magic_error: str) -> NoReturn:
    """Raise HTTPException for magic byte validation error."""
    logger.warning("unified_content: magic byte validation error → 400 (%s)", magic_error)
    raise HTTPException(status_code=400, detail=magic_error)


def _raise_malware_detected(threat_name: str) -> NoReturn:
    """Raise HTTPException for malware detected."""
    detail = f"File rejected: malware detected ({threat_name})"
    logger.warning("unified_content: malware detected → 400 (%s)", detail)
    raise HTTPException(status_code=400, detail=detail)


def _raise_content_not_found(content_id: str) -> NoReturn:  # type: ignore[reportUnusedFunction]
    """Raise HTTPException for content not found.

    Note: Currently unused but kept for potential future use.
    """
    raise HTTPException(status_code=404, detail=f"Content {content_id} not found")


def _raise_access_denied(content_id: str) -> NoReturn:  # type: ignore[reportUnusedFunction]
    """Raise HTTPException for access denied.

    Note: Currently unused but kept for potential future use.
    """
    raise HTTPException(status_code=403, detail=f"Access denied to content {content_id}")


def _raise_message_not_found() -> NoReturn:  # type: ignore[reportUnusedFunction]
    """Raise HTTPException for message not found.

    Note: Currently unused but kept for potential future use.
    """
    raise HTTPException(status_code=404, detail="Message not found")


def _raise_max_batch_size_exceeded(max_items: int = 100) -> NoReturn:
    """Raise HTTPException for batch size exceeded."""
    detail = f"Maximum {max_items} items per batch"
    logger.warning("unified_content: batch size exceeded → 400 (%s)", detail)
    raise HTTPException(status_code=400, detail=detail)


def _raise_max_tags_exceeded() -> NoReturn:
    """Raise HTTPException for too many tags."""
    logger.warning("unified_content: max tags exceeded → 400")
    raise HTTPException(status_code=400, detail="Maximum 20 tags to add")


def _raise_storage_backend_not_set() -> NoReturn:
    """Raise HTTPException for storage backend not set."""
    logger.error("unified_content: storage backend not set → 500")
    raise HTTPException(status_code=500, detail="Content storage backend is not set")


def _raise_file_data_empty() -> NoReturn:
    """Raise HTTPException for empty file data."""
    logger.warning("unified_content: file data empty → 404")
    raise HTTPException(
        status_code=404,
        detail="File data is empty. The file may have been lost. Please contact administrator.",
    )


async def _retrieve_content_file_bytes(
    *,
    service: ContentStorageService,
    content: Content,
    content_id: UUID,
) -> bytes:
    if content.storage_backend is None:
        _raise_storage_backend_not_set()
    assert content.storage_backend is not None
    backend = service.storage_factory.get_backend_by_name(content.storage_backend.value)
    try:
        file_data = await backend.retrieve(content.file_path or "", content_id, fail_fast=True)
    except SeaweedStorageUnavailableError as storage_error:
        logger.warning(
            "unified_content document body: storage temporarily unavailable content_id=%s: %s",
            content_id,
            storage_error,
        )
        raise HTTPException(status_code=503, detail=_STORAGE_TEMPORARILY_UNAVAILABLE_DETAIL) from storage_error
    except (SeaweedFileNotFoundError, SeaweedFileCorruptedError) as storage_error:
        logger.warning(
            "unified_content document body: storage object missing/unreadable content_id=%s: %s",
            content_id,
            storage_error,
        )
        try:
            await service.quarantine_from_storage_error(content_id, storage_error)
        except Exception:
            logger.exception(
                "[STEP] content_storage_quarantine_fail content_id=%s",
                content_id,
            )
        raise HTTPException(status_code=404, detail=_STORAGE_OBJECT_UNAVAILABLE_DETAIL) from storage_error
    except (ValueError, FileNotFoundError) as storage_error:
        logger.warning("unified_content document body: storage object missing content_id=%s", content_id)
        raise HTTPException(status_code=404, detail=_STORAGE_OBJECT_UNAVAILABLE_DETAIL) from storage_error
    except Exception as storage_error:
        _raise_internal_server_error("retrieve_content_file_bytes", storage_error)
    if not file_data:
        _raise_file_data_empty()
    return bytes(file_data)


def _raise_no_content_ids_provided() -> NoReturn:
    """Raise HTTPException for no content IDs provided."""
    logger.warning("unified_content: no content IDs provided → 400")
    raise HTTPException(status_code=400, detail="No content IDs provided")


def _raise_no_accessible_files() -> NoReturn:
    """Raise HTTPException for no accessible files found."""
    logger.warning("unified_content: no accessible files to download → 400")
    raise HTTPException(status_code=400, detail="No accessible files found to download")


def _raise_comment_not_found() -> NoReturn:
    """Raise HTTPException for comment not found."""
    logger.warning("unified_content: comment not found or no permission → 404")
    raise HTTPException(status_code=404, detail="Comment not found or no permission")
