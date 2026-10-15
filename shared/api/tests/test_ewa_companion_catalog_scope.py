# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Boundary tests: companion catalogue queries pass EwaFile folder scope (owner-only, folder_item_id=ewa_file).
# Invariants:
# - ``companion_list_content_kwargs`` is the single source of scope for file tools and catalog find.
# Related:
# - api/utils/ewa_companion_folder.py
# ---

from __future__ import annotations

from unittest.mock import MagicMock

from api.utils.ewa_companion_folder import (
    EWA_COMPANION_FOLDER_DISPLAY_NAME,
    EWA_COMPANION_FOLDER_ITEM_ID,
    companion_list_content_kwargs,
    content_row_in_companion_folder,
)


def test_companion_folder_constants() -> None:
    assert EWA_COMPANION_FOLDER_ITEM_ID == "ewa_file"
    assert EWA_COMPANION_FOLDER_DISPLAY_NAME == "EwaFile"


def test_companion_list_content_kwargs() -> None:
    kw = companion_list_content_kwargs()
    assert kw["folder_item_id"] == EWA_COMPANION_FOLDER_ITEM_ID
    assert kw["owner_only"] is True


def test_content_row_in_companion_folder() -> None:
    row = MagicMock(folder_item_id=EWA_COMPANION_FOLDER_ITEM_ID)
    assert content_row_in_companion_folder(row) is True
    row.folder_item_id = "documents"
    assert content_row_in_companion_folder(row) is False
