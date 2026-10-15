# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for desktop bootstrap helpers and re-export import chain via desktop.py.
# Invariants:
# - SYSTEM_FOLDER_KEYS stable; position helpers pick first free App Store grid slot.
# Related:
# - api/routers/desktop_bootstrap.py
# ---

from types import SimpleNamespace

from api.routers.desktop import (
    SYSTEM_FOLDER_KEYS,
    _cleanup_legacy_desktop_state,
    ensure_app_store_icon,
    ensure_system_folders,
)
from api.routers.desktop_bootstrap import (
    _normalize_item_position,
    _pick_app_store_position,
)


def test_system_folder_keys_import_chain() -> None:
    assert "documents" in SYSTEM_FOLDER_KEYS
    assert "ewa_file" in SYSTEM_FOLDER_KEYS
    assert len(SYSTEM_FOLDER_KEYS) == 8


def test_normalize_item_position_valid_dict() -> None:
    assert _normalize_item_position({"x": 130, "y": 240}) == {"x": 130, "y": 240}


def test_normalize_item_position_rejects_invalid() -> None:
    assert _normalize_item_position(None) is None
    assert _normalize_item_position({"x": "bad", "y": 1}) is None


def test_pick_app_store_position_skips_occupied() -> None:
    occupied = SimpleNamespace(position={"x": 130, "y": 20})
    pos = _pick_app_store_position([occupied])
    assert (pos["x"], pos["y"]) != (130, 20)


def test_bootstrap_public_callables_importable() -> None:
    assert callable(ensure_system_folders)
    assert callable(ensure_app_store_icon)
    assert callable(_cleanup_legacy_desktop_state)
    from api.routers.desktop_bootstrap import reconcile_desktop_app_item_names_from_catalog

    assert callable(reconcile_desktop_app_item_names_from_catalog)
