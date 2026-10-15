# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Gated desktop admin routes to seed and teardown Content Manager E2E fixtures.
# Invariants:
# - Disabled unless CONTENT_E2E_SEED_ENABLED is truthy; admin RBAC always required.
# Related:
# - api/services/unified_content/content_e2e_fixture_service.py
# - api/routers/desktop_admin.py
# ---

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from api.core.auth import User as AuthUser
from api.core.database_manager import get_asyncpg_pool
from api.routers.admin_auth import require_admin_user
from api.services.unified_content.content_e2e_fixture_service import (
    CONTENT_E2E_SEED_ENV,
    seed_content_e2e_fixtures,
    teardown_content_e2e_fixtures,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/content-e2e", tags=["desktop-admin-content-e2e"])


class ContentE2ESeedBody(BaseModel):
    count: int = Field(default=2, ge=1, le=10)


class ContentE2ESeedResponse(BaseModel):
    session_id: str
    seeded_content_ids: list[str]
    count: int


class ContentE2ETeardownResponse(BaseModel):
    session_id: str | None
    deleted_content_ids: list[str]
    count: int


def _require_e2e_gate() -> None:
    from api.services.unified_content.content_e2e_fixture_service import (  # noqa: PLC0415
        content_e2e_seed_enabled,
    )

    if not content_e2e_seed_enabled():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Content E2E seed routes are disabled; set {CONTENT_E2E_SEED_ENV}=1",
        )


@router.post("/seed", response_model=ContentE2ESeedResponse)
async def post_content_e2e_seed(
    body: ContentE2ESeedBody,
    pool=Depends(get_asyncpg_pool),
    admin: AuthUser = Depends(require_admin_user),
) -> ContentE2ESeedResponse:
    _require_e2e_gate()
    try:
        payload = await seed_content_e2e_fixtures(pool, actor_user_id=admin.id, count=body.count)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    logger.info("[STEP] content_e2e_seed_route actor=%s count=%s", admin.id, body.count)
    return ContentE2ESeedResponse.model_validate(payload)


@router.delete("/teardown", response_model=ContentE2ETeardownResponse)
async def delete_content_e2e_teardown(
    session_id: str | None = Query(default=None, max_length=128),
    pool=Depends(get_asyncpg_pool),
    admin: AuthUser = Depends(require_admin_user),
) -> ContentE2ETeardownResponse:
    _ = admin
    _require_e2e_gate()
    try:
        payload = await teardown_content_e2e_fixtures(pool, session_id=session_id)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    logger.info("[STEP] content_e2e_teardown_route session=%s", session_id)
    return ContentE2ETeardownResponse.model_validate(payload)
