# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for MusicForge DB-backed config bundle and config-aware lane/style selection.
# Invariants:
# - code_default_bundle() must mirror algorithm module defaults (SFT default, no genre→Turbo).
# - Config-aware select_music_forge_model_lane matches legacy behavior for code bundle.
# Related:
# - api/services/music_forge/config/
# - api/services/music_forge/algorithm/lanes.py
# ---

from __future__ import annotations

from api.schemas.music_forge import MusicForgeRunCreate
from api.services.music_forge.algorithm import (
    MUSIC_FORGE_LANE_SFT_XL,
    MUSIC_FORGE_LANE_TURBO_XL,
    build_style_capsule,
    fallback_song_blueprint,
    normalize_music_forge_input,
    select_music_forge_model_lane,
)
from api.services.music_forge.config import (
    code_default_bundle,
    default_lane_from_bundle,
    invalidate_music_forge_config_cache,
)
from api.services.music_forge.config import coordinator as config_coordinator


def test_code_default_bundle_has_sft_default_lane() -> None:
    bundle = code_default_bundle()
    default_lane = default_lane_from_bundle(bundle)
    assert default_lane["lane"] == MUSIC_FORGE_LANE_SFT_XL
    assert default_lane["is_default"] is True
    assert default_lane["workflow_file"] == "ace_sft_new.json"
    sampler = default_lane.get("sampler") or {}
    assert sampler.get("sampler_name") == "jkass_quality"
    assert sampler.get("cfg") == 7.0


def test_code_default_bundle_house_does_not_select_turbo() -> None:
    bundle = code_default_bundle()
    intent = normalize_music_forge_input(
        MusicForgeRunCreate(idea="Night drive", style_hint="house club groove", language="en")
    )
    lane = select_music_forge_model_lane(intent, corpus=None, config=bundle)
    assert lane["lane"] == MUSIC_FORGE_LANE_SFT_XL
    assert lane["lane"] != MUSIC_FORGE_LANE_TURBO_XL


def _lane_core_fields(lane: dict) -> dict:
    return {
        k: lane[k]
        for k in (
            "lane",
            "ugs_workflow",
            "ace_workflow",
            "model_scope",
            "workflow_file",
            "ksampler_use_comfy_template",
            "billing_mode",
        )
    }


def test_select_lane_with_code_bundle_matches_legacy_behavior() -> None:
    bundle = code_default_bundle()
    house = normalize_music_forge_input(
        MusicForgeRunCreate(idea="Night drive", style_hint="house club groove", language="en")
    )
    turbo = normalize_music_forge_input(MusicForgeRunCreate(idea="Night drive", style_hint="xl turbo", language="en"))
    base = normalize_music_forge_input(
        MusicForgeRunCreate(idea="Night drive", constraints="use base xl", language="en")
    )
    assert _lane_core_fields(select_music_forge_model_lane(house, config=bundle)) == _lane_core_fields(
        select_music_forge_model_lane(house)
    )
    assert _lane_core_fields(select_music_forge_model_lane(turbo, config=bundle)) == _lane_core_fields(
        select_music_forge_model_lane(turbo)
    )
    assert _lane_core_fields(select_music_forge_model_lane(base, config=bundle)) == _lane_core_fields(
        select_music_forge_model_lane(base)
    )


def test_code_default_bundle_lane_sampler_top_defaults() -> None:
    """Ideal TOP knobs live on lane.sampler — not style_capsule (APP sampler precedence)."""
    bundle = code_default_bundle()
    intent = normalize_music_forge_input(MusicForgeRunCreate(idea="Late bus home", language="en"))
    blueprint = fallback_song_blueprint(intent)
    capsule = build_style_capsule("warm pop, natural vocal", intent, blueprint, config=bundle)
    default_lane = default_lane_from_bundle(bundle)
    assert default_lane["workflow_file"] == "ace_sft_new.json"
    sampler = dict(default_lane.get("sampler") or {})
    assert sampler.get("sampler_name") == "jkass_quality"
    assert float(sampler.get("cfg") or 0) == 7.0
    assert float(sampler.get("temperature") or 0) == 0.85
    assert capsule.get("bpm")
    assert "[Intro]" in str(capsule.get("caption") or "")


def test_code_default_bundle_includes_required_style_profiles() -> None:
    bundle = code_default_bundle()
    for style_key in ("pop", "drum and bass", "house", "lofi_chill", "indie_rock"):
        assert style_key in bundle.styles
        profile = bundle.styles[style_key]
        assert profile.get("keyscale")
        assert isinstance(profile.get("textures"), dict)
        assert isinstance(profile.get("arrangement"), dict)
        assert isinstance(profile.get("voice"), dict)


def test_code_default_bundle_includes_prompt_templates() -> None:
    bundle = code_default_bundle()
    for kind in ("blueprint", "lyrics", "style"):
        assert kind in bundle.prompts
        assert bundle.prompts[kind]["system_prompt"]
        assert isinstance(bundle.prompts[kind]["rules"], list)


def test_code_default_lyrics_gate_fails_on_sung_craft() -> None:
    bundle = code_default_bundle()
    lyrics = bundle.prompts["lyrics"]
    blob = f"{lyrics['system_prompt']} {' '.join(str(r) for r in lyrics['rules'])}".lower()
    assert "ритм" in blob
    fail_codes: set[str] = set()
    for stages in bundle.pipelines.values():
        for stage in stages:
            if stage.get("stage_type") == "lyrics_gate":
                fail_codes.update(str(x) for x in (stage.get("settings") or {}).get("fail_on") or [])
    assert {"meta_music_jargon", "empty_pop_cliche", "weak_cliche_fill", "abstract_noun_chant"} <= fail_codes


def test_invalidate_config_cache_clears_process_cache() -> None:
    invalidate_music_forge_config_cache()
    bundle = code_default_bundle()
    config_coordinator.set_local_cache(7, bundle)
    assert config_coordinator.get_local_cached(7) is not None
    invalidate_music_forge_config_cache()
    assert config_coordinator.get_local_cached(7) is None
