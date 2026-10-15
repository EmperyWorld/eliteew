# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression contracts for Music Generator V5 BIG XL SFT workflow wiring.
# Invariants:
# - V5 workflow keeps expected latent chain, seed behavior, and default diffusion model mapping.
# - Segment duration/stage seed derivation remains deterministic for repeatable debugging.
# Related:
# - api/services/studio_comfy_workflows.py
# ---
"""Music Generator V5 BIG XL SFT (BIG_XL_SFT.json) contracts."""

from __future__ import annotations

from api.services.studio_comfy_workflows import (
    ACE_V5_SFT_GENERATE_STAGES,
    ACE_V5_SFT_LORA_NODE,
    ACE_V5_SFT_MAX_DURATION_SECONDS,
    ACE_V5_SFT_OUTPUT_NODE,
    apply_v5_sft_generate_node_inputs,
    build_ace_music_v5_big_xl_sft_workflow,
    v5_segment_durations,
)


def test_v5_workflow_matches_operator_latent_chain() -> None:
    workflow, output_node = build_ace_music_v5_big_xl_sft_workflow(
        {
            "lyrics": "[Verse 1]\nПривет мир",
            "tags": "120 BPM pop, female vocal, warm synth pads",
            "vocal": "female",
            "bpm": 120,
            "duration_seconds": 180,
            "language": "ru",
            "keyscale": "A minor",
            "timesignature": "4",
            "temperature": 0.8,
            "cfg_scale": 2.1,
            "seed": 7777,
        }
    )

    assert output_node == ACE_V5_SFT_OUTPUT_NODE
    assert ACE_V5_SFT_LORA_NODE not in workflow
    assert workflow["207"]["inputs"]["diffusion_model"] == "acestep_v1.5_xl_sft_bf16.safetensors"
    assert workflow["202"]["inputs"]["model"] == ["207", 0]
    assert workflow["208"]["inputs"]["clip"] == ["207", 1]
    assert workflow["203"]["inputs"]["latent_or_audio"] == ["202", 4]
    assert workflow["203"]["inputs"]["positive"] == ["202", 2]
    assert workflow["205"]["inputs"]["latent_or_audio"] == ["204", 4]
    assert workflow["210"]["inputs"]["audio"] == ["205", 5]
    assert "209" not in workflow
    assert workflow["208"]["inputs"]["duration"] == 180.0
    segs = v5_segment_durations(180.0)
    for stage_id, seg in zip(ACE_V5_SFT_GENERATE_STAGES, segs, strict=True):
        assert workflow[stage_id]["inputs"]["duration"] == seg
        assert workflow[stage_id]["inputs"]["denoise"] == 1.0
        assert workflow[stage_id]["inputs"]["shift"] == 3.0
        assert workflow[stage_id]["inputs"]["sampler_name"] == "euler"
        assert workflow[stage_id]["inputs"]["scheduler"] == "normal"
        assert workflow[stage_id]["inputs"]["guidance_interval"] == 1.0
        assert workflow[stage_id]["inputs"]["use_tiled_vae"] is False
    assert "206" not in workflow


def test_v5_default_lora_disabled_for_clean_audio() -> None:
    workflow, _ = build_ace_music_v5_big_xl_sft_workflow(
        {
            "lyrics": "[Chorus]\nhey",
            "tags": "Style: Club house. 128 BPM, female vocal",
            "duration_seconds": 120,
            "seed": 42,
        }
    )
    assert ACE_V5_SFT_LORA_NODE not in workflow
    assert workflow["202"]["inputs"]["model"] == ["207", 0]


def test_v5_default_lora_uses_xl_concept_slider() -> None:
    from api.services.studio_comfy_workflows import ACE_SFT_LORA_ENABLED

    if not ACE_SFT_LORA_ENABLED:
        return
    workflow, _ = build_ace_music_v5_big_xl_sft_workflow(
        {
            "lyrics": "[Chorus]\nhey",
            "tags": "Style: Club house. 128 BPM, female vocal",
            "duration_seconds": 120,
            "seed": 42,
        }
    )
    assert workflow[ACE_V5_SFT_LORA_NODE]["inputs"]["lora_name"] == (
        "ACE15XL/ace-step_1-5_xl_danceability_slider.safetensors"
    )
    assert workflow[ACE_V5_SFT_LORA_NODE]["inputs"]["strength_model"] == 1.0


def test_v5_lora_override_from_input() -> None:
    from api.services import studio_comfy_workflows as scw

    original = scw.ACE_SFT_LORA_ENABLED
    scw.ACE_SFT_LORA_ENABLED = True
    try:
        workflow, _ = build_ace_music_v5_big_xl_sft_workflow(
            {
                "lyrics": "[Chorus]\nhey",
                "tags": "Style: EDM. 128 BPM, female vocal",
                "duration_seconds": 120,
                "seed": 42,
                "v5_lora_name": "custom/lora.safetensors",
                "v5_lora_strength_model": 0.75,
            }
        )
        assert workflow[ACE_V5_SFT_LORA_NODE]["inputs"]["lora_name"] == "custom/lora.safetensors"
        assert workflow[ACE_V5_SFT_LORA_NODE]["inputs"]["strength_model"] == 0.75
    finally:
        scw.ACE_SFT_LORA_ENABLED = original


def test_v5_segment_durations_fixed_sixty_per_stage() -> None:
    segs = v5_segment_durations(165.0)
    assert segs == [60.0, 60.0, 60.0, 60.0]
    workflow, _ = build_ace_music_v5_big_xl_sft_workflow(
        {
            "lyrics": "[Verse]\nline",
            "tags": "120 BPM pop",
            "duration_seconds": 280,
            "seed": 1,
        }
    )
    assert workflow["208"]["inputs"]["duration"] == ACE_V5_SFT_MAX_DURATION_SECONDS


def test_v5_sft_sampler_defaults_match_v4_quality_recipe() -> None:
    node: dict = {}
    apply_v5_sft_generate_node_inputs(
        node,
        base_seed=1,
        segment_duration=60.0,
        stage_index=0,
        input_data={},
        sampler_cfg=None,
    )
    assert node["shift"] == 3.0
    assert node["sampler_name"] == "euler"
    assert node["scheduler"] == "normal"
    assert node["guidance_interval"] == 1.0
    assert node["use_tiled_vae"] is False


def test_v5_stage_seeds_differ_per_chain_step() -> None:
    base: dict = {"cfg": 7.0}
    seeds: list[int] = []
    for idx in range(4):
        node: dict = {}
        apply_v5_sft_generate_node_inputs(
            node,
            base_seed=424242,
            segment_duration=60.0,
            stage_index=idx,
            input_data=base,
            sampler_cfg=None,
        )
        seeds.append(node["seed"])
    assert len(set(seeds)) == 4
