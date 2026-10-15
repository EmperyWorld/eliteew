# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Resolve MusicForge Mode + render lane from config bundle and intent (Wave B/D).
# Invariants:
# - Enabled Modes only; execute falls back default/lane match; create rejects unknown mode_key.
# Related:
# - api/services/music_forge/pipeline_interpreter.py
# - api/services/music_forge/pipeline.py
# - api/services/music_forge/config/types.py
# ---
"""Mode / lane resolution for PipelineInterpreter and public create."""

from __future__ import annotations

from typing import Any

from api.services.music_forge.algorithm.lanes import select_music_forge_model_lane
from api.services.music_forge.config.types import MusicForgeConfigBundle


def enabled_pipeline_stages(config: MusicForgeConfigBundle, mode_key: str) -> list[dict[str, Any]]:
    """Return enabled stages for mode_key ordered by sort_order."""
    stages = list(config.pipelines.get(mode_key) or [])
    enabled = [dict(s) for s in stages if s.get("enabled", True)]
    enabled.sort(key=lambda s: int(s.get("sort_order") or 0))
    return enabled


def public_modes_catalog(config: MusicForgeConfigBundle) -> list[dict[str, Any]]:
    """Enabled Modes for public capabilities (Wave D)."""
    modes = [dict(m) for m in config.modes.values() if m.get("enabled")]
    modes.sort(key=lambda m: (int(m.get("sort_order") or 0), str(m.get("mode_key") or "")))
    return [
        {
            "mode_key": str(m["mode_key"]),
            "label_ru": str(m.get("label_ru") or m["mode_key"]),
            "label_en": str(m.get("label_en") or m["mode_key"]),
            "is_default": bool(m.get("is_default")),
            "lane_key": str(m.get("lane_key") or ""),
        }
        for m in modes
        if m.get("mode_key")
    ]


def resolve_create_mode(
    config: MusicForgeConfigBundle, intent: dict[str, Any]
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Resolve Mode for create_run step seeding; unknown mode_key → ValueError."""
    requested = str(intent.get("mode_key") or "").strip()
    if requested:
        enabled_keys = {str(k) for k, m in config.modes.items() if m.get("enabled")}
        if requested not in enabled_keys:
            raise ValueError(f"music_forge_mode_key_invalid:{requested}")
    mode, _lane, stages = resolve_mode_for_intent(config, intent, corpus=None)
    return mode, stages


def resolve_default_mode(config: MusicForgeConfigBundle) -> dict[str, Any] | None:
    enabled = [m for m in config.modes.values() if m.get("enabled")]
    if not enabled:
        return None
    for mode in enabled:
        if mode.get("is_default"):
            return dict(mode)
    return dict(enabled[0])


def resolve_mode_for_intent(
    config: MusicForgeConfigBundle,
    intent: dict[str, Any],
    *,
    corpus: dict[str, Any] | None = None,
) -> tuple[dict[str, Any], dict[str, Any], list[dict[str, Any]]]:
    """Pick Mode + model_lane + stages.

    Precedence:
    1. intent.mode_key if enabled
    2. lane from select_music_forge_model_lane → Mode with matching lane_key
    3. default Mode
    """
    modes = {k: dict(v) for k, v in config.modes.items() if v.get("enabled")}
    requested = str(intent.get("mode_key") or "").strip()
    mode: dict[str, Any] | None = None
    if requested and requested in modes:
        mode = modes[requested]

    model_lane = select_music_forge_model_lane(intent, corpus, config=config)
    if mode is None:
        lane_name = str(model_lane.get("lane") or model_lane.get("lane_key") or "")
        for candidate in modes.values():
            if str(candidate.get("lane_key") or "") == lane_name:
                mode = candidate
                break
    if mode is None:
        mode = resolve_default_mode(config)
    if mode is None:
        raise ValueError("music_forge_modes_unavailable")

    lane_key = str(mode.get("lane_key") or "")
    if lane_key and lane_key in config.lanes:
        model_lane = dict(config.lanes[lane_key])
    stages = enabled_pipeline_stages(config, str(mode["mode_key"]))
    if not stages:
        raise ValueError(f"music_forge_pipeline_empty:{mode.get('mode_key')}")
    return mode, model_lane, stages
