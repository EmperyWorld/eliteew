# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract lock for Collective Souls Desktop AI Chat hero cohort.
# Invariants:
# - Allowlist, catalog avatar paths, kernels, cues, and solo multipliers stay wired.
# Related:
# - api/services/desktop_chat_ensemble/heroes_collective_souls_data.py
# - documentation/product/DESKTOP-ENSEMBLE-HERO-AUTHORING.md
# ---
"""Regression for collective_souls hero cohort."""

from __future__ import annotations

from pathlib import Path

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
    COLLECTIVE_SOULS_DESKTOP_HERO_IDS,
)

_NEW = COLLECTIVE_SOULS_DESKTOP_HERO_IDS

_LABELS = {
    "nikolay_fyodorovich": "Николай Фёдорович",
    "albert_emilevich": "Альберт Эмилевич",
    "yanus_arnievich": "Янус Арниевич",
    "yan_genrihovich": "Ян Генрихович",
    "richard_joshuevich": "Ричард Джошуевич",
    "teresa_agnesovna": "Тереза Агнесовна",
}

_AVATARS_ROOT = Path(__file__).resolve().parents[2] / "web" / "frontend" / "public"


@pytest.mark.parametrize("hid", _NEW)
def test_collective_soul_hero_wired(hid: str) -> None:
    assert hid in ALLOWED_DESKTOP_HERO_IDS
    assert HERO_SHORT_LABEL[hid] == _LABELS[hid]
    assert hid in HERO_CATALOG
    assert HERO_CATALOG[hid].get("cohort") == "collective_souls"
    assert HERO_CATALOG[hid]["avatarPublicPath"] == f"/avatars/{hid}.webp"
    assert (_AVATARS_ROOT / f"avatars/{hid}.webp").is_file()
    assert "Правда:" in HERO_PROMPT_KERNEL[hid]
    assert "Границы:" in HERO_PROMPT_KERNEL[hid]
    assert "выдавать себя за реального исторического" in HERO_PROMPT_KERNEL[hid].casefold()
    assert compose_solo_system_prompt(hid)
    assert hid in HERO_SLOT_PROFILE
    assert hid in HERO_CAPABILITY_CUES
    assert hid in SOLO_HERO_COMPETENCE_MULTIPLIER


def test_collective_soul_cues_fire() -> None:
    roster = list(_NEW)
    assert "nikolay_fyodorovich" in hero_ids_cued_by_text("долгий горизонт и система энергии", roster)
    assert "albert_emilevich" in hero_ids_cued_by_text("благоговение перед жизнью и этика заботы", roster)
    assert "yanus_arnievich" in hero_ids_cued_by_text("open source ядро linux", roster)
    assert "yan_genrihovich" in hero_ids_cued_by_text("парламент детей и педагогика", roster)
    assert "richard_joshuevich" in hero_ids_cued_by_text("gnu gpl copyleft", roster)
    assert "teresa_agnesovna" in hero_ids_cued_by_text("тихое милосердие и присутствие", roster)
