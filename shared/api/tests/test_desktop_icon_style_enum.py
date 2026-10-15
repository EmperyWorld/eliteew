# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract lock: DesktopIconStyle accepts static icon-only packs (slate/clay/ember).
# Invariants:
# - New pack literals parse via StrEnum; unknown values fail.
# Related:
# - api/schemas/user_profile.py
# - documentation/product/desktop_icon_system.md
# ---

from __future__ import annotations

import pytest
from pydantic import TypeAdapter, ValidationError

from api.schemas.user_profile import DesktopIconStyle, UIPreferences


def test_desktop_icon_style_accepts_static_packs() -> None:
    adapter = TypeAdapter(DesktopIconStyle)
    for key in ("slate", "clay", "ember", "prism", "mercury", "vhs"):
        assert adapter.validate_python(key) == DesktopIconStyle(key)


def test_ui_preferences_accepts_ember_icon_style() -> None:
    prefs = UIPreferences.model_validate({"desktop_icon_style": "ember"})
    assert prefs.desktop_icon_style == DesktopIconStyle.EMBER


def test_desktop_icon_style_rejects_unknown() -> None:
    with pytest.raises(ValidationError):
        TypeAdapter(DesktopIconStyle).validate_python("not-a-pack")
