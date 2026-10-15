# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Wave Host-1 lock: Comfy workflow JSON root resolves to /app/comfyui or host/comfyui.
# Related:
# - api/services/studio_comfy_workflows.py
# - documentation/platform/ELITEEW-PACK-LAYOUT.md
# ---

from __future__ import annotations

from api.services.studio_comfy_workflows import _COMFYUI_ROOT, WORKFLOW_PATH_ACE_SFT_V4


def test_comfyui_root_is_app_or_host_tree() -> None:
    assert _COMFYUI_ROOT.name == "comfyui"
    root_s = str(_COMFYUI_ROOT)
    assert root_s.endswith("/app/comfyui") or root_s.endswith("/host/comfyui")


def test_ace_sft_v4_workflow_file_present_when_tree_mounted() -> None:
    # Container bake/bind or CC host checkout must expose the living template.
    if not _COMFYUI_ROOT.is_dir():
        return
    assert WORKFLOW_PATH_ACE_SFT_V4.is_file(), WORKFLOW_PATH_ACE_SFT_V4
    assert WORKFLOW_PATH_ACE_SFT_V4.parent == _COMFYUI_ROOT
