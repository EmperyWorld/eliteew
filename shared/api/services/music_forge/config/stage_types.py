# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Closed stage-type registry for MusicForge Pipeline Architect (Wave A+).
# Invariants:
# - Admin may compose stage *instances* only from these types; new types need a code handler.
# Related:
# - api/services/music_forge/config/validator.py
# - documentation/product/MUSIC-FORGE-APP.md
# ---
"""Closed vocabulary of MusicForge pipeline stage types."""

from __future__ import annotations

ALLOWED_STAGE_TYPES = frozenset(
    {
        "intent_normalize",
        "llm_generate",
        "lyrics_gate",
        "style_build",
        "lyrics_enrich",
        "audio_comfy",
        "content_persist",
    }
)

ALLOWED_LLM_UGS_TYPE_KEYS = frozenset(
    {
        "music_generator_forge_blueprint",
        "music_generator_forge_lyrics",
        "music_generator_forge_style",
    }
)

DEFAULT_PIPELINE_STAGE_SPECS: tuple[dict[str, object], ...] = (
    {
        "stage_key": "intent_normalize",
        "stage_type": "intent_normalize",
        "title_ru": "Нормализация идеи",
        "sort_order": 10,
        "settings": {"corpus": True},
    },
    {
        "stage_key": "song_blueprint",
        "stage_type": "llm_generate",
        "title_ru": "Blueprint песни",
        "sort_order": 20,
        "settings": {
            "prompt_kind": "blueprint",
            "ugs_type_key": "music_generator_forge_blueprint",
            "persist_field": "song_blueprint",
            "json_format": True,
            "temperature": 0.45,
        },
    },
    {
        "stage_key": "lyrics_draft",
        "stage_type": "llm_generate",
        "title_ru": "Черновик текста",
        "sort_order": 30,
        "settings": {
            "prompt_kind": "lyrics",
            "ugs_type_key": "music_generator_forge_lyrics",
            "persist_field": "lyrics_raw",
            "json_format": False,
            "temperature": 0.82,
        },
    },
    {
        "stage_key": "lyrics_gate",
        "stage_type": "lyrics_gate",
        "title_ru": "Проверка текста",
        "sort_order": 40,
        "settings": {
            "fail_on": [
                "empty_lyrics",
                "json_leak",
                "missing_sections",
                "stack_leak",
                "meta_music_jargon",
                "empty_pop_cliche",
                "weak_cliche_fill",
                "abstract_noun_chant",
            ],
            "retry_once": True,
        },
    },
    {
        "stage_key": "style_capsule",
        "stage_type": "style_build",
        "title_ru": "Style capsule",
        "sort_order": 50,
        "settings": {
            "prompt_kind": "style",
            "ugs_type_key": "music_generator_forge_style",
            "temperature": 0.58,
        },
    },
    {
        "stage_key": "lyrics_enrich",
        "stage_type": "lyrics_enrich",
        "title_ru": "ACE enrich",
        "sort_order": 60,
        "settings": {"structure_prepare": True},
    },
    {
        "stage_key": "audio_render",
        "stage_type": "audio_comfy",
        "title_ru": "Рендер аудио",
        "sort_order": 70,
        "settings": {},
    },
    {
        "stage_key": "content_persist",
        "stage_type": "content_persist",
        "title_ru": "Сохранение в библиотеку",
        "sort_order": 80,
        "settings": {},
    },
)


def default_pipeline_for_lane(lane_key: str) -> list[dict[str, object]]:
    """Build seeded stage list for one mode bound to a render lane."""
    stages: list[dict[str, object]] = []
    for spec in DEFAULT_PIPELINE_STAGE_SPECS:
        settings = dict(spec["settings"])  # type: ignore[arg-type]
        if spec["stage_type"] == "audio_comfy":
            settings = {"lane_key": lane_key}
        stages.append(
            {
                "stage_key": spec["stage_key"],
                "stage_type": spec["stage_type"],
                "title_ru": spec["title_ru"],
                "sort_order": spec["sort_order"],
                "enabled": True,
                "settings": settings,
            }
        )
    return stages
