# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# **Affective Router** for EWA companion (project «Mela's Ascension», Module C4): combines existing
# trust / wrath classifier signals with a cheap regex-based heuristic over the user's last message and
# returns ``AffectiveRouting`` — a structured ``(mood, suggested_persona, suggested_ambient)`` hint that
# downstream modules (chat orchestrator, anticipation, ambient driver in a later PR) can consult without
# any extra LLM call.
# Invariants:
# - **Pure** function — no I/O, no async, no LLM. Safe to call on every turn.
# - **Suggestion only.** Real persona switching stays inside ``companion_trust_turn`` (abuse / rude heuristic → hostile v1);
#   this module never mutates the profile.
# - When inputs are missing or ambiguous the router returns ``mood='neutral'``, persona = current seed and
#   ``ambient=None``. Never raises.
# - Heuristic copes with mixed RU/EN text; matching is case-insensitive and bounded to the first 4 KiB.
# Related:
# - api/ewa_platform/companion/sidecar/trust_classify.py
# - api/ewa_platform/companion/sidecar/arlika_wrath_classify.py
# - api/ewa_platform/companion/persona/anticipation.py
# - api/ewa_platform/companion/turn/chat_turn.py
# ---

from __future__ import annotations

import re
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Final, Literal

Mood = Literal[
    "warm",
    "neutral",
    "tense",
    "playful",
    "grief",
    "focus",
]

_MAX_TEXT_LEN: Final[int] = 4096

_RE_WARM = re.compile(
    r"(?i)("
    r"спасиб|благодар|люблю|обнима|родн[аы][яй]|солнышк|"
    r"thanks?\b|thank\s+you|love\s+you|appreciate|grateful"
    r")"
)
_RE_GRIEF = re.compile(
    r"(?i)("
    r"устал[аи]?\b|вымотан|вымоталась|плохо мне|тяжело|"
    r"грустно|депресс|плакал[аи]?|плачу|"
    r"tired|exhausted|sad|crying|burnt? out"
    r")"
)
_RE_TENSE = re.compile(
    r"(?i)("
    r"бес[ия]шь|раздража|ненавиж|злюсь|сука\b|тупица|"
    r"идиот(?:ка)?|нахер|пошл[ао]\s+(?:ты|нахрен)|"
    r"hate\s+(?:you|this)|annoyed?|piss(?:ed)?\s+off|stupid|"
    r"гадина|тварь|сволоч"
    r")"
)
_RE_PLAYFUL = re.compile(
    r"(?i)("
    r"хах[ао]+|ха-ха|лол\b|ору\b|смешно\b|"
    r"haha|lol\b|funny|jk\b|just\s+kidding"
    r")"
)
_RE_FOCUS = re.compile(
    r"(?i)("
    r"сосредоточ|нужно сделать|deadlin|to\s*do|нужно сдать|"
    r"focus|priorit(y|ize)|crunch|задач[аи]"
    r")"
)


@dataclass(frozen=True)
class AffectiveRouting:
    """Routing suggestion for a single chat turn — pure, non-mutating."""

    mood: Mood
    suggested_persona: str
    suggested_ambient: str | None
    confidence: float
    rationale: str


_AMBIENT_BY_MOOD: Final[dict[Mood, str | None]] = {
    "warm": "ambient_warm_soft",
    "grief": "ambient_low_warm",
    "tense": "ambient_cool_low",
    "playful": "ambient_playful_bright",
    "focus": "ambient_focus_neutral",
    "neutral": None,
}


def _detect_mood(text: str) -> tuple[Mood, float, str]:
    """Return ``(mood, confidence, rationale)`` from cheap regex heuristics."""

    if not text:
        return "neutral", 0.0, "empty_input"
    if _RE_TENSE.search(text):
        return "tense", 0.85, "matched_hostile_or_irritation"
    if _RE_GRIEF.search(text):
        return "grief", 0.8, "matched_fatigue_or_sadness"
    if _RE_WARM.search(text):
        return "warm", 0.75, "matched_gratitude_or_warmth"
    if _RE_PLAYFUL.search(text):
        return "playful", 0.6, "matched_playful_markers"
    if _RE_FOCUS.search(text):
        return "focus", 0.5, "matched_task_focus_markers"
    return "neutral", 0.0, "no_emotional_markers"


def _persona_for_mood(
    *,
    current_seed: str,
    mood: Mood,
    trust_delta: int | None,
    abuse_at_peak: bool | None,
) -> str:
    """Return the **suggested** persona seed id. Final switch decision stays with `companion_trust_turn`."""

    seed = (current_seed or "parent").strip().lower() or "parent"

    if abuse_at_peak is True:
        return "arlika"

    if mood == "tense":
        return "arlika_v2" if seed != "arlika" else seed
    if mood == "grief":
        return "mela" if seed not in ("arlika", "arlika_v2") else seed
    if mood == "warm" and seed in ("arlika", "arlika_v2"):
        return "arlika_v2"
    if isinstance(trust_delta, int) and trust_delta <= -2 and seed != "arlika":
        return "arlika_v2"
    return seed


def affective_route(
    *,
    user_text: str,
    persona_seed_id: str,
    trust_delta: int | None = None,
    abuse_at_peak: bool | None = None,
    recent_episode_snippets: Sequence[str] | None = None,
) -> AffectiveRouting:
    """Combine ``user_text`` heuristics with optional trust/wrath classifier signals.

    The function never blocks and never raises. Pass ``trust_delta`` / ``abuse_at_peak`` only if you have
    already obtained them from ``classify_companion_trust_turn`` for the same turn — otherwise leave ``None``
    and the router falls back to text-only heuristics.
    """

    text = (user_text or "")[:_MAX_TEXT_LEN]
    mood, confidence, rationale = _detect_mood(text)

    joined_eps = ""
    if recent_episode_snippets:
        joined_eps = " ".join(str(s or "").strip() for s in recent_episode_snippets if str(s or "").strip())[
            :_MAX_TEXT_LEN
        ]
    if mood == "neutral" and joined_eps:
        if _RE_GRIEF.search(joined_eps):
            mood = "grief"
            confidence = max(confidence, 0.55)
            rationale = "recent_episodes_signal_fatigue"
        elif _RE_TENSE.search(joined_eps):
            mood = "tense"
            confidence = max(confidence, 0.55)
            rationale = "recent_episodes_signal_tension"

    if abuse_at_peak is True:
        mood = "tense"
        confidence = max(confidence, 0.95)
        rationale = "abuse_at_peak_overrides_heuristic"
    elif isinstance(trust_delta, int):
        if trust_delta >= 2 and mood not in ("tense", "grief"):
            mood = "warm"
            confidence = max(confidence, 0.7)
            rationale = "trust_delta_warm_boost"
        elif trust_delta <= -2 and mood == "neutral":
            mood = "tense"
            confidence = max(confidence, 0.7)
            rationale = "trust_delta_tense_boost"

    suggested_persona = _persona_for_mood(
        current_seed=persona_seed_id,
        mood=mood,
        trust_delta=trust_delta,
        abuse_at_peak=abuse_at_peak,
    )
    ambient = _AMBIENT_BY_MOOD.get(mood)

    return AffectiveRouting(
        mood=mood,
        suggested_persona=suggested_persona,
        suggested_ambient=ambient,
        confidence=round(float(confidence), 3),
        rationale=rationale,
    )
