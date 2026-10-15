# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Russian-first agentic tool error summaries and unhandled None mapping.
# ---

from __future__ import annotations

from api.ewa_platform.agentic.agentic_locale import (
    agentic_gate_title_default,
    agentic_tool_none_summary,
)
from api.ewa_platform.agentic.tools.bridge import map_tool_result_to_act_result


def test_gate_title_default_russian() -> None:
    assert agentic_gate_title_default({}) == "Нужно ваше решение"


def test_file_open_none_summary_russian() -> None:
    summary = agentic_tool_none_summary("file_open", session={"goal_json": {"text": "Исследование ДВФУ"}})
    assert "каталог" in summary.lower()
    assert "file_open" not in summary


def test_map_tool_result_none_is_unhandled_with_russian_summary() -> None:
    act = map_tool_result_to_act_result(
        "catalog_list",
        None,
        session={"goal_json": {"text": "Найди документы"}},
    )
    assert act.status == "unhandled"
    assert "каталог" in act.summary.lower()


def test_map_tool_result_file_create_ok_without_task_run_is_error() -> None:
    act = map_tool_result_to_act_result(
        "file_create",
        {"status": "ok", "reply": "Укажите текст", "data": {}, "task_run": None},
    )
    assert act.status == "error"
    assert "Укажите текст" in act.summary
