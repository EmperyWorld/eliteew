# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Legacy desktop ``app_component`` aliases and remap helper for persisted state and companion actions.
# Invariants:
# - Remap targets must stay in ``KNOWN_DESKTOP_APP_COMPONENTS`` (desktop router catalog).
# Related:
# - api/routers/desktop.py (LEGACY_HIDDEN_DESKTOP_APP_*)
# - api/ewa_platform/companion/actions/allowlist.py
# ---

from __future__ import annotations

LEGACY_DESKTOP_APP_COMPONENT_ALIASES: dict[str, str] = {
    "EliteChat": "GAFChatApp",
    "ArlyQueenChat": "GAFChatApp",
}


def remap_legacy_desktop_app_component(app_component: str | None) -> str | None:
    """Map removed desktop components to their canonical replacement when one exists."""
    if app_component is None:
        return None
    normalized = app_component.strip()
    if not normalized:
        return app_component
    return LEGACY_DESKTOP_APP_COMPONENT_ALIASES.get(normalized, normalized)
