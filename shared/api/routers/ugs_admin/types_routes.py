# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
#   UGS Admin generation type CRUD routes.
# Invariants:
#   - All routes require ``require_ugs_admin_user``.
# Related:
#   - api/services/ugs/generation_type_service.py
#   - api/models/database_models.GenerationType
# ---

from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import APIRouter, Depends, HTTPException, Query, status  # type: ignore[import-untyped]
from fastapi.responses import Response  # type: ignore[import-untyped]
from sqlalchemy import select  # type: ignore[import-untyped]

from api.core.database_manager import get_postgres_session
from api.models.database_models import GenerationType
from api.routers.ugs_admin._helpers import humanize_admin_detail, model_to_response
from api.schemas.ugs_admin import (
    AdminGenerationTypeResponse,
    GenerationTypeCreate,
    GenerationTypeUpdate,
)
from api.services.ugs.admin_access import require_ugs_admin_user
from api.services.ugs.generation_type_service import GenerationTypeService

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

    from api.core.auth import User as AuthUser


def register_types_routes(router: APIRouter) -> None:
    @router.get("/types", response_model=list[AdminGenerationTypeResponse])
    async def list_generation_types(
        include_inactive: bool = Query(default=True, description="Include deactivated generation types"),
        _: AuthUser = Depends(require_ugs_admin_user),  # noqa: B008
        db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    ) -> list[AdminGenerationTypeResponse]:
        stmt = select(GenerationType)
        if not include_inactive:
            stmt = stmt.where(GenerationType.is_active == True)  # noqa: E712
        stmt = stmt.order_by(GenerationType.category, GenerationType.type_key)
        result = await db.execute(stmt)
        items = result.scalars().all()
        return [model_to_response(item, AdminGenerationTypeResponse) for item in items]

    @router.get("/types/{type_key}", response_model=AdminGenerationTypeResponse)
    async def get_generation_type(
        type_key: str,
        _: AuthUser = Depends(require_ugs_admin_user),  # noqa: B008
        db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    ) -> AdminGenerationTypeResponse:
        result = await db.execute(select(GenerationType).where(GenerationType.type_key == type_key))
        generation_type = result.scalar_one_or_none()
        if generation_type is None:
            msg = "Тип генерации не найден."
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)
        return model_to_response(generation_type, AdminGenerationTypeResponse)

    @router.post("/types", response_model=AdminGenerationTypeResponse, status_code=status.HTTP_201_CREATED)
    async def create_generation_type(
        payload: GenerationTypeCreate,
        _: AuthUser = Depends(require_ugs_admin_user),  # noqa: B008
        db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    ) -> AdminGenerationTypeResponse:
        service = GenerationTypeService(db)
        try:
            generation_type = await service.create_type(payload.model_dump(mode="json"))
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=humanize_admin_detail(str(exc)),
            ) from exc
        return model_to_response(generation_type, AdminGenerationTypeResponse)

    @router.put("/types/{type_key}", response_model=AdminGenerationTypeResponse)
    async def update_generation_type(
        type_key: str,
        payload: GenerationTypeUpdate,
        _: AuthUser = Depends(require_ugs_admin_user),  # noqa: B008
        db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    ) -> AdminGenerationTypeResponse:
        result = await db.execute(select(GenerationType).where(GenerationType.type_key == type_key))
        generation_type = result.scalar_one_or_none()
        if generation_type is None:
            msg = "Тип генерации не найден."
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)

        update_data = payload.model_dump(exclude_unset=True, mode="json")
        if "metadata" in update_data:
            update_data["type_metadata"] = update_data.pop("metadata")

        for field, value in update_data.items():
            setattr(generation_type, field, value)

        await db.commit()
        await db.refresh(generation_type)
        return model_to_response(generation_type, AdminGenerationTypeResponse)

    @router.delete("/types/{type_key}", status_code=status.HTTP_204_NO_CONTENT)
    async def delete_generation_type(
        type_key: str,
        _: AuthUser = Depends(require_ugs_admin_user),  # noqa: B008
        db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    ) -> Response:
        result = await db.execute(select(GenerationType).where(GenerationType.type_key == type_key))
        generation_type = result.scalar_one_or_none()
        if generation_type is None:
            msg = "Тип генерации не найден."
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)

        await db.delete(generation_type)
        await db.commit()
        return Response(status_code=status.HTTP_204_NO_CONTENT)
