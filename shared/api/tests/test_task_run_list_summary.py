# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---

from __future__ import annotations

from api.ewa_platform.companion.orchestration.task_run_list_summary import (
    trim_task_run_for_list_summary,
)


def test_trim_task_run_for_list_summary_strips_heavy_fields() -> None:
    run = {
        "id": "run-1",
        "status": "running",
        "plan_payload": {
            "kind": "agentic_session_v1",
            "agentic_session_id": "sess-1",
            "session_status": "executing",
            "mission_answer_summary": "Готово: создан документ.",
            "primary_result": "Документ создан.",
            "recommended_next_action": "Откройте документ.",
            "plan_summary": "x" * 600,
            "internal_blob": {"nodes": [1, 2, 3]},
        },
        "result_payload": {
            "unified_content_id": "content-1",
            "debug_trace": "huge",
        },
        "confirmation_state": {
            "kind": "gate",
            "state": "confirming",
            "prompt": "ok",
            "gate": {"kind": "confirm", "prompt": "ok", "extra": "kept"},
        },
        "error_payload": {"code": "E1", "stack": "trace"},
        "surface_blocks": [{"id": "block-1"}],
    }

    trimmed = trim_task_run_for_list_summary(run)

    assert trimmed["surface_blocks"] == []
    assert "internal_blob" not in trimmed["plan_payload"]
    assert len(trimmed["plan_payload"]["plan_summary"]) <= 481
    assert trimmed["plan_payload"]["agentic_session_id"] == "sess-1"
    assert trimmed["plan_payload"]["mission_answer_summary"] == "Готово: создан документ."
    assert trimmed["plan_payload"]["primary_result"] == "Документ создан."
    assert trimmed["plan_payload"]["recommended_next_action"] == "Откройте документ."
    assert trimmed["result_payload"] == {"unified_content_id": "content-1"}
    assert trimmed["confirmation_state"] == {
        "kind": "gate",
        "state": "confirming",
        "prompt": "ok",
        "gate": {"kind": "confirm", "prompt": "ok", "extra": "kept"},
    }
    assert trimmed["error_payload"] == {"code": "E1"}
