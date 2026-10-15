# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Desktop admin API for Celery + RabbitMQ workers monitoring and safe control
# (snapshot / revoke / purge-queue).
# Invariants:
# - GET snapshot: require_admin_user; mutate: require_emperyworld_admin.
# - Purge only whitelisted Celery queue names from celery_app.conf.task_queues.
# Related:
# - api/services/workers_ops/celery_workers_ops_service.py
# - api/routers/desktop_admin.py
# - documentation/platform/docker-re_doc/ADMIN-WORKERS-OPS.md
# ---

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.core.auth import User as AuthUser
from api.core.database_manager import get_postgres_session
from api.routers.admin_auth import require_admin_user, require_emperyworld_admin
from api.services.workers_ops.celery_workers_ops_service import (
    build_workers_ops_snapshot,
    purge_celery_queue,
    revoke_celery_task,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/workers-ops", tags=["desktop-admin-workers-ops"])


class WorkersOpsRevokeBody(BaseModel):
    task_id: str = Field(..., min_length=1, max_length=255)
    terminate: bool = False


class WorkersOpsPurgeBody(BaseModel):
    queue: str = Field(..., min_length=1, max_length=128)


class WorkersOpsActionResponse(BaseModel):
    ok: bool
    detail: dict[str, Any] = Field(default_factory=dict)


@router.get("/snapshot")
async def workers_ops_snapshot(
    _admin: AuthUser = Depends(require_admin_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> dict[str, Any]:
    """Celery inspect + beat health + RabbitMQ/UGS queue-ops plane."""
    return await build_workers_ops_snapshot(db)


@router.post("/revoke", response_model=WorkersOpsActionResponse)
async def workers_ops_revoke(
    body: WorkersOpsRevokeBody,
    admin: AuthUser = Depends(require_emperyworld_admin),
) -> WorkersOpsActionResponse:
    try:
        detail = revoke_celery_task(body.task_id, terminate=body.terminate)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        logger.exception(
            "[STEP] workers_ops_revoke_fail admin=%s task_id=%s",
            getattr(admin, "email", None),
            body.task_id,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"revoke_failed:{type(exc).__name__}",
        ) from exc
    logger.info(
        "[STEP] workers_ops_revoke_ok admin=%s task_id=%s terminate=%s",
        getattr(admin, "email", None),
        body.task_id,
        body.terminate,
    )
    return WorkersOpsActionResponse(ok=True, detail=detail)


@router.post("/purge-queue", response_model=WorkersOpsActionResponse)
async def workers_ops_purge_queue(
    body: WorkersOpsPurgeBody,
    admin: AuthUser = Depends(require_emperyworld_admin),
) -> WorkersOpsActionResponse:
    try:
        detail = purge_celery_queue(body.queue)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        logger.exception(
            "[STEP] workers_ops_purge_fail admin=%s queue=%s",
            getattr(admin, "email", None),
            body.queue,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"purge_failed:{type(exc).__name__}",
        ) from exc
    logger.info(
        "[STEP] workers_ops_purge_ok admin=%s queue=%s purged=%s",
        getattr(admin, "email", None),
        body.queue,
        detail.get("purged"),
    )
    return WorkersOpsActionResponse(ok=True, detail=detail)
