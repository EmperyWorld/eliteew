# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Topic extraction from companion plan user lines (shared by intent + schedule).
# Related:
# - api/ewa_platform/companion/plans/service.py
# - api/ewa_platform/companion/plans/schedule.py
# ---

from __future__ import annotations

import re

_PLAN_BOILERPLATE_RE = re.compile(
    r"(?is)\b(?:составь|сделай|построй|разработай|накидай|создай|подготовь|план|roadmap|"
    r"дорожн\w*\s+карт|недел\w*|месяц\w*|шаги|задачи|этапы|make|create|build|plan)\b",
)

_DURATION_TOPIC_NOISE_RE = re.compile(
    r"(?is)\b(?:на|for)\s+(?:\d+|две|два|три|четыре|\w+)\s*"
    r"(?:-\s*)?(?:недел\w*|месяц\w*|дн\w*|weeks?|months?|days?)?\s*:?\s*"
)


def extract_plan_topic_from_user_line(user_line: str) -> str:
    """Strip plan boilerplate; remaining text is the user's topic (may be empty)."""

    topic = _PLAN_BOILERPLATE_RE.sub(" ", user_line or "").strip()
    topic = _DURATION_TOPIC_NOISE_RE.sub(" ", topic)
    topic = re.sub(r"\s+", " ", topic)
    return topic.strip(" :—–-")


__all__ = ("extract_plan_topic_from_user_line",)
