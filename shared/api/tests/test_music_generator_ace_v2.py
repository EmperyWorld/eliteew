# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression tests for ACE music workflow selection and KSampler/template contracts.
# Invariants:
# - XL Base/SFT workflows must preserve KSampler parameters from their Comfy JSON templates.
# - Music Evolution tags in Comfy node 94 must keep exact capitalized lyrics section labels.
# Related:
# - api/services/studio_comfy_workflows.py
# - documentation/product/MUSIC-GENERATOR-LYRICS-TAGS-IMPLEMENTATION.md
# ---
"""Контракт UGS /generate с ugs_workflow v2 (Musicv2.json, ACE 1.5 XL)."""

from __future__ import annotations

from api.services.studio_comfy_workflows import build_ace_music_workflow, resolve_ace_v2_workflow_flag


def test_v2_workflow_uses_xl_turbo_and_seed_109() -> None:
    workflow, output_node = build_ace_music_workflow(
        {
            "lyrics": "[Verse]\nhello",
            "tags": "120 BPM pop, female vocal",
            "bpm": 120,
            "duration_seconds": 90,
            "ugs_workflow": "v2",
            "language": "en",
            "keyscale": "A minor",
            "timesignature": "4",
            "temperature": 0.8,
            "cfg_scale": 2,
            "top_p": 0.9,
            "top_k": 5,
            "min_p": 0.1,
            "seed": 456,
            "cfg": 2.0,
            "sampler_name": "euler",
            "scheduler": "simple",
            "denoise": 0.88,
            "generate_audio_codes": True,
            "batch_size": 2,
            "shift": 3.0,
        }
    )

    assert output_node == "107"
    assert workflow["104"]["inputs"]["unet_name"] == "acestep_v1.5_xl_turbo_bf16.safetensors"
    assert workflow["105"]["inputs"]["clip_name1"] == "qwen_0.6b_ace15.safetensors"
    assert workflow["105"]["inputs"]["clip_name2"] == "qwen_4b_ace15.safetensors"
    assert workflow["109"]["inputs"]["value"] == 456
    assert workflow["3"]["inputs"]["seed"] == ["109", 0]
    assert workflow["94"]["inputs"]["seed"] == ["109", 0]
    assert workflow["3"]["inputs"]["denoise"] == 0.88
    assert workflow["3"]["inputs"]["sampler_name"] == "euler"
    assert workflow["3"]["inputs"]["scheduler"] == "simple"
    assert workflow["3"]["inputs"]["cfg"] == 2.0
    assert workflow["94"]["inputs"]["generate_audio_codes"] is True
    assert workflow["107"]["inputs"]["filename_prefix"] == "audio/V2_"
    assert workflow["107"]["inputs"]["quality"] == "320k"


def test_v2_denoise_defaults_to_one_when_omitted() -> None:
    workflow, _ = build_ace_music_workflow(
        {
            "lyrics": "x",
            "tags": "pop",
            "bpm": 100,
            "duration_seconds": 60,
            "ugs_workflow": "v2",
        }
    )
    assert workflow["3"]["inputs"]["denoise"] == 1.0


def test_v2_base_uses_xl_base_template_and_ksampler_from_json() -> None:
    workflow, _ = build_ace_music_workflow(
        {
            "lyrics": "x",
            "tags": "pop",
            "bpm": 100,
            "duration_seconds": 60,
            "ugs_workflow": "v2_base",
        }
    )
    assert workflow["104"]["inputs"]["unet_name"] == "acestep_v1.5_xl_base_bf16.safetensors"
    assert workflow["3"]["inputs"]["steps"] == 50
    assert workflow["3"]["inputs"]["cfg"] == 2
    assert workflow["107"]["inputs"]["filename_prefix"] == "audio/V2_base_"


def test_v2_sft_uses_xl_sft_template_and_ksampler_from_json() -> None:
    workflow, _ = build_ace_music_workflow(
        {
            "lyrics": "x",
            "tags": "pop",
            "bpm": 100,
            "duration_seconds": 60,
            "ugs_workflow": "v2_sft",
        }
    )
    assert workflow["104"]["inputs"]["unet_name"] == "acestep_v1.5_xl_sft_bf16.safetensors"
    assert workflow["3"]["inputs"]["steps"] == 50
    assert workflow["3"]["inputs"]["cfg"] == 7
    assert workflow["107"]["inputs"]["filename_prefix"] == "audio/V2_sft_"


def test_v2_base_ksampler_use_comfy_template_applies_explicit_sampler() -> None:
    """ksampler_use_comfy_template: steps/cfg from JSON; sampler/scheduler from input (Lula)."""
    workflow, _ = build_ace_music_workflow(
        {
            "lyrics": "x",
            "tags": "pop",
            "bpm": 115,
            "duration_seconds": 195,
            "ugs_workflow": "v2_base",
            "ksampler_use_comfy_template": True,
            "sampler_name": "deis",
            "scheduler": "kl_optimal",
            "cfg": 1.9,
        }
    )
    assert workflow["3"]["inputs"]["steps"] == 50
    assert workflow["3"]["inputs"]["cfg"] == 2
    assert workflow["3"]["inputs"]["sampler_name"] == "deis"
    assert workflow["3"]["inputs"]["scheduler"] == "kl_optimal"


def test_v2_sft_ksampler_use_comfy_template_keeps_template_cfg() -> None:
    """ksampler_use_comfy_template: не затирать cfg 7 / шаблон, даже если cfg с API."""
    workflow, _ = build_ace_music_workflow(
        {
            "lyrics": "x",
            "tags": "pop",
            "bpm": 100,
            "duration_seconds": 60,
            "ugs_workflow": "v2_sft",
            "ksampler_use_comfy_template": True,
            "cfg": 2.0,
        }
    )
    assert workflow["3"]["inputs"]["cfg"] == 7
    assert workflow["3"]["inputs"]["steps"] == 50


def test_resolve_v2_workflow_from_xl_tab_source_when_flag_missing() -> None:
    assert resolve_ace_v2_workflow_flag({"source_mode": "xl_base_sft_tab"}) == "v2_base"
    assert resolve_ace_v2_workflow_flag({"music_generator_source_mode": "xl_base_sft_tab"}) == "v2_base"


def test_evolution_xl_base_workflow_keeps_capitalized_section_tags_in_node_94() -> None:
    """Music Evolution: pipeline capitalizes tags; Comfy node 94 must not re-lowercase via prepare_xl_base."""
    caps_tags = (
        "Style: Luna test. 92 BPM, female vocal. "
        "[Intro] soft pad fade-in. [Verse] lo-fi groove, 92 BPM. [Chorus] synth hook, 92 BPM."
    )
    workflow, _ = build_ace_music_workflow(
        {
            "lyrics": "\n".join(
                [
                    "[Intro]",
                    "(Arrangement: soft pad, 92 BPM feel)",
                    "(Voice: female, hushed)",
                    "[Verse 1]",
                    "Тихий свет в окне снова зовёт меня",
                    "Стены дышат тем что не видно глазом",
                    "Я ищу ответ в этом немом диалоге",
                    "[Chorus]",
                    "Эхо шепота ветра сквозь стекло плывёт",
                    "В этом вихре ощущаю как меняет мир",
                    "Твой ветер касается не прощая меня",
                ]
            ),
            "tags": caps_tags,
            "bpm": 92,
            "duration_seconds": 90,
            "ugs_workflow": "v2_base",
            "ugs_type_key": "music_generator_evolution_xl_base",
            "billing_mode": "evolution_xl_base",
            "music_evolution_run_id": "dafa0030-dd68-40a8-88e9-29a0fb4045b1",
            "language": "ru",
        }
    )
    node_tags = workflow["94"]["inputs"]["tags"]
    assert "[Intro]" in node_tags
    assert "[Verse 1]" in node_tags
    assert "[Chorus]" in node_tags
    assert "[intro]" not in node_tags
    assert "[verse]" not in node_tags
    assert "[chorus]" not in node_tags


def test_xl_tab_source_mode_without_ugs_workflow_uses_base_unet() -> None:
    workflow, _ = build_ace_music_workflow(
        {
            "lyrics": "x",
            "tags": "pop",
            "bpm": 100,
            "duration_seconds": 60,
            "source_mode": "xl_base_sft_tab",
            "ksampler_use_comfy_template": True,
        }
    )
    assert workflow["104"]["inputs"]["unet_name"] == "acestep_v1.5_xl_base_bf16.safetensors"
    assert workflow["107"]["inputs"]["filename_prefix"] == "audio/V2_base_"
    assert workflow["3"]["inputs"]["steps"] == 50


def test_comfy_workflow_default_bpm_when_missing_is_120() -> None:
    workflow, _ = build_ace_music_workflow(
        {
            "lyrics": "[Verse]\nline one\nline two",
            "tags": "120 BPM pop, female vocal",
            "duration_seconds": 90,
            "ugs_workflow": "v2",
        }
    )
    assert workflow["94"]["inputs"]["bpm"] == 120
