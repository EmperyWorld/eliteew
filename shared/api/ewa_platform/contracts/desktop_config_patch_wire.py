# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Allowlist desktop config keys for orchestration/companion intents (wire JSON → PATCH /desktop/config body subset).
# Invariants:
# - No SQL/HTTP; strings only; reject unknown keys and oversized wallpaper payloads.
# - ``theme`` wire input may be any-case ``dark``/``light``/``auto``; output uses API ``Theme`` StrEnum spelling
#   (``DARK``, ``LIGHT``, ``AUTO``) for ``PATCH /api/v1/desktop/config``.
# Related:
# - api/routers/desktop.py (DesktopConfigUpdate)
# - api/ewa_platform/contracts/desktop_intent.py
# - api/ewa_platform/adapters/eliteew_desktop_http.py
# ---
"""Sanitize partial desktop config patch dicts for automation intents."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

_MAX_WALLPAPER_LEN = 500_000
_MAX_ACCENT_LEN = 64
_MAX_WIDGETS_PANEL_POS_LEN = 32
_MAX_GRID_STEP_LEN = 16
_MAX_WALLPAPER_HISTORY_ITEMS = 15
_MAX_WALLPAPER_HISTORY_ENTRY_LEN = 500_000

_ALLOWED_PATCH_TOP_KEYS: frozenset[str] = frozenset(
    {
        "wallpaper",
        "theme",
        "accent_color",
        "icon_size",
        "snap_to_grid",
        "grid_step",
        "widgets_panel_position",
        "compact_widgets",
        "show_widgets_panel",
        "live_wallpaper",
        "wallpapers_history",
    }
)
_ALLOWED_THEME: frozenset[str] = frozenset({"dark", "light", "auto"})
_ALLOWED_ICON_SIZE: frozenset[str] = frozenset({"small", "medium", "large"})


def sanitize_patch_desktop_config_wire(raw: Mapping[str, Any] | None) -> dict[str, Any]:
    """Return a JSON-safe dict suitable for PATCH ``/api/v1/desktop/config``; empty if nothing valid."""

    if raw is None or not isinstance(raw, Mapping):
        return {}
    out: dict[str, Any] = {}
    for key, value in raw.items():
        if not isinstance(key, str):
            continue
        k = key.strip()
        if k not in _ALLOWED_PATCH_TOP_KEYS:
            continue
        if k == "wallpaper":
            if not isinstance(value, str):
                continue
            w = value.strip()
            if not w or len(w) > _MAX_WALLPAPER_LEN:
                continue
            out["wallpaper"] = w
        elif k == "theme":
            if not isinstance(value, str):
                continue
            t = value.strip().lower()
            if t in _ALLOWED_THEME:
                out["theme"] = t.upper()
        elif k == "accent_color":
            if not isinstance(value, str):
                continue
            a = value.strip()
            if not a or len(a) > _MAX_ACCENT_LEN:
                continue
            if a.startswith("#"):
                hexpart = a[1:]
                if all(c in "0123456789abcdefABCDEF" for c in hexpart) and len(hexpart) in (3, 6, 8):
                    norm = a.lower() if len(hexpart) != 3 else a
                    out["accent_color"] = norm
            else:
                out["accent_color"] = a
        elif k == "icon_size":
            if not isinstance(value, str):
                continue
            iz = value.strip().lower()
            if iz in _ALLOWED_ICON_SIZE:
                out["icon_size"] = iz
        elif k == "snap_to_grid":
            if isinstance(value, bool):
                out["snap_to_grid"] = value
        elif k == "grid_step":
            if not isinstance(value, str):
                continue
            gs = value.strip().lower()
            if gs in {"small", "medium", "large"} and len(gs) <= _MAX_GRID_STEP_LEN:
                out["grid_step"] = gs
        elif k == "widgets_panel_position":
            if not isinstance(value, str):
                continue
            wp = value.strip().lower().replace("_", "-")
            if wp and len(wp) <= _MAX_WIDGETS_PANEL_POS_LEN:
                out["widgets_panel_position"] = wp
        elif k in {"compact_widgets", "show_widgets_panel", "live_wallpaper"}:
            if isinstance(value, bool):
                out[k] = value
        elif k == "wallpapers_history":
            if not isinstance(value, list):
                continue
            hist: list[str] = []
            for item in value[:_MAX_WALLPAPER_HISTORY_ITEMS]:
                if not isinstance(item, str):
                    continue
                s = item.strip()
                if not s or len(s) > _MAX_WALLPAPER_HISTORY_ENTRY_LEN:
                    continue
                if s not in hist:
                    hist.append(s)
                if len(hist) >= _MAX_WALLPAPER_HISTORY_ITEMS:
                    break
            if hist:
                out["wallpapers_history"] = hist
    return out


__all__ = ["sanitize_patch_desktop_config_wire"]
