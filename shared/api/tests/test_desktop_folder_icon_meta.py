# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for user folder icon meta merge/sanitize helpers.
# Invariants:
# - Unknown icon ids are dropped; system folders never keep folder_icon from client.
# Related:
# - api/services/desktop_folder_icon.py
# ---

from api.services.desktop_folder_icon import (
    USER_FOLDER_ICON_META_KEY,
    merge_desktop_item_meta_for_write,
    normalize_user_folder_icon,
    sanitize_desktop_item_meta_for_persist,
)


def test_normalize_user_folder_icon_allowlist() -> None:
    assert normalize_user_folder_icon("star") == "star"
    assert normalize_user_folder_icon(" unknown ") is None
    assert normalize_user_folder_icon(42) is None


def test_merge_desktop_item_meta_for_write_preserves_other_keys() -> None:
    merged = merge_desktop_item_meta_for_write(
        {"project_guard_released": True},
        {USER_FOLDER_ICON_META_KEY: "heart"},
        allow_folder_icon=True,
    )
    assert merged[USER_FOLDER_ICON_META_KEY] == "heart"
    assert merged["project_guard_released"] is True


def test_sanitize_desktop_item_meta_for_persist_drops_system_folder_icon() -> None:
    meta = sanitize_desktop_item_meta_for_persist(
        item_type="FOLDER",
        is_system=True,
        meta={USER_FOLDER_ICON_META_KEY: "star"},
    )
    assert USER_FOLDER_ICON_META_KEY not in meta
