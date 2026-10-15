# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract lock for Desktop AI Chat hero nikita_dvizhev (real-estate expert).
# Invariants:
# - Hero is allowlisted; cues fire on real-estate language; kernel has truth/boundary guards.
# Related:
# - api/services/desktop_chat_ensemble/heroes.py
# - documentation/product/DESKTOP-ENSEMBLE-HERO-AUTHORING.md
# ---
"""Regression for nikita_dvizhev catalog wiring."""

from __future__ import annotations

import pytest

pytest.importorskip("sqlalchemy")

from api.services.desktop_chat_ensemble.heroes import (
    HERO_CAPABILITY_CUES,
    HERO_SHORT_LABEL,
    HERO_SLOT_PROFILE,
    hero_ids_cued_by_text,
)
from api.services.desktop_chat_ensemble.heroes_prompt_data import (
    HERO_CATALOG,
    HERO_PROMPT_KERNEL,
    compose_solo_system_prompt,
)
from api.services.desktop_chat_ensemble.settings import ALLOWED_DESKTOP_HERO_IDS

_HID = "nikita_dvizhev"


def test_nikita_in_allowlist_and_catalog() -> None:
    assert _HID in ALLOWED_DESKTOP_HERO_IDS
    assert HERO_SHORT_LABEL[_HID] == "Никита Движев"
    assert _HID in HERO_CATALOG
    assert HERO_CATALOG[_HID]["avatarPublicPath"] == "/avatars/nikita_dvizhev.webp"
    assert "Правда:" in HERO_PROMPT_KERNEL[_HID]
    assert "Границы:" in HERO_PROMPT_KERNEL[_HID]
    assert compose_solo_system_prompt(_HID)


def test_nikita_slot_profile_has_real_estate_axes() -> None:
    profile = HERO_SLOT_PROFILE[_HID]
    assert profile["rigor"] >= 2
    assert profile["finance"] >= 2
    assert profile["growth"] >= 2
    assert profile["research"] >= 2


def test_nikita_cues_on_realty_language() -> None:
    cues = HERO_CAPABILITY_CUES[_HID]
    assert "недвижимост" in cues
    assert "риелтор" in cues
    hit = hero_ids_cued_by_text(
        "Нужен план продажи квартиры через Циан и эксклюзив с собственником",
        [_HID, "viktor_engineer"],
    )
    assert hit == [_HID]
    miss = hero_ids_cued_by_text("привет, как дела?", [_HID])
    assert miss == []
