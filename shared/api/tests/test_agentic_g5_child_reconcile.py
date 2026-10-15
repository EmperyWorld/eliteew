# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Gate G5 locks: awaiting_child binds child_run_id and terminalizes when child completes.
# Invariants:
# - Unbound awaiting_child does not invent completion.
# - Terminal child run completes/fails the bound parent node.
# Related:
# - api/ewa_platform/agentic/jobs/child_reconcile.py
# - documentation/product/ewa/EWA-FORENSIC-AUDIT-RECOVERY-PLAN-2026-07-09.md (Gate G5)
# ---

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock

import pytest

from api.ewa_platform.agentic.jobs import child_reconcile as cr


@pytest.mark.asyncio
async def test_reconcile_completes_bound_awaiting_child(monkeypatch: pytest.MonkeyPatch) -> None:
    node = {
        "id": "node-1",
        "session_id": "sess-1",
        "status": "awaiting_child",
        "metadata_json": {"child_run_id": "child-1"},
    }
    child = {
        "id": "child-1",
        "status": "completed",
        "principal_id": "p1",
        "result_payload": {"track_name": "Neon"},
        "error_payload": {},
    }
    mark_completed = AsyncMock(return_value={**node, "status": "completed"})
    monkeypatch.setattr(cr.agentic_pg, "agentic_task_tree_list", AsyncMock(return_value=[node]))
    monkeypatch.setattr(cr.companion_pg, "companion_task_run_fetch", AsyncMock(return_value=child))
    monkeypatch.setattr(cr.agentic_pg, "agentic_task_tree_mark_completed", mark_completed)

    progressed = await cr.reconcile_awaiting_child_nodes_for_session(
        object(),
        session={"id": "sess-1", "principal_id": "p1"},
    )

    assert progressed == 1
    mark_completed.assert_awaited_once()
    completed_call = mark_completed.await_args
    assert completed_call is not None
    assert completed_call.kwargs["node_id"] == "node-1"
    assert "Neon" in completed_call.kwargs["result_summary"]


@pytest.mark.asyncio
async def test_reconcile_skips_unbound_awaiting_child(monkeypatch: pytest.MonkeyPatch) -> None:
    node = {
        "id": "node-2",
        "session_id": "sess-1",
        "status": "awaiting_child",
        "metadata_json": {},
    }
    mark_completed = AsyncMock()
    update = AsyncMock()
    monkeypatch.setattr(cr.agentic_pg, "agentic_task_tree_list", AsyncMock(return_value=[node]))
    monkeypatch.setattr(cr.companion_pg, "companion_task_run_fetch", AsyncMock())
    monkeypatch.setattr(cr.agentic_pg, "agentic_task_tree_mark_completed", mark_completed)
    monkeypatch.setattr(cr.agentic_pg, "agentic_task_tree_update", update)

    progressed = await cr.reconcile_awaiting_child_nodes_for_session(
        object(),
        session={"id": "sess-1"},
    )

    assert progressed == 0
    mark_completed.assert_not_called()
    update.assert_not_called()


@pytest.mark.asyncio
async def test_maybe_complete_from_run_kicks_step(monkeypatch: pytest.MonkeyPatch) -> None:
    from contextlib import asynccontextmanager
    from unittest.mock import MagicMock

    node = {
        "id": "node-3",
        "session_id": "sess-9",
        "status": "awaiting_child",
        "metadata_json": {"child_run_id": "child-9"},
    }
    child: dict[str, Any] = {
        "id": "child-9",
        "status": "failed",
        "principal_id": "p9",
        "result_payload": {},
        "error_payload": {"message": "ugs_timeout"},
    }
    update = AsyncMock(return_value={**node, "status": "failed"})
    enqueue = MagicMock()
    conn = AsyncMock()
    conn.execute = AsyncMock(return_value="UPDATE 1")

    @asynccontextmanager
    async def _acquire():
        yield conn

    pool = MagicMock()
    pool.acquire = _acquire

    monkeypatch.setattr(cr.companion_pg, "companion_task_run_fetch", AsyncMock(return_value=child))
    monkeypatch.setattr(
        cr.agentic_pg,
        "agentic_task_tree_find_awaiting_child_by_run",
        AsyncMock(return_value=[node]),
    )
    monkeypatch.setattr(cr.agentic_pg, "agentic_task_tree_update", update)
    monkeypatch.setattr(cr, "enqueue_agentic_step", enqueue)

    progressed = await cr.maybe_complete_agentic_awaiting_child_from_run(
        pool,
        child_run_id="child-9",
        principal_id="p9",
    )

    assert progressed == 1
    update.assert_awaited()
    enqueue.assert_called_once_with(session_id="sess-9", principal_id="p9")


def test_metadata_with_child_run_bind_sets_id() -> None:
    meta = cr.metadata_with_child_run_bind(
        {"metadata_json": {"keep": 1}},
        child_run_id="run-x",
        tool_name="image_generation",
    )
    assert meta["keep"] == 1
    assert meta["child_run_id"] == "run-x"
    assert meta["awaiting_child_tool"] == "image_generation"
