# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Content comment add/delete routes stored in content metadata.
# Invariants:
# - Mounted without extra prefix under unified_content parent.
# Related:
# - api/routers/unified_content_deps.py
# ---

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException  # type: ignore[import-untyped]
from pydantic import BaseModel, Field  # type: ignore[import-untyped]

from api.core.oauth2_auth import require_oauth2_user
from api.dependencies.user_context import get_current_user_db_id as get_content_user_id
from api.models import User
from api.routers.unified_content_deps import (
    _raise_comment_not_found,
    _raise_internal_server_error,
    get_content_service,
)
from api.services.unified_content.content_storage_service import ContentStorageService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Unified Content"])


class CommentRequest(BaseModel):
    comment: str = Field(..., min_length=1, max_length=5000, description="Comment text")


@router.post("/content/{content_id:uuid}/comment")
async def add_comment(
    content_id: UUID,
    request: CommentRequest,
    current_user: User = Depends(require_oauth2_user),
    content_user_id: str = Depends(get_content_user_id),
    service: ContentStorageService = Depends(get_content_service),
) -> dict[str, Any]:
    """
    Add or update comment for a content item

    Comments are stored in metadata.comments array
    """
    try:
        # Get current content
        content = await service.get_content(content_id, content_user_id)

        # Get current metadata
        current_metadata = content.metadata or {}
        comments = current_metadata.get("comments", [])

        # Add new comment
        new_comment = {
            "id": str(uuid4()),
            "text": request.comment,
            "user_id": content_user_id,
            "created_at": datetime.now(UTC).isoformat(),
        }
        comments.append(new_comment)

        # Update metadata
        updated_metadata = {**current_metadata, "comments": comments}

        # Update content
        from api.schemas.unified_content import ContentUpdate

        # All fields in ContentUpdate are optional, so we can pass only metadata
        # pyright: ignore[reportCallIssue]
        updates = ContentUpdate(metadata=updated_metadata)  # type: ignore[call-arg]

        updated_content = await service.update_content(
            content_id=content_id,
            user_id=content_user_id,
            updates=updates,
        )

        return {"comment": new_comment, "content": updated_content}

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e)) from e
    except Exception as e:
        logger.exception("Add comment failed")
        _raise_internal_server_error("add_comment", e)


@router.delete("/content/{content_id:uuid}/comment/{comment_id}")
async def delete_comment(
    content_id: UUID,
    comment_id: str,
    current_user: User = Depends(require_oauth2_user),
    content_user_id: str = Depends(get_content_user_id),
    service: ContentStorageService = Depends(get_content_service),
) -> dict[str, Any]:
    """
    Delete a comment from content item

    Only comment owner or content owner can delete
    """
    try:
        # Get current content
        content = await service.get_content(content_id, content_user_id)

        # Get current metadata
        current_metadata = content.metadata or {}
        comments = current_metadata.get("comments", [])

        # Find and remove comment
        user_id_str = content_user_id
        filtered_comments: list[dict[str, Any]] = []
        removed = False
        for comment in comments:
            is_target_comment = comment.get("id") == comment_id
            can_delete_comment = comment.get("user_id") == user_id_str or str(content.user_id) == user_id_str

            if is_target_comment and can_delete_comment:
                removed = True
                continue

            filtered_comments.append(comment)

        if not removed:
            _raise_comment_not_found()

        # Update metadata
        updated_metadata = {**current_metadata, "comments": filtered_comments}

        # Update content
        from api.schemas.unified_content import ContentUpdate

        # All fields in ContentUpdate are optional, so we can pass only metadata
        # pyright: ignore[reportCallIssue]
        updates = ContentUpdate(metadata=updated_metadata)  # type: ignore[call-arg]

        updated_content = await service.update_content(
            content_id=content_id,
            user_id=content_user_id,
            updates=updates,
        )

        return {"success": True, "content": updated_content}

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e)) from e
    except Exception as e:
        logger.exception("Delete comment failed")
        _raise_internal_server_error("delete_comment", e)
