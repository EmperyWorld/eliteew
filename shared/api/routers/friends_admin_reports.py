# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Admin HTTP API for Social Hub user-report moderation queue.
# Invariants:
# - All routes require require_admin_user (admin | emperyworld_admin).
# - Responses are summary-only; no private notes or chat bodies.
# Related:
# - api/services/friends/reports_admin.py
# - documentation/product/SOCIAL-HUB.md
# ---

from __future__ import annotations

import logging
from uuid import UUID

import asyncpg  # type: ignore[import-not-found,import-untyped]
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from api.core.auth import User as AuthUser
from api.core.database_manager import get_asyncpg_pool
from api.routers.admin_auth import require_admin_user
from api.services.friends.reports_admin import (
    VALID_REPORT_STATUSES,
    FriendsReportsAdminOps,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Friends Admin"])


class SocialReportAdminItem(BaseModel):
    id: str
    reporter_user_id: str
    reported_user_id: str
    reason: str
    details: str | None = None
    status: str
    created_at: str | None = None
    reviewed_at: str | None = None
    reviewer_user_id: str | None = None
    reporter_username: str | None = None
    reporter_display_name: str
    reported_username: str | None = None
    reported_display_name: str
    reviewer_username: str | None = None


class SocialReportAdminListOut(BaseModel):
    items: list[SocialReportAdminItem]
    total: int


class SocialReportAdminPatchBody(BaseModel):
    status: str = Field(..., min_length=1, max_length=32)


async def get_friends_reports_admin_ops(
    db_pool: asyncpg.Pool = Depends(get_asyncpg_pool),
) -> FriendsReportsAdminOps:
    return FriendsReportsAdminOps(db_pool)


@router.get("/admin/reports", response_model=SocialReportAdminListOut)
async def admin_list_social_reports(
    status_filter: str | None = Query(None, alias="status"),
    q: str | None = Query(None, max_length=200),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    _admin: AuthUser = Depends(require_admin_user),
    ops: FriendsReportsAdminOps = Depends(get_friends_reports_admin_ops),
) -> SocialReportAdminListOut:
    try:
        payload = await ops.list_reports(
            status_filter=status_filter,
            q=q,
            limit=limit,
            offset=offset,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return SocialReportAdminListOut(
        items=[SocialReportAdminItem.model_validate(item) for item in payload["items"]],
        total=int(payload["total"]),
    )


@router.get("/admin/reports/{report_id}", response_model=SocialReportAdminItem)
async def admin_get_social_report(
    report_id: UUID,
    _admin: AuthUser = Depends(require_admin_user),
    ops: FriendsReportsAdminOps = Depends(get_friends_reports_admin_ops),
) -> SocialReportAdminItem:
    try:
        item = await ops.get_report(str(report_id))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return SocialReportAdminItem.model_validate(item)


@router.patch("/admin/reports/{report_id}", response_model=SocialReportAdminItem)
async def admin_patch_social_report(
    report_id: UUID,
    body: SocialReportAdminPatchBody,
    admin: AuthUser = Depends(require_admin_user),
    ops: FriendsReportsAdminOps = Depends(get_friends_reports_admin_ops),
) -> SocialReportAdminItem:
    if body.status not in VALID_REPORT_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid status",
        )
    try:
        item = await ops.patch_report(
            str(report_id),
            status=body.status,
            reviewer_user_id=str(admin.id),
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return SocialReportAdminItem.model_validate(item)
