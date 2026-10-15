# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Курсорина HTTP API — create (enqueue), poll public view, optional cancel.
# Invariants:
# - Product responses are MissionPublicView (no tool steps).
# - Loop runs in Celery; sync /tick is debug-only.
# Related:
# - documentation/product/desktop/KURSORINA.md
# ---

from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.database_manager import get_postgres_session
from api.routers.desktop import get_desktop_user_id
from api.services.kursorina.jobs import (
    KursorinaCapacityError,
    assert_can_enqueue,
    enqueue_mission_run,
)
from api.services.kursorina.loop import tick_mission
from api.services.kursorina.models import (
    MissionCreateBody,
    MissionPublicView,
    MissionTickBody,
    to_public_view,
)
from api.services.kursorina.runtime import ToolRuntime
from api.services.kursorina.store import (
    count_active_missions,
    create_mission,
    delete_mission,
    get_mission,
    list_missions,
    save_mission,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/kursorina", tags=["Desktop - Kursorina"])


def _principal(user_id: UUID) -> str:
    return str(user_id)


@router.post("/missions", response_model=MissionPublicView, status_code=status.HTTP_201_CREATED)
async def kursorina_create_mission(
    body: MissionCreateBody,
    user_id: UUID = Depends(get_desktop_user_id),
) -> MissionPublicView:
    goal = body.goal.strip()
    if len(goal) < 3:
        raise HTTPException(status_code=400, detail="goal too short")
    principal = _principal(user_id)
    try:
        await assert_can_enqueue(principal_id=principal)
    except KursorinaCapacityError as exc:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(exc)) from exc

    mission = await create_mission(principal_id=principal, goal=goal, status="queued")
    # Post-insert capacity recheck (check-then-act race window); cancel overflow rows.
    try:
        user_n = await count_active_missions(principal_id=principal)
        global_n = await count_active_missions(principal_id=None)
        from api.services.kursorina.jobs import max_global, max_per_user

        if user_n > max_per_user() or global_n > max_global():
            mission.status = "cancelled"
            mission.block_reason = "Сейчас слишком много активных задач. Попробуйте позже."
            await save_mission(mission)
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=mission.block_reason)
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001 — fail closed: do not enqueue without caps
        logger.info("[STEP] kursorina_capacity_recheck_fail err=%s", type(exc).__name__)
        mission.status = "blocked"
        mission.block_reason = "Не удалось проверить лимит задач. Попробуйте позже."
        await save_mission(mission)
        raise HTTPException(status_code=503, detail=mission.block_reason) from exc

    try:
        task_id = enqueue_mission_run(mission_id=mission.id, user_id=str(user_id))
        if not task_id.strip():
            raise RuntimeError("empty celery task id")
        mission.celery_task_id = task_id
        await save_mission(mission)
    except Exception as exc:  # noqa: BLE001 — surface enqueue failure honestly
        logger.info("[STEP] kursorina_enqueue_fail err=%s", type(exc).__name__)
        mission.status = "blocked"
        mission.block_reason = "Не удалось поставить задачу в очередь. Попробуйте позже."
        await save_mission(mission)
        raise HTTPException(status_code=503, detail=mission.block_reason) from exc

    logger.info("[STEP] kursorina_mission_queued id=%s", mission.id[:48])
    return to_public_view(mission)


@router.get("/missions", response_model=list[MissionPublicView])
async def kursorina_list_missions(
    limit: int = Query(default=20, ge=1, le=50),
    user_id: UUID = Depends(get_desktop_user_id),
) -> list[MissionPublicView]:
    rows = await list_missions(principal_id=_principal(user_id), limit=limit)
    return [to_public_view(m) for m in rows]


@router.get("/missions/{mission_id}", response_model=MissionPublicView)
async def kursorina_get_mission(
    mission_id: str,
    user_id: UUID = Depends(get_desktop_user_id),
) -> MissionPublicView:
    mission = await get_mission(mission_id=mission_id, principal_id=_principal(user_id))
    if mission is None:
        raise HTTPException(status_code=404, detail="mission not found")
    view = to_public_view(mission)
    logger.info(
        "[STEP] kursorina_get id=%s status=%s results=%s answer_chars=%s",
        view.id[:48],
        view.status,
        len(view.results),
        len(view.answer or ""),
    )
    return view


@router.post("/missions/{mission_id}/cancel", response_model=MissionPublicView)
async def kursorina_cancel_mission(
    mission_id: str,
    user_id: UUID = Depends(get_desktop_user_id),
) -> MissionPublicView:
    mission = await get_mission(mission_id=mission_id, principal_id=_principal(user_id))
    if mission is None:
        raise HTTPException(status_code=404, detail="mission not found")
    if mission.status in {"completed", "blocked", "cancelled"}:
        return to_public_view(mission)
    mission.cancel_requested = True
    if mission.status == "queued":
        mission.status = "cancelled"
        mission.block_reason = "cancelled by user"
    await save_mission(mission)
    logger.info("[STEP] kursorina_cancel_requested id=%s", mission.id[:48])
    return to_public_view(mission)


@router.delete("/missions/{mission_id}", status_code=status.HTTP_204_NO_CONTENT)
async def kursorina_delete_mission(
    mission_id: str,
    user_id: UUID = Depends(get_desktop_user_id),
) -> None:
    ok = await delete_mission(mission_id=mission_id, principal_id=_principal(user_id))
    if not ok:
        raise HTTPException(status_code=404, detail="mission not found")
    logger.info("[STEP] kursorina_mission_deleted id=%s", mission_id[:48])


@router.post("/missions/{mission_id}/tick", response_model=MissionPublicView)
async def kursorina_tick_mission(
    mission_id: str,
    body: MissionTickBody | None = None,
    user_id: UUID = Depends(get_desktop_user_id),
    db: AsyncSession = Depends(get_postgres_session),
) -> MissionPublicView:
    """Debug/sync fallback — product UI must use create + poll, not tick."""
    mission = await get_mission(mission_id=mission_id, principal_id=_principal(user_id))
    if mission is None:
        raise HTTPException(status_code=404, detail="mission not found")
    if mission.celery_task_id and mission.status in {"queued", "running"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="mission is owned by the background worker — poll GET instead of tick",
        )
    max_steps = body.max_steps if body is not None else 5
    runtime = ToolRuntime(db=db, user_id=user_id, web_enabled=True)
    updated = await tick_mission(mission, max_steps=max_steps, runtime=runtime)
    return to_public_view(updated)
