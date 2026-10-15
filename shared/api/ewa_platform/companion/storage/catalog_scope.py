# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Re-export companion catalogue scope helpers for ``ewa_platform`` (folder **EwaFile** only).
# Invariants:
# - All companion ``list_content`` / runtime catalogue reads must use ``companion_list_content_kwargs()``.
# Related:
# - api/utils/ewa_companion_folder.py
# ---

from __future__ import annotations

from api.utils.ewa_companion_folder import (
    EWA_COMPANION_FOLDER_DISPLAY_NAME,
    EWA_COMPANION_FOLDER_ITEM_ID,
    companion_list_content_kwargs,
    content_row_in_companion_folder,
)

__all__ = (
    "EWA_COMPANION_FOLDER_DISPLAY_NAME",
    "EWA_COMPANION_FOLDER_ITEM_ID",
    "companion_list_content_kwargs",
    "content_row_in_companion_folder",
)
