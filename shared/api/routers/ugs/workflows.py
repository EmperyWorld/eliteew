# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
#   UGS workflow builder CRUD, validation, duplication, execution, and execution history endpoints.
# Invariants:
#   - UGS admin gate on mutating workflow routes; graph validation never executes side effects.
# Related:
#   - api/services/ugs/workflow_service.py
#   - api/routers/ugs/common.py (``_is_not_found_or_denied_detail`` for execute errors)
# ---
"""UGS workflow routes."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Query  # type: ignore[import-untyped]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.core.auth import User
from api.core.database_manager import get_postgres_session
from api.routers.ugs.common import _is_not_found_or_denied_detail
from api.routers.ugs.deps import get_ugs_service, logger
from api.schemas.ugs import (
    UGSWorkflowDetailResponse,
    UGSWorkflowExecuteResponse,
    UGSWorkflowExecutionDetailResponse,
    UGSWorkflowExecutionsResponse,
    UGSWorkflowListResponse,
    UGSWorkflowMutationResponse,
    WorkflowBuilderCatalogResponse,
    WorkflowValidationResponse,
)
from api.services.ugs.admin_access import require_ugs_admin_user
from api.services.ugs.unified_generation_service import UnifiedGenerationService


def get_workflow_service(
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> Any:
    """Get workflow service instance"""
    from api.services.ugs.workflow_service import WorkflowService  # noqa: PLC0415

    return WorkflowService(db)


def register_workflow_routes(router: APIRouter) -> None:
    # ========================================
    # WORKFLOW SYSTEM ENDPOINTS
    # ========================================

    @router.post(
        "/workflows",
        response_model=UGSWorkflowMutationResponse,
        summary="Create Workflow",
        description="Create a new visual workflow with drag-and-drop nodes and connections",
    )
    async def create_workflow(
        workflow_name: str = Body(..., description="Name of the workflow"),
        description: str = Body("", description="Description of the workflow"),
        workflow_data: dict[str, Any] = Body(..., description="React Flow workflow data"),  # noqa: B008
        project_id: str | None = Body(None, description="Project ID"),
        company_id: str | None = Body(None, description="Company ID"),
        *,  # All subsequent arguments are keyword-only
        is_public: bool = Body(False, description="Whether the workflow is public"),  # noqa: FBT003
        user: User = Depends(require_ugs_admin_user),  # noqa: B008
        workflow_service: Any = Depends(get_workflow_service),  # noqa: B008, ANN401
    ) -> UGSWorkflowMutationResponse | dict[str, Any]:
        """
        🔥 CREATE WORKFLOW 🔥

        Create a new visual workflow using React Flow data structure.
        Workflows can contain multiple generation nodes connected in sequence.

        - **workflow_name**: Display name for the workflow
        - **description**: Optional description
        - **workflow_data**: React Flow data with nodes and edges
        - **project_id**: Optional project association
        - **company_id**: Optional company association
        - **is_public**: Whether other users can see this workflow
        """
        try:
            result = await workflow_service.create_workflow(
                user_id=str(user.id),
                workflow_name=workflow_name,
                workflow_data=workflow_data,
                description=description,
                project_id=project_id,
                company_id=company_id,
                is_public=is_public,
            )

            return {"message": "Воркфлоу успешно создан.", "workflow": result}  # noqa: TRY300

        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        except (OSError, RuntimeError) as e:
            logger.exception("Workflow creation failed")
            raise HTTPException(status_code=500, detail="Internal server error") from e

    @router.get(
        "/workflows/node-catalog",
        summary="Get Workflow Builder Node Catalog",
        description="Returns builder palette metadata and capability flags for workflow nodes",
        response_model=WorkflowBuilderCatalogResponse,
    )
    async def get_workflow_builder_node_catalog(
        user: User = Depends(require_ugs_admin_user),  # noqa: ARG001, B008
        workflow_service: Any = Depends(get_workflow_service),  # noqa: B008, ANN401
    ) -> WorkflowBuilderCatalogResponse:
        try:
            payload = await workflow_service.get_builder_node_catalog()
        except (OSError, RuntimeError) as e:
            logger.exception("Failed to load workflow builder node catalog")
            raise HTTPException(status_code=500, detail="Не удалось загрузить каталог узлов.") from e
        else:
            return WorkflowBuilderCatalogResponse(**payload)

    @router.get(
        "/workflows/{workflow_id}",
        response_model=UGSWorkflowDetailResponse,
        summary="Get Workflow",
        description="Retrieve a specific workflow by ID",
    )
    async def get_workflow(
        workflow_id: str,
        user: User = Depends(require_ugs_admin_user),  # noqa: B008
        workflow_service: Any = Depends(get_workflow_service),  # noqa: B008, ANN401
    ) -> UGSWorkflowDetailResponse | dict[str, Any]:
        """
        🔥 GET WORKFLOW 🔥

        Retrieve detailed information about a specific workflow.

        - **workflow_id**: UUID of the workflow to retrieve
        """
        try:
            workflow = await workflow_service.get_workflow(workflow_id, str(user.id))

            if not workflow:
                msg = "Воркфлоу не найден."
                raise HTTPException(status_code=404, detail=msg)  # noqa: TRY301
            return {"workflow": workflow}  # noqa: TRY300

        except HTTPException:
            raise
        except (OSError, RuntimeError) as e:
            logger.exception("Workflow retrieval failed")
            raise HTTPException(status_code=500, detail="Internal server error") from e

    @router.put(
        "/workflows/{workflow_id}",
        response_model=UGSWorkflowMutationResponse,
        summary="Update Workflow",
        description="Update an existing workflow's properties and structure",
    )
    async def update_workflow(
        workflow_id: str,
        updates: dict[str, Any] = Body(..., description="Fields to update"),  # noqa: B008
        user: User = Depends(require_ugs_admin_user),  # noqa: B008
        workflow_service: Any = Depends(get_workflow_service),  # noqa: B008, ANN401
    ) -> UGSWorkflowMutationResponse | dict[str, str]:
        """
        🔥 UPDATE WORKFLOW 🔥

        Update workflow properties, structure, or settings.

        - **workflow_id**: UUID of the workflow to update
        - **updates**: Object containing fields to update
        """
        try:
            success = await workflow_service.update_workflow(workflow_id, str(user.id), updates)

            if not success:
                msg = "Воркфлоу не найден или недоступен."
                raise HTTPException(status_code=404, detail=msg)  # noqa: TRY301
        except HTTPException:
            raise
        except (OSError, RuntimeError) as e:
            logger.exception("Workflow update failed")
            raise HTTPException(status_code=500, detail="Internal server error") from e
        else:
            return {"message": "Воркфлоу успешно обновлён."}

    @router.delete(
        "/workflows/{workflow_id}",
        response_model=UGSWorkflowMutationResponse,
        summary="Delete Workflow",
        description="Delete a workflow permanently",
    )
    async def delete_workflow(
        workflow_id: str,
        user: User = Depends(require_ugs_admin_user),  # noqa: B008
        workflow_service: Any = Depends(get_workflow_service),  # noqa: B008, ANN401
    ) -> UGSWorkflowMutationResponse | dict[str, str]:
        """
        🔥 DELETE WORKFLOW 🔥

        Permanently delete a workflow. This action cannot be undone.

        - **workflow_id**: UUID of the workflow to delete
        """
        try:
            success = await workflow_service.delete_workflow(workflow_id, str(user.id))

            if not success:
                msg = "Воркфлоу не найден или недоступен."
                raise HTTPException(status_code=404, detail=msg)  # noqa: TRY301
        except HTTPException:
            raise
        except (OSError, RuntimeError) as e:
            logger.exception("Workflow deletion failed")
            raise HTTPException(status_code=500, detail="Internal server error") from e
        else:
            return {"message": "Воркфлоу успешно удалён."}

    @router.get(
        "/workflows",
        response_model=UGSWorkflowListResponse,
        summary="List Workflows",
        description="Get a list of user's workflows with optional filtering",
    )
    async def list_workflows(
        project_id: str | None = Query(None, description="Filter by project ID"),
        company_id: str | None = Query(None, description="Filter by company ID"),
        *,  # All subsequent arguments are keyword-only
        include_public: bool = Query(default=True, description="Include public workflows"),
        limit: int = Query(50, description="Maximum number of results", le=100),
        offset: int = Query(0, description="Pagination offset"),
        user: User = Depends(require_ugs_admin_user),  # noqa: B008
        workflow_service: Any = Depends(get_workflow_service),  # noqa: B008, ANN401
    ) -> UGSWorkflowListResponse | dict[str, list[dict[str, Any]]]:
        """
        🔥 LIST WORKFLOWS 🔥

        Retrieve a paginated list of workflows owned by or accessible to the user.

        - **project_id**: Optional filter by project
        - **company_id**: Optional filter by company
        - **include_public**: Include publicly available workflows
        - **limit**: Maximum results (1-100)
        - **offset**: Pagination offset
        """
        try:
            workflows = await workflow_service.list_workflows(
                user_id=str(user.id),
                project_id=project_id,
                company_id=company_id,
                include_public=include_public,
                limit=limit,
                offset=offset,
            )
        except (OSError, RuntimeError) as e:
            logger.exception("Workflow listing failed")
            raise HTTPException(status_code=500, detail="Internal server error") from e
        else:
            return {"workflows": workflows}

    @router.post(
        "/workflows/validate",
        summary="Validate Workflow Graph",
        description="Validate/compile a workflow graph without executing it",
        response_model=WorkflowValidationResponse,
    )
    async def validate_workflow_graph(
        workflow_data: dict[str, Any] = Body(..., description="React Flow workflow data"),  # noqa: B008
        user: User = Depends(require_ugs_admin_user),  # noqa: ARG001, B008
        workflow_service: Any = Depends(get_workflow_service),  # noqa: B008, ANN401
    ) -> WorkflowValidationResponse:
        try:
            payload = workflow_service.validate_workflow_graph(workflow_data)
        except (OSError, RuntimeError) as e:
            logger.exception("Workflow validation failed")
            raise HTTPException(status_code=500, detail="Не удалось провалидировать workflow.") from e
        else:
            return WorkflowValidationResponse(**payload)

    @router.post(
        "/workflows/{workflow_id}/duplicate",
        response_model=UGSWorkflowMutationResponse,
        summary="Duplicate Workflow",
        description="Create a copy of an existing workflow",
    )
    async def duplicate_workflow(
        workflow_id: str,
        new_name: str = Body(..., description="Name for the duplicated workflow"),
        description: str | None = Body(None, description="Optional new description"),
        user: User = Depends(require_ugs_admin_user),  # noqa: B008
        workflow_service: Any = Depends(get_workflow_service),  # noqa: B008, ANN401
    ) -> UGSWorkflowMutationResponse | dict[str, Any]:
        """
        🔥 DUPLICATE WORKFLOW 🔥

        Create a copy of an existing workflow with a new name.

        - **workflow_id**: UUID of the workflow to duplicate
        - **new_name**: Name for the new workflow copy
        - **description**: Optional description for the copy
        """
        try:
            new_workflow_id = await workflow_service.duplicate_workflow(
                workflow_id=workflow_id,
                user_id=str(user.id),
                new_name=new_name,
                description=description,
            )

            if not new_workflow_id:
                msg = "Исходный воркфлоу не найден."
                raise HTTPException(status_code=404, detail=msg)  # noqa: TRY301
        except HTTPException:
            raise
        except (OSError, RuntimeError) as e:
            logger.exception("Workflow duplication failed")
            raise HTTPException(status_code=500, detail="Internal server error") from e
        else:
            return {"message": "Воркфлоу успешно дублирован.", "new_workflow_id": new_workflow_id}

    # ========================================
    # WORKFLOW EXECUTION ENDPOINTS
    # ========================================

    @router.get(
        "/workflows/{workflow_id}/executions",
        summary="List Workflow Executions",
        description="Get execution history for a workflow",
        response_model=UGSWorkflowExecutionsResponse,
    )
    async def list_workflow_executions(
        workflow_id: str,
        limit: int = Query(20, ge=1, le=100, description="Maximum executions to return"),
        offset: int = Query(0, ge=0, description="Pagination offset"),
        user: User = Depends(require_ugs_admin_user),  # noqa: B008
        workflow_service: Any = Depends(get_workflow_service),  # noqa: B008, ANN401
    ) -> UGSWorkflowExecutionsResponse | dict[str, Any]:
        try:
            payload = await workflow_service.list_workflow_executions(
                workflow_id=workflow_id,
                user_id=str(user.id),
                limit=limit,
                offset=offset,
            )
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e)) from e
        except (OSError, RuntimeError) as e:
            logger.exception("Failed to list workflow executions for %s", workflow_id)
            raise HTTPException(status_code=500, detail="Не удалось получить историю запусков воркфлоу.") from e
        else:
            if isinstance(payload, list):
                executions = payload
                total = len(executions)
            elif isinstance(payload, dict):
                executions = payload.get("executions", [])
                total = int(payload.get("total", len(executions)))
            else:
                executions = []
                total = 0
            return {
                "executions": executions,
                "workflow_id": workflow_id,
                "total": total,
            }

    @router.get(
        "/workflows/{workflow_id}/executions/{execution_id}",
        summary="Get Workflow Execution Detail",
        description="Get detailed information for one workflow execution",
        response_model=UGSWorkflowExecutionDetailResponse,
    )
    async def get_workflow_execution_detail(
        workflow_id: str,
        execution_id: str,
        user: User = Depends(require_ugs_admin_user),  # noqa: B008
        workflow_service: Any = Depends(get_workflow_service),  # noqa: B008, ANN401
    ) -> UGSWorkflowExecutionDetailResponse | dict[str, Any]:
        try:
            execution = await workflow_service.get_workflow_execution(
                workflow_id=workflow_id,
                execution_id=execution_id,
                user_id=str(user.id),
            )
            if not execution:
                raise HTTPException(status_code=404, detail="Запуск воркфлоу не найден.")
        except HTTPException:
            raise
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e)) from e
        except (OSError, RuntimeError) as e:
            logger.exception(
                "Failed to get workflow execution detail for %s/%s",
                workflow_id,
                execution_id,
            )
            raise HTTPException(status_code=500, detail="Не удалось получить детали запуска воркфлоу.") from e
        else:
            return {"execution": execution}

    @router.post(
        "/workflows/{workflow_id}/execute",
        summary="Execute Workflow",
        description="Execute a workflow with optional input data",
        response_model=UGSWorkflowExecuteResponse,
    )
    async def execute_workflow(
        workflow_id: str,
        execution_request: dict[str, Any] | None = Body(  # noqa: B008
            None, description="Optional execution parameters"
        ),
        user: User = Depends(require_ugs_admin_user),  # noqa: B008
        workflow_service: Any = Depends(get_workflow_service),  # noqa: B008, ANN401
        ugs_service: UnifiedGenerationService = Depends(get_ugs_service),  # noqa: B008
    ) -> UGSWorkflowExecuteResponse | dict[str, Any]:
        """
        🔥 EXECUTE WORKFLOW 🔥

        Execute a workflow with optional input data and parameters.

        Args:
            workflow_id: ID of the workflow to execute
            execution_request: Optional execution parameters

        Returns:
            Execution details with execution_id
        """
        try:
            execution_name = execution_request.get("execution_name") if execution_request else None
            input_data = execution_request.get("input_data") if execution_request else None
            trigger_type = execution_request.get("trigger_type", "manual") if execution_request else "manual"

            return await workflow_service.execute_workflow(
                workflow_id=workflow_id,
                user_id=str(user.id),
                execution_name=execution_name,
                input_data=input_data,
                trigger_type=trigger_type,
                ugs_service=ugs_service,
            )

        except ValueError as e:
            detail = str(e)
            normalized_detail = detail.lower()
            status_code = 404 if _is_not_found_or_denied_detail(normalized_detail) else 400
            raise HTTPException(status_code=status_code, detail=detail) from e
        except (OSError, RuntimeError) as e:
            logger.exception("Failed to execute workflow %s", workflow_id)
            raise HTTPException(status_code=500, detail="Не удалось запустить воркфлоу.") from e
