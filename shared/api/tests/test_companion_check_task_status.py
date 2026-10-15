# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for ``check_task_status`` intent parsing and status normalization.
# Invariants:
# - No asyncpg / HTTP.
# Related:
# - api/ewa_platform/companion/orchestration/check_task_status.py
# ---

from __future__ import annotations

from api.ewa_platform.companion.orchestration.check_task_status import (
    build_task_status_snapshot,
    extract_task_run_id,
    format_task_status_reply,
    normalize_task_run_status,
    user_line_requests_check_task_status,
)

_SAMPLE_ID = "15f5a8df-e5f0-41d1-a625-7105e091e869"


def test_extract_task_run_id_from_line() -> None:
    line = f"статус задачи {_SAMPLE_ID}"
    assert extract_task_run_id(line) == _SAMPLE_ID


def test_user_line_requests_check_task_status_with_uuid() -> None:
    assert user_line_requests_check_task_status(f"проверь статус {_SAMPLE_ID}")
    assert user_line_requests_check_task_status(f"check_task_status({_SAMPLE_ID})")


def test_user_line_requests_check_task_status_without_uuid_requires_intent() -> None:
    assert user_line_requests_check_task_status("check_task_status()")
    assert user_line_requests_check_task_status("статус задачи")
    assert not user_line_requests_check_task_status("продолжай")
    assert not user_line_requests_check_task_status("привет")


def test_normalize_task_run_status_vocabulary() -> None:
    assert normalize_task_run_status("running") == "RUNNING"
    assert normalize_task_run_status("pending") == "PENDING"
    assert normalize_task_run_status("completed") == "COMPLETED"
    assert normalize_task_run_status("failed") == "FAILED"
    assert normalize_task_run_status("awaiting_confirmation") == "AWAITING_CONFIRMATION"


def test_user_line_requests_check_task_status_casual_music() -> None:
    assert user_line_requests_check_task_status("как там с записью?")
    assert user_line_requests_check_task_status("что с песней?")


def test_format_task_status_reply_no_raw_ids() -> None:
    run = {
        "id": _SAMPLE_ID,
        "status": "running",
        "intent_kind": "music_generation_background",
        "steps": [
            {"step_index": 2, "status": "running", "title": "Generate audio"},
        ],
        "plan_payload": {"theme_preview": "Лето"},
    }
    snap = build_task_status_snapshot(run)
    reply = format_task_status_reply(snap, user_line="как там с песней?")
    assert _SAMPLE_ID not in reply
    assert "check_task_status" not in reply
    assert "Запись песни" in reply
    assert "Лето" in reply


def test_build_task_status_snapshot_music_progress() -> None:
    run = {
        "id": _SAMPLE_ID,
        "status": "running",
        "intent_kind": "music_generation_background",
        "steps": [
            {"step_index": 1, "status": "completed", "title": "Lyrics"},
            {"step_index": 2, "status": "running", "title": "Generate audio"},
        ],
        "plan_payload": {"theme_preview": "Summer"},
    }
    snap = build_task_status_snapshot(run)
    assert snap["normalized_status"] == "RUNNING"
    assert snap["progress"]["kind"] == "music_pipeline"
    assert snap["progress"]["current_stage"] >= 1
