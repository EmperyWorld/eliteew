# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Detect and strip malformed LLM control tails (memory/actions) when models shorten ``<<MEMORY>>…<<END>>`` to ``<>[…]<``.
# Invariants:
# - Pure regex helpers — no I/O; parsers in memory/actions decide JSON semantics.
# Related:
# - api/ewa_platform/companion/memory/hcm_store.py
# - api/ewa_platform/companion/actions/allowlist.py
# - api/ewa_platform/companion/context/noise.py
# ---

from __future__ import annotations

import re
from re import Pattern

# ``<>[{"type":"fact",…}]<`` — common typo vs canonical ``<<MEMORY>>[…]<<END>>``.
_LOOSE_ANGLE_JSON_BLOCK_RE: Pattern[str] = re.compile(
    r"<>[\s]*(?P<body>\[[\s\S]*?\])[\s]*<+",
    re.DOTALL,
)

# ``<<[{"type":…}]<<`` without MEMORY/END keywords.
_LOOSE_DBL_ANGLE_JSON_BLOCK_RE: Pattern[str] = re.compile(
    r"<<[\s]*(?P<body>\[[\s\S]*?\])[\s]*<<+(?!END>>)",
    re.DOTALL,
)

MALFORMED_CONTROL_TAIL_RES: tuple[Pattern[str], ...] = (
    _LOOSE_ANGLE_JSON_BLOCK_RE,
    _LOOSE_DBL_ANGLE_JSON_BLOCK_RE,
)


def strip_malformed_control_tails(text: str) -> str:
    """Remove leaked malformed control JSON blocks from user-visible prose."""

    t = text or ""
    for pat in MALFORMED_CONTROL_TAIL_RES:
        t = pat.sub("", t)
    t = re.sub(r"[ \t]{2,}", " ", t)
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip()


def iter_malformed_control_tail_bodies(text: str) -> list[tuple[Pattern[str], re.Match[str], str]]:
    """Return ``(pattern, match, json_body)`` for each malformed tail occurrence."""

    out: list[tuple[Pattern[str], re.Match[str], str]] = []
    for pat in MALFORMED_CONTROL_TAIL_RES:
        for m in pat.finditer(text or ""):
            body = (m.group("body") or "").strip()
            if body:
                out.append((pat, m, body))
    return out


__all__ = [
    "MALFORMED_CONTROL_TAIL_RES",
    "iter_malformed_control_tail_bodies",
    "strip_malformed_control_tails",
]
