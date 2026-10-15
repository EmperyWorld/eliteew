# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# User upload and replace-file routes for unified content.
# Invariants:
# - Mounted without extra prefix under unified_content parent.
# - ``replace-file`` relies on ``ContentStorageService.replace_file_content`` to snapshot
#   previous body into ``content_versions`` before overwrite (no post-replace create_version).
# Related:
# - api/routers/unified_content_deps.py
# - api/services/unified_content/content_storage_service.py
# ---

from __future__ import annotations

import logging
from typing import cast
from uuid import UUID

from fastapi import (  # type: ignore[import-untyped]
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    Query,
    Request,
    UploadFile,
)
from starlette import status

from api.core.auth import User as AuthUser
from api.core.oauth2_auth import require_oauth2_user
from api.core.user_identity import resolve_db_user_uuid_with_pool
from api.dependencies.user_context import get_current_user_db_id as get_content_user_id
from api.gaf_chat.constants import CONTENT_SUBTYPE_GAF_CHAT_VOICE
from api.helpers.markdown_storage_normalize import (
    maybe_convert_html_payload_to_markdown_for_md_filename,
    maybe_convert_html_payload_to_plain_for_txt_filename,
)
from api.models import User
from api.routers.unified_content_deps import (
    _raise_file_extension_error,
    _raise_file_size_error,
    _raise_filename_required,
    _raise_internal_server_error,
    _raise_magic_byte_error,
    _raise_malware_detected,
    _raise_rate_limit_exceeded,
    get_client_info,
    get_content_service,
    get_content_type_from_mime,
    get_db_pool,
    get_malware_scanner,
    get_rate_limiter,
    get_search_service,
    get_security_validator,
    process_content_background,
)
from api.schemas.unified_content import Content, ContentCreate, ContentType, Visibility
from api.services.queue_features import QUEUE_FLAG_DOCS, is_queue_enabled
from api.services.rabbitmq_service import get_rabbitmq_service
from api.services.rate_limiter import RateLimiter
from api.services.unified_content.content_search_service import ContentSearchService
from api.services.unified_content.content_storage_service import ContentStorageService
from api.services.unified_content.security_validator import MalwareScanner, SecurityValidator
from api.utils.project_vault_permissions import assert_user_may_write_project_vault

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Unified Content"])


@router.post("/content", response_model=Content, status_code=201)
async def upload_content(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    name: str | None = Query(None, description="Content name (defaults to filename)"),
    description: str | None = Query(None),
    tags: str | None = Query(None, description="Comma-separated tags"),
    content_type: ContentType = Query(ContentType.OTHER),
    visibility: Visibility = Query(Visibility.PRIVATE),
    company_id: UUID | None = Query(None, description="Company classification (Plan 3)"),
    project_id: UUID | None = Query(None, description="Project classification (Plan 3)"),
    friend_visibility: bool | None = Query(False, description="Enable friend visibility (Plan 3)"),
    friend_shared_user_ids: str | None = Query(
        None,
        description="Comma-separated friend user UUIDs; when set with friend_visibility, only these friends see the file (must be mutual friends). Omit for all friends.",
    ),
    folder_item_id: str | None = Query(None, description="Desktop folder item_id (content group)"),
    apply_project_desktop_folder: bool = Query(
        True,
        description="With project_id, default folder_item_id to eliteew-proj- unless folder_item_id set",
    ),
    source_service: str | None = Query(None),
    sub_type: str | None = Query(
        None,
        max_length=50,
        description="Optional sub-type; only gaf_chat_voice is accepted (GAF voice — hidden from Content Manager listing)",
    ),
    current_user: User = Depends(require_oauth2_user),
    content_user_id: str = Depends(get_content_user_id),
    service: ContentStorageService = Depends(get_content_service),
    search_service: ContentSearchService = Depends(get_search_service),
    security_validator: SecurityValidator = Depends(get_security_validator),
    malware_scanner: MalwareScanner = Depends(get_malware_scanner),
    rate_limiter: RateLimiter = Depends(get_rate_limiter),
) -> Content:
    """
    Upload new content with automatic storage backend selection

    Security Features (NEW):
    - Upload rate limiting (10 uploads/min per user)
    - File type whitelist validation
    - Magic byte verification
    - Executable file blocking
    - Malware scanning (ClamAV)
    - File size enforcement (100MB max)

    Storage:
    - Files < 1MB → PostgreSQL
    - Files ≥ 1MB → SeaweedFS S3 (replaced MinIO)
    - Automatic SHA256 deduplication
    - Quota enforcement (10GB per user)
    """
    try:
        # SECURITY FIX #3: Rate limiting check
        is_allowed, retry_after = rate_limiter.check_rate_limit(content_user_id)
        if not is_allowed:
            logger.warning(
                f"Upload rate limit exceeded: user={content_user_id} | "
                f"file={file.filename} | retry_after={retry_after:.1f}s"
            )
            _raise_rate_limit_exceeded(retry_after)
        # SECURITY FIX #4: Validate file size BEFORE reading into memory
        # Get file size from UploadFile object
        file.file.seek(0, 2)  # Seek to end
        file_size = file.file.tell()
        file.file.seek(0)  # Reset to beginning

        size_valid, size_error = security_validator.validate_file_size(file_size)
        if not size_valid:
            error_msg = size_error if size_error is not None else "File size validation failed"
            logger.warning(
                f"Upload rejected (size): {file.filename} | "
                f"Size: {file_size} | User: {current_user.id} | "
                f"Error: {error_msg}"
            )
            _raise_file_size_error(error_msg)

        # SECURITY FIX #1: Validate file extension
        if file.filename is None:
            _raise_filename_required()
        # Type narrowing: after None check, filename is guaranteed to be str
        assert file.filename is not None  # Type narrowing for type checker
        filename_for_ext_check = file.filename
        ext_valid, ext_error = security_validator.validate_file_extension(filename_for_ext_check)
        if not ext_valid:
            error_msg = ext_error if ext_error is not None else "File extension validation failed"
            logger.warning(
                f"Upload rejected (extension): {file.filename} | User: {current_user.id} | Error: {error_msg}"
            )
            _raise_file_extension_error(error_msg)

        # Read file data (now safe - size already validated)
        file_data = await file.read()

        # SECURITY FIX #1: Validate magic bytes
        filename_str = file.filename if file.filename is not None else "unknown"
        magic_valid, magic_error, detected_mime = await security_validator.validate_magic_bytes_async(
            file_data, filename_str, file.content_type or "application/octet-stream"
        )
        if not magic_valid:
            error_msg = magic_error if magic_error is not None else "Magic byte validation failed"
            logger.warning(
                f"Upload rejected (magic bytes): {file.filename} | User: {current_user.id} | Error: {error_msg}"
            )
            _raise_magic_byte_error(error_msg)

        # SECURITY FIX #5: Malware scanning
        filename_for_scan = file.filename if file.filename is not None else "unknown"
        is_safe, threat_name = await malware_scanner.scan_file(file_data, filename_for_scan)
        if not is_safe:
            threat_msg = threat_name if threat_name is not None else "Unknown threat"
            logger.error(f"MALWARE DETECTED: {file.filename} | Threat: {threat_msg} | User: {current_user.id}")
            _raise_malware_detected(threat_msg)

        # Use detected MIME type (more reliable than client-provided)
        actual_mime_type = detected_mime or file.content_type or "application/octet-stream"

        # Auto-detect content type if not specified or is OTHER
        if content_type == ContentType.OTHER:
            content_type = get_content_type_from_mime(actual_mime_type, file.filename or "unknown")

        # Parse tags
        tag_list = [t.strip() for t in tags.split(",")] if tags else []

        resolved_sub_type: str | None = None
        if sub_type is not None and str(sub_type).strip():
            st = str(sub_type).strip()
            if st != CONTENT_SUBTYPE_GAF_CHAT_VOICE:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid sub_type",
                )
            resolved_sub_type = CONTENT_SUBTYPE_GAF_CHAT_VOICE

        # Create content
        filename_str = file.filename if file.filename is not None else "unknown"
        name_str = name if name is not None else filename_str
        content_data = ContentCreate(
            user_id=content_user_id,
            name=name_str,
            description=description,
            tags=tag_list,
            content_type=content_type,
            mime_type=actual_mime_type,  # Use detected MIME type
            original_filename=filename_str,
            visibility=visibility,
            company_id=company_id,
            project_id=project_id,
            friend_visibility=friend_visibility or False,
            folder_item_id=folder_item_id,
            apply_project_desktop_folder=apply_project_desktop_folder,
            source_service=source_service,
            sub_type=resolved_sub_type,
            title=None,
            word_count=None,
            character_count=None,
            access_level=None,
            is_public=None,
            source_id=None,
        )

        ip_address, user_agent = get_client_info(request)

        if project_id is not None:
            db_pool_u = await get_db_pool()
            db_u = await resolve_db_user_uuid_with_pool(cast(AuthUser, current_user), db_pool_u)
            await assert_user_may_write_project_vault(
                db_pool_u,
                project_id,
                db_user_uuid=db_u,
                storage_user_id=content_user_id,
            )

        content = await service.create_content(
            content_data=content_data,
            file_data=file_data,
            user_id=content_user_id,
            ip_address=ip_address,
            user_agent=user_agent,
        )

        if content_data.friend_visibility and friend_shared_user_ids and friend_shared_user_ids.strip():
            parts = [p.strip() for p in friend_shared_user_ids.split(",") if p.strip()]
            if parts:
                await service.set_content_friend_shared_user_ids(
                    content.id,
                    content_user_id,
                    parts,
                )
                content = await service.get_content(content.id, content_user_id)

        if is_queue_enabled(QUEUE_FLAG_DOCS, default=True):
            published = await get_rabbitmq_service().publish_document_processing(
                task_type="unified_content_process",
                content_id=str(content.id),
                payload={
                    "content_id": str(content.id),
                    "content_type": content_type.value,
                    "mime_type": actual_mime_type,
                    "filename": file.filename or "unknown",
                },
            )
            if not published:
                background_tasks.add_task(
                    process_content_background,
                    content_id=content.id,
                    content_type=content_type.value,
                    file_data=file_data,
                    filename=file.filename or "unknown",
                    mime_type=file.content_type or "application/octet-stream",
                )
        else:
            background_tasks.add_task(
                process_content_background,
                content_id=content.id,
                content_type=content_type.value,
                file_data=file_data,
                filename=file.filename or "unknown",
                mime_type=file.content_type or "application/octet-stream",
            )

        # Index to Elasticsearch (async, non-blocking)
        try:
            await search_service.index_content(content.id, content_user_id)
            logger.info("Indexed content %s to Elasticsearch", content.id)
        except Exception:
            # Don't fail upload if ES indexing fails
            logger.exception("Failed to index %s to Elasticsearch", content.id)

        # Cache invalidation (dashboard + event bus) — must not fail upload
        from api.services.cache_service import best_effort_invalidate_after_content_mutation

        await best_effort_invalidate_after_content_mutation(str(content_user_id), operation="create")

        return content

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.exception("Upload failed")
        _raise_internal_server_error("upload", e)


@router.post("/content/{content_id}/replace-file", response_model=Content)
async def replace_content_file(
    request: Request,
    background_tasks: BackgroundTasks,
    content_id: UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(require_oauth2_user),
    content_user_id: str = Depends(get_content_user_id),
    service: ContentStorageService = Depends(get_content_service),
    search_service: ContentSearchService = Depends(get_search_service),
    security_validator: SecurityValidator = Depends(get_security_validator),
    malware_scanner: MalwareScanner = Depends(get_malware_scanner),
    rate_limiter: RateLimiter = Depends(get_rate_limiter),
) -> Content:
    """
    Replace file bytes for existing content (same content_id).

    Used by Ultimate Doc Editor save so the logical document id does not change on each save.
    Previous body is snapshotted into ``content_versions`` inside ``replace_file_content``.
    """
    try:
        is_allowed, retry_after = rate_limiter.check_rate_limit(content_user_id)
        if not is_allowed:
            logger.warning(
                "Replace rate limit exceeded: user=%s | content_id=%s | retry_after=%s",
                current_user.id,
                content_id,
                retry_after,
            )
            _raise_rate_limit_exceeded(retry_after)

        file.file.seek(0, 2)
        file_size = file.file.tell()
        file.file.seek(0)

        size_valid, size_error = security_validator.validate_file_size(file_size)
        if not size_valid:
            error_msg = size_error if size_error is not None else "File size validation failed"
            logger.warning(
                "Replace rejected (size): %s | Size: %s | User: %s | Error: %s",
                file.filename,
                file_size,
                current_user.id,
                error_msg,
            )
            _raise_file_size_error(error_msg)

        if file.filename is None:
            _raise_filename_required()
        assert file.filename is not None
        filename_for_ext_check = file.filename
        ext_valid, ext_error = security_validator.validate_file_extension(filename_for_ext_check)
        if not ext_valid:
            error_msg = ext_error if ext_error is not None else "File extension validation failed"
            logger.warning(
                "Replace rejected (extension): %s | User: %s | Error: %s",
                file.filename,
                current_user.id,
                error_msg,
            )
            _raise_file_extension_error(error_msg)

        file_data = await file.read()

        magic_valid, magic_error, detected_mime = await security_validator.validate_magic_bytes_async(
            file_data, filename_for_ext_check, file.content_type or "application/octet-stream"
        )
        if not magic_valid:
            error_msg = magic_error if magic_error is not None else "Magic byte validation failed"
            logger.warning(
                "Replace rejected (magic bytes): %s | User: %s | Error: %s",
                file.filename,
                current_user.id,
                error_msg,
            )
            _raise_magic_byte_error(error_msg)

        filename_for_scan = file.filename if file.filename is not None else "unknown"
        is_safe, threat_name = await malware_scanner.scan_file(file_data, filename_for_scan)
        if not is_safe:
            threat_msg = threat_name if threat_name is not None else "Unknown threat"
            logger.error(
                "MALWARE DETECTED (replace): %s | Threat: %s | User: %s",
                file.filename,
                threat_msg,
                current_user.id,
            )
            _raise_malware_detected(threat_msg)

        actual_mime_type = detected_mime or file.content_type or "application/octet-stream"

        file_data, md_storage_normalized = maybe_convert_html_payload_to_markdown_for_md_filename(
            filename_for_ext_check, file_data
        )
        if md_storage_normalized:
            actual_mime_type = "text/markdown"
            logger.info(
                "replace-file: normalized HTML payload to Markdown for %s | content_id=%s",
                filename_for_ext_check,
                content_id,
            )
        else:
            file_data, txt_storage_normalized = maybe_convert_html_payload_to_plain_for_txt_filename(
                filename_for_ext_check, file_data
            )
            if txt_storage_normalized:
                actual_mime_type = "text/plain"
                logger.info(
                    "replace-file: normalized HTML payload to plain text for %s | content_id=%s",
                    filename_for_ext_check,
                    content_id,
                )

        existing = await service.get_content(content_id, content_user_id)
        if existing.project_id is not None:
            db_pool_u = await get_db_pool()
            db_u = await resolve_db_user_uuid_with_pool(cast(AuthUser, current_user), db_pool_u)
            await assert_user_may_write_project_vault(
                db_pool_u,
                existing.project_id,
                db_user_uuid=db_u,
                storage_user_id=content_user_id,
            )

        ip_address, user_agent = get_client_info(request)

        content = await service.replace_file_content(
            content_id=content_id,
            user_id=content_user_id,
            file_data=file_data,
            original_filename=file.filename,
            mime_type=actual_mime_type,
            ip_address=ip_address,
            user_agent=user_agent,
            change_description="File replaced (Ultimate Doc Editor)",
        )

        if is_queue_enabled(QUEUE_FLAG_DOCS, default=True):
            published = await get_rabbitmq_service().publish_document_processing(
                task_type="unified_content_process",
                content_id=str(content.id),
                payload={
                    "content_id": str(content.id),
                    "content_type": content.content_type.value
                    if hasattr(content.content_type, "value")
                    else str(content.content_type),
                    "mime_type": actual_mime_type,
                    "filename": file.filename or "unknown",
                },
            )
            if not published:
                background_tasks.add_task(
                    process_content_background,
                    content_id=content.id,
                    content_type=content.content_type.value
                    if hasattr(content.content_type, "value")
                    else str(content.content_type),
                    file_data=file_data,
                    filename=file.filename or "unknown",
                    mime_type=actual_mime_type,
                )
        else:
            background_tasks.add_task(
                process_content_background,
                content_id=content.id,
                content_type=content.content_type.value
                if hasattr(content.content_type, "value")
                else str(content.content_type),
                file_data=file_data,
                filename=file.filename or "unknown",
                mime_type=actual_mime_type,
            )

        try:
            await search_service.index_content(content.id, content_user_id)
            logger.info("Indexed content %s after replace", content.id)
        except Exception:
            logger.exception("Failed to index %s to Elasticsearch after replace", content.id)

        from api.services.cache_service import best_effort_invalidate_after_content_mutation

        await best_effort_invalidate_after_content_mutation(str(content_user_id), operation="create")

        return content

    except HTTPException:
        raise
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.exception("Replace file failed")
        _raise_internal_server_error("replace_file", e)
