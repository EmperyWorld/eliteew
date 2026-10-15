"""Music Generator V4 SFT (ace_sft_new.json) contracts."""

from __future__ import annotations

import pytest

from api.services.studio_comfy_workflows import (
    ACE_V4_SFT_MAX_DURATION_SECONDS,
    apply_v4_sft_generate_node_inputs,
    build_ace_music_v4_sft_workflow,
    plan_v4_sft_chunk_durations,
)


def test_v4_sft_workflow_fills_nodes_202_and_203() -> None:
    workflow, output_node = build_ace_music_v4_sft_workflow(
        {
            "lyrics": "[Verse 1]\nПривет мир",
            "tags": "120 BPM pop, female vocal, warm synth pads, [intro] pads, [verse] bass, [chorus] drop",
            "vocal": "female",
            "bpm": 120,
            "duration_seconds": 180,
            "language": "ru",
            "keyscale": "A minor",
            "timesignature": "4",
            "temperature": 0.8,
            "cfg_scale": 2.1,
            "top_p": 0.88,
            "top_k": 4,
            "min_p": 0.05,
            "seed": 4242,
            "generate_audio_codes": True,
        }
    )

    assert output_node == "207"
    assert workflow["205"]["inputs"]["diffusion_model"] == "acestep_v1.5_xl_sft_bf16.safetensors"
    assert workflow["207"]["class_type"] == "SaveAudioMP3"
    assert workflow["207"]["inputs"]["filename_prefix"] == "audio/ACE_V4_sft_"
    assert workflow["202"]["class_type"] == "AceStepSFTGenerate"
    assert workflow["203"]["class_type"] == "AceStepSFTTextEncode"
    assert workflow["202"]["inputs"]["seed"] == 4242
    assert workflow["202"]["inputs"]["duration"] == 180.0
    assert workflow["202"]["inputs"]["steps"] == 50
    assert workflow["202"]["inputs"]["cfg"] == 7.0
    assert workflow["203"]["inputs"]["seed"] == 4242
    assert workflow["203"]["inputs"]["bpm"] == 120
    assert "[Verse 1]" in workflow["203"]["inputs"]["lyrics"]
    assert workflow["203"]["inputs"]["caption"].lower().startswith("style:")
    assert "120 BPM" in workflow["203"]["inputs"]["caption"]
    # TOP canon: caption section tags Title Case to match lyrics ([Intro] not [intro]).
    assert "[Intro]" in workflow["203"]["inputs"]["caption"]
    assert "[Verse]" in workflow["203"]["inputs"]["caption"]
    assert "[Chorus]" in workflow["203"]["inputs"]["caption"]
    assert "[intro]" not in workflow["203"]["inputs"]["caption"]
    assert workflow["203"]["inputs"]["lm_cfg_scale"] == 2.1
    assert workflow["203"]["inputs"]["lm_temperature"] == 0.8
    assert workflow["203"]["inputs"]["lm_top_p"] == 0.88
    assert workflow["203"]["inputs"]["lm_top_k"] == 4
    assert workflow["203"]["inputs"]["lm_min_p"] == 0.05
    assert workflow["203"]["inputs"]["generate_audio_codes"] is True
    assert workflow["203"]["inputs"]["instrumental"] is False


def test_v4_sft_workflow_applies_explicit_generate_overrides() -> None:
    workflow, _ = build_ace_music_v4_sft_workflow(
        {
            "lyrics": "[Chorus]\nhey",
            "tags": "Style: EDM. 128 BPM, female vocal",
            "bpm": 128,
            "duration_seconds": 120,
            "steps": 40,
            "cfg": 5.5,
            "sampler_name": "euler",
            "scheduler": "simple",
            "denoise": 0.95,
            "seed": 999,
        }
    )

    assert workflow["202"]["inputs"]["steps"] == 40
    assert workflow["202"]["inputs"]["cfg"] == 5.5
    assert workflow["202"]["inputs"]["sampler_name"] == "euler"
    assert workflow["202"]["inputs"]["scheduler"] == "simple"
    assert workflow["202"]["inputs"]["denoise"] == 0.95


def test_v4_sft_workflow_clamps_long_duration() -> None:
    workflow, _ = build_ace_music_v4_sft_workflow(
        {
            "lyrics": "[Verse]\nline",
            "tags": "120 BPM pop",
            "duration_seconds": 280,
            "seed": 1,
        }
    )
    assert workflow["202"]["inputs"]["duration"] == ACE_V4_SFT_MAX_DURATION_SECONDS
    assert workflow["203"]["inputs"]["duration"] == ACE_V4_SFT_MAX_DURATION_SECONDS


def test_v4_luna_sft_workflow_uses_lora_and_luna_prefix() -> None:
    workflow, output_node = build_ace_music_v4_sft_workflow(
        {
            "lyrics": "[Verse 1]\nТихий свет",
            "tags": "Style: 134 BPM psychedelic melancholy, female vocal",
            "v4_soloist": "luna",
            "bpm": 134,
            "duration_seconds": 120,
            "language": "ru",
            "keyscale": "G minor",
            "seed": 777,
        }
    )

    assert output_node == "207"
    assert "204" not in workflow
    assert workflow["202"]["inputs"]["model"] == ["205", 0]
    assert workflow["203"]["inputs"]["clip"] == ["205", 1]
    assert workflow["207"]["inputs"]["filename_prefix"] == "audio/ACE_V4_luna_sft_"
    assert "G minor" in workflow["203"]["inputs"]["caption"]
    assert workflow["203"]["inputs"]["bpm"] == 134


def test_v4_sft_seed_derived_apg_params_stable() -> None:
    base: dict = {"steps": 50, "cfg": 7.0, "temperature": 0.85, "cfg_scale": 2.1}
    a: dict = {}
    b: dict = {}
    apply_v4_sft_generate_node_inputs(
        a, seed=6_866_258_504_827_156, duration_seconds=180, input_data=base, sampler_cfg=None
    )
    apply_v4_sft_generate_node_inputs(
        b, seed=5_584_467_676_078_621, duration_seconds=180, input_data=base, sampler_cfg=None
    )
    assert a["shift"] == 3.0
    assert b["shift"] == 3.0
    assert a["sampler_name"] == "euler"
    assert a["guidance_interval"] == 1.0
    assert a["guidance_mode"] == "standard_cfg"
    assert a["use_tiled_vae"] is False


def test_plan_v4_sft_chunk_durations_splits_long_tracks() -> None:
    assert plan_v4_sft_chunk_durations(75) == [75.0]
    assert plan_v4_sft_chunk_durations(120) == [60.0, 62.0]
    assert plan_v4_sft_chunk_durations(180) == [60.0, 60.0, 64.0]


def test_v4_sft_long_form_disabled_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.services.studio_comfy_workflows import v4_sft_long_form_enabled

    monkeypatch.delenv("ACE_V4_SFT_LONG_FORM_ENABLED", raising=False)
    assert v4_sft_long_form_enabled() is False
    monkeypatch.setenv("ACE_V4_SFT_LONG_FORM_ENABLED", "1")
    assert v4_sft_long_form_enabled() is True


def test_v4_sft_chunk_workflow_sets_continuation_caption() -> None:
    workflow, _ = build_ace_music_v4_sft_workflow(
        {
            "lyrics": "[Verse 1]\nПривет",
            "tags": "118 BPM pop, female vocal, A minor",
            "duration_seconds": 60,
            "v4_chunk_index": 1,
            "v4_chunk_offset_sec": 58,
            "seed": 1,
        }
    )
    assert workflow["202"]["inputs"]["duration"] == 60.0
    assert "continuation from 58 seconds" in workflow["203"]["inputs"]["caption"]


def test_v4_sft_final_chunk_outro_polish() -> None:
    workflow, _ = build_ace_music_v4_sft_workflow(
        {
            "lyrics": "[Outro]\nТихо тает свет",
            "tags": "118 BPM pop-soul, female vocal, A minor",
            "duration_seconds": 64,
            "v4_is_final_chunk": True,
            "v4_chunk_offset_sec": 116,
            "seed": 42,
            "cfg_scale": 2.2,
            "temperature": 0.9,
        }
    )
    assert workflow["202"]["inputs"]["fade_out_duration"] == 4.0
    assert workflow["202"]["inputs"]["cfg"] < 7.0
    assert "smooth natural outro" in workflow["203"]["inputs"]["caption"]
    assert workflow["203"]["inputs"]["lm_cfg_scale"] == 1.75
    assert workflow["203"]["inputs"]["lm_temperature"] == 0.78
    assert "metallic vocal" in workflow["203"]["inputs"]["lm_negative_prompt"]
