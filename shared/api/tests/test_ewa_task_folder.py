# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for EwaFile per-task folder id helpers and companion workspace membership.
# Related:
# - api/utils/ewa_task_folder.py
# - api/utils/ewa_companion_folder.py
# ---

from __future__ import annotations

from datetime import UTC, datetime

import pytest

from api.utils.ewa_companion_folder import content_row_in_companion_folder
from api.utils.ewa_task_folder import (
    EWA_TASK_FOLDER_PREFIX,
    derive_ewa_task_folder_short_title,
    ewa_task_folder_item_id,
    format_ewa_task_folder_label,
    is_ewa_task_folder_item_id,
    sanitize_ewa_task_folder_label,
)


def test_ewa_task_folder_item_id_stable() -> None:
    key = "bbf19ed4-1111-2222-3333-444444444444"
    assert ewa_task_folder_item_id(key) == f"{EWA_TASK_FOLDER_PREFIX}{key}"
    assert is_ewa_task_folder_item_id(ewa_task_folder_item_id(key))


def test_ewa_task_folder_item_id_sanitizes() -> None:
    assert ewa_task_folder_item_id("Task A/B!") == f"{EWA_TASK_FOLDER_PREFIX}task-a-b"


def test_ewa_task_folder_item_id_rejects_empty() -> None:
    with pytest.raises(ValueError):
        ewa_task_folder_item_id("   ")


def test_sanitize_folder_label() -> None:
    assert sanitize_ewa_task_folder_label("  Создай отчёт  ") == "Создай отчёт"
    assert sanitize_ewa_task_folder_label("") == "Task"


def test_format_ewa_task_folder_label_stamps_utc() -> None:
    when = datetime(2026, 7, 10, 1, 23, tzinfo=UTC)
    assert format_ewa_task_folder_label("Создай отчёт", when=when) == "Создай отчёт_2026-07-10_0123"
    stamped = "Отчёт_2026-07-10_0123"
    assert format_ewa_task_folder_label(stamped, when=when) == stamped


def test_derive_short_title_from_long_goal() -> None:
    long_goal = (
        "Создать документ с правилами работы и форматами взаимодействия Зера и Тани. "
        "Затем сделать тезисный план презентации EliteEW и алгоритм знакомства."
    )
    short = derive_ewa_task_folder_short_title(long_goal)
    assert len(short) <= 40
    assert "Затем" not in short
    assert short.startswith("Создать документ")
    when = datetime(2026, 7, 10, 1, 52, tzinfo=UTC)
    label = format_ewa_task_folder_label(long_goal, when=when)
    assert label.endswith("_2026-07-10_0152")
    assert len(label) < 60
    assert "форматами взаимодействия_2026" not in label


def test_derive_short_title_prefers_filename_stem() -> None:
    assert derive_ewa_task_folder_short_title("правила_работы_Зеры_и_Тани.txt") == "правила работы Зеры и Тани"


def test_content_row_accepts_task_subfolder() -> None:
    assert content_row_in_companion_folder({"folder_item_id": "ewa_file"}) is True
    assert content_row_in_companion_folder({"folder_item_id": "ewa-task-abc"}) is True
    assert content_row_in_companion_folder({"folder_item_id": "documents"}) is False
