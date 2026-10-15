# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# User-triggered unified_content processing routes (reprocess/reindex queue).
# Invariants:
# - Bearer auth + ContentStorageService ACL; project vault write check when project_id set.
# Related:
# - api/domains/content.py
# - api/services/unified_content/processing_reprocess.py
# ---

from __future__ import annotations

import logging
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException  # type: ignore[import-untyped]
from pydantic import BaseModel  # type: ignore[import-untyped]
from starlette import status

from api.core.oauth2_auth import require_oauth2_user
from api.dependencies.user_context import get_current_user_db_id as get_content_user_id
from api.models import User
from api.routers.unified_content import (
    get_content_service,
    get_upload_rate_limiter,
    process_content_background,
)
from api.services.rate_limiter import RateLimiter
from api.services.unified_content.content_storage_service import ContentStorageService
from api.services.unified_content.processing_reprocess import (
    http_exception_for_reprocess_error,
    queue_unified_content_reprocess,
)
from api.utils.content_storage_error_detail import internal_server_error_detail

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Unified Content - Processing"])


class ReprocessQueuedResponse(BaseModel):
    """User-triggered re-run of the storage-backed processing pipeline (extracted text, thumbnails, ES/Qdrant)."""

    status: Literal["queued"] = "queued"
    content_id: UUID


@router.post(
    "/content/{content_id}/reprocess",
    response_model=ReprocessQueuedResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def reprocess_content(
    background_tasks: BackgroundTasks,
    content_id: UUID,
    current_user: User = Depends(require_oauth2_user),
    content_user_id: str = Depends(get_content_user_id),
    service: ContentStorageService = Depends(get_content_service),
    rate_limiter: RateLimiter = Depends(get_upload_rate_limiter),
) -> ReprocessQueuedResponse:
    """
    Re-queue processing from stored bytes (same path as upload/replace).

    Use when processing_status=failed or previews/extracted text need a fresh run.
    """
    try:
        is_allowed, retry_after = rate_limiter.check_rate_limit(content_user_id)
        if not is_allowed:
            logger.warning(
                "Reprocess rate limit exceeded: user=%s | content_id=%s | retry_after=%s",
                current_user.id,
                content_id,
                retry_after,
            )
            detail = "Too many requests. Try again later."
            headers = {"Retry-After": str(int(retry_after))} if retry_after else None
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=detail,
                headers=headers,
            )

        queued_id = await queue_unified_content_reprocess(
            content_id=content_id,
            content_user_id=content_user_id,
            current_user=current_user,
            service=service,
            background_tasks=background_tasks,
            process_content_background=process_content_background,
        )
        return ReprocessQueuedResponse(content_id=queued_id)

    except HTTPException:
        raise
    except Exception as e:
        try:
            raise http_exception_for_reprocess_error(e)
        except HTTPException as http_exc:
            raise http_exc from e
        logger.exception("Reprocess content failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=internal_server_error_detail("reprocess"),
        ) from e
