# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression locks for confirming agentic-session task-run mirrors.
# Invariants:
# - Stale task-run revisions must fail before agentic HITL side effects.
# Related:
# - api/ewa_platform/agentic/respond.py
# ---

from __future__ import annotations

import pytest

from api.ewa_platform.agentic.respond import apply_agentic_task_run_confirm


@pytest.mark.asyncio
async def test_agentic_task_run_confirm_rejects_stale_run_revision() -> None:
    run = {
        "id": "run-agentic",
        "intent_kind": "agentic_session",
        "run_revision": 7,
        "plan_payload": {"agentic_session_id": "sess-1"},
    }

    out = await apply_agentic_task_run_confirm(
        pool=object(),  # type: ignore[arg-type]
        run=run,
        principal_id="p-1",
        decision="confirm",
        expect_run_revision=6,
    )

    assert out == {"ok": False, "revision_conflict": True, "task_run": run}
