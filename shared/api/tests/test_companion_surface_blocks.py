# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for EWA companion Output Surface V2 block shaping.
# Invariants:
# - Surface blocks are derived from task-run rows only and do not mutate task state.
# Related:
# - api/ewa_platform/companion/surface_blocks.py
# ---

from __future__ import annotations

from api.ewa_platform.companion.surface_blocks import (
    attach_surface_blocks_to_chat_payload,
    attach_surface_blocks_to_run,
    surface_blocks_for_task_run,
)


def _run(status: str = "completed") -> dict:
    return {
        "id": "run-1",
        "principal_id": "p1",
        "status": status,
        "intent_kind": "action_workflow",
        "user_message": "утренний ритуал",
        "plan_payload": {"workflow_title_ru": "Утренний ритуал"},
        "confirmation_state": {},
        "result_payload": {"ok": True},
        "error_payload": {},
        "execution_mode": "async",
        "run_revision": 3,
        "created_at": "2026-05-27T01:00:00Z",
        "steps": [
            {
                "id": "step-1",
                "step_index": 1,
                "step_kind": "theme_set",
                "status": "completed",
                "title": "theme_set",
                "output_payload": {"theme": "dark"},
            }
        ],
    }


def test_surface_blocks_for_task_run_builds_workflow_timeline() -> None:
    blocks = surface_blocks_for_task_run(_run())

    assert len(blocks) == 1
    block = blocks[0]
    assert block["kind"] == "workflow_timeline"
    assert block["run_id"] == "run-1"
    assert block["status"] == "completed"
    assert block["payload"]["steps"][0]["step_kind"] == "theme_set"


def test_surface_blocks_for_awaiting_confirmation_adds_actions() -> None:
    blocks = surface_blocks_for_task_run(_run("awaiting_confirmation"))

    assert blocks[0]["kind"] == "confirm"
    assert [action["payload"]["decision"] for action in blocks[0]["actions"][:2]] == ["confirm", "cancel"]


def test_attach_surface_blocks_to_chat_payload_mirrors_task_run() -> None:
    payload = attach_surface_blocks_to_chat_payload({"reply": "ok", "task_run": _run()})

    assert payload["surface_blocks"][0]["id"] == "task_run:run-1:workflow_timeline"
    assert payload["task_run"]["surface_blocks"][0]["run_id"] == "run-1"


def test_attach_surface_blocks_to_run_preserves_existing_blocks() -> None:
    run = _run()
    run["surface_blocks"] = [{"id": "custom"}]

    assert attach_surface_blocks_to_run(run)["surface_blocks"] == [{"id": "custom"}]
