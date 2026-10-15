# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for ``sanitize_patch_desktop_config_wire`` (allowlist + API-facing normalisation).
# Invariants:
# - No live HTTP; deterministic dict in/out only.
# Related:
# - api/ewa_platform/contracts/desktop_config_patch_wire.py
# - api/models/desktop.py (``Theme`` StrEnum)
# ---
"""Tests for desktop config patch wire sanitiser."""

from __future__ import annotations

from api.ewa_platform.contracts.desktop_config_patch_wire import sanitize_patch_desktop_config_wire


def test_sanitize_theme_normalises_to_api_str_enum() -> None:
    assert sanitize_patch_desktop_config_wire({"theme": "auto"}) == {"theme": "AUTO"}
    assert sanitize_patch_desktop_config_wire({"theme": "AUTO"}) == {"theme": "AUTO"}
    assert sanitize_patch_desktop_config_wire({"theme": "dark"}) == {"theme": "DARK"}
    assert sanitize_patch_desktop_config_wire({"theme": "Light"}) == {"theme": "LIGHT"}


def test_sanitize_theme_rejects_unknown() -> None:
    assert sanitize_patch_desktop_config_wire({"theme": "sepia"}) == {}
