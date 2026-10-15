# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Finalize companion task runs (doc_create, etc.) when agentic HITL gate is confirmed/cancelled.
# Invariants:
# - Bound awaiting_human node is marked terminal after companion confirm/cancel.
# - policy_json.unified_content_id is set when a document is created.
# Related:
# - api/ewa_platform/agentic/respond.py
# - api/ewa_platform/companion/orchestration/task_run_confirm.py
# ---

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any, Literal

import asyncpg

from api.ewa_platform.companion.orchestration.run_lifecycle import run_revision
from api.ewa_platform.companion.orchestration.tool_result_utils import as_mapping_dict
from api.ewa_platform.persistence_pg import agentic_asyncpg as agentic_pg
from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg

logger = logging.getLogger(__name__)

Decision = Literal["confirm", "cancel"]


def companion_pending_task_run_id_from_act_raw(raw: Mapping[str, Any] | None) -> str | None:
    if not isinstance(raw, Mapping):
        return None
    task_run = raw.get("task_run")
    if not isinstance(task_run, Mapping):
        return None
    rid = str(task_run.get("id") or "").strip()
    return rid or None


def _created_content_id_from_confirm_outcome(outcome: Mapping[str, Any]) -> str | None:
    task_run = outcome.get("task_run")
    if isinstance(task_run, Mapping):
        result_payload = as_mapping_dict(task_run.get("result_payload"))
        cid = str(result_payload.get("created_unified_content_id") or "").strip()
        if cid:
            return cid
    for action in outcome.get("actions") or []:
        if not isinstance(action, Mapping):
            continue
        cid = str(action.get("unified_content_id") or "").strip()
        if cid:
            return cid
    return None


def _outcome_from_terminal_companion_run(
    pending_run: Mapping[str, Any],
    *,
    decision: Decision,
) -> dict[str, Any] | None:
    """Idempotent replay when companion confirm already applied (e.g. prior 500 after doc create)."""

    status = str(pending_run.get("status") or "").strip().lower()
    if decision == "confirm" and status == "completed":
        result_payload = as_mapping_dict(pending_run.get("result_payload"))
        created_id = str(result_payload.get("created_unified_content_id") or "").strip()
        actions: list[dict[str, Any]] = []
        if created_id:
            actions.append(
                {
                    "type": "open_app",
                    "app_component": "DocEditor",
                    "unified_content_id": created_id,
                    "companion_surface_only": True,
                }
            )
        return {
            "reply": "Продолжаю выполнение.",
            "actions": actions,
            "task_run": dict(pending_run),
            "idempotent_replay": True,
        }
    if decision == "cancel" and status == "cancelled":
        return {
            "reply": "Задача отменена.",
            "actions": [],
            "task_run": dict(pending_run),
            "idempotent_replay": True,
        }
    return None


async def _resolve_companion_pending_run(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    gate: Mapping[str, Any],
    bound_node: Mapping[str, Any] | None,
) -> dict[str, Any] | None:
    run_id = str(gate.get("companion_pending_task_run_id") or "").strip()
    if run_id:
        return await companion_pg.companion_task_run_fetch_for_principal(
            pool,
            run_id=run_id,
            principal_id=principal_id,
        )

    return None


async def finalize_hitl_companion_pending(
    pool: asyncpg.Pool,
    *,
    session: Mapping[str, Any],
    principal_id: str,
    decision: Decision,
    active_nodes: list[Mapping[str, Any]],
) -> dict[str, Any]:
    """Apply companion confirm/cancel for gates opened by needs_confirm tool acts."""

    gate = session.get("gate_json")
    if not isinstance(gate, Mapping):
        return {"ok": True, "skipped": True, "reason": "no_gate"}

    bound_node_id = str(gate.get("bound_node_id") or "").strip()
    bound_node = next(
        (n for n in active_nodes if str(n.get("id") or "") == bound_node_id),
        None,
    )
    if bound_node is None and bound_node_id:
        return {"ok": False, "reason": "bound_node_drift"}

    pending_run = await _resolve_companion_pending_run(
        pool,
        principal_id=principal_id,
        gate=gate,
        bound_node=bound_node,
    )
    if pending_run is None:
        return {"ok": True, "skipped": True, "reason": "no_companion_pending_run"}

    from api.ewa_platform.companion.orchestration.task_run_confirm import apply_companion_task_run_confirmation

    outcome = _outcome_from_terminal_companion_run(pending_run, decision=decision)
    if outcome is None:
        run_status = str(pending_run.get("status") or "").strip().lower()
        if run_status != "awaiting_confirmation":
            return {
                "ok": False,
                "reason": f"companion_run_not_confirmable:{run_status}",
            }
        outcome = await apply_companion_task_run_confirmation(
            pool,
            run=pending_run,
            principal_id=principal_id,
            decision=decision,
            expect_run_revision=run_revision(pending_run),
        )
        if outcome.get("revision_conflict"):
            replay = _outcome_from_terminal_companion_run(pending_run, decision=decision)
            if replay is None:
                refreshed = await companion_pg.companion_task_run_fetch_for_principal(
                    pool,
                    run_id=str(pending_run.get("id") or ""),
                    principal_id=principal_id,
                )
                if refreshed is not None:
                    replay = _outcome_from_terminal_companion_run(refreshed, decision=decision)
            if replay is None:
                return {"ok": False, "reason": "revision_conflict", "revision_conflict": True}
            outcome = replay

    session_id = str(session.get("id") or "")
    node_status = "completed" if decision == "confirm" else "failed"
    summary = str(outcome.get("reply") or "").strip()[:4000]
    created_content_id: str | None = None
    if decision == "confirm":
        created_content_id = _created_content_id_from_confirm_outcome(outcome)

    checkpoint_row = None
    if bound_node_id:
        checkpoint_row = await agentic_pg.agentic_checkpoint_append(
            pool,
            session_id=session_id,
            kind="gate",
            node_id=bound_node_id,
            payload_json={
                "event": "hitl_companion_finalize",
                "decision": decision,
                "companion_task_run_id": str(pending_run.get("id") or ""),
                "created_unified_content_id": created_content_id,
                "summary": summary,
                "idempotent_replay": bool(outcome.get("idempotent_replay")),
            },
        )
        result_ref = str(checkpoint_row.get("id")) if checkpoint_row else None
        await agentic_pg.agentic_task_tree_update(
            pool,
            node_id=bound_node_id,
            session_id=session_id,
            status=node_status,
            result_ref=result_ref,
            result_summary=summary or f"companion_{decision}",
            gate_json={},
            mark_completed=decision == "confirm",
        )

    policy_patch: dict[str, Any] | None = None
    if created_content_id:
        policy_raw = session.get("policy_json")
        policy = dict(policy_raw) if isinstance(policy_raw, Mapping) else {}
        policy["unified_content_id"] = created_content_id
        policy_patch = policy

    logger.info(
        "[STEP] agentic_hitl_companion_finalize session_id=%s decision=%s run_id=%s content_id=%s node_id=%s",
        session_id,
        decision,
        pending_run.get("id"),
        created_content_id or "",
        bound_node_id or "",
    )
    return {
        "ok": True,
        "skipped": False,
        "companion_outcome": outcome,
        "created_unified_content_id": created_content_id,
        "policy_json": policy_patch,
        "bound_node_id": bound_node_id or None,
        "node_status": node_status,
    }
