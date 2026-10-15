# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Regex gate for **plan creation** intents in companion chat (server-only, no client hints required).
# Invariants:
# - Returns False for empty lines and pure memory questions.
# Related:
# - api/ewa_platform/companion/orchestration/tool_registry.py (plan_v1)
# ---

from __future__ import annotations

import re

_PLAN_INTENT_RE = re.compile(
    r"(?is)"
    r"(?:"
    r"\b(?:составь|сделай|построй|разработай|накидай|создай|подготовь)\b.{0,40}\b(?:план|roadmap|дорожн\w*\s+карт)"
    r"|"
    r"\b(?:план|roadmap)\b.{0,30}\b(?:на|на\s+\d+|на\s+неделю|на\s+месяц)"
    r"|"
    r"\b(?:разбей|разложи)\b.{0,30}\b(?:на\s+)?(?:шаги|задачи|этапы)"
    r"|"
    r"\b(?:план|plan)\b.{0,48}\b(?:дат\w*|dates?|deadlines?|срок\w*|due\s+dates?)"
    r"|"
    r"\b(?:make|create|build)\b.{0,30}\b(?:a\s+)?plan\b"
    r")",
)

_MEMORY_ONLY_RE = re.compile(
    r"(?is)(?:что\s+(?:ты\s+)?(?:помнишь|знаешь)|what\s+do\s+you\s+remember)",
)

_PLAN_REJECT_RE = re.compile(
    r"(?ix)"
    r"\b(?:неправильн\w*|wrong)\s+план\b"
    r"|"
    r"\bплан\b.{0,40}\bна\s+(?:тёмн|темн|светл|dark|light|auto)\b",
)


def user_line_requests_plan(user_line: str) -> bool:
    u = (user_line or "").strip()
    if len(u) < 8:
        return False
    if _MEMORY_ONLY_RE.search(u):
        return False
    if _PLAN_REJECT_RE.search(u):
        return False
    return bool(_PLAN_INTENT_RE.search(u))


__all__ = ("user_line_requests_plan",)
