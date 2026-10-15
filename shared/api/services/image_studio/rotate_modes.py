# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Single source of truth for Image Studio camera/rotate presets (ComfyUI output node ids).
# Invariants:
# - Keys must match the rotate_image Comfy workflow output nodes.
# - Router validation and provider_execution_comfyui must import this map only.
# Related:
# - host/comfyui/rotate_image.json
# - api/routers/image_studio.py
# - api/services/ugs/provider_execution_comfyui.py
# ---

from __future__ import annotations

ROTATE_MODE_ALL = "all"

# mode_key → (comfy_output_node_id, user-facing RU label)
STUDIO_ROTATE_OUTPUT_NODES: dict[str, tuple[str, str]] = {
    "close_up": ("31", "Крупный план"),
    "wide": ("34", "Широкий план"),
    "angle45_right": ("36", "45° вправо"),
    "angle90_right": ("38", "90° вправо"),
    "aerial": ("41", "Вид сверху"),
    "low": ("43", "Нижний ракурс"),
    "angle45_left": ("45", "45° влево"),
    "angle90_left": ("47", "90° влево"),
}


def validate_rotate_mode(mode_key: str) -> str:
    """Normalize and validate mode; raises ValueError with allowed list on bad input."""
    key = (mode_key or "").strip() or "angle90_right"
    if key == ROTATE_MODE_ALL:
        return key
    if key not in STUDIO_ROTATE_OUTPUT_NODES:
        allowed = ", ".join([*sorted(STUDIO_ROTATE_OUTPUT_NODES.keys()), ROTATE_MODE_ALL])
        raise ValueError(f"Invalid mode '{key}'. Allowed: {allowed}")
    return key


def rotate_mode_label(mode_key: str) -> str:
    if mode_key == ROTATE_MODE_ALL:
        return "Все ракурсы"
    entry = STUDIO_ROTATE_OUTPUT_NODES.get(mode_key)
    if entry:
        return entry[1]
    return "Поворот"
