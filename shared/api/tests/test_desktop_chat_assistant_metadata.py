# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Validate assistant message metadata enrichment with hero prompt-version provenance.
# Invariants:
# - `desktop_hero_prompt_version` is injected for hero responses.
# - `desktop_ensemble_prompt_versions` is injected for contributor rosters.
# Related:
# - api/services/desktop_chat/service.py
# ---
"""Tests for desktop assistant metadata prompt provenance."""

from __future__ import annotations

from api.services.desktop_chat.service import _assistant_metadata_with_prompt_versions
from api.services.desktop_chat_ensemble.heroes_prompt_data import get_hero_prompt_version


def test_assistant_metadata_enriches_solo_hero_prompt_version() -> None:
    out = _assistant_metadata_with_prompt_versions(
        {
            "desktop_prompt_mode": "solo",
            "desktop_hero_id": "likiy_sorrento",
        }
    )
    assert out is not None
    assert out["desktop_hero_prompt_version"] == get_hero_prompt_version("likiy_sorrento")
    assert out.get("desktop_prompt_mode") == "solo"


def test_assistant_metadata_enriches_ensemble_contributors_versions() -> None:
    out = _assistant_metadata_with_prompt_versions(
        {
            "desktop_hero_id": "arlyqueen",
            "desktop_ensemble_contributors": ["arlyqueen", "akimbo"],
            "desktop_ensemble_joint": True,
        }
    )
    assert out is not None
    assert out["desktop_hero_prompt_version"] == get_hero_prompt_version("arlyqueen")
    versions = out.get("desktop_ensemble_prompt_versions")
    assert isinstance(versions, dict)
    assert versions["arlyqueen"] == get_hero_prompt_version("arlyqueen")
    assert versions["akimbo"] == get_hero_prompt_version("akimbo")
