# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
#   UGS Admin ComfyUI workflow CRUD and disk import routes.
# Invariants:
#   - All routes require ``require_ugs_admin_user``; slug uniqueness enforced on create.
# Related:
#   - api/services/ugs/comfyui_workflow_catalog.py
#   - api/models/database_models.ComfyUIWorkflow
# ---

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status  # type: ignore[import-untyped]
from fastapi.responses import Response  # type: ignore[import-untyped]
from sqlalchemy import select  # type: ignore[import-untyped]

from api.core.database_manager import get_postgres_session
from api.models.database_models import ComfyUIWorkflow
from api.routers.ugs_admin._helpers import model_to_response, parse_uuid
from api.schemas.ugs_admin import (
    ComfyUIWorkflowCreate,
    ComfyUIWorkflowResponse,
    ComfyUIWorkflowUpdate,
)
from api.services.ugs.admin_access import require_ugs_admin_user
from api.services.ugs.comfyui_workflow_catalog import import_comfyui_workflows_from_disk

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

    from api.core.auth import User as AuthUser


def register_workflows_routes(router: APIRouter) -> None:
    @router.get("/workflows", response_model=list[ComfyUIWorkflowResponse])
    async def list_comfyui_workflows(
        *,
        include_inactive: bool = Query(default=False, description="Include deactivated workflows"),
        _: AuthUser = Depends(require_ugs_admin_user),  # noqa: B008
        db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    ) -> list[ComfyUIWorkflowResponse]:
        stmt = select(ComfyUIWorkflow)
        if not include_inactive:
            stmt = stmt.where(ComfyUIWorkflow.is_active == True)  # noqa: E712
        stmt = stmt.order_by(ComfyUIWorkflow.name)
        result = await db.execute(stmt)
        workflows = result.scalars().all()
        return [model_to_response(workflow, ComfyUIWorkflowResponse) for workflow in workflows]

    @router.get("/workflows/{slug}", response_model=ComfyUIWorkflowResponse)
    async def get_comfyui_workflow(
        slug: str,
        _: AuthUser = Depends(require_ugs_admin_user),  # noqa: B008
        db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    ) -> ComfyUIWorkflowResponse:
        result = await db.execute(select(ComfyUIWorkflow).where(ComfyUIWorkflow.slug == slug))
        workflow = result.scalar_one_or_none()
        if not workflow:
            msg = "Воркфлоу не найден."
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)
        return model_to_response(workflow, ComfyUIWorkflowResponse)

    @router.post("/workflows", response_model=ComfyUIWorkflowResponse, status_code=status.HTTP_201_CREATED)
    async def create_comfyui_workflow(
        payload: ComfyUIWorkflowCreate,
        current_user: AuthUser = Depends(require_ugs_admin_user),  # noqa: B008
        db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    ) -> ComfyUIWorkflowResponse:
        existing = await db.execute(select(ComfyUIWorkflow).where(ComfyUIWorkflow.slug == payload.slug))
        if existing.scalar_one_or_none():
            msg = "Этот slug уже занят."
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=msg)

        data = payload.model_dump()
        metadata = data.pop("metadata", {})
        created_by_uuid = parse_uuid(str(current_user.id))  # type: ignore[arg-type]
        workflow = ComfyUIWorkflow(**data, meta_data=metadata, created_by=created_by_uuid)
        db.add(workflow)
        await db.commit()
        await db.refresh(workflow)
        return model_to_response(workflow, ComfyUIWorkflowResponse)

    @router.post("/workflows/import-from-disk")
    async def import_comfyui_workflows(
        overwrite_existing: bool = Query(
            default=True,
            description="Refresh existing DB records when the source JSON has changed",
        ),
        current_user: AuthUser = Depends(require_ugs_admin_user),  # noqa: B008
        db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    ) -> dict[str, Any]:
        created_by_uuid = parse_uuid(str(current_user.id))  # type: ignore[arg-type]
        return await import_comfyui_workflows_from_disk(
            db,
            created_by=created_by_uuid,
            overwrite_existing=overwrite_existing,
        )

    @router.put("/workflows/{slug}", response_model=ComfyUIWorkflowResponse)
    async def update_comfyui_workflow(
        slug: str,
        payload: ComfyUIWorkflowUpdate,
        _: AuthUser = Depends(require_ugs_admin_user),  # noqa: B008
        db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    ) -> ComfyUIWorkflowResponse:
        result = await db.execute(select(ComfyUIWorkflow).where(ComfyUIWorkflow.slug == slug))
        workflow = result.scalar_one_or_none()
        if not workflow:
            msg = "Воркфлоу не найден."
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)

        update_data = payload.model_dump(exclude_unset=True, mode="json")
        metadata = update_data.pop("metadata", None)
        for field, value in update_data.items():
            setattr(workflow, field, value)
        if metadata is not None:
            workflow.meta_data = metadata

        await db.commit()
        await db.refresh(workflow)
        return model_to_response(workflow, ComfyUIWorkflowResponse)

    @router.delete("/workflows/{slug}", status_code=status.HTTP_204_NO_CONTENT)
    async def delete_comfyui_workflow(
        slug: str,
        _: AuthUser = Depends(require_ugs_admin_user),  # noqa: B008
        db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    ) -> Response:
        result = await db.execute(select(ComfyUIWorkflow).where(ComfyUIWorkflow.slug == slug))
        workflow = result.scalar_one_or_none()
        if not workflow:
            msg = "Воркфлоу не найден."
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)

        await db.delete(workflow)
        await db.commit()
        return Response(status_code=status.HTTP_204_NO_CONTENT)
