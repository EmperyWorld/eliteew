# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
#   UGS Hub task listing, tray summary, soft-delete, and admin-wide task inspection.
# Invariants:
#   - Task list responses set ``Cache-Control: no-store`` (polling surfaces).
# Related:
#   - api/routers/ugs/task_listing.py
# ---
"""UGS tasks and tray routes."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query  # type: ignore[import-untyped]
from fastapi.responses import Response  # type: ignore[import-untyped]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.core.auth import User
from api.core.database_manager import get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.routers.ugs.common import _is_non_critical_error
from api.routers.ugs.deps import logger
from api.routers.ugs.task_listing import _fetch_ugs_hub_tasks_list, _fetch_ugs_tray_summary
from api.schemas.ugs import UGSTaskResponse, UGSTraySummaryResponse
from api.services.ugs.admin_access import require_ugs_admin_user


def register_tasks_routes(router: APIRouter) -> None:

    @router.get(
        "/tasks/tray-summary",
        response_model=UGSTraySummaryResponse,
        summary="Get UGS Tray Summary",
        description="Lightweight desktop payload for active count and recent task status transitions",
    )
    async def get_user_tasks_tray_summary(
        response: Response,
        user: User = Depends(require_oauth2_user),  # noqa: B008
        db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    ) -> UGSTraySummaryResponse | dict[str, Any]:
        response.headers["Cache-Control"] = "no-store, max-age=0"
        try:
            return await _fetch_ugs_tray_summary(
                db,
                user_id=str(user.id),
            )
        except (OSError, RuntimeError) as e:
            if _is_non_critical_error(e):
                logger.warning(
                    "Non-critical error in get_user_tasks_tray_summary (RabbitMQ/connection): %s",
                    e,
                )
                return {
                    "active_count": 0,
                    "active_tasks": [],
                    "recent_transitions": [],
                    "server_time": datetime.now(UTC).isoformat(),
                }
            logger.exception(
                "Failed to get UGS tray summary for user %s",
                user.id,
                extra={"user_id": str(user.id), "error_type": type(e).__name__},
            )
            raise HTTPException(status_code=500, detail="Failed to retrieve tray summary") from e

    @router.get(
        "/tasks",
        response_model=list[UGSTaskResponse],
        summary="Get User Tasks",
        description="Get all generation tasks for the current user",
    )
    async def get_user_tasks(
        response: Response,
        status: str | None = Query(None, description="Filter by status"),
        limit: int = Query(150, description="Limit results (max 500)"),
        offset: int = Query(0, description="Offset for pagination", ge=0),
        compact: bool = Query(
            False,
            description="Lightweight rows: omit input_data and heavy previews (tray polling)",
        ),
        user: User = Depends(require_oauth2_user),  # noqa: B008
        db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    ) -> list[UGSTaskResponse] | list[dict[str, Any]]:
        """
        🔥 GET USER TASKS 🔥

        Get all generation tasks for the current user with optional filtering.
        """
        response.headers["Cache-Control"] = "no-store, max-age=0"
        try:
            return await _fetch_ugs_hub_tasks_list(
                db,
                filter_user_id=str(user.id),
                status=status,
                limit=limit,
                offset=offset,
                compact_list=compact,
            )
        except (OSError, RuntimeError) as e:
            error_msg = str(e)

            if _is_non_critical_error(e):
                logger.warning(
                    "Non-critical error in get_user_tasks (RabbitMQ/connection): %s. Task retrieval from database should still work.",
                    error_msg,
                )
                return []
            logger.exception(
                "Failed to get user tasks for user %s",
                user.id,
                extra={
                    "user_id": str(user.id),
                    "status_filter": status,
                    "limit": limit,
                    "error_type": type(e).__name__,
                },
            )
            raise HTTPException(status_code=500, detail="Failed to retrieve tasks") from e

    @router.get(
        "/admin/tasks",
        response_model=list[UGSTaskResponse],
        summary="List all UGS generation tasks (admin)",
        description="Server-wide generation history for UGS admins. Optional filter by owner user_id.",
    )
    async def get_admin_ugs_tasks(
        response: Response,
        status: str | None = Query(None, description="Filter by status"),
        user_id: str | None = Query(None, description="Filter by task owner user UUID"),
        limit: int = Query(150, description="Limit results (max 500)"),
        offset: int = Query(0, description="Offset for pagination", ge=0),
        compact: bool = Query(
            False,
            description="Lightweight rows: omit input_data and heavy previews (polling)",
        ),
        user: User = Depends(require_ugs_admin_user),  # noqa: B008
        db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    ) -> list[UGSTaskResponse] | list[dict[str, Any]]:
        """All users' tasks (or one user) — same compact shape as GET /tasks."""
        response.headers["Cache-Control"] = "no-store, max-age=0"
        try:
            filter_uid: str | None = None
            if user_id is not None and str(user_id).strip():
                filter_uid = str(user_id).strip()
            return await _fetch_ugs_hub_tasks_list(
                db,
                filter_user_id=filter_uid,
                status=status,
                limit=limit,
                offset=offset,
                compact_list=compact,
            )
        except (OSError, RuntimeError) as e:
            if _is_non_critical_error(e):
                logger.warning("Non-critical error in get_admin_ugs_tasks: %s", e)
                return []
            logger.exception("Failed to list admin UGS tasks")
            raise HTTPException(status_code=500, detail="Failed to retrieve tasks") from e

    @router.delete(
        "/tasks/{task_id}",
        summary="Delete User Task",
        description="Soft delete a generation task from the current user's UGS history",
        status_code=204,
    )
    async def delete_user_task(
        task_id: UUID,
        user: User = Depends(require_oauth2_user),  # noqa: B008
        db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    ) -> Response:
        try:
            from sqlalchemy import update  # noqa: PLC0415

            from api.models.database_models import GenerationRequest  # noqa: PLC0415

            stmt = (
                update(GenerationRequest)
                .where(
                    GenerationRequest.id == task_id,
                    GenerationRequest.user_id == user.id,
                    GenerationRequest.deleted_at.is_(None),
                )
                .values(
                    deleted_at=datetime.now(UTC).replace(tzinfo=None),
                    deleted_by=user.id,
                )
            )
            result = await db.execute(stmt)
            if (getattr(result, "rowcount", None) or 0) == 0:
                raise HTTPException(status_code=404, detail="Task not found")
            await db.commit()
        except HTTPException:
            raise
        except (OSError, RuntimeError) as e:
            logger.exception("Failed to delete task %s", task_id)
            raise HTTPException(status_code=500, detail="Failed to delete task") from e
        else:
            return Response(status_code=204)
