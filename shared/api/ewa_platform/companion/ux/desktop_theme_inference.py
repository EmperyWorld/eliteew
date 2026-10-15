# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Deterministic ``patch_desktop_config`` augmentation when the user asks to change **desktop theme** (including
# «на твоё усмотрение») but the chat LLM only suggests opening settings.
# Invariants:
# - Only adds rows that survive ``actions._normalize_action``; respects ``MAX_ACTIONS_PER_TURN``.
# - Requires desktop context words (рабочий стол / desktop / …) plus imperative, defer-to-companion, or desire/ask phrasing.
# - Stable «companion picks» theme from ``principal_id`` when user defers choice.
# Related:
# - api/ewa_platform/companion/actions/
# - api/ewa_platform/companion/turn/chat_turn.py
# ---
"""Infer companion desktop theme patch actions from conservative user-message patterns."""

from __future__ import annotations

import hashlib
import logging
import os
import re
from typing import Any

from api.ewa_platform.companion.actions import MAX_ACTIONS_PER_TURN, _normalize_action

logger = logging.getLogger(__name__)

_THEME_INFER_MAX_CHARS = int(os.getenv("EWA_COMPANION_THEME_INFER_MAX_CHARS", "320"))

_DESKTOP_THEME_CTX = re.compile(
    r"(?ix)(рабоч(?:ий|его)\s+стол\b|рабочего\s+стола\b|десктоп\w*\b|\bdesktop\b(?:\s+workspace)?|\bworkspace\s+theme\b|"
    r"тема\s+рабочего\s+стола|тем(?:у|ы)\s+стола\b|personalization\b.*\bdesktop\b|оформлени\w*\s+стола)",
)
_IMPERATIVE = re.compile(
    r"(?ix)\b(?:смени(?:ть)?|поменя(?:й|ть)|постав(?:ь|ить)|выбер(?:и|ать)|переключ(?:и|ить)|"
    r"установ(?:и|ить)|настро(?:й|ить)|сдела(?:й|ть)|перевед(?:и|ти)|"
    r"change|set|switch|apply|toggle|pick)\b",
)
_DEFER_TO_COMPANION = re.compile(
    r"(?ix)(\b(?:на|по)\s+(?:тво|ваш)[ёе]?\s+усмотрени.?|по\s+тво(?:ей|ём)\w*\s+(?:выбор\w*|вкус\w*)|сам\w*\s+выбер"
    r"|you\s+pick|your\s+(?:pick|choice)|surprise\s+me|whatever\s+you\s+(?:like|prefer))",
)
_THEME_DESIRE_OR_ASK = re.compile(
    r"(?ix)\b(?:хочу|хотел[ау]?\s+бы|нужна|надо\b|давай\b|"
    r"можешь\s+(?:поставить|выбрать|переключить|сделать)|можно\b|would\s+like|i\s+want|please\s+(?:set|switch))\b",
)
_NON_EXECUTION_QUESTION_RE = re.compile(
    r"(?ix)^\s*(?:как|почему|зачем|how|why|what)\b",
)
_THEME_WORD_RE = re.compile(r"(?ix)\b(?:тем[ауыё]|theme|оформлени\w*\s+стола)\b")
_NON_THEME_CONTENT_EDIT_RE = re.compile(
    r"(?ix)\b(?:поменя(?:й|ть)|замени(?:ть)?|замен(?:и|ить)|смени(?:ть)?)\b.{0,24}\b(?:на|to)\s+(?:"
    r"описани\w*|карточ\w*|формулиров\w*|назван\w*|wording|cards?|descriptions?)\b",
)


def _env_enabled() -> bool:
    raw = os.getenv("EWA_COMPANION_INFER_DESKTOP_THEME_PATCH", "1")
    return str(raw).strip().lower() not in ("0", "false", "no", "off")


def _already_has_patch(actions: list[dict[str, Any]]) -> bool:
    for row in actions:
        if isinstance(row, dict) and str(row.get("type") or "").strip().lower() == "patch_desktop_config":
            return True
    return False


def _stable_theme_pick(principal_id: str) -> str:
    h = hashlib.sha256(principal_id.encode("utf-8")).hexdigest()
    idx = int(h[:8], 16) % 3
    return ("dark", "light", "auto")[idx]


def _looks_like_non_executing_question(user_line: str) -> bool:
    s = str(user_line or "").strip()
    if not s:
        return False
    if "?" not in s and not _NON_EXECUTION_QUESTION_RE.search(s):
        return False
    return _NON_EXECUTION_QUESTION_RE.search(s) is not None


def infer_theme_from_user_line(user_line: str, *, principal_id: str) -> str | None:
    """Return the inferred desktop theme (``"dark"|"light"|"auto"``) or ``None`` when the line is not a theme request.

    Pure inference helper extracted from ``augment_patch_desktop_config_from_user_line`` so that the Phase B/C
    ``theme_set`` server tool (see ``orchestration.tool_registry``) can short-circuit the LLM round-trip for clear
    "set desktop theme" intents without re-implementing the regex stack.

    Invariants:
    - Returns ``None`` (no inference) when ``EWA_COMPANION_INFER_DESKTOP_THEME_PATCH`` is disabled. The caller is
      then responsible for falling back to the LLM-emitted ``patch_desktop_config`` action.
    - Falls back to a **principal-stable** pick (``_stable_theme_pick``) when the user explicitly defers ("на твоё
      усмотрение" / "you pick"); never random.
    """

    if not _env_enabled():
        return None
    u = (user_line or "").strip()
    if not u:
        return None
    if _looks_like_non_executing_question(u):
        return None
    if len(u) > _THEME_INFER_MAX_CHARS and not _THEME_WORD_RE.search(u[: min(len(u), 400)]):
        return None
    if _NON_THEME_CONTENT_EDIT_RE.search(u):
        return None
    if not (
        _DESKTOP_THEME_CTX.search(u)
        and (_IMPERATIVE.search(u) or _DEFER_TO_COMPANION.search(u) or _THEME_DESIRE_OR_ASK.search(u))
    ):
        return None

    low = u.lower()
    if any(
        tok in low
        for tok in (
            "тёмн",
            "темн",
            "dark",
            "night",
            "ночн",
            "black",
            "черн",
        )
    ) or ("тём" in low):
        return "dark"
    if any(tok in low for tok in ("светл", "light", "white", "бел", "день")):
        return "light"
    if any(tok in low for tok in ("авто", "auto", "систем", "system")) or re.search(r"(?i)как\s+в\s+систем", u):
        return "auto"
    if _DEFER_TO_COMPANION.search(u):
        return _stable_theme_pick(principal_id)
    if _THEME_DESIRE_OR_ASK.search(u) and _THEME_WORD_RE.search(u):
        return _stable_theme_pick(principal_id)
    return None


def augment_patch_desktop_config_from_user_line(
    user_line: str,
    actions: list[dict[str, Any]],
    *,
    principal_id: str,
) -> list[dict[str, Any]]:
    """Append ``patch_desktop_config`` when the user clearly targets desktop theme and no patch is present."""

    if len(actions) >= MAX_ACTIONS_PER_TURN:
        return actions
    if _already_has_patch(actions):
        return actions
    theme = infer_theme_from_user_line(user_line, principal_id=principal_id)
    if not theme:
        return actions

    raw = {"type": "patch_desktop_config", "patch": {"theme": theme}}
    row = _normalize_action(raw)
    if row is None:
        return actions
    merged = list(actions) + [row]
    logger.info("[STEP] companion_infer_desktop_theme_patch theme=%s", theme)
    return merged[:MAX_ACTIONS_PER_TURN]


__all__ = [
    "augment_patch_desktop_config_from_user_line",
    "infer_theme_from_user_line",
]
