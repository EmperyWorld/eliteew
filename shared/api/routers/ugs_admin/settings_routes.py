# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
#   UGS Admin scoped settings CRUD routes.
# Invariants:
#   - All routes require ``require_ugs_admin_user``; duplicate scope/key tuples rejected on create.
# Related:
#   - api/models/database_models.UGSSetting
#   - api/schemas/ugs_admin.py
# ---

from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status  # type: ignore[import-untyped]
from fastapi.responses import Response  # type: ignore[import-untyped]
from sqlalchemy import select  # type: ignore[import-untyped]

from api.core.database_manager import get_postgres_session
from api.models.database_models import UGSSetting
from api.routers.ugs_admin._helpers import model_to_response
from api.schemas.ugs_admin import (
    UGSSettingCreate,
    UGSSettingListResponse,
    UGSSettingResponse,
    UGSSettingUpdate,
)
from api.services.ugs.admin_access import require_ugs_admin_user

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

    from api.core.auth import User as AuthUser


def register_settings_routes(router: APIRouter) -> None:
    @router.get("/settings", response_model=UGSSettingListResponse)
    async def list_ugs_settings(
        scope: str | None = Query(None, description="Filter by scope"),
        company_id: UUID | None = Query(None),  # noqa: B008
        project_id: UUID | None = Query(None),  # noqa: B008
        user_id: UUID | None = Query(None),  # noqa: B008
        _: AuthUser = Depends(require_ugs_admin_user),  # noqa: B008
        db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    ) -> UGSSettingListResponse:
        stmt = select(UGSSetting)
        if scope:
            stmt = stmt.where(UGSSetting.scope == scope)
        if company_id:
            stmt = stmt.where(UGSSetting.company_id == company_id)
        if project_id:
            stmt = stmt.where(UGSSetting.project_id == project_id)
        if user_id:
            stmt = stmt.where(UGSSetting.user_id == user_id)

        stmt = stmt.order_by(UGSSetting.updated_at.desc())
        result = await db.execute(stmt)
        settings = result.scalars().all()
        return UGSSettingListResponse(
            items=[model_to_response(setting, UGSSettingResponse) for setting in settings],
            total=len(settings),
        )

    @router.post("/settings", response_model=UGSSettingResponse, status_code=status.HTTP_201_CREATED)
    async def create_ugs_setting(
        payload: UGSSettingCreate,
        _: AuthUser = Depends(require_ugs_admin_user),  # noqa: B008
        db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    ) -> UGSSettingResponse:
        data = payload.model_dump()

        stmt = select(UGSSetting).where(
            UGSSetting.scope == data["scope"],
            UGSSetting.key == data["key"],
            UGSSetting.company_id == data.get("company_id"),
            UGSSetting.project_id == data.get("project_id"),
            UGSSetting.user_id == data.get("user_id"),
        )
        existing = await db.execute(stmt)
        if existing.scalar_one_or_none():
            msg = "Такая настройка уже существует. Используйте обновление."
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=msg)

        setting = UGSSetting(**data)
        db.add(setting)
        await db.commit()
        await db.refresh(setting)
        return model_to_response(setting, UGSSettingResponse)

    @router.put("/settings/{setting_id}", response_model=UGSSettingResponse)
    async def update_ugs_setting(
        setting_id: UUID,
        payload: UGSSettingUpdate,
        _: AuthUser = Depends(require_ugs_admin_user),  # noqa: B008
        db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    ) -> UGSSettingResponse:
        result = await db.execute(select(UGSSetting).where(UGSSetting.id == setting_id))
        setting = result.scalar_one_or_none()
        if not setting:
            msg = "Настройка не найдена."
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)

        update_data = payload.model_dump(exclude_unset=True, mode="json")
        for field, value in update_data.items():
            setattr(setting, field, value)

        await db.commit()
        await db.refresh(setting)
        return model_to_response(setting, UGSSettingResponse)

    @router.delete("/settings/{setting_id}", status_code=status.HTTP_204_NO_CONTENT)
    async def delete_ugs_setting(
        setting_id: UUID,
        _: AuthUser = Depends(require_ugs_admin_user),  # noqa: B008
        db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    ) -> Response:
        result = await db.execute(select(UGSSetting).where(UGSSetting.id == setting_id))
        setting = result.scalar_one_or_none()
        if not setting:
            msg = "Настройка не найдена."
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)

        await db.delete(setting)
        await db.commit()
        return Response(status_code=status.HTTP_204_NO_CONTENT)
