# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# EBrowser policy API: self GET effective + admin CRUD per user.
# Invariants:
# - Admin write via require_admin_user; users cannot write own policy.
# - Modes exclusive; validation errors map to 400.
# Related:
# - documentation/product/desktop/DESKTOP-EBROWSER.md
# - api/services/ebrowser/policy_store.py
# ---

from __future__ import annotations

from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.auth import User as AuthUser
from api.core.database_manager import get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.routers.admin_auth import require_admin_user
from api.services.ebrowser.policy_store import (
    EBrowserPolicyValidationError,
    get_effective_policy,
    upsert_policy,
    user_exists,
)

router = APIRouter(prefix="/ebrowser", tags=["EBrowser"])


class EBrowserPolicyResponse(BaseModel):
    user_id: str
    mode: Literal["open", "allowlist", "denylist"]
    allow: list[str]
    deny: list[str]
    ttl_seconds: int
    fetched_at: str
    expires_at: str
    is_default: bool = False


class EBrowserPolicyPut(BaseModel):
    mode: Literal["open", "allowlist", "denylist"]
    allow: list[str] = Field(default_factory=list)
    deny: list[str] = Field(default_factory=list)


async def _desktop_user_id(
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> UUID:
    from api.routers.desktop import get_desktop_user_id

    return await get_desktop_user_id(current_user=current_user, db=db)


@router.get("/policy", response_model=EBrowserPolicyResponse)
async def get_own_ebrowser_policy(
    user_id: UUID = Depends(_desktop_user_id),
    db: AsyncSession = Depends(get_postgres_session),
) -> EBrowserPolicyResponse:
    payload = await get_effective_policy(db, user_id)
    return EBrowserPolicyResponse(**payload)


@router.get(
    "/admin/users/{target_user_id}/policy",
    response_model=EBrowserPolicyResponse,
)
async def admin_get_ebrowser_policy(
    target_user_id: UUID,
    _admin: AuthUser = Depends(require_admin_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> EBrowserPolicyResponse:
    if not await user_exists(db, target_user_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="user_not_found")
    payload = await get_effective_policy(db, target_user_id)
    return EBrowserPolicyResponse(**payload)


@router.put(
    "/admin/users/{target_user_id}/policy",
    response_model=EBrowserPolicyResponse,
)
async def admin_put_ebrowser_policy(
    target_user_id: UUID,
    body: EBrowserPolicyPut,
    _admin: AuthUser = Depends(require_admin_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> EBrowserPolicyResponse:
    if not await user_exists(db, target_user_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="user_not_found")
    try:
        payload = await upsert_policy(
            db,
            target_user_id,
            mode=body.mode,
            allow=body.allow,
            deny=body.deny,
        )
    except EBrowserPolicyValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=exc.code,
        ) from exc
    return EBrowserPolicyResponse(**payload)
