# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Strip unsolicited companion action rows when the user line does not justify side effects.
# Invariants:
# - Conservative gates mirror server-side augment predicates (DocEditor, MusicPlayer, desktop theme).
# Related:
# - api/ewa_platform/companion/turn/chat_turn.py
# - documentation/product/ewa/EWA-COMPANION-CHAT-TURN-PHASES.md
# ---

from __future__ import annotations

import logging
import re
from collections.abc import Mapping
from typing import Any

from api.ewa_platform.companion.sidecar.shell_listing_ordinals import (
    user_intent_shell_listing_doceditor_ordinal_open,
)
from api.ewa_platform.companion.storage.doceditor_content_resolve import (
    user_intent_doceditor_open_with_file,
)
from api.ewa_platform.companion.ux.desktop_theme_inference import infer_theme_from_user_line

logger = logging.getLogger(__name__)

_NON_EXECUTION_QUESTION_RE = re.compile(
    r"(?ix)^\s*(?:как|почему|зачем|how|why|what)\b",
)
_MUSICPLAYER_OPEN_INTENT_RE = re.compile(
    r"(?ix)\b(?:открой|открыть|запусти|запустить|покажи|включи|open|launch|start|show|bring\s+up)\b"
    r".{0,48}\b(?:music\s*player|audio\s*player|media\s*player|musicplayer|"
    r"музык\w*\s+плеер|плеер(?:\s+музыки)?)\b",
)
_MUSICPLAYBACK_INTENT_RE = re.compile(
    r"(?ix)\b(?:включи|запусти|играй|play|start)\b.{0,40}\b(?:музыку|трек|music|track)\b",
)
_DESKTOP_LOOK_CTX_RE = re.compile(
    r"(?ix)\b(?:рабоч(?:ий|его)\s+стол|desktop|workspace|обои|wallpaper|"
    r"фон(?:\s+рабоч(?:его|ий)\s+стол[аи]?)?|accent|акцент|"
    r"оформлени\w*\s+рабоч(?:его|ий)\s+стол[аи]?|desktop\s+settings|personalization)\b",
)
_DESKTOP_LOOK_INTENT_RE = re.compile(
    r"(?ix)\b(?:смени(?:ть)?|поменя(?:й|ть)|постав(?:ь|ить)|выбер(?:и|ать)|переключ(?:и|ить)|"
    r"установ(?:и|ить)|настро(?:й|ить)|сдела(?:й|ть)|change|set|switch|apply|toggle|pick|update)\b",
)
_DESKTOP_LOOK_DESIRE_RE = re.compile(
    r"(?ix)\b(?:хочу|хотел[ау]?\s+бы|давай|можешь|можно|please|can\s+you|would\s+like|i\s+want)\b",
)


def user_line_justifies_doceditor_open_app(user_line: str, shell_norm: Mapping[str, Any] | None) -> bool:
    """User message warrants a companion-initiated DocEditor window open."""

    if user_intent_doceditor_open_with_file(user_line):
        return True
    return user_intent_shell_listing_doceditor_ordinal_open(user_line, shell_norm)


def user_line_justifies_musicplayer_open_app(user_line: str) -> bool:
    """Conservative gate for ``open_app:MusicPlayer``."""

    u = str(user_line or "").strip()
    if len(u) < 3:
        return False
    if _NON_EXECUTION_QUESTION_RE.search(u):
        return False
    return bool(_MUSICPLAYER_OPEN_INTENT_RE.search(u) or _MUSICPLAYBACK_INTENT_RE.search(u))


def user_line_justifies_desktop_config_patch(user_line: str, *, principal_id: str) -> bool:
    """Conservative gate for ``patch_desktop_config`` side effects."""

    u = str(user_line or "").strip()
    if len(u) < 3:
        return False
    if _NON_EXECUTION_QUESTION_RE.search(u):
        return False
    if infer_theme_from_user_line(u, principal_id=principal_id):
        return True
    if not _DESKTOP_LOOK_CTX_RE.search(u):
        return False
    return bool(_DESKTOP_LOOK_INTENT_RE.search(u) or _DESKTOP_LOOK_DESIRE_RE.search(u))


def strip_unjustified_doceditor_open_app_actions(
    user_line: str,
    actions: list[dict[str, Any]],
    shell_norm: Mapping[str, Any] | None,
) -> list[dict[str, Any]]:
    """Remove model-hallucinated ``open_app`` rows for DocEditor when the user did not ask to open the editor."""

    if user_line_justifies_doceditor_open_app(user_line, shell_norm):
        return actions
    out: list[dict[str, Any]] = []
    stripped = 0
    for row in actions:
        if not isinstance(row, dict):
            out.append(row)
            continue
        if (
            str(row.get("type") or "").strip() == "open_app"
            and str(row.get("app_component") or "").strip() == "DocEditor"
        ):
            stripped += 1
            continue
        out.append(row)
    if stripped:
        logger.info("[STEP] companion_strip_spurious_doceditor_open_app removed=%s", stripped)
    return out


def strip_unjustified_musicplayer_open_app_actions(
    user_line: str,
    actions: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Remove unsolicited ``open_app MusicPlayer`` rows unless the line clearly requests opening/playing music."""

    if user_line_justifies_musicplayer_open_app(user_line):
        return actions
    out: list[dict[str, Any]] = []
    stripped = 0
    for row in actions:
        if not isinstance(row, dict):
            out.append(row)
            continue
        if (
            str(row.get("type") or "").strip() == "open_app"
            and str(row.get("app_component") or "").strip() == "MusicPlayer"
        ):
            stripped += 1
            continue
        out.append(row)
    if stripped:
        logger.info("[STEP] companion_strip_spurious_musicplayer_open_app removed=%s", stripped)
    return out


def strip_unjustified_patch_desktop_config_actions(
    user_line: str,
    actions: list[dict[str, Any]],
    *,
    principal_id: str,
) -> list[dict[str, Any]]:
    """Drop unsolicited ``patch_desktop_config`` rows when user did not request desktop look changes."""

    if user_line_justifies_desktop_config_patch(user_line, principal_id=principal_id):
        return actions
    out: list[dict[str, Any]] = []
    stripped = 0
    for row in actions:
        if not isinstance(row, dict):
            out.append(row)
            continue
        if str(row.get("type") or "").strip() == "patch_desktop_config":
            stripped += 1
            continue
        out.append(row)
    if stripped:
        logger.info("[STEP] companion_strip_spurious_patch_desktop_config removed=%s", stripped)
    return out


__all__ = (
    "strip_unjustified_doceditor_open_app_actions",
    "strip_unjustified_musicplayer_open_app_actions",
    "strip_unjustified_patch_desktop_config_actions",
    "user_line_justifies_desktop_config_patch",
    "user_line_justifies_doceditor_open_app",
    "user_line_justifies_musicplayer_open_app",
)
