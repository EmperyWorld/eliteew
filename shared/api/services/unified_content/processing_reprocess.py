# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Queue unified_content reprocessing from stored bytes (owner/edit ACL, project vault).
# Invariants:
# - Reprocess is rejected while status is pending/processing to avoid duplicate workers.
# - Same queue/background path as upload/replace; clears processing_error before enqueue.
# Related:
# - api/routers/unified_content_processing.py
# - api/workers/queue_handlers.py
# ---

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from typing import cast
from uuid import UUID

from fastapi import BackgroundTasks, HTTPException  # type: ignore[import-untyped]
from starlette import status

from api.core.auth import User as AuthUser
from api.core.database_manager import get_asyncpg_pool
from api.core.user_identity import resolve_db_user_uuid_with_pool
from api.models import User
from api.schemas.unified_content import Content, ProcessingStatus
from api.services.queue_features import QUEUE_FLAG_DOCS, is_queue_enabled
from api.services.rabbitmq_service import get_rabbitmq_service
from api.services.unified_content.content_storage_service import ContentStorageService
from api.utils.project_vault_permissions import assert_user_may_write_project_vault

logger = logging.getLogger(__name__)

ReprocessBackgroundFn = Callable[..., Awaitable[None]]


class ContentReprocessConflictError(ValueError):
    """Raised when content is already being processed."""


def assert_may_reprocess_content(existing: Content) -> None:
    """Owner/edit ACL gate for user-triggered reprocess."""
    if existing.can_edit is not True:
        raise PermissionError("Only the owner can reprocess this content")

    status_val = (
        existing.processing_status.value
        if hasattr(existing.processing_status, "value")
        else str(existing.processing_status or "")
    ).lower()
    if status_val in {ProcessingStatus.PENDING.value, ProcessingStatus.PROCESSING.value}:
        raise ContentReprocessConflictError("Content is already being processed")


async def assert_may_reprocess_project_vault(
    *,
    existing: Content,
    current_user: User,
) -> None:
    if existing.project_id is None:
        return
    db_pool = await get_asyncpg_pool()
    db_user_uuid = await resolve_db_user_uuid_with_pool(cast(AuthUser, current_user), db_pool)
    await assert_user_may_write_project_vault(
        db_pool,
        existing.project_id,
        db_user_uuid=db_user_uuid,
        storage_user_id=str(existing.user_id),
    )


async def queue_unified_content_reprocess(
    *,
    content_id: UUID,
    content_user_id: str,
    current_user: User,
    service: ContentStorageService,
    background_tasks: BackgroundTasks,
    process_content_background: ReprocessBackgroundFn,
) -> UUID:
    """
    Reset failed/stale processing state and enqueue the unified_content pipeline.

    Returns content_id after queue/background scheduling succeeds.
    """
    existing = await service.get_content(content_id, content_user_id)
    assert_may_reprocess_content(existing)
    await assert_may_reprocess_project_vault(existing=existing, current_user=current_user)

    file_data, meta = await service.read_file_bytes_for_owner(content_id, existing.user_id)
    filename = (
        meta.get("original_filename") or meta.get("name") or (existing.original_filename or existing.name) or "unknown"
    )
    mime_type = meta.get("mime_type") or existing.mime_type or "application/octet-stream"
    content_type_val = (
        existing.content_type.value if hasattr(existing.content_type, "value") else str(existing.content_type)
    )

    async with service.db_pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE unified_content
            SET processing_status = $1,
                processing_error = NULL,
                updated_at = NOW()
            WHERE id = $2
            """,
            ProcessingStatus.PENDING.value,
            content_id,
        )

    if is_queue_enabled(QUEUE_FLAG_DOCS, default=True):
        published = await get_rabbitmq_service().publish_document_processing(
            task_type="unified_content_process",
            content_id=str(content_id),
            payload={
                "content_id": str(content_id),
                "content_type": content_type_val,
                "mime_type": mime_type,
                "filename": filename,
            },
        )
        if not published:
            background_tasks.add_task(
                process_content_background,
                content_id=content_id,
                content_type=content_type_val,
                file_data=file_data,
                filename=filename,
                mime_type=mime_type,
            )
    else:
        background_tasks.add_task(
            process_content_background,
            content_id=content_id,
            content_type=content_type_val,
            file_data=file_data,
            filename=filename,
            mime_type=mime_type,
        )

    from api.services.cache_service import best_effort_invalidate_after_content_mutation

    await best_effort_invalidate_after_content_mutation(str(content_user_id), operation="create")
    logger.info(
        "Reprocess queued content_id=%s user=%s prior_status=%s",
        content_id,
        content_user_id,
        existing.processing_status,
    )
    return content_id


def http_exception_for_reprocess_error(exc: Exception) -> HTTPException:
    if isinstance(exc, PermissionError):
        return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    if isinstance(exc, ContentReprocessConflictError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    if isinstance(exc, ValueError):
        return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    raise exc
