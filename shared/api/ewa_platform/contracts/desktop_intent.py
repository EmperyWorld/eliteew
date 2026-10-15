# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Atomic server-issued commands for the desktop shell (open app, focus window, patch state, patch desktop DB config).
# Invariants:
# - JSON-serializable fields only; no React types or DOM handles — use stable string ids.
# Related:
# - api/ewa_platform/contracts/desktop_observation.py
# - api/ewa_platform/drivers/desktop_shell.py
# - api/ewa_platform/policy/rules.py
# - api/ewa_platform/docs/INTENT-CATALOG.md
# ---
"""Intent discriminators and typed payload dataclasses for ``desktop_intent_v1`` / ``INTENT-CATALOG``."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum
from typing import Any

from api.ewa_platform.contracts.desktop_config_patch_wire import sanitize_patch_desktop_config_wire


class DesktopIntentKind(StrEnum):
    """Wire ``intent_kind`` values aligned with ``schemas/desktop_intent_v1.json``."""

    OPEN_APP = "open_app"
    FOCUS_WINDOW = "focus_window"
    CLOSE_WINDOW = "close_window"
    PATCH_SHELL_STATE = "patch_shell_state"
    PATCH_DESKTOP_CONFIG = "patch_desktop_config"
    NAVIGATE_DEEP_LINK = "navigate_deep_link"


@dataclass(slots=True)
class OpenAppIntent:
    """Request to open or focus an application window."""

    app_component: str
    payload: dict[str, Any]


@dataclass(slots=True)
class FocusWindowIntent:
    """Bring an existing window to front."""

    window_id: str


@dataclass(slots=True)
class CloseWindowIntent:
    """Close a window by stable id."""

    window_id: str


@dataclass(slots=True)
class PatchShellStateIntent:
    """Merge a JSON fragment into persisted shell_state (server-mediated in adapter)."""

    patch: dict[str, Any]


@dataclass(slots=True)
class PatchDesktopConfigIntent:
    """Merge allowed keys into persisted desktop_configs (server-mediated via HTTP adapter)."""

    patch: dict[str, Any]


@dataclass(slots=True)
class NavigateDeepLinkIntent:
    """Navigate shell using a stable deep-link token (e.g. UGS hub vs studio — client resolves)."""

    deep_link_token: str
    payload: dict[str, Any]


def desktop_intent_wire_wellformed(intent: Mapping[str, Any]) -> bool:
    """Return True if ``intent`` satisfies minimal v1 wire shape (see ``schemas/desktop_intent_v1.json``)."""

    kind = intent.get("intent_kind")
    if not isinstance(kind, str) or not kind:
        return False
    if kind == DesktopIntentKind.FOCUS_WINDOW.value:
        w = intent.get("window_id")
        return isinstance(w, str) and bool(w.strip())
    if kind == DesktopIntentKind.CLOSE_WINDOW.value:
        w = intent.get("window_id")
        return isinstance(w, str) and bool(w.strip())
    if kind == DesktopIntentKind.PATCH_SHELL_STATE.value:
        p = intent.get("patch")
        return isinstance(p, Mapping)
    if kind == DesktopIntentKind.PATCH_DESKTOP_CONFIG.value:
        p = intent.get("patch")
        if not isinstance(p, Mapping):
            return False
        return bool(sanitize_patch_desktop_config_wire(p))
    if kind == DesktopIntentKind.OPEN_APP.value:
        ac = intent.get("app_component")
        return isinstance(ac, str) and bool(ac.strip())
    if kind == DesktopIntentKind.NAVIGATE_DEEP_LINK.value:
        tok = intent.get("deep_link_token")
        return isinstance(tok, str) and bool(tok.strip())
    return False
