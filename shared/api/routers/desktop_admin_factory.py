# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Desktop admin API for Gen/Forge factory intentions (Wave F5–F7 / G3).
# Invariants:
# - require_admin_user; 503 when ELITEEW_FACTORY_ENABLED=0.
# - Autonomous implement gated by ELITEEW_FACTORY_AUTONOMOUS (default off).
# - Config-driven assembly (Gate T∧C∧S) gated by ELITEEW_FACTORY_ASSEMBLY (default off).
# - Kill-all is Admin-only; does not flip autonomous env.
# Related:
# - api/ewa_platform/factory/
# - documentation/platform/docker-re_doc/ADMIN-FACTORY-OPS.md
# ---

from __future__ import annotations

import logging
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from api.core.auth import User as AuthUser
from api.ewa_platform.factory.assembly_gates import evaluate_assembly_gates
from api.ewa_platform.factory.config import (
    factory_assembly_enabled,
    factory_async_jobs_enabled,
    factory_autonomous_enabled,
    factory_enabled,
    factory_max_fix_loops,
)
from api.ewa_platform.factory.jobs.enqueue import FACTORY_CELERY_QUEUE, enqueue_factory_tick
from api.ewa_platform.factory.service import get_factory_service
from api.ewa_platform.factory.state_machine import FactoryTransitionError
from api.routers.admin_auth import require_admin_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/factory", tags=["desktop-admin-factory"])


class FactoryEnqueueBody(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    pack_stems: list[str] = Field(default_factory=list)
    run_ticks: int = Field(default=0, ge=0, le=20)


class FactoryAssemblyEvaluateBody(BaseModel):
    pack_stems: list[str] = Field(default_factory=list)
    intent: str = Field(default="", max_length=2000)


class FactoryKillAllBody(BaseModel):
    mode: Literal["cancel", "pause"] = "cancel"
    reason: str = Field(default="admin_kill_switch", max_length=200)


def _require_factory_enabled() -> None:
    if not factory_enabled():
        raise HTTPException(status_code=503, detail="factory control plane disabled")


@router.get("/status")
async def factory_status(
    _admin: AuthUser = Depends(require_admin_user),
) -> dict[str, Any]:
    _require_factory_enabled()
    return {
        "schema_version": 1,
        "enabled": True,
        "autonomous": factory_autonomous_enabled(),
        "async_jobs": factory_async_jobs_enabled(),
        "assembly": factory_assembly_enabled(),
        "max_fix_loops": factory_max_fix_loops(),
        "celery_queue": FACTORY_CELERY_QUEUE,
        "cli_hint": (
            "ELITEEW_FACTORY_AUTONOMOUS=0 → plan/verify only; "
            "ELITEEW_FACTORY_ASYNC_JOBS=1 → ticks on Celery ewa_factory; "
            "ELITEEW_FACTORY_ASSEMBLY=1 → Gate T∧C∧S (S advisory; default off); "
            "POST /intentions/kill-all → Admin kill switch"
        ),
    }


@router.post("/assembly/evaluate")
async def evaluate_assembly(
    body: FactoryAssemblyEvaluateBody,
    _admin: AuthUser = Depends(require_admin_user),
) -> dict[str, Any]:
    """Run Gate T∧C∧S when assembly flag is ON. Default OFF → 403."""

    _require_factory_enabled()
    if not factory_assembly_enabled():
        raise HTTPException(
            status_code=403,
            detail="factory assembly disabled (ELITEEW_FACTORY_ASSEMBLY=0)",
        )
    result = evaluate_assembly_gates(body.pack_stems, intent=body.intent or "")
    return {"schema_version": 1, "assembly": True, "result": result}


@router.post("/intentions/kill-all")
async def kill_all_intentions(
    body: FactoryKillAllBody = FactoryKillAllBody(),
    _admin: AuthUser = Depends(require_admin_user),
) -> dict[str, Any]:
    """Wave G3 kill switch — cancel (default) or pause all non-terminal intentions."""

    _require_factory_enabled()
    try:
        result = get_factory_service().kill_all_active(
            mode=body.mode,
            reason=body.reason,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"schema_version": 1, **result}


@router.get("/intentions")
async def list_intentions(
    _admin: AuthUser = Depends(require_admin_user),
) -> dict[str, Any]:
    _require_factory_enabled()
    items = get_factory_service().list_intentions()
    return {"schema_version": 1, "items": items, "count": len(items)}


@router.post("/intentions")
async def enqueue_intention(
    body: FactoryEnqueueBody,
    admin: AuthUser = Depends(require_admin_user),
) -> dict[str, Any]:
    _require_factory_enabled()
    created_by = getattr(admin, "email", None) or str(getattr(admin, "id", "") or "")
    async_on = factory_async_jobs_enabled()
    # Async: create pending, schedule Celery chain; sync: run_ticks in-process.
    item = get_factory_service().enqueue(
        title=body.title,
        pack_stems=body.pack_stems,
        created_by=created_by or None,
        run_ticks=0 if async_on else body.run_ticks,
    )
    celery_task_id: str | None = None
    if async_on and body.run_ticks > 0:
        celery_task_id = enqueue_factory_tick(
            intention_id=str(item["id"]),
            remaining_ticks=body.run_ticks,
        )
    return {
        "schema_version": 1,
        "item": item,
        "celery_task_id": celery_task_id,
        "async_jobs": async_on,
    }


@router.get("/intentions/{intention_id}")
async def get_intention(
    intention_id: str,
    _admin: AuthUser = Depends(require_admin_user),
) -> dict[str, Any]:
    _require_factory_enabled()
    item = get_factory_service().get_intention(intention_id)
    if item is None:
        raise HTTPException(status_code=404, detail="intention not found")
    return {"schema_version": 1, "item": item}


@router.post("/intentions/{intention_id}/pause")
async def pause_intention(
    intention_id: str,
    _admin: AuthUser = Depends(require_admin_user),
) -> dict[str, Any]:
    _require_factory_enabled()
    try:
        item = get_factory_service().pause(intention_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="intention not found") from None
    except FactoryTransitionError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return {"schema_version": 1, "item": item}


@router.post("/intentions/{intention_id}/resume")
async def resume_intention(
    intention_id: str,
    _admin: AuthUser = Depends(require_admin_user),
) -> dict[str, Any]:
    _require_factory_enabled()
    try:
        item = get_factory_service().resume(intention_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="intention not found") from None
    except FactoryTransitionError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return {"schema_version": 1, "item": item}


@router.post("/intentions/{intention_id}/tick")
async def tick_intention(
    intention_id: str,
    _admin: AuthUser = Depends(require_admin_user),
) -> dict[str, Any]:
    _require_factory_enabled()
    if factory_async_jobs_enabled():
        item = get_factory_service().get_intention(intention_id)
        if item is None:
            raise HTTPException(status_code=404, detail="intention not found")
        celery_task_id = enqueue_factory_tick(intention_id=intention_id, remaining_ticks=1)
        return {
            "schema_version": 1,
            "item": item,
            "celery_task_id": celery_task_id,
            "async_jobs": True,
        }
    verify_passed = True
    assembly_result: dict[str, Any] | None = None
    if factory_assembly_enabled():
        item_pre = get_factory_service().get_intention(intention_id)
        if item_pre is None:
            raise HTTPException(status_code=404, detail="intention not found")
        if str(item_pre.get("stage") or "") == "verify":
            assembly_result = evaluate_assembly_gates(
                item_pre.get("pack_stems") or [],
                intent=str(item_pre.get("title") or ""),
            )
            verify_passed = bool(assembly_result.get("passed"))
    try:
        item = get_factory_service().tick(intention_id, verify_passed=verify_passed)
    except KeyError:
        raise HTTPException(status_code=404, detail="intention not found") from None
    except FactoryTransitionError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    out: dict[str, Any] = {
        "schema_version": 1,
        "item": item,
        "async_jobs": False,
        "assembly": factory_assembly_enabled(),
    }
    if assembly_result is not None:
        out["assembly_result"] = assembly_result
    return out


@router.post("/intentions/{intention_id}/cancel")
async def cancel_intention(
    intention_id: str,
    _admin: AuthUser = Depends(require_admin_user),
) -> dict[str, Any]:
    _require_factory_enabled()
    try:
        item = get_factory_service().cancel(intention_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="intention not found") from None
    except FactoryTransitionError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return {"schema_version": 1, "item": item}
