# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract lock for seven new Desktop AI Chat heroes (Имя Отчество cohort).
# Invariants:
# - Allowlist, catalog avatar paths, kernels, cues, and solo multipliers stay wired.
# Related:
# - api/services/desktop_chat_ensemble/heroes_prompt_data.py
# - documentation/product/DESKTOP-ENSEMBLE-HERO-AUTHORING.md
# ---
"""Regression for mark/elena/kristian/artur/diana/viktor_lvovich/nikolas cohort."""

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
from api.services.desktop_chat_ensemble.settings import ALLOWED_DESKTOP_HERO_IDS

_NEW = (
    "mark_arkadevich",
    "elena_valeryevna",
    "kristian_romanovich",
    "artur_sergeevich",
    "diana_igorevna",
    "viktor_lvovich",
    "nikolas_alekseevich",
)

_LABELS = {
    "mark_arkadevich": "Марк Аркадьевич",
    "elena_valeryevna": "Елена Валерьевна",
    "kristian_romanovich": "Кристиан Романович",
    "artur_sergeevich": "Артур Сергеевич",
    "diana_igorevna": "Диана Игоревна",
    "viktor_lvovich": "Виктор Львович",
    "nikolas_alekseevich": "Николас Алексеевич",
}

_AVATARS_ROOT = Path(__file__).resolve().parents[2] / "web" / "frontend" / "public"


@pytest.mark.parametrize("hid", _NEW)
def test_new_hero_wired(hid: str) -> None:
    assert hid in ALLOWED_DESKTOP_HERO_IDS
    assert HERO_SHORT_LABEL[hid] == _LABELS[hid]
    assert hid in HERO_CATALOG
    assert HERO_CATALOG[hid]["avatarPublicPath"] == f"/avatars/{hid}.webp"
    assert (_AVATARS_ROOT / f"avatars/{hid}.webp").is_file()
    assert "Правда:" in HERO_PROMPT_KERNEL[hid]
    assert "Границы:" in HERO_PROMPT_KERNEL[hid]
    assert compose_solo_system_prompt(hid)
    assert hid in HERO_SLOT_PROFILE
    assert hid in HERO_CAPABILITY_CUES
    assert hid in SOLO_HERO_COMPETENCE_MULTIPLIER


def test_new_hero_cues_fire() -> None:
    roster = list(_NEW)
    assert "mark_arkadevich" in hero_ids_cued_by_text("нужен разворот компании и board memo", roster)
    assert "elena_valeryevna" in hero_ids_cued_by_text("какой точный ROI этого эксперимента", roster)
    assert "kristian_romanovich" in hero_ids_cued_by_text("нужен big idea для рекламной кампании", roster)
    assert "artur_sergeevich" in hero_ids_cued_by_text("просадка воронки продаж и CRM", roster)
    assert "diana_igorevna" in hero_ids_cued_by_text("поднять hiring bar и talent map", roster)
    assert "viktor_lvovich" in hero_ids_cued_by_text("карта альянсов и M&A экспансии", roster)
    assert "nikolas_alekseevich" in hero_ids_cued_by_text("moonshot и capital allocation", roster)
