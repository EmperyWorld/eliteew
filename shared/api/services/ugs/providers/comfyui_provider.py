#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Thin ComfyUI provider facade for UGS; composes client, execution, and workflow preset mixins.
# Invariants:
# - Public import path and ComfyUIProvider API remain stable for provider_manager and tests.
# Related:
# - documentation/product/UGS-FLOW-AND-CONFIG.md
# ---

"""
ComfyUI AI Provider for UGS (Unified Generation System)

Production-ready ComfyUI integration for advanced image, audio, and video generation.
Implementation split across comfyui_client_core, comfyui_execution, comfyui_workflow_presets.
"""

from __future__ import annotations

from .comfyui_client_core import ComfyUIClientCoreMixin
from .comfyui_execution import ComfyUIExecutionMixin
from .comfyui_observability import _finalize_z_image_user_prompt
from .comfyui_workflow_presets import ComfyUIWorkflowPresetsMixin

__all__ = ["ComfyUIProvider", "_finalize_z_image_user_prompt"]


class ComfyUIProvider(
    ComfyUIWorkflowPresetsMixin,
    ComfyUIExecutionMixin,
    ComfyUIClientCoreMixin,
):
    """
    Production-ready ComfyUI integration for advanced image generation.

    Facade over client core, execution polling, and curated workflow presets.
    """
