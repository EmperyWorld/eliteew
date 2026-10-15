# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Load and expose Discussion preset registry.
# Invariants:
# - Importing this package registers all built-in presets once.
# Related:
# - discussion/presets/base.py
# ---
from __future__ import annotations

from importlib import import_module

from .base import DiscussionPreset, get_preset, list_presets, require_preset

# Side-effect: each module calls register_preset on import.
for _preset_mod in (
    "brainstorm",
    "decision",
    "interview",
    "marketing_strategy",
    "negotiation",
    "product_review",
    "responsibility_assignment",
):
    import_module(f"{__name__}.{_preset_mod}")

__all__ = [
    "DiscussionPreset",
    "get_preset",
    "list_presets",
    "require_preset",
]
