# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression locks for EWRP offline fonts HTML, font staging, and ComfyUI turbo sampler preserve.
# Invariants:
# - Generated HTML must not reference fonts.googleapis.com / fonts.gstatic.com.
# - 01_top / turbo apply path finalizes positive prompt with z-image anti-text suffix.
# Related:
# - api/services/ewrp_templates.py
# - api/services/ewrp_font_assets.py
# - api/services/ugs/providers/comfyui_workflow_presets.py
# - api/services/ugs/providers/comfyui_observability.py
# ---

from __future__ import annotations

from pathlib import Path

import pytest

from api.services.ewrp_font_assets import ewrp_fonts_available, stage_ewrp_fonts
from api.services.ewrp_service import EWRP_COMFY_IMAGE_HEIGHT, EWRP_COMFY_IMAGE_WIDTH
from api.services.ewrp_templates import build_ewrp_html
from api.services.ugs.providers.comfyui_observability import _finalize_z_image_user_prompt
from api.services.ugs.providers.comfyui_workflow_presets import ComfyUIWorkflowPresetsMixin


@pytest.mark.unit
def test_ewrp_fonts_vendored() -> None:
    assert ewrp_fonts_available(), "Run: python3 shared/api/static/ewrp/vendor_ewrp_fonts.py"


@pytest.mark.unit
def test_build_ewrp_html_has_no_google_fonts_cdn() -> None:
    html = build_ewrp_html(
        "Demo",
        [{"title": "Slide", "bullets": ["one", "two"], "image_filename": None}],
        presentation_theme="classic",
    )
    assert "fonts.googleapis.com" not in html
    assert "fonts.gstatic.com" not in html
    assert "@font-face" in html
    assert 'url("fonts/' in html or "url('fonts/" in html


@pytest.mark.unit
def test_stage_ewrp_fonts_copies_into_job_dir(tmp_path: Path) -> None:
    dest = stage_ewrp_fonts(tmp_path)
    assert dest == tmp_path / "fonts"
    assert dest.is_dir()
    assert any(dest.iterdir())


@pytest.mark.unit
def test_comfy_preserves_sampler_for_01_top() -> None:
    workflow = {
        "83:28": {
            "class_type": "UNETLoader",
            "inputs": {"unet_name": "z_image_turbo_bf16.safetensors"},
        },
        "83:3": {
            "class_type": "KSampler",
            "inputs": {
                "steps": 4,
                "cfg": 1,
                "sampler_name": "res_multistep",
                "scheduler": "simple",
                "seed": 1,
            },
        },
        "83:13": {
            "class_type": "EmptySD3LatentImage",
            "inputs": {"width": 1024, "height": 1024, "batch_size": 1},
        },
        "83:27": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": "old", "clip": ["83:30", 0]},
        },
    }
    mixin = ComfyUIWorkflowPresetsMixin()
    mixin._apply_text_to_image_params(
        workflow,
        prompt="new prompt scene",
        negative_prompt="",
        width=EWRP_COMFY_IMAGE_WIDTH,
        height=EWRP_COMFY_IMAGE_HEIGHT,
        steps=20,
        cfg_scale=7.0,
        model="ignored.safetensors",
        seed=42,
        workflow_template="01_top.json",
    )
    ks = workflow["83:3"]["inputs"]
    assert ks["seed"] == 42
    assert ks["steps"] == 4
    assert ks["cfg"] == 1
    assert workflow["83:13"]["inputs"]["width"] == 1024
    assert workflow["83:13"]["inputs"]["height"] == 1024
    assert workflow["83:27"]["inputs"]["text"] == _finalize_z_image_user_prompt("new prompt scene")
    assert "no readable text" in workflow["83:27"]["inputs"]["text"].lower()


@pytest.mark.unit
def test_ewrp_comfy_latent_is_native_square() -> None:
    assert EWRP_COMFY_IMAGE_WIDTH == 1024
    assert EWRP_COMFY_IMAGE_HEIGHT == 1024


@pytest.mark.unit
def test_comfy_applies_sampler_for_generic_workflow() -> None:
    workflow = {
        "3": {
            "class_type": "KSampler",
            "inputs": {
                "steps": 8,
                "cfg": 2,
                "sampler_name": "euler",
                "scheduler": "normal",
                "seed": 1,
            },
        },
        "5": {
            "class_type": "EmptyLatentImage",
            "inputs": {"width": 512, "height": 512, "batch_size": 1},
        },
        "6": {"class_type": "CLIPTextEncode", "inputs": {"text": "pos", "clip": ["1", 1]}},
        "7": {"class_type": "CLIPTextEncode", "inputs": {"text": "neg", "clip": ["1", 1]}},
    }
    mixin = ComfyUIWorkflowPresetsMixin()
    mixin._apply_text_to_image_params(
        workflow,
        prompt="hello world premium scene",
        negative_prompt="blurry",
        width=768,
        height=512,
        steps=20,
        cfg_scale=6.5,
        model="x.safetensors",
        seed=7,
        workflow_template="text_to_image.json",
    )
    assert workflow["3"]["inputs"]["steps"] == 20
    assert workflow["3"]["inputs"]["cfg"] == 6.5
    assert workflow["5"]["inputs"]["width"] == 768
