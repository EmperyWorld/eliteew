# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Single-item CRUD, document projections, copy, and restore routes.
# Invariants:
# - Mounted without extra prefix under unified_content parent.
# Related:
# - api/routers/unified_content_deps.py
# ---

from __future__ import annotations

import logging
from typing import cast
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request  # type: ignore[import-untyped]
from starlette import status

from api.core.auth import User as AuthUser
from api.core.oauth2_auth import require_oauth2_user
from api.core.project_scope_access import (
    assert_company_accessible,
    assert_project_accessible,
    fetch_project_company_id,
)
from api.core.user_identity import resolve_db_user_uuid_with_pool
from api.dependencies.user_context import get_current_user_db_id as get_content_user_id
from api.models import User
from api.routers.unified_content_deps import (
    _content_blob_admin_read_bypass,
    _raise_internal_server_error,
    _retrieve_content_file_bytes,
    get_client_info,
    get_content_command_service,
    get_content_query_service,
    get_content_service,
    get_db_pool,
    get_search_service,
    process_content_background,
)
from api.schemas.unified_content import (
    Content,
    ContentCopyRequest,
    ContentUpdate,
    UnifiedContentDocumentBodyResponse,
    UnifiedContentDocumentStructureResponse,
)
from api.services.doc_editor_document_structure import build_document_structure_from_projection
from api.services.queue_features import QUEUE_FLAG_DOCS, is_queue_enabled
from api.services.rabbitmq_service import get_rabbitmq_service
from api.services.unified_content.content_command_service import ContentCommandService
from api.services.unified_content.content_query_service import ContentQueryService
from api.services.unified_content.content_search_service import ContentSearchService
from api.services.unified_content.content_storage_service import ContentStorageService
from api.services.unified_content.document_body_projection import (
    build_unified_content_document_body_projection,
    document_body_can_project_from_metadata,
    document_body_is_text_like,
)
from api.utils.project_desktop_folder import parse_project_id_from_desktop_folder_item_id
from api.utils.project_vault_permissions import assert_user_may_write_project_vault

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Unified Content"])


@router.get("/content/{content_id:uuid}", response_model=Content)
async def get_content(
    content_id: UUID,
    current_user: User = Depends(require_oauth2_user),
    content_user_id: str = Depends(get_content_user_id),
    query_service: ContentQueryService = Depends(get_content_query_service),
) -> Content:
    """
    Get content details by ID

    - Automatic permission check (owner, shared, or public)
    - Returns metadata only (use /download for file)
    """
    try:
        return await query_service.get_content(content_id, content_user_id)

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e)) from e
    except Exception as e:
        _raise_internal_server_error("get_content", e)


@router.get("/content/{content_id:uuid}/document-body", response_model=UnifiedContentDocumentBodyResponse)
async def get_content_document_body(
    content_id: UUID,
    current_user: User = Depends(require_oauth2_user),
    content_user_id: str = Depends(get_content_user_id),
    service: ContentStorageService = Depends(get_content_service),
) -> UnifiedContentDocumentBodyResponse:
    """
    Return a normalized text-like document body for embedded editors.

    This keeps Unified Content permission checks/storage reads server-side and exposes the same markdown/html/plain
    projection contract consumed by EWA document surfaces.
    """
    try:
        content = await service.get_content(
            content_id,
            content_user_id,
            check_permissions=not _content_blob_admin_read_bypass(current_user),
        )
        can_project_from_metadata = document_body_can_project_from_metadata(content)
        is_text_like = document_body_is_text_like(content)
        if not is_text_like and not can_project_from_metadata:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="document_body_projection_unavailable",
            )
        try:
            file_data: bytes | None = await _retrieve_content_file_bytes(
                service=service, content=content, content_id=content_id
            )
        except HTTPException:
            if not can_project_from_metadata:
                raise
            file_data = None
        return build_unified_content_document_body_projection(content=content, file_data=file_data)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e)) from e
    except Exception as e:
        logger.exception("Document body projection failed")
        _raise_internal_server_error("get_content_document_body", e)


@router.get("/content/{content_id:uuid}/document-structure", response_model=UnifiedContentDocumentStructureResponse)
async def get_content_document_structure(
    content_id: UUID,
    current_user: User = Depends(require_oauth2_user),
    content_user_id: str = Depends(get_content_user_id),
    service: ContentStorageService = Depends(get_content_service),
) -> UnifiedContentDocumentStructureResponse:
    """
    Return a backend-derived document outline for embedded EWA document tools.

    The route intentionally reuses document-body authorization/storage projection so the browser receives only bounded,
    server-derived sections and offsets.
    """
    try:
        content = await service.get_content(
            content_id,
            content_user_id,
            check_permissions=not _content_blob_admin_read_bypass(current_user),
        )
        can_project_from_metadata = document_body_can_project_from_metadata(content)
        is_text_like = document_body_is_text_like(content)
        if not is_text_like and not can_project_from_metadata:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="document_structure_unavailable",
            )
        try:
            file_data: bytes | None = await _retrieve_content_file_bytes(
                service=service, content=content, content_id=content_id
            )
        except HTTPException:
            if not can_project_from_metadata:
                raise
            file_data = None
        projection = build_unified_content_document_body_projection(content=content, file_data=file_data)
        return build_document_structure_from_projection(projection)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e)) from e
    except Exception as e:
        logger.exception("Document structure projection failed")
        _raise_internal_server_error("get_content_document_structure", e)


@router.patch("/content/{content_id}", response_model=Content)
async def update_content(
    content_id: UUID,
    updates: ContentUpdate,
    request: Request,
    current_user: User = Depends(require_oauth2_user),
    content_user_id: str = Depends(get_content_user_id),
    command_service: ContentCommandService = Depends(get_content_command_service),
    search_service: ContentSearchService = Depends(get_search_service),
) -> Content:
    """
    Update content metadata

    - Only owner can update
    - Cannot update file data (upload new version instead)
    - Tags, visibility, name, description can be updated
    """
    try:
        ip_address, user_agent = get_client_info(request)

        patch_incoming = updates.model_dump(exclude_unset=True)
        merged_updates = updates
        if patch_incoming:
            db_pool = await get_db_pool()
            db_user_uuid = await resolve_db_user_uuid_with_pool(
                cast(AuthUser, current_user),
                db_pool,
            )
            if "folder_item_id" in patch_incoming:
                raw_fid = patch_incoming["folder_item_id"]
                parsed_from_folder = parse_project_id_from_desktop_folder_item_id(raw_fid) if raw_fid else None
                if parsed_from_folder is not None:
                    await assert_user_may_write_project_vault(
                        db_pool,
                        parsed_from_folder,
                        db_user_uuid=db_user_uuid,
                        storage_user_id=content_user_id,
                    )
                    p_company = await fetch_project_company_id(db_pool, parsed_from_folder)
                    if p_company is None:
                        raise HTTPException(
                            status_code=status.HTTP_404_NOT_FOUND,
                            detail="Project not found",
                        )
                    if (
                        patch_incoming.get("project_id") is not None
                        and UUID(str(patch_incoming["project_id"])) != parsed_from_folder
                    ):
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="project_id does not match project desktop folder",
                        )
                    if (
                        patch_incoming.get("company_id") is not None
                        and UUID(str(patch_incoming["company_id"])) != p_company
                    ):
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="company_id does not match project desktop folder",
                        )
                    merged_updates = merged_updates.model_copy(
                        update={
                            "project_id": parsed_from_folder,
                            "company_id": p_company,
                        }
                    )

            patch = merged_updates.model_dump(exclude_unset=True)
            if "project_id" in patch:
                pid = patch["project_id"]
                if pid is not None:
                    pid_uuid = UUID(str(pid))
                    await assert_project_accessible(db_pool, pid_uuid, db_user_uuid)
                    cid = patch.get("company_id")
                    if cid is not None:
                        p_company = await fetch_project_company_id(db_pool, pid_uuid)
                        if p_company is None or p_company != UUID(str(cid)):
                            raise HTTPException(
                                status_code=status.HTTP_400_BAD_REQUEST,
                                detail="project_id does not match company_id",
                            )
            elif patch.get("company_id") is not None:
                await assert_company_accessible(
                    db_pool,
                    UUID(str(patch["company_id"])),
                    db_user_uuid,
                )

        content = await command_service.update_content(
            content_id=content_id,
            user_id=content_user_id,
            updates=merged_updates,
            ip_address=ip_address,
            user_agent=user_agent,
        )

        # Re-index after update
        try:
            await search_service.index_content(content_id, content_user_id)
            logger.info("Re-indexed updated content %s to Elasticsearch", content_id)
        except Exception:
            logger.exception("Failed to re-index updated content %s", content_id)

        from api.services.cache_service import best_effort_invalidate_after_content_mutation

        await best_effort_invalidate_after_content_mutation(
            content_user_id,
            operation="update",
            content_id=str(content_id),
        )

        return content

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e)) from e
    except Exception as e:
        logger.exception("Update failed")
        _raise_internal_server_error("update_content", e)


@router.delete("/content/{content_id:uuid}", status_code=204)
async def delete_content(
    content_id: UUID,
    request: Request,
    current_user: User = Depends(require_oauth2_user),
    content_user_id: str = Depends(get_content_user_id),
    command_service: ContentCommandService = Depends(get_content_command_service),
) -> None:
    """
    Soft delete content

    - Sets deleted_at timestamp
    - Owner can delete; platform admin / emperyworld_admin may delete any item they can read
      (shared/public/friends), same privilege as other content admin routes
    - Can be restored within retention period
    """
    try:
        ip_address, user_agent = get_client_info(request)

        allow_admin = current_user.role in ("admin", "emperyworld_admin")
        await command_service.delete_content(
            content_id=content_id,
            user_id=content_user_id,
            ip_address=ip_address,
            user_agent=user_agent,
            allow_delete_as_platform_admin=allow_admin,
        )

        # Remove from Elasticsearch using search service (handles NotFoundError gracefully)
        try:
            search_service = await get_search_service()
            await search_service.delete_from_index(content_id)
            logger.info(f"Removed deleted content {content_id} from Elasticsearch")
        except Exception as e:
            # Log but don't fail - deletion from ES is best-effort
            logger.warning(f"Failed to remove content {content_id} from Elasticsearch: {e}")

        from api.services.cache_service import best_effort_invalidate_after_content_mutation

        await best_effort_invalidate_after_content_mutation(content_user_id, operation="create")

        return

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e)) from e
    except Exception as e:
        logger.exception("Delete failed")
        _raise_internal_server_error("delete_content", e)


@router.post(
    "/content/{content_id:uuid}/copy",
    response_model=Content,
    status_code=status.HTTP_201_CREATED,
)
async def copy_content(
    content_id: UUID,
    body: ContentCopyRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_oauth2_user),
    content_user_id: str = Depends(get_content_user_id),
    service: ContentStorageService = Depends(get_content_service),
) -> Content:
    """
    Duplicate a readable content item into a new private row owned by the caller.

    Always creates a new storage object (hash dedup disabled). Shares, versions, and
    comments are not copied. Folder/company/project are inherited only when the caller
    owns the source; otherwise the copy is unfiled.
    """
    _ = current_user
    try:
        ip_address, user_agent = get_client_info(request)
        source = await service.get_content(content_id, content_user_id)
        file_data = await _retrieve_content_file_bytes(service=service, content=source, content_id=content_id)
        content = await service.copy_content(
            source_content_id=content_id,
            user_id=content_user_id,
            new_name=body.name,
            file_data=file_data,
            ip_address=ip_address,
            user_agent=user_agent,
        )

        filename = content.original_filename or content.name or "copy"
        mime_type = content.mime_type or "application/octet-stream"
        if is_queue_enabled(QUEUE_FLAG_DOCS, default=True):
            published = await get_rabbitmq_service().publish_document_processing(
                task_type="unified_content_process",
                content_id=str(content.id),
                payload={
                    "content_id": str(content.id),
                    "content_type": content.content_type.value,
                    "mime_type": mime_type,
                    "filename": filename,
                },
            )
            if not published:
                background_tasks.add_task(
                    process_content_background,
                    content_id=content.id,
                    content_type=content.content_type.value,
                    file_data=file_data,
                    filename=filename,
                    mime_type=mime_type,
                )
        else:
            background_tasks.add_task(
                process_content_background,
                content_id=content.id,
                content_type=content.content_type.value,
                file_data=file_data,
                filename=filename,
                mime_type=mime_type,
            )

        from api.services.cache_service import best_effort_invalidate_after_content_mutation

        await best_effort_invalidate_after_content_mutation(content_user_id, operation="create")
        return content
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e)) from e
    except Exception as e:
        logger.exception("Copy content failed")
        _raise_internal_server_error("copy_content", e)


@router.post("/content/{content_id:uuid}/restore", response_model=Content)
async def restore_content(
    content_id: UUID,
    request: Request,
    current_user: User = Depends(require_oauth2_user),
    content_user_id: str = Depends(get_content_user_id),
    command_service: ContentCommandService = Depends(get_content_command_service),
    search_service: ContentSearchService = Depends(get_search_service),
) -> Content:
    """
    Restore soft-deleted content

    - Only owner can restore
    - Clears deleted_at timestamp
    """
    try:
        ip_address, user_agent = get_client_info(request)

        content = await command_service.restore_content(
            content_id=content_id,
            user_id=content_user_id,
            ip_address=ip_address,
            user_agent=user_agent,
        )

        # Re-index restored content
        try:
            await search_service.index_content(content_id, content_user_id)
            logger.info(f"Re-indexed restored content {content_id} to Elasticsearch")
        except Exception:
            logger.exception("Failed to re-index restored content %s", content_id)

        from api.services.cache_service import best_effort_invalidate_after_content_mutation

        await best_effort_invalidate_after_content_mutation(content_user_id, operation="create")

        return content

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e)) from e
    except Exception as e:
        _raise_internal_server_error("restore_content", e)
