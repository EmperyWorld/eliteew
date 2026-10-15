# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   Floating Widgets API Router
# Invariants:
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
# Related:
#   - shared/api/main.py (регистрация роутеров); см. затронутые services/models.
# ------------------------------------------------------------------------------
"""
Floating Widgets API Router
Endpoints for managing user floating widgets
"""

import logging

import asyncpg  # type: ignore[import-not-found]
from fastapi import APIRouter, Depends, HTTPException, status  # type: ignore[import-untyped]

from api.core.auth import User
from api.core.database_manager import get_asyncpg_pool
from api.core.oauth2_auth import require_oauth2_user
from api.models.floating_widgets import (
    CreateWidgetFromTemplateRequest,
    FloatingWidgetCreate,
    FloatingWidgetResponse,
    FloatingWidgetTemplateResponse,
    FloatingWidgetUpdate,
)
from api.services.floating_widgets_service import FloatingWidgetsService

router = APIRouter(prefix="/api/v1/floating-widgets", tags=["floating-widgets"])
logger = logging.getLogger(__name__)


# ============================================================================
# DEPENDENCIES
# ============================================================================


def get_widgets_service(db_pool: asyncpg.Pool = Depends(get_asyncpg_pool)) -> FloatingWidgetsService:
    """Get floating widgets service instance with shared database pool."""
    return FloatingWidgetsService(db_pool=db_pool)


# ============================================================================
# TEMPLATE ENDPOINTS (must be before /{widget_id} to avoid route conflicts)
# ============================================================================


@router.get(
    "/templates",
    response_model=list[FloatingWidgetTemplateResponse],
    summary="Get Widget Templates",
)
async def get_templates(
    category: str | None = None,
    *,
    active_only: bool = True,
    current_user: User = Depends(require_oauth2_user),
    service: FloatingWidgetsService = Depends(get_widgets_service),
) -> list[FloatingWidgetTemplateResponse]:
    """
    Get available widget templates.

    Args:
        category: Filter by category (system, monitoring, content, ai, custom)
        active_only: Only return active templates
    """
    try:
        templates = await service.get_templates(category=category, active_only=active_only)
        logger.info("Successfully retrieved %s templates", len(templates))
        return templates
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error getting templates")
        detail_msg = f"Failed to get templates: {e!s}"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail_msg,
        ) from e


@router.get(
    "/templates/{widget_type}",
    response_model=FloatingWidgetTemplateResponse,
    summary="Get Widget Template",
)
async def get_template(
    widget_type: str,
    current_user: User = Depends(require_oauth2_user),
    service: FloatingWidgetsService = Depends(get_widgets_service),
) -> FloatingWidgetTemplateResponse:
    """
    Get specific widget template by type.
    """
    try:
        template = await service.get_template(widget_type)
        if not template:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
        return template
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error getting template")
        detail_msg = f"Failed to get template: {e!s}"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail_msg,
        ) from e


# ============================================================================
# WIDGET ENDPOINTS
# ============================================================================


@router.get("", response_model=list[FloatingWidgetResponse], summary="Get User Floating Widgets")
async def get_user_widgets(
    current_user: User = Depends(require_oauth2_user),
    service: FloatingWidgetsService = Depends(get_widgets_service),
) -> list[FloatingWidgetResponse]:
    """
    Get all visible floating widgets for current user.
    """
    try:
        return await service.get_user_widgets(str(current_user.id))
    except Exception as e:
        logger.exception("Error getting user widgets")
        detail_msg = f"Failed to get widgets: {e!s}"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail_msg,
        ) from e


@router.get("/{widget_id}", response_model=FloatingWidgetResponse, summary="Get Floating Widget")
async def get_widget(
    widget_id: str,
    current_user: User = Depends(require_oauth2_user),
    service: FloatingWidgetsService = Depends(get_widgets_service),
) -> FloatingWidgetResponse:
    """
    Get specific floating widget by ID.
    """
    try:
        widget = await service.get_widget(widget_id, str(current_user.id))
        if not widget:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Widget not found")
        return widget
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error getting widget")
        detail_msg = f"Failed to get widget: {e!s}"
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=detail_msg) from e


@router.post("", response_model=FloatingWidgetResponse, summary="Create Floating Widget")
async def create_widget(
    widget: FloatingWidgetCreate,
    current_user: User = Depends(require_oauth2_user),
    service: FloatingWidgetsService = Depends(get_widgets_service),
) -> FloatingWidgetResponse:
    """
    Create a new floating widget for current user.
    """
    try:
        return await service.create_widget(widget, str(current_user.id))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except Exception as e:
        logger.exception("Error creating widget")
        detail_msg = f"Failed to create widget: {e!s}"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail_msg,
        ) from e


@router.post("/from-template", response_model=FloatingWidgetResponse, summary="Create Widget From Template")
async def create_widget_from_template(
    request: CreateWidgetFromTemplateRequest,
    current_user: User = Depends(require_oauth2_user),
    service: FloatingWidgetsService = Depends(get_widgets_service),
) -> FloatingWidgetResponse:
    """
    Create a floating widget from template with optional customizations.
    """
    try:
        return await service.create_widget_from_template(
            template_type=request.widget_type,
            widget_key=request.widget_key,
            user_id=str(current_user.id),
            title=request.title,
            icon_config_override=request.icon_config,
            data_config_override=request.data_config,
            display_config_override=request.display_config,
            settings=request.settings,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except Exception as e:
        logger.exception("Error creating widget from template")
        detail_msg = f"Failed to create widget: {e!s}"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail_msg,
        ) from e


@router.patch("/{widget_id}", response_model=FloatingWidgetResponse, summary="Update Floating Widget")
async def update_widget(
    widget_id: str,
    updates: FloatingWidgetUpdate,
    current_user: User = Depends(require_oauth2_user),
    service: FloatingWidgetsService = Depends(get_widgets_service),
) -> FloatingWidgetResponse:
    """
    Update floating widget (partial update).
    """
    try:
        updated_widget = await service.update_widget(widget_id, updates, str(current_user.id))
        if not updated_widget:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Widget not found")
        return updated_widget
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error updating widget")
        detail_msg = f"Failed to update widget: {e!s}"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail_msg,
        ) from e


@router.delete("/{widget_id}", summary="Delete Floating Widget")
async def delete_widget(
    widget_id: str,
    current_user: User = Depends(require_oauth2_user),
    service: FloatingWidgetsService = Depends(get_widgets_service),
) -> dict[str, str]:
    """
    Delete floating widget.
    """
    try:
        deleted = await service.delete_widget(widget_id, str(current_user.id))
        if not deleted:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Widget not found")
        return {"message": "Widget deleted", "id": widget_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error deleting widget")
        detail_msg = f"Failed to delete widget: {e!s}"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail_msg,
        ) from e
