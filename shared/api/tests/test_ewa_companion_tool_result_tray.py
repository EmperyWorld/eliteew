# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Contract tests for tray outcome augmentation on terminal tool errors with empty SPA actions.
# Related:
# - api/ewa_platform/companion/orchestration/tool_result_utils.py
# - api/ewa_platform/companion/orchestration/task_orchestrator.py
# ---

from __future__ import annotations

from api.ewa_platform.companion.orchestration import task_orchestrator
from api.ewa_platform.companion.orchestration.tool_result_utils import (
    augment_tool_result_actions_for_tray,
)


def test_augment_injects_notice_on_error_with_empty_actions() -> None:
    out = augment_tool_result_actions_for_tray(
        status="error",
        actions=[],
        rationale="Could not open the app.",
    )
    assert out == [
        {
            "type": "companion_action_notice",
            "outcome": "failed",
            "rationale": "Could not open the app.",
        }
    ]


def test_augment_stamps_task_run_id_on_nonempty_actions() -> None:
    actions = [{"type": "open_app", "app_component": "MusicPlayer"}]
    task_run = {"id": "run-abc"}
    out = augment_tool_result_actions_for_tray(
        status="ok",
        actions=list(actions),
        rationale="",
        task_run=task_run,
    )
    assert out == [{**actions[0], "task_run_id": "run-abc"}]


def test_attach_task_run_id_preserves_existing_id() -> None:
    actions = [{"type": "open_app", "app_component": "DocEditor", "task_run_id": "keep-me"}]
    out = augment_tool_result_actions_for_tray(
        status="ok",
        actions=actions,
        rationale="",
        task_run={"id": "other"},
    )
    assert out[0]["task_run_id"] == "keep-me"


def test_augment_injects_notice_with_task_run_id() -> None:
    out = augment_tool_result_actions_for_tray(
        status="error",
        actions=[],
        rationale="Could not open the app.",
        task_run={"id": "run-err"},
    )
    assert out == [
        {
            "type": "companion_action_notice",
            "outcome": "failed",
            "rationale": "Could not open the app.",
            "task_run_id": "run-err",
        }
    ]


def test_augment_leaves_ok_and_nonempty_actions_unchanged() -> None:
    actions = [{"type": "open_app", "app_component": "MusicPlayer"}]
    assert (
        augment_tool_result_actions_for_tray(
            status="ok",
            actions=list(actions),
            rationale="",
        )
        == actions
    )
    assert (
        augment_tool_result_actions_for_tray(
            status="error",
            actions=list(actions),
            rationale="ignored",
        )
        == actions
    )


def test_tool_result_to_response_adds_notice_for_empty_error() -> None:
    resp = task_orchestrator._tool_result_to_response(
        {
            "tool": "app_open",
            "status": "error",
            "reply": "",
            "actions": [],
        },
        user_line="open mystery app",
    )
    assert resp["actions"] == [
        {
            "type": "companion_action_notice",
            "outcome": "failed",
            "rationale": task_orchestrator._EMPTY_ERROR_FALLBACK_EN,
        }
    ]
    assert resp["reply"] == task_orchestrator._EMPTY_ERROR_FALLBACK_EN
