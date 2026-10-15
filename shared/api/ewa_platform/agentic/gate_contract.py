# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# HITL gate JSON contract: build, expiry check, respond-time validation.
# Invariants:
# - bound_node_id captured at gate open time.
# - gate expect_session_revision is the revision *before* gate_required (audit only); current
#   session_revision is always +1 after the transition — do not compare them for HITL accept.
# Related:
# - api/ewa_platform/agentic/kernel/loop.py
# - api/ewa_platform/agentic/respond.py
# ---

from __future__ import annotations

from collections.abc import Mapping
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4


def gate_is_expired(gate_json: Mapping[str, Any]) -> bool:
    exp = str(gate_json.get("expires_at") or "").strip()
    if not exp:
        return False
    try:
        dt = datetime.fromisoformat(exp.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=UTC)
        return datetime.now(tz=UTC) > dt
    except ValueError:
        return False


def build_gate_json(
    *,
    kind: str,
    prompt: str,
    session_revision: int,
    title: str | None = None,
    body: str | None = None,
    options: list[str] | None = None,
    bound_node_id: str | None = None,
    bound_checkpoint_seq: int | None = None,
    companion_pending_task_run_id: str | None = None,
    pending_tool: str | None = None,
    ttl_hours: float = 24.0,
) -> dict[str, Any]:
    expires_at = (datetime.now(tz=UTC) + timedelta(hours=ttl_hours)).isoformat()
    payload: dict[str, Any] = {
        "gate_id": str(uuid4()),
        "kind": kind,
        "prompt": prompt,
        "expires_at": expires_at,
        "expect_session_revision": session_revision,
    }
    if title:
        payload["title"] = title
    if body:
        payload["body"] = body
    if options:
        payload["options"] = options
    if bound_node_id:
        payload["bound_node_id"] = bound_node_id
    if bound_checkpoint_seq is not None:
        payload["bound_checkpoint_seq"] = bound_checkpoint_seq
    if companion_pending_task_run_id:
        payload["companion_pending_task_run_id"] = companion_pending_task_run_id
    if pending_tool:
        payload["pending_tool"] = pending_tool
    return payload


def validate_gate_response(
    session: Mapping[str, Any],
    *,
    expect_session_revision: int | None,
    active_nodes: list[Mapping[str, Any]] | None = None,
) -> tuple[bool, str | None]:
    """Return (ok, reason) before human_respond transition."""

    gate = session.get("gate_json")
    if not isinstance(gate, Mapping):
        return True, None

    if gate_is_expired(gate):
        return False, "gate_expired"

    sess_rev = int(session.get("session_revision") or 0)
    # Optimistic lock: client snapshot must match current DB revision.
    if expect_session_revision is not None and int(expect_session_revision) != sess_rev:
        return False, "revision_conflict"

    bound_node = str(gate.get("bound_node_id") or "").strip()
    if not bound_node:
        return True, None

    nodes = active_nodes or []
    node = next((n for n in nodes if str(n.get("id") or "") == bound_node), None)
    if node is None:
        return False, "bound_node_drift"
    st = str(node.get("status") or "")
    if st in {"completed", "failed", "cancelled"}:
        return False, "bound_node_terminal"
    return True, None
