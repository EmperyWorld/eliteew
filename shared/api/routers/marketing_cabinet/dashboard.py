# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   Interactive overview dashboard: layouts, widgets, presets (REST under marketing-
#   cabinet).
# Invariants:
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
# Related:
#   - shared/api/main.py (регистрация роутеров); см. затронутые services/models.
# ------------------------------------------------------------------------------
"""Interactive overview dashboard: layouts, widgets, presets (REST under marketing-cabinet).

Mutations call ``get_accessible_project(..., for_mutation=True)``; GET/list endpoints use
``for_mutation=False`` (Wave 5 / N.140). Contract tests assert this for representative routes.
"""

from __future__ import annotations

from uuid import UUID

import asyncpg  # type: ignore[import-not-found]
from fastapi import (  # type: ignore[import-untyped]
    APIRouter,
    Depends,
    Header,
    HTTPException,
    Query,
    Request,
    status,
)

from api.core.unified_config import unified_settings
from api.routers.marketing_cabinet.common import (
    get_accessible_project,
    get_marketing_db_pool,
    get_marketing_user_id,
)
from api.routers.marketing_cabinet.rate_limit import check_marketing_dashboard_write_rate_limit
from api.schemas.marketing_cabinet.dashboard import (
    ApplyDashboardLayoutTemplateBody,
    CloneDashboardLayoutBody,
    CreateLayoutFromPresetBody,
    DashboardActivateResponse,
    DashboardCleanupDuplicatesResponse,
    DashboardCloneResponse,
    DashboardLayoutCreate,
    DashboardLayoutImportEnvelope,
    DashboardLayoutListResponse,
    DashboardLayoutResponse,
    DashboardLayoutUpdate,
    DashboardUsageStats,
    MarketingDashboardPresetListResponse,
    MarketingDashboardPresetOut,
    WidgetCreate,
    WidgetResponse,
    WidgetUpdate,
)
from api.services.marketing_cabinet.dashboard_idempotency import (
    get_widget_create_idempotent_response,
    remember_widget_create_idempotent_response,
)
from api.services.marketing_cabinet.dashboard_service import (
    DASHBOARD_LAYOUT_EXPORT_SCHEMA_VERSION,
    DashboardService,
)

router = APIRouter(prefix="/projects/{project_id}")


async def _widget_layout_id_for_user(db_pool: asyncpg.Pool, widget_id: UUID, user_id: str) -> UUID | None:
    async with db_pool.acquire() as conn:
        await conn.execute("SELECT set_config('app.current_user_id', $1, FALSE)", user_id)
        val = await conn.fetchval(
            """
            SELECT layout_id FROM marketing_dashboard_widgets WHERE id = $1::uuid
            """,
            widget_id,
        )
    return val if val is not None else None


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


@router.get("/dashboard-presets", response_model=MarketingDashboardPresetListResponse)
async def list_dashboard_presets(
    project_id: UUID,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> MarketingDashboardPresetListResponse:
    await get_accessible_project(db_pool, project_id, user_id, for_mutation=False)
    raw = await _dash(db_pool).list_presets()
    items = [MarketingDashboardPresetOut.model_validate(r) for r in raw]
    return MarketingDashboardPresetListResponse.model_validate({"items": items})


@router.get("/dashboard-layouts", response_model=DashboardLayoutListResponse)
async def list_dashboard_layouts(
    project_id: UUID,
    name: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> DashboardLayoutListResponse:
    await get_accessible_project(db_pool, project_id, user_id, for_mutation=False)
    return DashboardLayoutListResponse.model_validate(
        await _dash(db_pool).list_layouts(
            str(user_id),
            project_id=project_id,
            name=name,
            page=page,
            per_page=per_page,
        )
    )


@router.get("/dashboard-layouts/active", response_model=DashboardLayoutResponse | None)
async def get_active_dashboard_layout(
    project_id: UUID,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> DashboardLayoutResponse | None:
    await get_accessible_project(db_pool, project_id, user_id, for_mutation=False)
    return await _dash(db_pool).get_active_layout(str(user_id), project_id=project_id)


@router.post("/dashboard-layouts/from-preset", response_model=DashboardLayoutResponse)
async def create_dashboard_layout_from_preset(
    project_id: UUID,
    body: CreateLayoutFromPresetBody,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> DashboardLayoutResponse:
    await get_accessible_project(db_pool, project_id, user_id, for_mutation=True)
    await _require_dashboard_write_budget(user_id, route="post_layout_from_preset")
    return DashboardLayoutResponse.model_validate(
        await _dash(db_pool).create_layout_from_preset(
            body.preset_name,
            str(user_id),
            project_id=project_id,
            custom_name=body.custom_name,
            rebuild_existing=body.rebuild_existing,
        )
    )


@router.post("/dashboard-layouts/import", response_model=DashboardLayoutResponse)
async def import_dashboard_layout(
    project_id: UUID,
    body: DashboardLayoutImportEnvelope,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> DashboardLayoutResponse:
    await get_accessible_project(db_pool, project_id, user_id, for_mutation=True)
    await _require_dashboard_write_budget(user_id, route="post_layout_import")
    if body.export_schema_version != DASHBOARD_LAYOUT_EXPORT_SCHEMA_VERSION:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Unsupported export schema version {body.export_schema_version}; "
                f"expected {DASHBOARD_LAYOUT_EXPORT_SCHEMA_VERSION}"
            ),
        )
    return DashboardLayoutResponse.model_validate(
        await _dash(db_pool).import_layout_from_export(
            layout_payload=body.layout,
            user_id=str(user_id),
            project_id=project_id,
        )
    )


@router.post("/dashboard-layouts/from-template", response_model=DashboardLayoutResponse)
async def apply_dashboard_layout_template(
    project_id: UUID,
    body: ApplyDashboardLayoutTemplateBody,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> DashboardLayoutResponse:
    """Apply a user-saved layout template to this project (new active custom layout)."""
    await get_accessible_project(db_pool, project_id, user_id, for_mutation=True)
    await _require_dashboard_write_budget(user_id, route="post_layout_from_template")
    return DashboardLayoutResponse.model_validate(
        await _dash(db_pool).apply_layout_template_to_project(
            template_layout_id=body.template_layout_id,
            user_id=str(user_id),
            target_project_id=project_id,
        )
    )


@router.post("/dashboard-layouts", response_model=DashboardLayoutResponse)
async def create_dashboard_layout(
    project_id: UUID,
    body: DashboardLayoutCreate,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> DashboardLayoutResponse:
    await get_accessible_project(db_pool, project_id, user_id, for_mutation=True)
    await _require_dashboard_write_budget(user_id, route="post_layout")
    if body.project_id is not None and body.project_id != project_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="project_id в теле запроса должен совпадать с project_id в пути",
        )
    payload = body.model_copy(update={"project_id": project_id})
    return DashboardLayoutResponse.model_validate(await _dash(db_pool).create_layout(payload, str(user_id)))


@router.get("/dashboard-layouts/{layout_id}", response_model=DashboardLayoutResponse)
async def get_dashboard_layout(
    project_id: UUID,
    layout_id: UUID,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> DashboardLayoutResponse:
    await get_accessible_project(db_pool, project_id, user_id, for_mutation=False)
    layout = await _dash(db_pool).get_layout(layout_id, str(user_id))
    if layout is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Макет не найден")
    if layout.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Макет не найден")
    return DashboardLayoutResponse.model_validate(layout)


@router.patch("/dashboard-layouts/{layout_id}", response_model=DashboardLayoutResponse)
async def update_dashboard_layout(
    project_id: UUID,
    layout_id: UUID,
    body: DashboardLayoutUpdate,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> DashboardLayoutResponse:
    await get_accessible_project(db_pool, project_id, user_id, for_mutation=True)
    await _require_dashboard_write_budget(user_id, route="patch_layout")
    existing = await _dash(db_pool).get_layout(layout_id, str(user_id))
    if existing is None or existing.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Макет не найден")
    updated = await _dash(db_pool).update_layout(layout_id, body, str(user_id))
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Макет не найден")
    return DashboardLayoutResponse.model_validate(updated)


@router.delete("/dashboard-layouts/{layout_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dashboard_layout(
    project_id: UUID,
    layout_id: UUID,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> None:
    await get_accessible_project(db_pool, project_id, user_id, for_mutation=True)
    await _require_dashboard_write_budget(user_id, route="delete_layout")
    existing = await _dash(db_pool).get_layout(layout_id, str(user_id))
    if existing is None or existing.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Макет не найден")
    deleted = await _dash(db_pool).delete_layout(layout_id, str(user_id))
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Макет не найден")


@router.post("/dashboard-layouts/{layout_id}/activate", response_model=DashboardActivateResponse)
async def activate_dashboard_layout(
    project_id: UUID,
    layout_id: UUID,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> DashboardActivateResponse:
    await get_accessible_project(db_pool, project_id, user_id, for_mutation=True)
    await _require_dashboard_write_budget(user_id, route="post_layout_activate")
    existing = await _dash(db_pool).get_layout(layout_id, str(user_id))
    if existing is None or existing.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Макет не найден")
    return DashboardActivateResponse.model_validate(
        await _dash(db_pool).activate_layout(layout_id, str(user_id), project_id=project_id)
    )


@router.post("/dashboard-layouts/{layout_id}/clone", response_model=DashboardCloneResponse)
async def clone_dashboard_layout(
    project_id: UUID,
    layout_id: UUID,
    body: CloneDashboardLayoutBody,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> DashboardCloneResponse:
    await get_accessible_project(db_pool, project_id, user_id, for_mutation=True)
    await _require_dashboard_write_budget(user_id, route="post_layout_clone")
    existing = await _dash(db_pool).get_layout(layout_id, str(user_id))
    if existing is None or existing.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Макет не найден")
    return DashboardCloneResponse.model_validate(
        await _dash(db_pool).clone_layout(layout_id, body.new_name, str(user_id))
    )


@router.post("/dashboard-layouts/widgets", response_model=WidgetResponse)
async def add_dashboard_widget(
    request: Request,
    project_id: UUID,
    body: WidgetCreate,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> WidgetResponse:
    await get_accessible_project(db_pool, project_id, user_id, for_mutation=True)
    max_b = unified_settings.marketing_dashboard_post_widget_max_bytes
    cl_header = request.headers.get("content-length")
    if cl_header is not None:
        try:
            if int(cl_header) > max_b:
                raise HTTPException(
                    status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                    detail="Слишком большое тело запроса для добавления виджета",
                )
        except ValueError:
            pass
    await _require_dashboard_write_budget(user_id, route="post_widget")
    cached = await get_widget_create_idempotent_response(str(user_id), idempotency_key)
    if cached is not None:
        return WidgetResponse.model_validate(cached)
    parent = await _dash(db_pool).get_layout(body.layout_id, str(user_id))
    if parent is None or parent.project_id != project_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Макет не найден или не принадлежит этому проекту",
        )
    created = await _dash(db_pool).add_widget(body, str(user_id))
    await remember_widget_create_idempotent_response(str(user_id), idempotency_key, created)
    return WidgetResponse.model_validate(created)


@router.patch("/dashboard-widgets/{widget_id}", response_model=WidgetResponse)
async def update_dashboard_widget(
    project_id: UUID,
    widget_id: UUID,
    body: WidgetUpdate,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> WidgetResponse:
    await get_accessible_project(db_pool, project_id, user_id, for_mutation=True)
    await _require_dashboard_write_budget(user_id, route="patch_widget")
    updated = await _dash(db_pool).update_widget(widget_id, body, str(user_id))
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Виджет не найден")
    parent = await _dash(db_pool).get_layout(updated.layout_id, str(user_id))
    if parent is None or parent.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Виджет не найден")
    return WidgetResponse.model_validate(updated)


@router.delete("/dashboard-widgets/{widget_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dashboard_widget(
    project_id: UUID,
    widget_id: UUID,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> None:
    await get_accessible_project(db_pool, project_id, user_id, for_mutation=True)
    await _require_dashboard_write_budget(user_id, route="delete_widget")
    uid = str(user_id)
    layout_id = await _widget_layout_id_for_user(db_pool, widget_id, uid)
    if layout_id is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Виджет не найден")
    svc = _dash(db_pool)
    parent = await svc.get_layout(layout_id, uid)
    if parent is None or parent.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Виджет не найден")
    deleted = await svc.delete_widget(widget_id, uid)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Виджет не найден")


@router.post("/dashboard-widgets/cleanup-duplicates", response_model=DashboardCleanupDuplicatesResponse)
async def cleanup_dashboard_duplicate_widgets(
    project_id: UUID,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> DashboardCleanupDuplicatesResponse:
    await get_accessible_project(db_pool, project_id, user_id, for_mutation=True)
    await _require_dashboard_write_budget(user_id, route="post_cleanup_duplicates")
    return DashboardCleanupDuplicatesResponse.model_validate(
        await _dash(db_pool).cleanup_duplicate_widgets(str(user_id))
    )


@router.get("/dashboard-usage-stats", response_model=DashboardUsageStats)
async def get_dashboard_usage_stats(
    project_id: UUID,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> DashboardUsageStats:
    await get_accessible_project(db_pool, project_id, user_id, for_mutation=False)
    return DashboardUsageStats.model_validate(await _dash(db_pool).get_usage_stats(str(user_id), project_id=project_id))
