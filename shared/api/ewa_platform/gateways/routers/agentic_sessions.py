# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# REST API for EWA Agentic Substrate sessions (create, snapshot, respond, cancel).
# Invariants:
# - Requires ewa_orchestration_pool; gated by EWA_AGENTIC_SUBSTRATE_ENABLED.
# Related:
# - documentation/product/ewa/EWA-AGENTIC-SUBSTRATE-MASTER-PLAN.md
# ---

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status  # type: ignore[import-untyped]

from api.core.auth import User
from api.core.oauth2_auth import require_oauth2_user
from api.dependencies.user_context import get_current_user_db_id
from api.ewa_platform.agentic.adapters.task_run_events import sync_and_publish_task_run_from_session
from api.ewa_platform.agentic.config import agentic_substrate_enabled
from api.ewa_platform.agentic.kernel.state_machine import apply_session_transition
from api.ewa_platform.agentic.respond import apply_agentic_human_response
from api.ewa_platform.agentic.starter import start_agentic_session
from api.ewa_platform.gateways.ewa_service_unavailable import ewa_pool_unavailable_exception
from api.ewa_platform.persistence_pg import agentic_asyncpg as agentic_pg
from api.ewa_platform.schemas.pydantic.agentic_session import (
    AgenticCheckpointOut,
    AgenticSessionCreateIn,
    AgenticSessionCreateOut,
    AgenticSessionOut,
    AgenticSessionRespondIn,
    AgenticSessionRespondOut,
    AgenticTraceOut,
    AgenticTreeNodeOut,
    AgenticTreeOut,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["ewa-agentic"])


def _pool(request: Request) -> Any:
    return getattr(request.app.state, "ewa_orchestration_pool", None)


def _principal(user: User) -> str:
    return str(getattr(user, "id", "") or "")


def _require_enabled() -> None:
    if not agentic_substrate_enabled():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="agentic_substrate_disabled")


def _session_out(row: dict[str, Any]) -> AgenticSessionOut:
    return AgenticSessionOut(
        id=str(row["id"]),
        status=str(row["status"]),
        session_revision=int(row["session_revision"]),
        goal_json=dict(row.get("goal_json") or {}),
        plan_summary=str(row.get("plan_summary") or ""),
        linked_task_run_id=str(row["linked_task_run_id"]) if row.get("linked_task_run_id") else None,
        gate_json=dict(row.get("gate_json") or {}),
    )


@router.post(
    "/agentic/sessions",
    response_model=AgenticSessionCreateOut,
    status_code=status.HTTP_202_ACCEPTED,
    operation_id="ewa_agentic_session_create",
)
async def create_agentic_session(
    request: Request,
    body: AgenticSessionCreateIn,
    auth_user: User = Depends(require_oauth2_user),  # noqa: B008
    content_catalog_user_id: str = Depends(get_current_user_db_id),  # noqa: B008
) -> AgenticSessionCreateOut:
    _require_enabled()
    pool = _pool(request)
    if pool is None:
        raise ewa_pool_unavailable_exception()
    pid = _principal(auth_user)
    outcome = await start_agentic_session(
        pool,
        principal_id=pid,
        user_line=f"/agent {body.goal}",
        policy_json=body.policy,
        content_catalog_user_id=content_catalog_user_id,
        oauth2_sub=str(getattr(auth_user, "id", "") or ""),
    )
    if not outcome.get("ok"):
        reason = str(outcome.get("reason") or "")
        if reason == "active_session_exists":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="agentic_active_session_exists")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=reason or "agentic_start_failed")
    session = outcome.get("session")
    task_run = outcome.get("task_run")
    if not isinstance(session, dict):
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="agentic_start_failed")
    return AgenticSessionCreateOut(
        session=_session_out(session),
        task_run_id=str(task_run.get("id")) if isinstance(task_run, dict) else None,
        reply=str(outcome.get("reply") or ""),
    )


@router.get(
    "/agentic/sessions/{session_id}",
    response_model=AgenticSessionOut,
    operation_id="ewa_agentic_session_get",
)
async def get_agentic_session(
    request: Request,
    session_id: str,
    auth_user: User = Depends(require_oauth2_user),  # noqa: B008
) -> AgenticSessionOut:
    _require_enabled()
    pool = _pool(request)
    if pool is None:
        raise ewa_pool_unavailable_exception()
    row = await agentic_pg.agentic_session_fetch_for_principal(
        pool,
        session_id=session_id,
        principal_id=_principal(auth_user),
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="agentic_session_not_found")
    return _session_out(row)


@router.post(
    "/agentic/sessions/{session_id}/respond",
    response_model=AgenticSessionRespondOut,
    operation_id="ewa_agentic_session_respond",
)
async def respond_agentic_session(
    request: Request,
    session_id: str,
    body: AgenticSessionRespondIn,
    auth_user: User = Depends(require_oauth2_user),  # noqa: B008
) -> AgenticSessionRespondOut:
    _require_enabled()
    pool = _pool(request)
    if pool is None:
        raise ewa_pool_unavailable_exception()
    pid = _principal(auth_user)
    outcome = await apply_agentic_human_response(
        pool,
        session_id=session_id,
        principal_id=pid,
        decision=body.decision,
        message_text=body.message,
        client_turn_id=body.client_turn_id,
        source="confirm_api",
        expect_session_revision=body.expect_session_revision,
    )
    if outcome.get("revision_conflict"):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="agentic_session_revision_conflict")
    if not outcome.get("ok"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(outcome.get("reason") or "agentic_respond_failed"),
        )
    session = outcome.get("session")
    task_run = outcome.get("task_run")
    return AgenticSessionRespondOut(
        reply=str(outcome.get("reply") or ""),
        session=_session_out(session) if isinstance(session, dict) else None,
        task_run_id=str(task_run.get("id")) if isinstance(task_run, dict) else None,
    )


@router.post(
    "/agentic/sessions/{session_id}/cancel",
    response_model=AgenticSessionRespondOut,
    operation_id="ewa_agentic_session_cancel",
)
async def cancel_agentic_session(
    request: Request,
    session_id: str,
    auth_user: User = Depends(require_oauth2_user),  # noqa: B008
) -> AgenticSessionRespondOut:
    _require_enabled()
    pool = _pool(request)
    if pool is None:
        raise ewa_pool_unavailable_exception()
    pid = _principal(auth_user)
    session = await agentic_pg.agentic_session_fetch_for_principal(pool, session_id=session_id, principal_id=pid)
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="agentic_session_not_found")
    tr = await apply_session_transition(
        pool,
        session_id=session_id,
        principal_id=pid,
        event="cancel",
        expect_revision=int(session["session_revision"]),
        clear_lease=True,
    )
    if not tr.ok or tr.session is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="agentic_cancel_failed")
    run_row = await sync_and_publish_task_run_from_session(pool, session=tr.session)
    return AgenticSessionRespondOut(
        reply="Задача отменена.",
        session=_session_out(tr.session),
        task_run_id=str((run_row or {}).get("id") or tr.session.get("linked_task_run_id") or "") or None,
    )


@router.get(
    "/agentic/sessions/{session_id}/trace",
    response_model=AgenticTraceOut,
    operation_id="ewa_agentic_session_trace",
)
async def get_agentic_session_trace(
    request: Request,
    session_id: str,
    auth_user: User = Depends(require_oauth2_user),  # noqa: B008
    limit: int = 50,
) -> AgenticTraceOut:
    _require_enabled()
    pool = _pool(request)
    if pool is None:
        raise ewa_pool_unavailable_exception()
    pid = _principal(auth_user)
    row = await agentic_pg.agentic_session_fetch_for_principal(
        pool,
        session_id=session_id,
        principal_id=pid,
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="agentic_session_not_found")
    safe_limit = max(1, min(int(limit), 100))
    checkpoints = await agentic_pg.agentic_checkpoint_list_recent(
        pool,
        session_id=session_id,
        limit=safe_limit,
    )
    out_cps: list[AgenticCheckpointOut] = []
    for cp in checkpoints:
        seq_raw = cp.get("seq")
        if seq_raw is None:
            continue
        out_cps.append(
            AgenticCheckpointOut(
                seq=int(seq_raw),
                kind=str(cp.get("kind") or ""),
                node_id=str(cp["node_id"]) if cp.get("node_id") else None,
                payload_json=dict(cp.get("payload_json") or {}),
            )
        )
    return AgenticTraceOut(session_id=session_id, checkpoints=out_cps)


@router.get(
    "/agentic/sessions/{session_id}/tree",
    response_model=AgenticTreeOut,
    operation_id="ewa_agentic_session_tree",
)
async def get_agentic_session_tree(
    request: Request,
    session_id: str,
    auth_user: User = Depends(require_oauth2_user),  # noqa: B008
) -> AgenticTreeOut:
    _require_enabled()
    pool = _pool(request)
    if pool is None:
        raise ewa_pool_unavailable_exception()
    pid = _principal(auth_user)
    row = await agentic_pg.agentic_session_fetch_for_principal(
        pool,
        session_id=session_id,
        principal_id=pid,
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="agentic_session_not_found")
    nodes = await agentic_pg.agentic_task_tree_list(pool, session_id=session_id)
    out_nodes = [
        AgenticTreeNodeOut(
            id=str(n.get("id") or ""),
            node_kind=str(n.get("node_kind") or ""),
            status=str(n.get("status") or ""),
            title=str(n.get("title") or ""),
            tool_name=str(n["tool_name"]) if n.get("tool_name") else None,
            sort_order=int(n.get("sort_order") or 0),
            materialized_path=str(n.get("materialized_path") or ""),
        )
        for n in nodes
    ]
    return AgenticTreeOut(session_id=session_id, nodes=out_nodes)
