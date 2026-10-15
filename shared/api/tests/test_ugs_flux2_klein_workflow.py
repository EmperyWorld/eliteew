# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Flux.2 Klein distilled Site Studio graph: aspect snap, sampler preserve, RandomNoise seed.
# Related:
# - api/services/ugs/flux2_klein.py
# - api/services/ugs/providers/comfyui_workflow_presets.py
# - host/comfyui/site_studio_photo.json
# ---
from __future__ import annotations

import json
from pathlib import Path

from api.services.ugs.flux2_klein import snap_flux2_klein_latent
from api.services.ugs.providers.comfyui_observability import _finalize_z_image_user_prompt
from api.services.ugs.providers.comfyui_workflow_presets import ComfyUIWorkflowPresetsMixin

_REPO_WORKFLOW = Path(__file__).resolve().parents[3] / "host" / "comfyui" / "site_studio_photo.json"


def _klein_graph() -> dict:
    return json.loads(_REPO_WORKFLOW.read_text(encoding="utf-8"))


def test_snap_flux2_klein_latent_keeps_banner_and_portrait_aspect() -> None:
    assert snap_flux2_klein_latent(1600, 900) == (1600, 896)
    assert snap_flux2_klein_latent(1200, 1600) == (1200, 1600)
    assert snap_flux2_klein_latent(1200, 800) == (1200, 800)


def test_site_studio_photo_workflow_uses_local_klein_fp8() -> None:
    workflow = _klein_graph()
    assert workflow["70"]["inputs"]["unet_name"] == "flux-2-klein-4b-fp8.safetensors"
    assert workflow["71"]["inputs"]["type"] == "flux2"
    assert workflow["72"]["inputs"]["vae_name"] == "flux2-vae.safetensors"
    assert workflow["66"]["class_type"] == "EmptyFlux2LatentImage"
    assert workflow["62"]["inputs"]["steps"] == 4
    assert workflow["63"]["inputs"]["cfg"] == 1
    assert workflow["60"]["class_type"] == "SaveImage"


def test_comfy_preserves_klein_sampler_and_non_square_latent() -> None:
    workflow = _klein_graph()
    mixin = ComfyUIWorkflowPresetsMixin()
    mixin._apply_text_to_image_params(
        workflow,
        prompt="wide cinematic plaza at dusk",
        negative_prompt="ignored",
        width=1600,
        height=900,
        steps=20,
        cfg_scale=7.0,
        model="ignored.safetensors",
        seed=99,
        workflow_template="site_studio_photo.json",
    )
    assert workflow["62"]["inputs"]["steps"] == 4
    assert workflow["62"]["inputs"]["width"] == 1600
    assert workflow["62"]["inputs"]["height"] == 896
    assert workflow["66"]["inputs"]["width"] == 1600
    assert workflow["66"]["inputs"]["height"] == 896
    assert workflow["63"]["inputs"]["cfg"] == 1
    assert workflow["73"]["inputs"]["noise_seed"] == 99
    assert workflow["74"]["inputs"]["text"] == _finalize_z_image_user_prompt("wide cinematic plaza at dusk")
