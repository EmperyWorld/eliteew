# ---
# EliteEW · Empery World · https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for Music Evolution recipe feature extraction and corpus quality summary.
# Invariants:
# - Golden Music Evolution lanes are included; unrelated tracks without Evolution metadata are excluded.
# Related:
# - api/services/music_evolution_recipe_features.py
# ---

from __future__ import annotations

from api.services.music_evolution_recipe_features import (
    corpus_quality_summary,
    is_xl_base_recipe_metadata,
    recipe_features_from_metadata,
)


def test_is_xl_base_recipe_metadata_v2_base() -> None:
    assert is_xl_base_recipe_metadata({"ugs_workflow": "v2_base"}) is True
    assert is_xl_base_recipe_metadata({"music_evolution_run_id": "abc"}) is True
    assert is_xl_base_recipe_metadata({"music_generator_model_scope": "xl_sft_lora"}) is True
    assert is_xl_base_recipe_metadata({"ugs_workflow": "turbo"}) is False


def test_recipe_features_counts_sung_lines() -> None:
    md = {
        "ugs_workflow": "v2_base",
        "music_generator_lyrics": "[Verse 1]\nПервая строка куплета\n[Chorus]\nПрипевная строка здесь\n",
        "music_generator_language": "ru",
    }
    features = recipe_features_from_metadata(md)
    assert features["is_xl_base"] is True
    assert features["sung_line_count"] >= 2
    assert features["cyrillic_line_count"] >= 2


def test_corpus_quality_summary_from_items() -> None:
    summary = corpus_quality_summary(
        [
            {"quality_signal": 5, "sung_line_count": 12, "duration_seconds": 100, "style": "luna", "vocal": "female"},
            {"quality_signal": 1, "sung_line_count": 14, "duration_seconds": 110, "style": "rock", "vocal": "male"},
        ]
    )
    assert summary["liked_count"] == 2
    assert summary["median_sung_lines"] == 14
