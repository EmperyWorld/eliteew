# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression tests for XL Base quality-loop helpers and Comfy debug prompt summaries.
# Invariants:
# - Test fixtures must mirror the production XL Base Comfy template parameters.
# - Batch payload mutation must preserve validated lyrics/tags contracts.
# Related:
# - api/services/music_generator_xl_base_quality_loop.py
# - documentation/product/MUSIC-GENERATOR-XL-BASE-QUALITY-RUBRIC.md
# ---
"""Unit tests: XL Base quality loop (Comfy debug compare, batch pipeline)."""

from __future__ import annotations

from uuid import uuid4

import pytest

from api.services.music_generator_liked_recipe import effective_params_from_recipe_metadata
from api.services.music_generator_xl_base_quality_loop import (
    apply_xl_base_pipeline_to_batch_ugs_input,
    compare_comfy_debug_prompts,
    extract_comfy_prompt_summary,
)


def _good_lyrics() -> str:
    return """[Verse 1]
(Arrangement: 120 BPM, guitar)
(Voice: female, soft)
Первая строка куплета здесь,
Вторая строка для проверки текста.

[Chorus]
(Arrangement: 120 BPM, full band)
(Voice: female, anthemic)
Это припев, который поют,
Снова припев, снова идут.

[Verse 2]
Ещё один куплет для полноты,
Чтобы хватило строк для ACE.
"""


def _comfy_debug(lyrics: str, *, tags: str = "120 BPM pop, female vocal") -> dict:
    return {
        "comfy_history": {
            "abc": {
                "prompt": [
                    None,
                    None,
                    {
                        "94": {
                            "inputs": {
                                "lyrics": lyrics,
                                "tags": tags,
                                "language": "ru",
                                "bpm": 120,
                                "keyscale": "C major",
                            }
                        },
                        "109": {"inputs": {"value": 424242}},
                        "3": {
                            "inputs": {
                                "cfg": 2,
                                "steps": 50,
                                "sampler_name": "euler",
                                "scheduler": "simple",
                            }
                        },
                    },
                ]
            }
        }
    }


def test_extract_comfy_prompt_summary_sung_lines() -> None:
    summary = extract_comfy_prompt_summary(_comfy_debug(_good_lyrics()))
    assert summary["found"] is True
    assert summary["seed_applied"] == 424242
    assert summary["sung_lines"] >= 6
    assert summary["tags_len"] > 0


def test_compare_comfy_debug_skeleton_vs_full() -> None:
    skeleton = "[Intro]\n(Arrangement: glam rock)\n(Voice: male)\n[Verse 1]\n(Arrangement: drums)\n(Voice: male)\n"
    before = _comfy_debug(skeleton)
    after = _comfy_debug(_good_lyrics())
    cmp = compare_comfy_debug_prompts(before, after)
    assert cmp["before"]["sung_lines"] == 0
    assert cmp["after"]["sung_lines"] >= 6
    assert cmp["pipeline_improved_sung_lines"] is True
    assert cmp["deltas"]["sung_lines"] >= 6


def test_effective_params_from_recipe_metadata() -> None:
    cid = str(uuid4())
    md = {
        "music_generator_lyrics": _good_lyrics(),
        "music_generator_tags": "120 BPM, pop, female vocal",
        "music_generator_style": "pop",
        "music_generator_bpm": 118,
        "music_generator_language": "ru",
    }
    eff = effective_params_from_recipe_metadata(
        md,
        content_id=cid,
        content_name="Track A",
        duration_seconds=30,
    )
    assert eff["lyrics"].startswith("[Verse 1]")
    assert eff["bpm"] == 118
    assert eff["liked_recipe_content_id"] == cid


def test_effective_params_missing_lyrics_raises() -> None:
    with pytest.raises(ValueError, match="music_generator_lyrics"):
        effective_params_from_recipe_metadata({}, content_id="x", content_name="y", duration_seconds=30)


def test_apply_xl_base_pipeline_to_batch_ugs_input() -> None:
    ugs = {
        "lyrics": _good_lyrics(),
        "tags": "120 BPM pop, female vocal, [Style] pop",
        "language": "ru",
        "style": "pop",
        "bpm": 120,
        "ugs_workflow": "v2_base",
    }
    out, _obs = apply_xl_base_pipeline_to_batch_ugs_input(ugs)
    assert out.get("xl_base_lyrics_sung_lines", 0) >= 6
    assert len(out.get("tags") or "") > 0


def test_apply_xl_base_pipeline_rejects_skeleton() -> None:
    skeleton = "[Intro]\n(Arrangement: a)\n(Voice: b)\n[Verse 1]\n(Arrangement: c)\n(Voice: d)\n"
    ugs = {"lyrics": skeleton, "tags": "pop", "language": "ru", "style": "pop", "ugs_workflow": "v2_base"}
    with pytest.raises(ValueError, match="sung"):
        apply_xl_base_pipeline_to_batch_ugs_input(ugs)
