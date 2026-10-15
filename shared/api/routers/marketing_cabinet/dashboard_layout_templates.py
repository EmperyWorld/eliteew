# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   User dashboard layout templates: saved layouts (``project_id`` NULL) and save-from-
#   project.
# Invariants:
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
# Related:
#   - shared/api/main.py (регистрация роутеров); см. затронутые services/models.
# ------------------------------------------------------------------------------
"""User dashboard layout templates: saved layouts (``project_id`` NULL) and save-from-project."""

from __future__ import annotations

from uuid import UUID

import asyncpg  # type: ignore[import-not-found]
from fastapi import (  # type: ignore[import-untyped]
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status,
)

from api.routers.marketing_cabinet.common import (
    get_accessible_project,
    get_marketing_db_pool,
    get_marketing_user_id,
)
from api.routers.marketing_cabinet.rate_limit import check_marketing_dashboard_write_rate_limit
from api.schemas.marketing_cabinet.dashboard import (
    DashboardLayoutListResponse,
    DashboardLayoutResponse,
    SaveDashboardLayoutTemplateBody,
)
from api.services.marketing_cabinet.dashboard_service import DashboardService

router = APIRouter()


def _dash(db_pool: asyncpg.Pool) -> DashboardService:
    return DashboardService(db_pool)


async def _require_dashboard_write_budget(user_id: UUID, *, route: str) -> None:
    allowed, retry_after = await check_marketing_dashboard_write_rate_limit(str(user_id), route=route)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Слишком частые изменения дашборда. Подождите немного и повторите.",
            headers={"Retry-After": str(int(retry_after or 1))},
        )


@router.get("/dashboard-layout-templates", response_model=DashboardLayoutListResponse)
async def list_dashboard_layout_templates(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=100),
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> DashboardLayoutListResponse:
    """List the current user's saved layout templates (not bound to a project)."""
    return DashboardLayoutListResponse.model_validate(
        await _dash(db_pool).list_layout_templates(str(user_id), page=page, per_page=per_page)
    )


@router.post(
    "/dashboard-layout-templates/from-project/{project_id}",
    response_model=DashboardLayoutResponse,
)
async def save_dashboard_layout_template_from_project(
    project_id: UUID,
    body: SaveDashboardLayoutTemplateBody,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> DashboardLayoutResponse:
    """Save the active dashboard layout of ``project_id`` as a user template."""
    await get_accessible_project(db_pool, project_id, user_id, for_mutation=True)
    await _require_dashboard_write_budget(user_id, route="post_layout_template_save")
    return DashboardLayoutResponse.model_validate(
        await _dash(db_pool).save_active_layout_as_template(
            user_id=str(user_id),
            source_project_id=project_id,
            name=body.name,
            description=body.description,
        )
    )


@router.delete("/dashboard-layout-templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dashboard_layout_template(
    template_id: UUID,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> None:
    """Delete a user layout template by id."""
    await _require_dashboard_write_budget(user_id, route="delete_layout_template")
    await _dash(db_pool).delete_layout_template(template_id, str(user_id))
