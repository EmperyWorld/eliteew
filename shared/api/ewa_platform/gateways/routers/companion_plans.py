# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Read and light-write HTTP API for **EWA companion plans** (server-first goals/tasks).
# Invariants:
# - Requires ``app.state.ewa_orchestration_pool``; 503 when unset.
# - Gated by ``EWA_COMPANION_PLAN_ENABLED`` (404 when disabled).
# - PATCH task writes the plan SoT (CalendarApp overlay); it does not create desktop_calendar_events.
# Related:
# - documentation/product/ewa/EWA-COMPANION-SERVER-PLANS-ADR.md
# - api/ewa_platform/persistence_pg/companion_plans_asyncpg.py
# ---

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status  # type: ignore[import-untyped]

from api.core.auth import User
from api.core.oauth2_auth import require_oauth2_user
from api.ewa_platform.companion.plans.config import companion_plan_enabled
from api.ewa_platform.gateways.ewa_service_unavailable import ewa_pool_unavailable_exception
from api.ewa_platform.persistence_pg import companion_plans_asyncpg as plans_pg
from api.ewa_platform.schemas.pydantic.companion_plans import (
    CompanionPlanBundleOut,
    CompanionPlanSummaryOut,
    CompanionPlanTaskPatchIn,
)

router = APIRouter(tags=["EWA - Companion plans"])


def _pool(request: Request) -> Any | None:
    return getattr(request.app.state, "ewa_orchestration_pool", None)


def _principal(user: User) -> str:
    return str(user.id)


def _require_plans_enabled() -> None:
    if not companion_plan_enabled():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "companion_plans_disabled", "message": "Companion plans feature is disabled"},
        )


def _bundle_to_out(bundle: dict[str, Any]) -> CompanionPlanBundleOut:
    return CompanionPlanBundleOut.model_validate(bundle)


@router.get(
    "/companion-plans/active",
    response_model=CompanionPlanBundleOut,
    operation_id="ewa_companion_plans_active_get",
    summary="Get active companion plan with goals and tasks",
)
async def get_active_companion_plan(
    request: Request,
    user: User = Depends(require_oauth2_user),
) -> CompanionPlanBundleOut:
    _require_plans_enabled()
    pool = _pool(request)
    if pool is None:
        raise ewa_pool_unavailable_exception()
    bundle = await plans_pg.plan_get_active(pool, principal_id=_principal(user))
    if bundle is None:
        return CompanionPlanBundleOut(plan=None, goals=[], tasks=[])
    return _bundle_to_out(bundle)


@router.get(
    "/companion-plans/{plan_id}/summary",
    response_model=CompanionPlanSummaryOut,
    operation_id="ewa_companion_plans_summary_get",
    summary="Text summary for a companion plan",
)
async def get_companion_plan_summary(
    plan_id: str,
    request: Request,
    user: User = Depends(require_oauth2_user),
) -> CompanionPlanSummaryOut:
    _require_plans_enabled()
    pool = _pool(request)
    if pool is None:
        raise ewa_pool_unavailable_exception()
    bundle = await plans_pg.plan_fetch_bundle(pool, plan_id=plan_id, principal_id=_principal(user))
    if bundle is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="plan_not_found")
    plan = bundle.get("plan") or {}
    md = plans_pg.format_plan_markdown_reply(bundle, ru=True)
    return CompanionPlanSummaryOut(
        plan_id=str(plan.get("id") or plan_id),
        title=str(plan.get("title") or ""),
        status=str(plan.get("status") or "wait"),
        progress=float(plan.get("progress") or 0.0),
        summary_markdown=md,
    )


@router.post(
    "/companion-plans/active/archive",
    response_model=CompanionPlanBundleOut,
    operation_id="ewa_companion_plans_active_archive",
    summary="Archive (deactivate) the active companion plan",
)
async def archive_active_companion_plan(
    request: Request,
    user: User = Depends(require_oauth2_user),
) -> CompanionPlanBundleOut:
    _require_plans_enabled()
    pool = _pool(request)
    if pool is None:
        raise ewa_pool_unavailable_exception()
    await plans_pg.plan_archive_active(pool, principal_id=_principal(user))
    return CompanionPlanBundleOut(plan=None, goals=[], tasks=[])


@router.post(
    "/companion-plans/tasks/{task_id}/complete",
    response_model=CompanionPlanBundleOut,
    operation_id="ewa_companion_plans_task_complete",
    summary="Mark a plan task completed and refresh plan status",
)
async def complete_companion_plan_task(
    task_id: str,
    request: Request,
    user: User = Depends(require_oauth2_user),
) -> CompanionPlanBundleOut:
    _require_plans_enabled()
    pool = _pool(request)
    if pool is None:
        raise ewa_pool_unavailable_exception()
    bundle = await plans_pg.plan_task_complete(pool, principal_id=_principal(user), task_id=task_id)
    if bundle is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="task_not_found")
    return _bundle_to_out(bundle)


@router.patch(
    "/companion-plans/tasks/{task_id}",
    response_model=CompanionPlanBundleOut,
    operation_id="ewa_companion_plans_task_patch",
    summary="Update a plan task title, notes, or due slot (CalendarApp overlay write-back)",
)
async def patch_companion_plan_task(
    task_id: str,
    body: CompanionPlanTaskPatchIn,
    request: Request,
    user: User = Depends(require_oauth2_user),
) -> CompanionPlanBundleOut:
    _require_plans_enabled()
    pool = _pool(request)
    if pool is None:
        raise ewa_pool_unavailable_exception()
    payload = body.model_dump(exclude_unset=True)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="empty_patch",
        )
    all_day = payload.get("all_day")
    clear_due_time = all_day is True
    try:
        bundle = await plans_pg.plan_task_update(
            pool,
            principal_id=_principal(user),
            task_id=task_id,
            title=payload.get("title"),
            description=payload.get("description"),
            due_date=payload.get("due_date"),
            due_time=None if clear_due_time else payload.get("due_time"),
            due_duration_minutes=None if clear_due_time else payload.get("due_duration_minutes"),
            clear_due_time=clear_due_time,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    if bundle is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="task_not_found")
    return _bundle_to_out(bundle)
