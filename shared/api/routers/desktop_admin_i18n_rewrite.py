# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Admin API for i18n copy rewrite via stack2 (preview, probe batch, meta).
# Invariants:
# - require_admin_user on all routes; writes only when service allow_write.
# Related:
# - api/services/i18n_rewrite_stack2_service.py
# - shared/tools/i18n_rewriter/stack2_service.py
# - documentation/platform/I18N-REWRITE-STACK2.md
# ---

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from api.core.auth import User as AuthUser
from api.routers.desktop_admin import require_admin_user
from api.shared_tools_path import ensure_shared_tools_import_path

ensure_shared_tools_import_path()

from i18n_rewriter import stack2_service as i18n_rewrite_stack2

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/i18n-rewrite", tags=["desktop-admin-i18n-rewrite"])


class PreviewBody(BaseModel):
    spec_id: str = Field(..., min_length=1)
    target_id: str = Field(..., min_length=1)
    only_prefix: str | None = None
    batch_size: int = Field(default=32, ge=1, le=64)


class RunBatchBody(PreviewBody):
    batch_index: int = Field(default=1, ge=1, le=500)
    temperature: float = Field(default=0.35, ge=0.0, le=1.5)


@router.get("/meta")
async def get_i18n_rewrite_meta(
    _admin: AuthUser = Depends(require_admin_user),
) -> dict:
    return i18n_rewrite_stack2.admin_meta()


@router.post("/preview")
async def preview_i18n_rewrite(
    body: PreviewBody,
    _admin: AuthUser = Depends(require_admin_user),
) -> dict:
    try:
        return i18n_rewrite_stack2.build_preview(
            spec_id=body.spec_id,
            target_id=body.target_id,
            only_prefix=body.only_prefix,
            batch_size=body.batch_size,
        )
    except (ValueError, TypeError, FileNotFoundError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


@router.post("/run-batch")
async def run_i18n_rewrite_batch(
    body: RunBatchBody,
    _admin: AuthUser = Depends(require_admin_user),
) -> dict:
    meta = i18n_rewrite_stack2.admin_meta()
    if not meta.get("enabled"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="i18n rewrite unavailable on this host (no repo root)",
        )
    stack2 = meta.get("stack2") or {}
    if not stack2.get("ok"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=stack2.get("error") or "stack2 llama-chat is not reachable",
        )
    try:
        return i18n_rewrite_stack2.run_single_batch(
            spec_id=body.spec_id,
            target_id=body.target_id,
            only_prefix=body.only_prefix,
            batch_size=body.batch_size,
            batch_index=body.batch_index,
            temperature=body.temperature,
        )
    except (ValueError, TypeError, FileNotFoundError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except RuntimeError as exc:
        logger.warning("[STEP] i18n_rewrite_run_batch_failed: %s", exc)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
