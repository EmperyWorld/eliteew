# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Owner-only broken-files API: list, storage-recheck, permanent-delete.
# Invariants:
# - Mounted without extra prefix under unified_content parent.
# - Permanent delete is immediate hard-purge (not soft retention).
# Related:
# - documentation/product/CONTENT-BROKEN-FILES-AND-WEBP-DISPLAY.md
# ---

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query  # type: ignore[import-untyped]
from starlette import status

from api.core.oauth2_auth import require_oauth2_user
from api.dependencies.user_context import get_current_user_db_id as get_content_user_id
from api.models import User
from api.routers.unified_content_deps import (
    _STORAGE_OBJECT_UNAVAILABLE_DETAIL,
    _STORAGE_TEMPORARILY_UNAVAILABLE_DETAIL,
    _raise_internal_server_error,
    get_content_service,
)
from api.services.unified_content.content_storage_service import ContentStorageService
from api.services.unified_content.storage_backends.minio_storage import SeaweedStorageUnavailableError

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Unified Content"])


@router.get("/content/broken")
async def list_broken_content(
    current_user: User = Depends(require_oauth2_user),
    content_user_id: str = Depends(get_content_user_id),
    service: ContentStorageService = Depends(get_content_service),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> dict[str, Any]:
    """Owner-only list of storage-quarantined (broken) content."""
    try:
        return await service.list_broken_content(content_user_id, limit=limit, offset=offset)
    except Exception as exc:
        _raise_internal_server_error("list_broken_content", exc)
        raise  # pragma: no cover


@router.post("/content/broken/scan")
async def scan_broken_content(
    current_user: User = Depends(require_oauth2_user),
    content_user_id: str = Depends(get_content_user_id),
    service: ContentStorageService = Depends(get_content_service),
    dry_run: bool = Query(True),
    limit: int = Query(200, ge=1, le=2000),
) -> dict[str, Any]:
    """Owner one-shot orphan scan → broken_quarantined (default dry_run)."""
    try:
        return await service.owner_scan_storage_orphans(
            content_user_id,
            dry_run=dry_run,
            limit=limit,
        )
    except Exception as exc:
        _raise_internal_server_error("scan_broken_content", exc)
        raise  # pragma: no cover


@router.post("/content/{content_id:uuid}/storage-recheck")
async def storage_recheck_content(
    content_id: UUID,
    current_user: User = Depends(require_oauth2_user),
    content_user_id: str = Depends(get_content_user_id),
    service: ContentStorageService = Depends(get_content_service),
) -> dict[str, Any]:
    """Owner fail-fast probe: clear quarantine if Seaweed object is readable."""
    try:
        return await service.storage_recheck(content_id, content_user_id)
    except SeaweedStorageUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=_STORAGE_TEMPORARILY_UNAVAILABLE_DETAIL,
        ) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except Exception as exc:
        _raise_internal_server_error("storage_recheck_content", exc)
        raise  # pragma: no cover


@router.post("/content/{content_id:uuid}/permanent-delete")
async def permanent_delete_content(
    content_id: UUID,
    current_user: User = Depends(require_oauth2_user),
    content_user_id: str = Depends(get_content_user_id),
    service: ContentStorageService = Depends(get_content_service),
) -> dict[str, Any]:
    """Owner immediate hard-purge (PG + Seaweed + best-effort indexes)."""
    try:
        return await service.permanent_delete_broken(content_id, content_user_id)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=_STORAGE_OBJECT_UNAVAILABLE_DETAIL,
        ) from exc
    except Exception as exc:
        _raise_internal_server_error("permanent_delete_content", exc)
        raise  # pragma: no cover
