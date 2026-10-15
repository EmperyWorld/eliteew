# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Companion **deterministic** resolution of ``open_app`` targets by **ordinal position** inside the latest desktop
# ``surface_listing`` snapshot (Shell ``listing`` hint + open verb required). Targets ``DocEditor`` or ``ContentManagerPro``.
# Exposes **``user_intent_shell_listing_doceditor_ordinal_open``** so ``chat_turn`` can drop model-only DocEditor opens
# unless the user line would also trigger this merge.
# Invariants:
# - Count only listing rows that carry ``uc=<id>`` (same traversal order as ``flat_surface_listing_entries``).
# - Never invents identifiers; skips on empty listing, missing ``uc``, or out-of-range index.
# - Opt-out via ``EWA_COMPANION_LISTING_ORDINALS=0``.
# Related:
# - api/ewa_platform/companion/storage/doceditor_content_resolve.py
# - api/ewa_platform/companion/turn/chat_turn.py
# ---
"""Shell ``surface_listing`` ordinal → ``open_app`` augmentation (DocEditor / Content Manager)."""

from __future__ import annotations

import logging
import os
import re
from collections.abc import Mapping
from typing import Any, Literal

from api.ewa_platform.companion.storage.doceditor_content_resolve import (
    companion_already_has_cm_focus_or_filter,
    companion_already_has_doceditor_unified,
    flat_surface_listing_entries,
    merge_contentmanager_open_for_companion,
    merge_doceditor_open_with_unified_id,
)

logger = logging.getLogger(__name__)


def _env_listing_ordinals_enabled() -> bool:
    raw = os.getenv("EWA_COMPANION_LISTING_ORDINALS", "1")
    return str(raw).strip().lower() not in ("0", "false", "no", "off")


_LISTING_HINT_RE = re.compile(
    r"(?:\b(?:list(?:ing)?|inventory)\b|списк(?:а|е|ом|ами|ах)?|перечень|листинг)",
    re.IGNORECASE,
)

_OPEN_VERB_FOR_ORDINAL = re.compile(
    r"(?:\b|^)(?:открой|открыть|покажи|запусти|выбери|выберите|откройте"
    r"|open|show|launch|focus|bring\s+up|select)\b",
    re.IGNORECASE,
)

_DIGIT_ORDINAL_RE = re.compile(
    r"(?:#|№|(?:ном(?:ер|\.)|n[oр]\.?)\s*)(\d{1,2})\b",
    re.IGNORECASE,
)

_RU_LAST_RE = re.compile(r"\b(?:последн\w+|крайн\w+)\b", re.IGNORECASE)
_EN_LAST_RE = re.compile(r"\b(?:last|final)\b", re.IGNORECASE)

_RU_ORD_PREFIX_TO_N: tuple[tuple[str, int], ...] = (
    ("перв", 1),
    ("втор", 2),
    ("треть", 3),
    ("четверт", 4),
    ("пят", 5),
    ("шест", 6),
    ("седьм", 7),
    ("восьм", 8),
    ("девят", 9),
    ("десят", 10),
)

# Longest word first so ``third`` beats ``thi`` tails and ``second`` does not match ``secondarily``.
_EN_ORD_WORDS_DESC: tuple[tuple[str, int], ...] = (
    ("tenth", 10),
    ("seventh", 7),
    ("third", 3),
    ("fourth", 4),
    ("fifth", 5),
    ("sixth", 6),
    ("eighth", 8),
    ("ninth", 9),
    ("second", 2),
    ("first", 1),
)

_CONTENTMANAGER_HINT_RE = re.compile(
    r"(?:контент\s*-\s*менеджер|контент\s+менеджер\b"
    r"|менеджер\s+контента\b|content\s+manager|content\s*-\s*manager)",
    re.IGNORECASE,
)


def _entries_with_uc(
    shell_norm: Mapping[str, Any] | None,
) -> list[tuple[str | None, str]]:
    rows = flat_surface_listing_entries(shell_norm if isinstance(shell_norm, Mapping) else None)
    out: list[tuple[str | None, str]] = []
    for name, uc in rows:
        u = str(uc).strip() if uc else ""
        if u:
            out.append((name, u))
    return out


def resolve_shell_listing_ordinal_component(
    user_line: str,
) -> Literal["DocEditor", "ContentManagerPro"]:
    if _CONTENTMANAGER_HINT_RE.search(user_line.strip()):
        return "ContentManagerPro"
    return "DocEditor"


def parse_shell_listing_ordinal_slot(user_line: str) -> int | Literal["last"] | None:
    """1-based ordinal among rows with ``uc``; ``last``; ``None`` if not detected."""

    s = user_line.strip()
    if not s:
        return None

    if _RU_LAST_RE.search(s) or _EN_LAST_RE.search(s):
        return "last"

    m = _DIGIT_ORDINAL_RE.search(s)
    if m:
        try:
            n = int(m.group(1))
        except ValueError:
            return None
        return n if 1 <= n <= 50 else None

    for word, num in _EN_ORD_WORDS_DESC:
        if re.search(rf"\b{re.escape(word)}\b", s, re.IGNORECASE):
            return num

    tokens_ru = re.findall(r"[\wа-яА-ЯёЁ\-]+", s.lower())
    for t in tokens_ru:
        if len(t) < 4:
            continue
        if t.startswith(("послед", "крайн")):
            continue
        for prefix, num in _RU_ORD_PREFIX_TO_N:
            if t.startswith(prefix) and len(t) <= 14:
                return num
    return None


def user_intent_shell_listing_doceditor_ordinal_open(
    user_line: str,
    shell_norm: Mapping[str, Any] | None,
) -> bool:
    """True exactly when ``augment_actions_shell_listing_ordinals`` would insert **DocEditor** ``open_app`` (not CM)."""

    if not _env_listing_ordinals_enabled():
        return False
    if not isinstance(user_line, str) or not user_line.strip():
        return False
    if not (_LISTING_HINT_RE.search(user_line) and _OPEN_VERB_FOR_ORDINAL.search(user_line)):
        return False
    which = parse_shell_listing_ordinal_slot(user_line)
    if which is None:
        return False
    if resolve_shell_listing_ordinal_component(user_line) != "DocEditor":
        return False
    with_uc = _entries_with_uc(shell_norm)
    if not with_uc:
        return False
    idx_1_based = len(with_uc) if which == "last" else int(which)
    return 1 <= idx_1_based <= len(with_uc)


def augment_actions_shell_listing_ordinals(
    user_line: str,
    actions: list[dict[str, Any]],
    shell_norm: Mapping[str, Any] | None,
) -> list[dict[str, Any]]:
    """Merge deterministic ``open_app`` when ``user_line`` references a numbered row in ``surface_listing``."""

    if not _env_listing_ordinals_enabled():
        return actions
    if not isinstance(user_line, str) or not user_line.strip():
        return actions
    if not (_LISTING_HINT_RE.search(user_line) and _OPEN_VERB_FOR_ORDINAL.search(user_line)):
        return actions

    which = parse_shell_listing_ordinal_slot(user_line)
    if which is None:
        return actions

    with_uc = _entries_with_uc(shell_norm)
    if not with_uc:
        logger.info("[STEP] companion_listing_ordinal_skip empty_uc_rows")
        return actions

    idx_1_based = len(with_uc) if which == "last" else int(which)
    if idx_1_based < 1 or idx_1_based > len(with_uc):
        logger.info(
            "[STEP] companion_listing_ordinal_oob slot=%s len=%s",
            idx_1_based,
            len(with_uc),
        )
        return actions

    picked_name, picked_uc = with_uc[idx_1_based - 1]
    target = resolve_shell_listing_ordinal_component(user_line)

    rationale = f"Opened from listing row #{idx_1_based}: {(picked_name or 'item').strip()[:80]}"[:200]

    merged_in = [_ for _ in actions if isinstance(_, dict)]

    if target == "ContentManagerPro":
        if companion_already_has_cm_focus_or_filter(merged_in):
            return actions
        return merge_contentmanager_open_for_companion(
            merged_in,
            focus_unified_content_id=picked_uc,
            rationale=rationale,
        )

    if companion_already_has_doceditor_unified(merged_in):
        return actions
    return merge_doceditor_open_with_unified_id(
        merged_in,
        unified_id=picked_uc,
        rationale=rationale,
    )


__all__: tuple[str, ...] = (
    "augment_actions_shell_listing_ordinals",
    "parse_shell_listing_ordinal_slot",
    "resolve_shell_listing_ordinal_component",
    "user_intent_shell_listing_doceditor_ordinal_open",
)
