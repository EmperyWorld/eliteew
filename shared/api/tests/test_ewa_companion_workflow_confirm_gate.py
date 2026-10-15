# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioural tests for generic workflow confirm_gate resume (Phase 4.2).
# Related:
# - api/ewa_platform/companion/workflows/action/confirm_flow.py
# ---

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock

import pytest

from api.ewa_platform.companion.workflows.action import confirm_flow


@pytest.mark.unit
def test_generic_confirm_gate_resume_enqueues_next_step(monkeypatch: pytest.MonkeyPatch) -> None:
    enqueue_calls: list[dict[str, object]] = []

    def fake_enqueue(**kwargs: object) -> str:
        enqueue_calls.append(dict(kwargs))
        return "celery-task-1"

    monkeypatch.setattr(
        "api.ewa_platform.companion.jobs.enqueue.enqueue_companion_run",
        fake_enqueue,
    )

    run_row = {
        "id": "run-wf",
        "principal_id": "p1",
        "intent_kind": "action_workflow",
        "workflow_id": "music_full_cycle_v1",
        "status": "awaiting_confirmation",
        "plan_payload": {"kind": "action_workflow", "workflow_id": "music_full_cycle_v1"},
        "confirmation_state": {
            "kind": "workflow_confirm_gate",
            "step_index": 2,
            "step_key": "confirm_play",
        },
        "run_revision": 1,
    }
    steps = [
        {"id": "s1", "step_index": 1, "step_kind": "music_generation_pipeline_v2", "status": "completed"},
        {"id": "s2", "step_index": 2, "step_kind": "confirm_gate", "status": "awaiting_confirmation"},
        {"id": "s3", "step_index": 3, "step_kind": "tool_dispatch", "status": "pending"},
    ]

    monkeypatch.setattr(confirm_flow.companion_pg, "companion_task_steps_list", AsyncMock(return_value=steps))
    monkeypatch.setattr(confirm_flow.companion_pg, "companion_task_step_update", AsyncMock())
    monkeypatch.setattr(
        confirm_flow.companion_pg,
        "companion_task_run_update",
        AsyncMock(return_value={**run_row, "status": "running"}),
    )

    out = asyncio.run(
        confirm_flow.maybe_apply_action_workflow_confirmation(
            MagicMock(),
            run=run_row,
            principal_id="p1",
            decision="confirm",
            ru_locale=True,
        ),
    )
    assert out is not None
    assert enqueue_calls
    assert enqueue_calls[0]["step_index"] == 3
    assert "Продолжаю" in str(out.get("reply") or "")
