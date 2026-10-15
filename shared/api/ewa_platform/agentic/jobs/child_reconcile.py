# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Gate G5 — bind accepted async companion child runs to agentic awaiting_child nodes
# and terminalize those nodes when the child run completes/fails/cancels.
# Invariants:
# - child_run_id lives in task-tree metadata_json (no schema migration).
# - Missing/unbound child_run_id does not invent completion; poll leaves node waiting.
# - E5: failed child reconciliation writes failed/last_error/claim cleanup atomically.
# Related:
# - api/ewa_platform/agentic/jobs/step_executor.py
# - documentation/product/ewa/EWA-FORENSIC-AUDIT-RECOVERY-PLAN-2026-07-09.md (Gate G5)
# - documentation/product/ewa/EWA-ECOSYSTEM-VULNERABILITY-MAP-2026-07-09.md (E5)
# ---

from __future__ import annotations

import logging
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Any

from api.ewa_platform.agentic.hitl_companion_finalize import companion_pending_task_run_id_from_act_raw
from api.ewa_platform.agentic.jobs.enqueue import enqueue_agentic_step
from api.ewa_platform.companion.orchestration.run_lifecycle import is_run_terminal
from api.ewa_platform.persistence_pg import agentic_asyncpg as agentic_pg
from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg

logger = logging.getLogger(__name__)


def child_run_id_from_act_raw(raw: Mapping[str, Any] | None) -> str | None:
    """Extract companion child task-run id from an accepted tool act payload."""

    return companion_pending_task_run_id_from_act_raw(raw)


def child_run_id_from_node(node: Mapping[str, Any]) -> str | None:
    meta = node.get("metadata_json")
    if not isinstance(meta, Mapping):
        return None
    rid = str(meta.get("child_run_id") or "").strip()
    return rid or None


def metadata_with_child_run_bind(
    node: Mapping[str, Any],
    *,
    child_run_id: str | None,
    tool_name: str = "",
) -> dict[str, Any]:
    """Merge child_run_id into node metadata for awaiting_child binding."""

    meta = dict(node.get("metadata_json") or {}) if isinstance(node.get("metadata_json"), Mapping) else {}
    rid = str(child_run_id or "").strip()
    if rid:
        meta["child_run_id"] = rid
        meta["awaiting_child_bound_at"] = datetime.now(UTC).isoformat()
        if tool_name:
            meta["awaiting_child_tool"] = str(tool_name)[:80]
    return meta


async def _terminalize_awaiting_child_node(
    pool: Any,
    *,
    node: Mapping[str, Any],
    child: Mapping[str, Any],
) -> bool:
    """Mark one awaiting_child node completed/failed from a terminal companion child run."""

    node_id = str(node.get("id") or "").strip()
    session_id = str(node.get("session_id") or "").strip()
    if not node_id or not session_id:
        return False
    child_status = str(child.get("status") or "").strip().lower()
    child_id = str(child.get("id") or "").strip()
    summary = ""
    result_payload = child.get("result_payload")
    if isinstance(result_payload, Mapping):
        summary = str(
            result_payload.get("track_name")
            or result_payload.get("content_id")
            or result_payload.get("created_unified_content_id")
            or ""
        ).strip()
    if not summary:
        error_payload = child.get("error_payload")
        if isinstance(error_payload, Mapping):
            summary = str(error_payload.get("message") or "").strip()
    if not summary:
        summary = f"child_run_{child_status}:{child_id}"[:4000]

    if child_status == "completed":
        await agentic_pg.agentic_task_tree_mark_completed(
            pool,
            node_id=node_id,
            session_id=session_id,
            result_summary=summary[:4000],
        )
    else:
        await agentic_pg.agentic_task_tree_mark_failed_from_child(
            pool,
            node_id=node_id,
            session_id=session_id,
            result_summary=summary[:4000],
            last_error=f"child_run_{child_status}"[:2000],
        )
    logger.info(
        "[STEP] agentic_awaiting_child_terminalized session_id=%s node_id=%s child_run_id=%s child_status=%s",
        session_id,
        node_id,
        child_id,
        child_status,
    )
    return True


async def reconcile_awaiting_child_nodes_for_session(
    pool: Any,
    *,
    session: Mapping[str, Any],
) -> int:
    """Poll companion child runs for this session's awaiting_child nodes; return progressed count."""

    session_id = str(session.get("id") or "").strip()
    if not session_id:
        return 0
    nodes = await agentic_pg.agentic_task_tree_list(
        pool,
        session_id=session_id,
        statuses=["awaiting_child"],
    )
    progressed = 0
    for node in nodes:
        child_id = child_run_id_from_node(node)
        if not child_id:
            logger.debug(
                "[STEP] agentic_awaiting_child_unbound session_id=%s node_id=%s",
                session_id,
                node.get("id"),
            )
            continue
        child = await companion_pg.companion_task_run_fetch(pool, run_id=child_id)
        if child is None:
            await agentic_pg.agentic_task_tree_mark_failed_from_child(
                pool,
                node_id=str(node.get("id") or ""),
                session_id=session_id,
                result_summary=f"child_run_missing:{child_id}"[:4000],
                last_error="child_run_missing",
            )
            progressed += 1
            continue
        if not is_run_terminal(str(child.get("status") or "")):
            continue
        if await _terminalize_awaiting_child_node(pool, node=node, child=child):
            progressed += 1
    return progressed


async def maybe_complete_agentic_awaiting_child_from_run(
    pool: Any,
    *,
    child_run_id: str,
    principal_id: str | None = None,
) -> int:
    """Fast-path callback when a companion child run reaches a terminal status."""

    rid = str(child_run_id or "").strip()
    if not rid:
        return 0
    child = await companion_pg.companion_task_run_fetch(pool, run_id=rid)
    if child is None or not is_run_terminal(str(child.get("status") or "")):
        return 0
    nodes = await agentic_pg.agentic_task_tree_find_awaiting_child_by_run(pool, child_run_id=rid)
    progressed = 0
    sessions_to_kick: set[tuple[str, str]] = set()
    for node in nodes:
        if await _terminalize_awaiting_child_node(pool, node=node, child=child):
            progressed += 1
            sid = str(node.get("session_id") or "").strip()
            pid = str(principal_id or child.get("principal_id") or "").strip()
            if sid and pid:
                sessions_to_kick.add((sid, pid))
    for sid, pid in sessions_to_kick:
        enqueue_agentic_step(session_id=sid, principal_id=pid)
    return progressed


__all__ = [
    "child_run_id_from_act_raw",
    "child_run_id_from_node",
    "metadata_with_child_run_bind",
    "maybe_complete_agentic_awaiting_child_from_run",
    "reconcile_awaiting_child_nodes_for_session",
]
