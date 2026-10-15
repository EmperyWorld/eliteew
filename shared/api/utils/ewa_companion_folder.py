# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Canonical desktop folder for EWA companion file ops — ``folder_item_id`` on ``unified_content`` and
# ``desktop_items.item_id`` / ``system_key`` for the non-deletable system folder **EwaFile**.
# Invariants:
# - Companion catalogue queries (list/search/rename/delete) scope to **EwaFile** + nested ``ewa-task-*``
#   folders + ``owner_only``.
# - Matches ``SYSTEM_FOLDER_KEYS`` entry in ``api/routers/desktop.py``.
# Related:
# - api/ewa_platform/companion/storage/catalog_scope.py
# - api/utils/ewa_task_folder.py
# - documentation/product/ewa/EWA-COMPANION-FILE-CATALOG.md
# ---

from __future__ import annotations

from typing import Any

from api.utils.ewa_task_folder import is_ewa_task_folder_item_id

EWA_COMPANION_FOLDER_ITEM_ID = "ewa_file"
EWA_COMPANION_FOLDER_DISPLAY_NAME = "EwaFile"


def companion_list_content_kwargs() -> dict[str, Any]:
    """Keyword args for ``ContentQueryService.list_content`` in companion catalogue paths.

    ``folder_item_id=ewa_file`` browse includes nested ``ewa-task-*`` rows in storage list SQL.
    """

    return {
        "folder_item_id": EWA_COMPANION_FOLDER_ITEM_ID,
        "owner_only": True,
    }


def content_row_in_companion_folder(row: Any) -> bool:
    """True when a list/get row belongs to EwaFile or a nested companion task folder."""

    fid = getattr(row, "folder_item_id", None)
    if fid is None and isinstance(row, dict):
        fid = row.get("folder_item_id")
    fid_s = str(fid or "").strip()
    return fid_s == EWA_COMPANION_FOLDER_ITEM_ID or is_ewa_task_folder_item_id(fid_s)


__all__ = (
    "EWA_COMPANION_FOLDER_DISPLAY_NAME",
    "EWA_COMPANION_FOLDER_ITEM_ID",
    "companion_list_content_kwargs",
    "content_row_in_companion_folder",
)
