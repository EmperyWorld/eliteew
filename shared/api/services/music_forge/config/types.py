# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# MusicForge config types and fail-closed / activate errors.
# Invariants:
# - Runtime without active complete bundle → MusicForgeConfigUnavailableError.
# Related:
# - api/services/music_forge/config/gateway.py
# - documentation/product/MUSIC-FORGE-APP.md
# ---
"""MusicForge config shared types."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

from api.services.music_forge.algorithm.constants import (
    MUSIC_FORGE_ANTI_WAIL_NEGATIVE_PROMPT,
    MUSIC_FORGE_LANE_BASE_XL,
    MUSIC_FORGE_LANE_SFT_XL,
    MUSIC_FORGE_LANE_TURBO_XL,
)

REQUIRED_PROMPT_KINDS = frozenset({"blueprint", "lyrics", "style"})
ALLOWED_UGS_WORKFLOWS = frozenset({"v4", "v4_luna", "v2", "v2_base", "v5"})

# Operator-facing meta for MusicForge lanes (SSOT for admin UI labels).
# DiffRhythm / ACE V3 / v2_sft are NOT MusicForge lanes — see UGS Comfy catalog / legacy music-generator.
UGS_WORKFLOW_META: dict[str, dict[str, str]] = {
    "v4": {
        "label_ru": "SFT XL — основной (AceStepSFT)",
        "label_en": "SFT XL — default (AceStepSFT)",
        "workflow_file": "ace_sft_new.json",
        "product_mode": "sft_xl",
    },
    "v4_luna": {
        "label_ru": "SFT XL + Luna LoRA",
        "label_en": "SFT XL + Luna LoRA",
        "workflow_file": "v4_luna_ace_sft_xl.json",
        "product_mode": "",
    },
    "v2": {
        "label_ru": "TURBO XL — быстрее",
        "label_en": "TURBO XL — faster",
        "workflow_file": "Musicv2.json",
        "product_mode": "turbo_xl",
    },
    "v2_base": {
        "label_ru": "BASE XL",
        "label_en": "BASE XL",
        "workflow_file": "Musicv2_base.json",
        "product_mode": "base_xl",
    },
    "v5": {
        "label_ru": "BIG XL SFT (v5, chained)",
        "label_en": "BIG XL SFT (v5, chained)",
        "workflow_file": "BIG_XL_SFT.json",
        "product_mode": "",
    },
}


class MusicForgeConfigUnavailableError(RuntimeError):
    """Нет активной ревизии конфигурации в БД — runtime fail-closed."""

    def __init__(self, detail: str = "music_forge_config_unavailable") -> None:
        self.detail = detail
        super().__init__(detail)


class MusicForgeConfigActivationInvalidError(ValueError):
    """Bundle не проходит hard-gate перед activate."""

    def __init__(self, reasons: list[str]) -> None:
        self.reasons = list(reasons)
        super().__init__(",".join(self.reasons))


@dataclass(frozen=True)
class MusicForgeConfigBundle:
    """Active MusicForge configuration snapshot for pipeline and capabilities."""

    lanes: dict[str, dict[str, Any]]
    styles: dict[str, dict[str, Any]]
    prompts: dict[str, dict[str, Any]]
    product: dict[str, Any]
    version: str
    revision_id: UUID | None = None
    config_generation: int | None = None
    negative_prompt: str = field(default=MUSIC_FORGE_ANTI_WAIL_NEGATIVE_PROMPT)
    # Wave A Pipeline Architect: user Modes + ordered stage instances per mode_key.
    modes: dict[str, dict[str, Any]] = field(default_factory=dict)
    pipelines: dict[str, list[dict[str, Any]]] = field(default_factory=dict)


def default_lane_from_bundle(config: MusicForgeConfigBundle) -> dict[str, Any]:
    """Return the default lane dict from a config bundle."""
    for lane in config.lanes.values():
        if lane.get("is_default"):
            return dict(lane)
    for lane_key in (MUSIC_FORGE_LANE_SFT_XL, MUSIC_FORGE_LANE_BASE_XL, MUSIC_FORGE_LANE_TURBO_XL):
        if lane_key in config.lanes:
            return dict(config.lanes[lane_key])
    return dict(next(iter(config.lanes.values())))
