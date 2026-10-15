# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for golden Music Evolution soloist catalog (10 styles).
# Invariants:
# - Exactly ten soloists; ``ray`` is default; ``nebula`` maps to genre ``luna``.
# - Legacy ids resolve via alias map (e.g. ``lula`` -> ``nebula``).
# Related:
# - api/services/music_evolution_soloists.py
# ---

from __future__ import annotations

from api.schemas.music_evolution import MusicEvolutionRunCreate
from api.services.music_evolution_pipeline import normalize_music_evolution_input
from api.services.music_evolution_soloists import (
    GOLDEN_SOLOIST_IDS,
    apply_soloist_to_run_create,
    finalize_soloist_evolution_tags,
    get_soloist,
    resolve_soloist_id,
    soloist_options_for_api,
    soloist_production_overrides,
)


def test_soloist_options_golden_ten() -> None:
    options = soloist_options_for_api()
    ids = {item.value for item in options}
    assert ids == set(GOLDEN_SOLOIST_IDS)
    assert len(options) == 10
    assert all(not item.freeform for item in options)
    ray = next(item for item in options if item.value == "ray")
    assert ray.label_ru == "Рэй"
    assert ray.genre == "pop"
    nebula = next(item for item in options if item.value == "nebula")
    assert nebula.label_ru == "Туманность"
    assert nebula.genre == "luna"


def test_apply_soloist_overrides_locks_ray_pop() -> None:
    body = MusicEvolutionRunCreate(
        theme="Новый день",
        soloist="ray",
        vocal="male",
        genre="techno",
        language="en",
        mood="calm",
        meaning_tags=["life"],
    )
    locked = apply_soloist_to_run_create(body)
    assert locked.vocal == "female"
    assert locked.language == "ru"
    assert locked.genre == "pop"
    assert locked.mood == "warm"
    assert locked.meaning_tags == []


def test_normalize_locks_tempest_duet_dnb() -> None:
    normalized = normalize_music_evolution_input(
        MusicEvolutionRunCreate(
            theme="Два импульса",
            soloist="tempest",
            vocal="female",
            genre="pop",
            language="en",
            mood="energetic",
            meaning_tags=["road"],
        )
    )
    assert normalized["soloist"] == "tempest"
    assert normalized["vocal"] == "duet"
    assert normalized["genre"] == "drum_and_bass"
    assert normalized["vocal_locked"] is True
    assert normalized["mood"] == "energetic"
    assert normalized["meaning_tags"] == []


def test_legacy_lula_alias_resolves_to_nebula() -> None:
    assert resolve_soloist_id("lula") == "nebula"
    assert get_soloist("lula").id == "nebula"


def test_unknown_soloist_falls_back_to_ray() -> None:
    assert resolve_soloist_id("unknown-id") == "ray"
    assert get_soloist(None).id == "ray"


def test_pulse_production_overrides_techno_corridor() -> None:
    params = soloist_production_overrides(soloist_id="pulse", mood="energetic", seed=42, stable_seed=7)
    assert params["keyscale"] == "A minor"
    assert 127 <= int(params["bpm"]) <= 133


def test_nebula_production_overrides_luna_corridor() -> None:
    params = soloist_production_overrides(soloist_id="nebula", mood="ironic", seed=42, stable_seed=7)
    assert params["keyscale"] == "F# minor"
    assert 108 <= int(params["bpm"]) <= 120


def test_finalize_ray_tags_anchor_pop() -> None:
    tags = finalize_soloist_evolution_tags(
        "ray",
        "techno",
        bpm=118,
        vocal="female",
        vocal_profile="bright clear female",
    )
    assert "Modern Russian pop Ray" in tags
    assert "Dark warehouse techno" not in tags


def test_finalize_tempest_tags_dnb_duet() -> None:
    tags = finalize_soloist_evolution_tags(
        "tempest",
        "pop ballad",
        bpm=174,
        vocal="duet",
        vocal_profile="male baritone and female airy",
    )
    low = tags.lower()
    assert "drum and bass duet tempest" in low
    assert "reese bass" in low
