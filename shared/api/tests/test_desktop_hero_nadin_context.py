# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract lock for Desktop AI Chat hero nadin_context (first-contact sense sync).
# Invariants:
# - Hero is allowlisted; cues fire on sense-sync language; kernel has truth/boundary guards.
# Related:
# - api/services/desktop_chat_ensemble/heroes.py
# - documentation/product/DESKTOP-ENSEMBLE-HERO-AUTHORING.md
# ---
"""Regression for nadin_context catalog wiring."""

from __future__ import annotations

import pytest

pytest.importorskip("sqlalchemy")

from api.services.desktop_chat.solo_slot import SOLO_HERO_COMPETENCE_MULTIPLIER
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
from api.services.desktop_chat_ensemble.settings import (
    ALLOWED_DESKTOP_HERO_IDS,
    ASSISTANT_DESKTOP_HERO_IDS,
)

_HID = "nadin_context"


def test_nadin_in_allowlist_and_catalog() -> None:
    assert _HID in ALLOWED_DESKTOP_HERO_IDS
    assert _HID in ASSISTANT_DESKTOP_HERO_IDS
    assert HERO_SHORT_LABEL[_HID] == "Найдин"
    assert _HID in HERO_CATALOG
    assert HERO_CATALOG[_HID]["avatarPublicPath"] == "/avatars/nadin_context.webp"
    assert HERO_CATALOG[_HID]["label"] == "Найдин | Контекст и Смыслы"
    assert "Правда:" in HERO_PROMPT_KERNEL[_HID]
    assert "Границы:" in HERO_PROMPT_KERNEL[_HID]
    assert compose_solo_system_prompt(_HID)


def test_nadin_slot_profile_sense_sync_axes() -> None:
    profile = HERO_SLOT_PROFILE[_HID]
    assert profile["behavioral"] == 3
    assert profile["brand_voice"] == 3
    assert profile["engineering"] == 1
    assert profile["finance"] == 1
    assert profile["research"] >= 2


def test_nadin_cues_on_sense_sync_language() -> None:
    cues = HERO_CAPABILITY_CUES[_HID]
    assert "образ результата" in cues
    assert "раппорт" in cues
    assert "когнитивн" in cues
    hit = hero_ids_cued_by_text(
        "Нужна синхронизация смыслов и образ результата перед ТЗ для команды",
        [_HID, "viktor_engineer"],
    )
    assert hit == [_HID]
    miss = hero_ids_cued_by_text("привет, как дела?", [_HID])
    assert miss == []


def test_nadin_solo_slot_multiplier() -> None:
    assert SOLO_HERO_COMPETENCE_MULTIPLIER[_HID] == 1.1
