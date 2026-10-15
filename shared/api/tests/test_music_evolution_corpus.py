# ---
# EliteEW · Empery World · https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for Music Evolution corpus scoring and XL Base filtering behavior.
# Related:
# - api/services/music_evolution_corpus.py
# ---

from __future__ import annotations

from api.services.music_evolution_corpus import score_recipe_against_input


def test_score_recipe_prefers_rich_xl_base_hints() -> None:
    rich = {
        "style": "chanson",
        "vocal": "female",
        "language": "ru",
        "sung_line_count": 12,
        "has_voice_annotations": True,
        "is_short_skeleton": False,
        "is_low_cyrillic": False,
    }
    poor = {
        "style": "chanson",
        "vocal": "female",
        "language": "ru",
        "sung_line_count": 4,
        "has_voice_annotations": False,
        "is_short_skeleton": True,
        "is_low_cyrillic": True,
    }
    normalized = {"genre": "chanson", "vocal": "female", "language": "ru"}
    rich_score = score_recipe_against_input(rich, normalized, quality_signal=5)
    poor_score = score_recipe_against_input(poor, normalized, quality_signal=5)
    assert rich_score > poor_score


def test_score_recipe_penalizes_short_skeleton() -> None:
    base = {
        "style": "pop",
        "vocal": "female",
        "language": "ru",
        "sung_line_count": 6,
        "has_voice_annotations": False,
        "is_short_skeleton": False,
        "is_low_cyrillic": False,
    }
    short = {**base, "is_short_skeleton": True}
    normalized = {"genre": "pop", "vocal": "female", "language": "ru"}
    assert score_recipe_against_input(short, normalized, quality_signal=1) < score_recipe_against_input(
        base, normalized, quality_signal=1
    )


def test_score_recipe_treats_legacy_lula_as_nebula() -> None:
    legacy = {
        "style": "luna",
        "soloist": "lula",
        "vocal": "female",
        "language": "ru",
        "sung_line_count": 12,
        "has_voice_annotations": True,
        "is_short_skeleton": False,
        "is_low_cyrillic": False,
    }
    normalized = {"genre": "luna", "soloist": "nebula", "vocal": "female", "language": "ru"}
    assert score_recipe_against_input(legacy, normalized, quality_signal=5) >= 12


def test_score_recipe_prefers_matching_soloist_and_genre() -> None:
    match = {
        "style": "techno",
        "soloist": "pulse",
        "vocal": "female",
        "language": "ru",
        "sung_line_count": 12,
        "has_voice_annotations": True,
        "is_short_skeleton": False,
        "is_low_cyrillic": False,
    }
    mismatch = {**match, "style": "luna", "soloist": "nebula"}
    normalized = {"genre": "techno", "soloist": "pulse", "vocal": "female", "language": "ru"}
    assert score_recipe_against_input(match, normalized, quality_signal=5) > score_recipe_against_input(
        mismatch, normalized, quality_signal=5
    )
