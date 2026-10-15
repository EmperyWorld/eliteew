# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression locks for companion folder intent (root default / explicit create / reuse).
# Related:
# - api/ewa_platform/companion/orchestration/companion_folder_intent.py
# - documentation/product/ewa/EWA-COMPANION-FILE-CATALOG.md
# ---

from __future__ import annotations

from api.ewa_platform.companion.orchestration.companion_folder_intent import (
    named_task_key_from_label,
    parse_companion_folder_intent,
)
from api.ewa_platform.companion.orchestration.flows.doc_create import (
    _doc_create_output_limits,
    _doc_create_scale_for_request,
)


def test_folder_intent_defaults_to_root_even_with_agentic_session() -> None:
    target = parse_companion_folder_intent(
        "создай документ plan.md и напиши в нём план запуска",
        {"_agentic_session_id": "sess-uuid-1", "name": "plan.md"},
    )
    assert target.mode == "root"
    assert target.task_key is None
    assert target.folder_item_id is None


def test_folder_intent_create_from_russian_phrase() -> None:
    target = parse_companion_folder_intent(
        "создай папку «Проекты» и файл roadmap.md",
        {},
    )
    expected_key = named_task_key_from_label("Проекты")
    assert target.mode == "create"
    assert target.folder_label == "Проекты"
    assert target.task_key == expected_key
    assert expected_key.startswith("named-")


def test_folder_intent_reuse_quoted_folder() -> None:
    target = parse_companion_folder_intent(
        "положи файл в папку «Проекты»",
        {},
    )
    assert target.mode == "reuse"
    assert target.reuse_query == "Проекты"


def test_folder_intent_explicit_tool_args_create() -> None:
    target = parse_companion_folder_intent(
        "create a document",
        {"create_folder": True, "folder_name": "Launch"},
    )
    assert target.mode == "create"
    assert target.folder_label == "Launch"
    assert target.task_key == named_task_key_from_label("Launch")


def test_folder_intent_explicit_folder_item_id() -> None:
    target = parse_companion_folder_intent(
        "save here",
        {"folder_item_id": "ewa-task-named-abcdef0123456789"},
    )
    assert target.mode == "reuse"
    assert target.folder_item_id == "ewa-task-named-abcdef0123456789"


def test_doc_create_scale_brief_vs_long() -> None:
    assert _doc_create_scale_for_request("создай файл note.md кратко чеклист") == "brief"
    assert _doc_create_scale_for_request("напиши подробный доклад по запуску") == "long"
    assert _doc_create_scale_for_request("создай документ plan.md и напиши план") == "standard"


def test_doc_create_output_limits_follow_scale() -> None:
    bmin, bmax, bpasses = _doc_create_output_limits(user_line="кратко заметка на полстраницы")
    assert bmax <= 3_500
    assert bmin <= 400
    assert bpasses <= 2

    smin, smax, spasses = _doc_create_output_limits(user_line="создай документ с планом")
    assert smax <= 12_000
    assert smin <= 1_200
    assert spasses <= 3

    lmin, lmax, _ = _doc_create_output_limits(user_line="подробный развёрнутый доклад")
    assert lmin >= 8_000
    assert lmax >= 24_000
