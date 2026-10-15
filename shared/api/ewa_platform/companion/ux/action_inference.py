# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# **Deterministic augmentation** when the user's message clearly asks to launch an **allowlisted** desktop app while the
# HTTP LLM prose omits ``<<ACTIONS>>`` / JSON ``actions``. Covers **MusicPlayer** and **ContentManagerPro** (optional
# ``content_manager_focus_unified_content_id`` from inline ``uc=`` tokens or shell ``surface_listing`` when the tail is deictic).
# Invariants:
# - Only adds ``open_app`` rows that survive ``actions._normalize_action``; capped by ``MAX_ACTIONS_PER_TURN``.
# - Never duplicates Content Manager ``open_app``; may **upgrade** an existing CM row missing focus ID with resolved ``uc``.
# - Idempotent — never duplicates the same `(type, app_component)` for Music Player.
# - Opt-out via ``EWA_COMPANION_INFER_OPEN_FROM_USER=0``.
# Related:
# - api/ewa_platform/companion/actions/
# - api/ewa_platform/companion/storage/doceditor_content_resolve.py
# - api/ewa_platform/companion/turn/chat_turn.py
# ---
"""Infer missing companion ``open_app`` actions from conservative user-message patterns."""

from __future__ import annotations

import logging
import os
import re
from collections.abc import Mapping
from typing import Any

from api.ewa_platform.companion.actions import MAX_ACTIONS_PER_TURN, _normalize_action, _opaque_id
from api.ewa_platform.companion.storage.doceditor_content_resolve import (
    collect_surface_listing_anchors,
    is_deictic_doc_reference,
)

logger = logging.getLogger(__name__)

_MUSICPLAYER_RU = re.compile(
    r"(?:открой|открыть|запусти|покажи|включи)\s+(?:мне\s+){0,1}(?:до\s*){0,1}"
    r"(?:(?:музыкальный|music\s*){0,1}плеер|music\s*player|musicplayer)\b",
    re.IGNORECASE,
)
_MUSICPLAYER_EN = re.compile(
    r"\b(open|launch|start|show|bring\s+up)\s+(?:the\s+|my\s+|a\s+|an\s*)?(music\s+|audio\s+|media\s+)?player\b",
    re.IGNORECASE,
)

_CONTENTMANAGER_RU = re.compile(
    r"(?:открой|открыть|запусти|покажи|включи)\s+(?:мне\s+)?(?:"
    r"контент\s*-\s*менеджер\b"
    r"|контент\s+менеджер\b"
    r"|менеджер\s+контента\b"
    r")",
    re.IGNORECASE,
)
_CONTENTMANAGER_EN = re.compile(
    r"\b(open|launch|start|show|bring\s+up)\s+(?:the\s+|my\s+|a\s+|an\s*)?"
    r"(?:content\s+manager|content\s*-\s*manager)\b",
    re.IGNORECASE,
)
_NON_EXECUTION_QUESTION_RE = re.compile(
    r"(?ix)^\s*(?:как|почему|зачем|how|why|what)\b",
)

_UC_INLINE_RE = re.compile(r"(?i)\buc=(?P<uc>[^\s]+)")
_CM_DEICTIC_TAIL_EXTRA: frozenset[str] = frozenset(
    {
        "на этом",
        "на этом файле",
        "по нему",
        "for this",
        "for it",
        "about this",
        "this",
        "that",
    }
)


def _env_infer_enabled() -> bool:
    raw = os.getenv("EWA_COMPANION_INFER_OPEN_FROM_USER", "1")
    return str(raw).strip().lower() not in ("0", "false", "no", "off")


def _has_open(actions: list[dict[str, Any]], app_component: str) -> bool:
    for row in actions:
        if row.get("type") == "open_app" and str(row.get("app_component") or "").strip() == app_component:
            return True
    return False


def _intent_open_content_manager(user_line: str) -> bool:
    u = user_line.strip()
    return bool(_CONTENTMANAGER_RU.search(u) or _CONTENTMANAGER_EN.search(u))


def _tail_points_to_shell_listing(remainder: str) -> bool:
    tail = remainder.strip()
    if not tail:
        return False
    low = tail.lower().strip(",.;:!?\"«»'`")
    if low in _CM_DEICTIC_TAIL_EXTRA:
        return True
    return is_deictic_doc_reference(tail)


def _extract_inline_uc(user_line: str) -> str | None:
    m = _UC_INLINE_RE.search(user_line)
    if not m:
        return None
    return _opaque_id(m.group("uc"))


def _looks_like_non_executing_question(user_line: str) -> bool:
    s = str(user_line or "").strip()
    if not s:
        return False
    if "?" not in s and not _NON_EXECUTION_QUESTION_RE.search(s):
        return False
    return _NON_EXECUTION_QUESTION_RE.search(s) is not None


def _resolve_content_manager_focus_uc(
    user_line: str,
    shell_norm: Mapping[str, Any] | None,
) -> str | None:
    uc_inline = _extract_inline_uc(user_line)
    if uc_inline:
        return uc_inline
    ru_m = _CONTENTMANAGER_RU.search(user_line)
    en_m = _CONTENTMANAGER_EN.search(user_line)
    match = ru_m or en_m
    if match is None:
        return None
    m_end = match.end()
    remainder = user_line[m_end:] if m_end > 0 else ""
    anchors = collect_surface_listing_anchors(shell_norm if isinstance(shell_norm, Mapping) else None)
    _, last_u = anchors[-1] if anchors else (None, None)
    if not last_u:
        return None
    if not _tail_points_to_shell_listing(remainder):
        return None
    return last_u


def _index_content_manager_open(actions: list[dict[str, Any]]) -> int:
    for i, row in enumerate(actions):
        if not isinstance(row, dict):
            continue
        if row.get("type") == "open_app" and str(row.get("app_component") or "").strip() == "ContentManagerPro":
            return i
    return -1


def augment_actions_from_user_open_intent(
    user_line: str,
    actions: list[dict[str, Any]],
    *,
    shell_norm: Mapping[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Return ``actions`` merged with inferred ``open_app`` rows within ``MAX_ACTIONS_PER_TURN``."""

    if not _env_infer_enabled():
        return actions
    if not isinstance(user_line, str) or not user_line.strip():
        return actions
    if _looks_like_non_executing_question(user_line):
        return actions

    merged: list[dict[str, Any]] = [_ for _ in actions if isinstance(_, dict)]

    def _maybe_add_musicplayer() -> None:
        nonlocal merged
        if len(merged) >= MAX_ACTIONS_PER_TURN:
            return
        if _has_open(merged, "MusicPlayer"):
            return
        u = user_line.strip()
        if not (_MUSICPLAYER_RU.search(u) or _MUSICPLAYER_EN.search(u)):
            return
        row = _normalize_action({"type": "open_app", "app_component": "MusicPlayer"})
        if row is None:
            return
        logger.info("[STEP] companion_inferred_open_app app=MusicPlayer user_preview=%r", u[:120])
        merged.append(row)

    def _maybe_add_contentmanagerpro() -> None:
        nonlocal merged
        u = user_line.strip()
        if not _intent_open_content_manager(u):
            return
        focus_uc = _resolve_content_manager_focus_uc(user_line, shell_norm)
        idx_cm = _index_content_manager_open(merged)
        if idx_cm >= 0:
            row0 = merged[idx_cm]
            if (
                isinstance(row0, dict)
                and focus_uc
                and not str(row0.get("content_manager_focus_unified_content_id") or "").strip()
            ):
                upgraded = dict(row0)
                upgraded["content_manager_focus_unified_content_id"] = focus_uc
                norm = _normalize_action(upgraded)
                if norm is not None:
                    merged[idx_cm] = norm
                    logger.info(
                        "[STEP] companion_inferred_upgrade_open_app app=ContentManagerPro unified_preview=%r",
                        focus_uc[:120],
                    )
            return
        if len(merged) >= MAX_ACTIONS_PER_TURN:
            return
        raw: dict[str, Any] = {"type": "open_app", "app_component": "ContentManagerPro"}
        if focus_uc:
            raw["content_manager_focus_unified_content_id"] = focus_uc
        row = _normalize_action(raw)
        if row is None:
            return
        logger.info("[STEP] companion_inferred_open_app app=ContentManagerPro user_preview=%r", u[:120])
        merged.append(row)

    _maybe_add_musicplayer()
    _maybe_add_contentmanagerpro()
    return merged[:MAX_ACTIONS_PER_TURN]


__all__: tuple[str, ...] = ("augment_actions_from_user_open_intent",)
