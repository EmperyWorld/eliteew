#!/usr/bin/env python3
# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   Unified Content Shares Router
# Invariants:
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
# Related:
#   - shared/api/main.py (регистрация роутеров); см. затронутые services/models.
# ------------------------------------------------------------------------------
"""
Unified Content Shares Router
Week 9 - UI Components: Sharing & Collaboration

API endpoints for content sharing management:
- Create/update/delete shares
- List shares (owned & received)
- Permission management
- Access tracking
"""

import logging
from typing import TYPE_CHECKING
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status  # type: ignore[import-untyped]
from fastapi.responses import JSONResponse  # type: ignore[import-untyped]

from api.core.database_manager import get_elasticsearch_client
from api.core.oauth2_auth import require_oauth2_user  # type: ignore[import-untyped]
from api.dependencies.user_context import get_current_user_db_id as get_content_user_id
from api.models import User
from api.schemas.unified_content import (
    Permission,
    Share,
    ShareCreate,
    ShareResponse,
    ShareUpdate,
)
from api.services.unified_content.audit_logger import AuditLogger
from api.services.unified_content.content_search_service import ContentSearchService
from api.services.unified_content.share_service import ShareService

if TYPE_CHECKING:
    import asyncpg  # type: ignore[import-not-found]

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Unified Content - Shares"])


# ============================================================================
# DEPENDENCY INJECTION
# ============================================================================


async def get_share_service(request: Request) -> ShareService:
    """Get ShareService instance"""
    db_pool: asyncpg.Pool = request.app.state.db_pool
    audit_logger = AuditLogger(db_pool)
    search_service = ContentSearchService(get_elasticsearch_client(), db_pool)
    return ShareService(db_pool, audit_logger, search_service)


# ============================================================================
# ENDPOINTS
# ============================================================================


@router.post(
    "/content/{content_id}/shares",
    response_model=Share,
    status_code=status.HTTP_201_CREATED,
    summary="Create content share",
    description="Владелец файла или руководитель проекта (created_by) для контента с project_id; получатель — активный участник проекта.",
)
async def create_share(
    content_id: UUID,
    share_data: ShareCreate,
    request: Request,
    current_user: User = Depends(require_oauth2_user),
    content_user_id: str = Depends(get_content_user_id),
    share_service: ShareService = Depends(get_share_service),
) -> Share:
    """
    Create new share for content.

    **Permission:** владелец контента или руководитель проекта (при project_id); получатель — активный участник проекта.

    **Permission Levels:**
    - `view`: Read-only access
    - `edit`: Can modify content
    - `admin`: Can manage shares

    **Optional Expiration:**
    - Set `expires_at` for time-limited access
    """
    try:
        return await share_service.create_share(
            content_id=content_id,
            share_data=share_data,
            user_id=content_user_id,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )

    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except Exception as e:
        logger.exception("Error creating share")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create share") from e


@router.get(
    "/content/{content_id}/shares",
    response_model=list[Share],
    summary="List content shares",
    description="Список шеров: владелец контента или руководитель проекта для контента с project_id.",
)
async def list_content_shares(
    content_id: UUID,
    current_user: User = Depends(require_oauth2_user),
    content_user_id: str = Depends(get_content_user_id),
    share_service: ShareService = Depends(get_share_service),
) -> list[Share]:
    """
    List all shares for a content.

    **Permission:** владелец контента или руководитель проекта (при project_id).

    Returns list of shares with:
    - User shared with
    - Permission level
    - Expiration date
    - Access statistics
    """
    try:
        return await share_service.list_content_shares(content_id=content_id, user_id=content_user_id)

    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e
    except Exception as e:
        logger.exception("Error listing shares")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to list shares") from e


@router.patch(
    "/content/shares/{share_id}",
    response_model=Share,
    summary="Update share",
    description="Обновление шера: владелец контента или руководитель проекта (при project_id).",
)
async def update_share(
    share_id: UUID,
    share_update: ShareUpdate,
    request: Request,
    current_user: User = Depends(require_oauth2_user),
    content_user_id: str = Depends(get_content_user_id),
    share_service: ShareService = Depends(get_share_service),
) -> Share:
    """
    Update share configuration.

    **Permission:** владелец контента или руководитель проекта (при project_id).

    **Updatable Fields:**
    - `permission_level`: Change access level
    - `expires_at`: Extend/shorten expiration
    """
    try:
        return await share_service.update_share(
            share_id=share_id,
            share_update=share_update,
            user_id=content_user_id,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )

    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e
    except Exception as e:
        logger.exception("Error updating share")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update share") from e


@router.delete(
    "/content/shares/{share_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke share",
    description="Отзыв шера: владелец контента или руководитель проекта (при project_id).",
)
async def delete_share(
    share_id: UUID,
    request: Request,
    current_user: User = Depends(require_oauth2_user),
    content_user_id: str = Depends(get_content_user_id),
    share_service: ShareService = Depends(get_share_service),
) -> JSONResponse:
    """
    Revoke share and remove user access.

    **Permission:** владелец контента или руководитель проекта для контента с project_id.

    This action is immediate and irreversible.
    """
    try:
        await share_service.delete_share(
            share_id=share_id,
            user_id=content_user_id,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )

        return JSONResponse(status_code=status.HTTP_204_NO_CONTENT, content=None)

    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e
    except Exception as e:
        logger.exception("Error deleting share")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete share") from e


@router.get(
    "/content/shares/received",
    response_model=list[ShareResponse],
    summary="List received shares",
    description="Get all content shared with current user",
)
async def list_received_shares(
    permission_level: Permission | None = None,
    current_user: User = Depends(require_oauth2_user),
    content_user_id: str = Depends(get_content_user_id),
    share_service: ShareService = Depends(get_share_service),
) -> list[ShareResponse]:
    """
    List all content shared with current user.

    **Optional Filters:**
    - `permission_level`: Filter by permission (view/edit/admin)

    Returns shares with content details:
    - Content name & type
    - Who shared it
    - Permission level
    - Expiration
    """
    try:
        return await share_service.list_received_shares(user_id=content_user_id, permission_filter=permission_level)

    except Exception as e:
        logger.exception("Error listing received shares")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list received shares",
        ) from e


@router.post(
    "/content/shares/{share_id}/access",
    response_model=Share,
    summary="Track share access",
    description="Increment access counter and update timestamp",
)
async def track_share_access(
    share_id: UUID,
    current_user: User = Depends(require_oauth2_user),
    content_user_id: str = Depends(get_content_user_id),
    share_service: ShareService = Depends(get_share_service),
) -> Share:
    """
    Track share access.

    Call this endpoint when user accesses shared content:
    - Increments access counter
    - Updates last accessed timestamp
    - Validates expiration

    **Permission:** Shared user only
    """
    try:
        return await share_service.track_access(share_id=share_id, user_id=content_user_id)

    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except Exception as e:
        logger.exception("Error tracking access")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to track access") from e
