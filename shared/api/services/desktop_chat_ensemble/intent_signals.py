# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared goal-intent signals for Desktop ensemble blueprint pick and agentic planning.
# Invariants:
# - Partner/feedback coaching must not force research_plan_v1.
# - Explicit internet asks must surface as web-enabled expert turns.
# Related:
# - api/services/desktop_chat_ensemble/blueprint/picker.py
# - api/ewa_platform/agentic/kernel/research_plan_contract.py
# ---

from __future__ import annotations

import re

_INTERNET_RE = re.compile(
    r"(?is)"
    r"(?:в\s+интернет\w*|найди\s+в\s+интернет\w*|поиск\s+в\s+интернет\w*|"
    r"search\s+(?:the\s+)?(?:web|internet)|from\s+the\s+internet|"
    r"google\s+|web\s+search|онлайн.?поиск)"
)

_PARTNER_FEEDBACK_RE = re.compile(
    r"(?is)"
    r"(?:"
    # Direct partner framing (nom/dat/gen: партнёр / партнеру / партнера)
    r"как\s+твой\s+партн[её]р\w*|как\s+партн[её]р\w*|"
    r"я\s+как\s+твой\s+партн[её]р\w*|из\s+уважения\s+к\s+тебе\s+как\s+партн[её]р\w*|"
    r"партн[её]р\.|я\s+горжусь|"
    # Coaching / continue-later tone common in lady_boss→Zera turns
    r"споп\.?\s*дыши|верн[её]мся\s+(?:к\s+)?твоим|"
    r"соавтор|твой\s+рост|обсудим\s+позже|"
    r"маркетинговый\s+анализ\s+тезиса|"
    r"минус\s*:|плюс\s*:|моя\s+ошибка|"
    r"3\s*вопрос|шаблон\s*3"
    r")"
)

_MULTI_DELIVERABLE_RE = re.compile(
    r"(?is)"
    r"(?:два\s+документ|нескольк\w*\s+документ|dual[_\s-]?doc|"
    r"таблиц\w*|сегмент\w*|roadmap|презентац)"
)


def goal_requires_internet(goal_text: str) -> bool:
    return bool(_INTERNET_RE.search(str(goal_text or "")))


def goal_looks_like_partner_feedback(goal_text: str) -> bool:
    """Partner coaching / thesis feedback — not a greenfield market-research brief."""
    text = str(goal_text or "").strip()
    if len(text) < 80:
        return False
    return bool(_PARTNER_FEEDBACK_RE.search(text))


def goal_looks_like_multi_deliverable(goal_text: str) -> bool:
    return bool(_MULTI_DELIVERABLE_RE.search(str(goal_text or "")))


__all__ = (
    "goal_looks_like_multi_deliverable",
    "goal_looks_like_partner_feedback",
    "goal_requires_internet",
)
