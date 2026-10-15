# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract lock for Desktop AI Chat IT department cohort (it_* heroes).
# Invariants:
# - Six IT ids allowlisted; catalog cohort=it_dept; default ensemble stays assistants.
# Related:
# - api/services/desktop_chat_ensemble/heroes_it_dept_data.py
# - documentation/product/DESKTOP-ENSEMBLE-HERO-AUTHORING.md
# ---
"""Regression for IT department hero cohort wiring."""

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
    DEFAULT_ENSEMBLE_HERO_ORDER,
    IT_DEPT_DESKTOP_HERO_IDS,
    sanitize_desktop_chat_settings_payload,
)

_IT_IDS = (
    "it_kernel",
    "it_schema",
    "it_canvas",
    "it_pipeliner",
    "it_sentinel",
    "it_relay",
)


@pytest.mark.parametrize("hid", _IT_IDS)
def test_it_hero_in_allowlist_catalog_and_prompt(hid: str) -> None:
    assert hid in IT_DEPT_DESKTOP_HERO_IDS
    assert hid in ALLOWED_DESKTOP_HERO_IDS
    assert hid not in ASSISTANT_DESKTOP_HERO_IDS
    assert hid in HERO_SHORT_LABEL
    assert hid in HERO_CATALOG
    assert HERO_CATALOG[hid].get("cohort") == "it_dept"
    assert HERO_CATALOG[hid]["avatarPublicPath"] == f"/avatars/{hid}.webp"
    assert "Правда:" in HERO_PROMPT_KERNEL[hid]
    assert "Границы:" in HERO_PROMPT_KERNEL[hid]
    assert "Язык: русский" in HERO_PROMPT_KERNEL[hid]
    assert compose_solo_system_prompt(hid)
    assert hid in SOLO_HERO_COMPETENCE_MULTIPLIER
    assert SOLO_HERO_COMPETENCE_MULTIPLIER[hid] >= 1.0


def test_it_cohort_size_and_default_ensemble_assistants_only() -> None:
    assert len(IT_DEPT_DESKTOP_HERO_IDS) == 6
    assert DEFAULT_ENSEMBLE_HERO_ORDER == ASSISTANT_DESKTOP_HERO_IDS
    assert not any(hid.startswith("it_") for hid in DEFAULT_ENSEMBLE_HERO_ORDER)


def test_it_slot_profiles_engineering_heavy() -> None:
    for hid in _IT_IDS:
        profile = HERO_SLOT_PROFILE[hid]
        assert profile["engineering"] >= 2
        assert profile["rigor"] >= 2


def test_it_kernel_cues_on_architecture_language() -> None:
    cues = HERO_CAPABILITY_CUES["it_kernel"]
    assert "adr" in cues
    hit = hero_ids_cued_by_text(
        "Нужен ADR и границы модулей для tech lead ревью",
        ["it_kernel", "it_schema", "likiy_sorrento"],
    )
    assert "it_kernel" in hit
    miss = hero_ids_cued_by_text("привет, как дела?", ["it_kernel"])
    assert miss == []


def test_sanitize_accepts_mixed_assistant_and_it_roster() -> None:
    settings = sanitize_desktop_chat_settings_payload(
        {
            "desktop_chat_mode": "ensemble",
            "desktop_ensemble_ids": [
                "likiy_sorrento",
                "it_kernel",
                "it_schema",
                "arlyqueen",
            ],
        }
    )
    roster = settings.get("desktop_ensemble_ids") or []
    assert "it_kernel" in roster
    assert "it_schema" in roster
    assert "likiy_sorrento" in roster
    assert len(roster) <= 6
