# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# **Ambient actions expansion** for EWA companion (project «Mela's Ascension», Module B3). When the
# orchestrator produces an ``ambient_adjust`` action, this module resolves it through
# ``mood_palette.resolve_ambient_preset`` and rewrites it into wire-compatible actions the SPA can
# already execute: one ``patch_desktop_config`` (theme / wallpaper) and optionally one ``open_app``
# for the desktop ``MusicPlayer`` carrying the preset id.
# Invariants:
# - **Pure** — no I/O. Does not call the desktop driver itself.
# - Strict allowlist of theme tokens via ``sanitize_patch_desktop_config_wire`` (re-used in
#   ``actions.allowlist``).
# - Feature flag ``EWA_COMPANION_AMBIENT_ACTIONS_ENABLED``: when **false**, ``ambient_adjust`` is
#   stripped from the action list entirely. Default off — opt-in until the SPA has a renderer.
# - Original ``ambient_adjust`` row is **dropped** from the returned list; the expanded actions take
#   its place. ``MAX_ACTIONS_PER_TURN`` is respected.
# - When the preset has no music_preset, no ``MusicPlayer`` action is emitted; same for empty patch.
# Related:
# - api/ewa_platform/companion/actions/allowlist.py
# - api/ewa_platform/companion/affective/mood_palette.py
# - api/ewa_platform/drivers/ambient_driver.py
# ---

from __future__ import annotations

import os
from collections.abc import Iterable
from typing import Any

from api.ewa_platform.companion.affective.mood_palette import AmbientPreset, resolve_ambient_preset
from api.ewa_platform.contracts.desktop_config_patch_wire import (
    sanitize_patch_desktop_config_wire,
)

from .allowlist import MAX_ACTIONS_PER_TURN

MUSIC_PLAYER_COMPONENT: str = "MusicPlayer"


def ambient_actions_enabled() -> bool:
    return os.getenv("EWA_COMPANION_AMBIENT_ACTIONS_ENABLED", "false").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )


def _expand_one(raw: dict[str, Any]) -> tuple[list[dict[str, Any]], AmbientPreset]:
    """Expand one ``ambient_adjust`` row into concrete actions.

    Returns ``(expanded_actions, preset)``. Empty list if preset has no actionable fields.
    """

    mood = str(raw.get("mood") or raw.get("ambient") or "").strip().lower()
    preset = resolve_ambient_preset(mood)
    rationale = str(raw.get("rationale") or preset.rationale or "").strip()[:200]

    expanded: list[dict[str, Any]] = []

    patch: dict[str, Any] = {}
    if preset.theme_id:
        patch["theme"] = preset.theme_id
    if preset.wallpaper_id:
        patch["wallpaper"] = preset.wallpaper_id
    if patch:
        body = sanitize_patch_desktop_config_wire(patch)
        if body:
            row_patch: dict[str, Any] = {"type": "patch_desktop_config", "patch": body}
            if rationale:
                row_patch["rationale"] = rationale
            expanded.append(row_patch)

    # Contemplation / continuity-weak: theme+wallpaper only — no MusicPlayer spam (W4).
    weak = bool(raw.get("contemplation_weak"))
    if preset.music_preset and not weak:
        row_music: dict[str, Any] = {
            "type": "open_app",
            "app_component": MUSIC_PLAYER_COMPONENT,
        }
        if rationale:
            row_music["rationale"] = rationale
        expanded.append(row_music)

    return expanded, preset


def expand_ambient_actions(actions: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    """Rewrite every ``ambient_adjust`` row into existing wire actions; strips when disabled."""

    enabled = ambient_actions_enabled()
    out: list[dict[str, Any]] = []
    for raw in actions:
        if not isinstance(raw, dict):
            continue
        if str(raw.get("type") or "").strip().lower() != "ambient_adjust":
            out.append(raw)
            continue
        if not enabled:
            continue
        expanded, _preset = _expand_one(raw)
        for row in expanded:
            if len(out) >= MAX_ACTIONS_PER_TURN:
                break
            out.append(row)
        if len(out) >= MAX_ACTIONS_PER_TURN:
            break
    return out[:MAX_ACTIONS_PER_TURN]


__all__: tuple[str, ...] = (
    "MUSIC_PLAYER_COMPONENT",
    "ambient_actions_enabled",
    "expand_ambient_actions",
)
