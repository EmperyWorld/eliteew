# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for legacy desktop app_component remap helper.
# Invariants:
# - EliteChat and ArlyQueenChat map to GAFChatApp; unknown ids pass through.
# Related:
# - api/services/desktop_app_component_legacy.py
# ---

from api.services.desktop_app_component_legacy import (
    LEGACY_DESKTOP_APP_COMPONENT_ALIASES,
    remap_legacy_desktop_app_component,
)


def test_remap_legacy_desktop_app_component_elite_chat() -> None:
    assert remap_legacy_desktop_app_component("EliteChat") == "GAFChatApp"
    assert remap_legacy_desktop_app_component("ArlyQueenChat") == "GAFChatApp"


def test_remap_legacy_desktop_app_component_passthrough() -> None:
    assert remap_legacy_desktop_app_component("MusicPlayer") == "MusicPlayer"
    assert remap_legacy_desktop_app_component(None) is None


def test_legacy_alias_map_covers_removed_chat_apps() -> None:
    assert LEGACY_DESKTOP_APP_COMPONENT_ALIASES["EliteChat"] == "GAFChatApp"
    assert LEGACY_DESKTOP_APP_COMPONENT_ALIASES["ArlyQueenChat"] == "GAFChatApp"
