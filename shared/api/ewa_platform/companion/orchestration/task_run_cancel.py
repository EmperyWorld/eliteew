# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# User-initiated cancel for companion task runs (music, image, user action workflows).
# Invariants:
# - Terminal runs are no-op; child workflow tool runs cancelled before parent workflow.
# Related:
# - api/ewa_platform/gateways/routers/companion_chat.py
# - api/ewa_platform/companion/jobs/music_run_reconcile.py
# ---

from __future__ import annotations

import asyncio
import logging
from collections.abc import Mapping
from typing import Any

import asyncpg
from sqlalchemy.ext.asyncio import AsyncSession

from api.ewa_platform.companion.jobs.music_run_reconcile import (
    MUSIC_ASYNC_INTENT_KINDS,
    cancel_companion_music_run_for_user,
)
from api.ewa_platform.companion.jobs.task_events import publish_task_event_async
from api.ewa_platform.companion.orchestration.companion_image_generation import (
    IMAGE_ASYNC_INTENT_KINDS,
)
from api.ewa_platform.companion.orchestration.run_lifecycle import run_revision
from api.ewa_platform.companion.workflows.user.workflow_auth_cache import (
    delete_workflow_auth_snapshot_sync,
)
from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg

logger = logging.getLogger(__name__)

_ACTIVE_STATUSES = frozenset({"pending", "running", "awaiting_confirmation"})
_ACTIVE_STEP_STATUSES = frozenset({"pending", "running", "in_progress", "awaiting_confirmation"})


def _is_confirmation_claim_in_progress(run: Mapping[str, Any]) -> bool:
    confirmation_state = run.get("confirmation_state")
    if not isinstance(confirmation_state, Mapping):
        return False
    return str(confirmation_state.get("state") or "").strip() == "confirming"


def _is_user_action_workflow(run: Mapping[str, Any]) -> bool:
    if str(run.get("intent_kind") or "").strip() != "action_workflow":
        return False
    plan = run.get("plan_payload")
    if isinstance(plan, Mapping) and str(plan.get("user_workflow_id") or "").strip():
        return True
    wf_id = str(run.get("workflow_id") or "").strip()
    return wf_id.startswith("user_")


async def _cancel_run_steps(
    pool: asyncpg.Pool,
    *,
    run_id: str,
    terminal_status: str = "cancelled",
) -> None:
    steps = await companion_pg.companion_task_steps_list(pool, run_id=run_id)
    for step in steps:
        st = str(step.get("status") or "").strip().lower()
        if st not in _ACTIVE_STEP_STATUSES:
            continue
        await companion_pg.companion_task_step_update(
            pool,
            step_id=str(step.get("id") or ""),
            status=terminal_status,
            error_payload={"message": "cancelled_by_user"},
        )


async def _terminalize_simple_run(
    pool: asyncpg.Pool,
    *,
    run: Mapping[str, Any],
    terminal_status: str = "cancelled",
    message: str = "cancelled_by_user",
) -> bool:
    run_id = str(run.get("id") or "").strip()
    principal_id = str(run.get("principal_id") or "").strip()
    if not run_id or not principal_id:
        return False
    status = str(run.get("status") or "").strip().lower()
    if status in {"completed", "failed", "cancelled"}:
        return False
    if _is_confirmation_claim_in_progress(run):
        logger.info("[STEP] companion_task_cancel_skip_confirming run_id=%s", run_id)
        return False
    updated = await companion_pg.companion_task_run_update(
        pool,
        run_id=run_id,
        principal_id=principal_id,
        status=terminal_status,
        error_payload={"message": message},
        confirmation_state={},
        expect_revision=run_revision(run),
    )
    if updated is None:
        logger.info("[STEP] companion_task_cancel_revision_conflict run_id=%s", run_id)
        return False
    await _cancel_run_steps(pool, run_id=run_id, terminal_status=terminal_status)
    await publish_task_event_async(
        principal_id=principal_id,
        event_name="task_failed",
        payload={
            "run_id": run_id,
            "status": terminal_status,
            "intent_kind": str(run.get("intent_kind") or ""),
            "error_payload": {"message": message},
        },
    )
    return True


async def _cancel_image_run_for_user(
    pool: asyncpg.Pool,
    db: AsyncSession,
    *,
    run: Mapping[str, Any],
    oauth_user_id: str | None,
) -> dict[str, Any]:
    from api.ewa_platform.companion.jobs.music_run_reconcile import (
        _cancel_ugs_requests_for_companion_run,
    )

    run_id = str(run.get("id") or "").strip()
    ugs_cancelled = await _cancel_ugs_requests_for_companion_run(
        db,
        companion_run_id=run_id,
        user_id=oauth_user_id,
    )
    changed = await _terminalize_simple_run(
        pool,
        run=run,
        message="image_generation_cancelled_by_user",
    )
    return {
        "ok": True,
        "cancelled": changed,
        "ugs_requests_cancelled": ugs_cancelled,
        "run_id": run_id,
    }


async def _cancel_user_workflow_run(
    pool: asyncpg.Pool,
    db: AsyncSession,
    *,
    run: Mapping[str, Any],
    oauth_user_id: str | None,
) -> dict[str, Any]:
    run_id = str(run.get("id") or "").strip()
    principal_id = str(run.get("principal_id") or "").strip()
    children = await companion_pg.companion_task_runs_list_by_parent_run(
        pool,
        principal_id=principal_id,
        parent_run_id=run_id,
        limit=16,
    )
    child_cancelled = 0
    for child in children:
        outcome = await cancel_companion_task_run_for_user(
            pool,
            db,
            run=child,
            oauth_user_id=oauth_user_id,
        )
        if outcome.get("ok"):
            child_cancelled += 1
    changed = await _terminalize_simple_run(
        pool,
        run=run,
        message="workflow_cancelled_by_user",
    )
    await asyncio.to_thread(delete_workflow_auth_snapshot_sync, run_id)
    logger.info(
        "[STEP] companion_workflow_cancelled run_id=%s children=%s changed=%s",
        run_id,
        child_cancelled,
        changed,
    )
    return {
        "ok": True,
        "cancelled": changed,
        "child_runs_cancelled": child_cancelled,
        "run_id": run_id,
    }


def _agentic_session_id_from_run(run: Mapping[str, Any]) -> str | None:
    plan = run.get("plan_payload")
    if not isinstance(plan, Mapping):
        return None
    sid = str(plan.get("agentic_session_id") or "").strip()
    return sid or None


async def _cancel_agentic_session_run(
    pool: asyncpg.Pool,
    *,
    run: Mapping[str, Any],
) -> dict[str, Any]:
    from api.ewa_platform.agentic.adapters.task_run_events import sync_and_publish_task_run_from_session
    from api.ewa_platform.agentic.kernel.state_machine import apply_session_transition
    from api.ewa_platform.persistence_pg import agentic_asyncpg as agentic_pg

    run_id = str(run.get("id") or "").strip()
    principal_id = str(run.get("principal_id") or "").strip()
    session_id = _agentic_session_id_from_run(run)
    session_cancelled = False
    if session_id and principal_id:
        session = await agentic_pg.agentic_session_fetch_for_principal(
            pool,
            session_id=session_id,
            principal_id=principal_id,
        )
        if session is not None:
            tr = await apply_session_transition(
                pool,
                session_id=session_id,
                principal_id=principal_id,
                event="cancel",
                expect_revision=int(session["session_revision"]),
                clear_lease=True,
            )
            session_cancelled = tr.ok and tr.session is not None
            if session_cancelled and tr.session is not None:
                await sync_and_publish_task_run_from_session(pool, session=tr.session)
    changed = await _terminalize_simple_run(
        pool,
        run=run,
        message="agentic_cancelled_by_user",
    )
    logger.info(
        "[STEP] companion_agentic_cancelled run_id=%s session_id=%s session_cancelled=%s changed=%s",
        run_id,
        session_id,
        session_cancelled,
        changed,
    )
    return {
        "ok": True,
        "cancelled": changed or session_cancelled,
        "run_id": run_id,
        "agentic_session_id": session_id,
    }


async def cancel_companion_task_run_for_user(
    pool: asyncpg.Pool,
    db: AsyncSession,
    *,
    run: Mapping[str, Any],
    oauth_user_id: str | None,
) -> dict[str, Any]:
    """Cancel one companion task run when allowed for the current user."""

    intent = str(run.get("intent_kind") or "").strip()
    if intent in MUSIC_ASYNC_INTENT_KINDS:
        return await cancel_companion_music_run_for_user(
            pool,
            db,
            run=run,
            oauth_user_id=oauth_user_id,
        )
    if intent in IMAGE_ASYNC_INTENT_KINDS:
        return await _cancel_image_run_for_user(pool, db, run=run, oauth_user_id=oauth_user_id)
    if intent == "action_workflow" and _is_user_action_workflow(run):
        return await _cancel_user_workflow_run(pool, db, run=run, oauth_user_id=oauth_user_id)
    if intent == "agentic_session":
        return await _cancel_agentic_session_run(pool, run=run)
    return {"ok": False, "reason": "not_cancellable"}


def is_companion_task_run_cancellable(run: Mapping[str, Any]) -> bool:
    intent = str(run.get("intent_kind") or "").strip()
    status = str(run.get("status") or "").strip().lower()
    if status not in _ACTIVE_STATUSES:
        return False
    if _is_confirmation_claim_in_progress(run):
        return False
    if intent in MUSIC_ASYNC_INTENT_KINDS:
        return True
    if intent in IMAGE_ASYNC_INTENT_KINDS:
        return True
    if intent == "agentic_session":
        return True
    return intent == "action_workflow" and _is_user_action_workflow(run)


__all__ = (
    "cancel_companion_task_run_for_user",
    "is_companion_task_run_cancellable",
)
