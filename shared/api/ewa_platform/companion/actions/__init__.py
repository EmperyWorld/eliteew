# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Companion **desktop actions**: closed allowlist + tail/JSON parsing (``allowlist``) and **ambient** expansion
# of ``ambient_adjust``. Re-exports the stable import path ``api.ewa_platform.companion.actions``.
# Invariants:
# - Import ``allowlist`` before ``ambient``; ``ambient`` depends only on ``allowlist`` and ``affective.mood_palette``.
# Related:
# - api/ewa_platform/docs/EWA-COMPANION-PACKAGE-MIGRATION.md
# ---

from __future__ import annotations

from .allowlist import (
    ACTIONS_NS_LOG,
    ALLOWED_ACTION_TYPES,
    ALLOWED_APP_COMPONENTS,
    COMPANION_ACTIONS_EXCLUDED_APP_COMPONENTS,
    MAX_ACTIONS_PER_TURN,
    _normalize_action,
    _opaque_id,
    actions_emit_instruction,
    normalize_actions_list_from_json,
    parse_actions_tail,
)
from .ambient import (
    MUSIC_PLAYER_COMPONENT,
    ambient_actions_enabled,
    expand_ambient_actions,
)

__all__: tuple[str, ...] = (
    "ACTIONS_NS_LOG",
    "ALLOWED_ACTION_TYPES",
    "ALLOWED_APP_COMPONENTS",
    "COMPANION_ACTIONS_EXCLUDED_APP_COMPONENTS",
    "MAX_ACTIONS_PER_TURN",
    "_normalize_action",
    "_opaque_id",
    "normalize_actions_list_from_json",
    "parse_actions_tail",
    "actions_emit_instruction",
    "MUSIC_PLAYER_COMPONENT",
    "ambient_actions_enabled",
    "expand_ambient_actions",
)
