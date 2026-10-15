# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# MusicForge model lane registry and intent normalization for SFT XL / BASE XL / TURBO XL routing.
# Invariants:
# - Default lane is SFT XL; genre words alone never force Turbo over SFT.
# - Frontend never decides model/workflow parameters; lane is derived on the backend.
# Related:
# - api/services/music_forge/algorithm/constants.py
# - api/services/music_forge/pipeline.py
# ---

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from api.services.music_forge.algorithm.constants import (
    _CYRILLIC_RE,
    MUSIC_FORGE_LANE_BASE_XL,
    MUSIC_FORGE_LANE_SFT_XL,
    MUSIC_FORGE_LANE_TURBO_XL,
    MUSIC_FORGE_VERSION,
)

if TYPE_CHECKING:
    from api.services.music_forge.config import MusicForgeConfigBundle

# Explicit opt-in only — genre words (house/dnb/edm) must NOT force Turbo over SFT.
_TURBO_LANE_MARKERS = (
    "turbo",
    "xl turbo",
    "xl_turbo",
    "fast turbo",
    "быстрый turbo",
)
_BASE_LANE_MARKERS = (
    "base xl",
    "xl base",
    "xl_base",
    "v2_base",
    "musicv2_base",
)

_MUSIC_FORGE_MODEL_LANES: dict[str, dict[str, Any]] = {
    MUSIC_FORGE_LANE_SFT_XL: {
        "lane": MUSIC_FORGE_LANE_SFT_XL,
        "ugs_workflow": "v4",
        "ace_workflow": "v4",
        "model_scope": "xl_sft",
        "workflow_file": "ace_sft_new.json",
        "ksampler_use_comfy_template": False,
        "billing_mode": "music_forge_xl_sft",
    },
    MUSIC_FORGE_LANE_BASE_XL: {
        "lane": MUSIC_FORGE_LANE_BASE_XL,
        "ugs_workflow": "v2_base",
        "ace_workflow": "v2_base",
        "model_scope": "xl_base",
        "workflow_file": "Musicv2_base.json",
        "ksampler_use_comfy_template": True,
        "billing_mode": "music_forge_xl_base",
    },
    MUSIC_FORGE_LANE_TURBO_XL: {
        "lane": MUSIC_FORGE_LANE_TURBO_XL,
        "ugs_workflow": "v2",
        "ace_workflow": "v2",
        "model_scope": "xl_turbo",
        "workflow_file": "Musicv2.json",
        "ksampler_use_comfy_template": False,
        "billing_mode": "music_forge_xl_turbo",
    },
}


def normalize_music_forge_input(body: Any) -> dict[str, Any]:
    """Normalize public create input into backend-owned creative intent."""
    idea = " ".join(str(body.idea).strip().split())
    style_hint = " ".join(str(body.style_hint or "").strip().split())
    constraints = "\n".join(line.strip() for line in str(body.constraints or "").splitlines() if line.strip())
    requested_language = str(body.language or "auto").strip().lower()
    language = (
        requested_language if requested_language in {"ru", "en"} else ("ru" if _CYRILLIC_RE.search(idea) else "en")
    )
    duration = max(60, min(240, int(body.duration_seconds)))
    mode_key = str(getattr(body, "mode_key", None) or "").strip() or None
    out: dict[str, Any] = {
        "idea": idea,
        "language": language,
        "requested_language": requested_language,
        "style_hint": style_hint,
        "constraints": constraints,
        "duration_seconds": duration,
        "lane": MUSIC_FORGE_LANE_SFT_XL,
        "version": MUSIC_FORGE_VERSION,
    }
    if mode_key:
        out["mode_key"] = mode_key
    return out


def _lane_markers_from_config(config: MusicForgeConfigBundle, lane_key: str) -> list[str]:
    lane = config.lanes.get(lane_key) or {}
    markers = lane.get("markers")
    return list(markers) if isinstance(markers, list) else []


def _default_lane_from_config(config: MusicForgeConfigBundle) -> dict[str, Any]:
    for lane in config.lanes.values():
        if lane.get("is_default"):
            return dict(lane)
    for lane_key in (MUSIC_FORGE_LANE_SFT_XL, MUSIC_FORGE_LANE_BASE_XL, MUSIC_FORGE_LANE_TURBO_XL):
        if lane_key in config.lanes:
            return dict(config.lanes[lane_key])
    return dict(next(iter(config.lanes.values())))


def select_music_forge_model_lane(
    intent: dict[str, Any],
    corpus: dict[str, Any] | None = None,
    *,
    config: MusicForgeConfigBundle | None = None,
) -> dict[str, Any]:
    """Pick SFT XL (default), or explicit BASE/TURBO opt-in. Genre words alone never force Turbo."""
    del corpus  # reserved for future SFT-like corpus weighting; TOP path defaults to SFT
    probe = " ".join(
        [
            str(intent.get("idea") or ""),
            str(intent.get("style_hint") or ""),
            str(intent.get("constraints") or ""),
        ]
    ).lower()
    if config is not None:
        base_markers = _lane_markers_from_config(config, MUSIC_FORGE_LANE_BASE_XL)
        turbo_markers = _lane_markers_from_config(config, MUSIC_FORGE_LANE_TURBO_XL)
        if any(marker in probe for marker in base_markers):
            return dict(config.lanes[MUSIC_FORGE_LANE_BASE_XL])
        if any(marker in probe for marker in turbo_markers):
            return dict(config.lanes[MUSIC_FORGE_LANE_TURBO_XL])
        return _default_lane_from_config(config)

    if any(marker in probe for marker in _BASE_LANE_MARKERS):
        return dict(_MUSIC_FORGE_MODEL_LANES[MUSIC_FORGE_LANE_BASE_XL])
    if any(marker in probe for marker in _TURBO_LANE_MARKERS):
        return dict(_MUSIC_FORGE_MODEL_LANES[MUSIC_FORGE_LANE_TURBO_XL])
    return dict(_MUSIC_FORGE_MODEL_LANES[MUSIC_FORGE_LANE_SFT_XL])
