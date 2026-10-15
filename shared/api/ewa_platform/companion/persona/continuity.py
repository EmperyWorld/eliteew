# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Pure helpers for ``companion_continuity_v1`` — decaying micro-self state (mood tint, valence,
# arousal, short unspoken notes) parallel to long-term ``companion_character_v1`` / HCM facts.
# Invariants:
# - No asyncio / DB I/O; persistence is caller's LP merge.
# - Never store raw chain-of-thought; notes are short sanitized topic tags only.
# - Prompt section is hard-capped (``CONTINUITY_PROMPT_BUDGET_CHARS``).
# - Feature flag ``EWA_COMPANION_CONTINUITY_V1_ENABLED`` default off (PG / getenv shim).
# Related:
# - documentation/product/ewa/EWA-COMPANION-CONTINUITY-PRESENCE-CAUSE-ROADMAP.md (W1)
# - api/ewa_platform/companion/turn/turn_memory_sideeffects.py
# - api/ewa_platform/companion/turn/phases/main_llm_prepare.py
# ---
"""EWA companion continuity micro-state (session self vector)."""

from __future__ import annotations

import os
import re
from collections.abc import Mapping, Sequence
from datetime import UTC, datetime
from typing import Any

CONTINUITY_NS: str = "companion_continuity_v1"
CONTINUITY_SCHEMA: str = "companion_continuity_v1"
CONTINUITY_PROMPT_BUDGET_CHARS: int = 180
MAX_UNSPOKEN_NOTES: int = 3
MAX_NOTE_CHARS: int = 80
DEFAULT_DECAY_HALF_LIFE_HOURS: float = 18.0
MAX_VALENCE_DRIFT: float = 0.15
MAX_AROUSAL_DRIFT: float = 0.15

MOOD_TINT_ALLOWLIST: frozenset[str] = frozenset(
    {
        "neutral",
        "warm",
        "grief",
        "tense",
        "playful",
        "focus",
        "focused_warm",
        "ironic_soft",
    }
)

_GREETING_ONLY = re.compile(
    r"^(?:привет|здравствуй(?:те)?|хай|hello|hi|hey|добр(?:ый|ое)\s+\w+)[\s!.?…]*$",
    re.IGNORECASE,
)
_UNSAFE_NOTE = re.compile(r"[<>{}\[\]\\]|<<|>>|ACTIONS|MEMORY", re.IGNORECASE)


def companion_continuity_v1_enabled() -> bool:
    """PG/env flag — default off until operator enables Continuity W1."""

    return str(os.getenv("EWA_COMPANION_CONTINUITY_V1_ENABLED", "0")).strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def _now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat()


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _clamp_unit(raw: Any, default: float = 0.5) -> float:
    try:
        return _clamp(float(raw), 0.0, 1.0)
    except TypeError, ValueError:
        return default


def _clamp_signed(raw: Any, default: float = 0.0) -> float:
    try:
        return _clamp(float(raw), -1.0, 1.0)
    except TypeError, ValueError:
        return default


def _parse_iso(raw: Any) -> datetime | None:
    text = str(raw or "").strip()
    if not text:
        return None
    try:
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        dt = datetime.fromisoformat(text)
    except ValueError:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def default_continuity_block() -> dict[str, Any]:
    return {
        "schema": CONTINUITY_SCHEMA,
        "mood_tint": "neutral",
        "valence": 0.0,
        "arousal": 0.25,
        "unspoken_notes": [],
        "updated_at": _now_iso(),
        "decay_half_life_hours": DEFAULT_DECAY_HALF_LIFE_HOURS,
    }


def normalize_continuity_block(raw: Mapping[str, Any] | None) -> dict[str, Any]:
    base = default_continuity_block()
    if not isinstance(raw, Mapping):
        return base
    tint = str(raw.get("mood_tint") or "neutral").strip().lower()
    if tint not in MOOD_TINT_ALLOWLIST:
        tint = "neutral"
    notes_raw = raw.get("unspoken_notes")
    notes: list[str] = []
    if isinstance(notes_raw, Sequence) and not isinstance(notes_raw, (str, bytes)):
        for item in notes_raw:
            cleaned = sanitize_unspoken_note(str(item))
            if cleaned and cleaned not in notes:
                notes.append(cleaned)
            if len(notes) >= MAX_UNSPOKEN_NOTES:
                break
    try:
        half = float(raw.get("decay_half_life_hours", DEFAULT_DECAY_HALF_LIFE_HOURS))
    except TypeError, ValueError:
        half = DEFAULT_DECAY_HALF_LIFE_HOURS
    half = _clamp(half, 1.0, 168.0)
    updated = str(raw.get("updated_at") or "").strip() or base["updated_at"]
    return {
        "schema": CONTINUITY_SCHEMA,
        "mood_tint": tint,
        "valence": _clamp_signed(raw.get("valence"), 0.0),
        "arousal": _clamp_unit(raw.get("arousal"), 0.25),
        "unspoken_notes": notes,
        "updated_at": updated,
        "decay_half_life_hours": half,
    }


def get_continuity(profile: Mapping[str, Any] | None) -> dict[str, Any]:
    if not isinstance(profile, Mapping):
        return default_continuity_block()
    lp = profile.get("learned_preferences")
    if not isinstance(lp, Mapping):
        return default_continuity_block()
    return normalize_continuity_block(lp.get(CONTINUITY_NS) if isinstance(lp.get(CONTINUITY_NS), Mapping) else None)


def sanitize_unspoken_note(raw: str) -> str:
    text = " ".join(str(raw or "").split())
    if not text or _UNSAFE_NOTE.search(text):
        return ""
    text = text[:MAX_NOTE_CHARS].strip(" .;,-")
    if len(text) < 4:
        return ""
    return text


def apply_continuity_decay(
    block: Mapping[str, Any],
    *,
    now: datetime | None = None,
) -> dict[str, Any]:
    """Exponential decay of valence/arousal toward neutral; drop notes near rest."""

    current = normalize_continuity_block(block)
    updated_at = _parse_iso(current.get("updated_at"))
    if updated_at is None:
        return current
    instant = now or datetime.now(UTC)
    hours = max(0.0, (instant - updated_at).total_seconds() / 3600.0)
    half = float(current["decay_half_life_hours"])
    if hours <= 0.0:
        return current
    factor = 0.5 ** (hours / half)
    valence = float(current["valence"]) * factor
    arousal = 0.25 + (float(current["arousal"]) - 0.25) * factor
    notes = list(current["unspoken_notes"])
    tint = str(current["mood_tint"])
    if abs(valence) < 0.05 and abs(arousal - 0.25) < 0.05:
        notes = []
        tint = "neutral"
    elif hours >= half * 2 and notes:
        notes = notes[:1]
    return normalize_continuity_block(
        {
            **current,
            "mood_tint": tint,
            "valence": valence,
            "arousal": arousal,
            "unspoken_notes": notes,
            # keep updated_at — decay is a read-time view until next write
        }
    )


def _mood_tint_from_affective(mood_name: str, *, valence: float) -> str:
    mood = (mood_name or "neutral").strip().lower()
    if mood == "warm" and valence >= 0.15:
        return "focused_warm" if valence >= 0.35 else "warm"
    if mood == "playful" and valence < 0.0:
        return "ironic_soft"
    if mood in MOOD_TINT_ALLOWLIST:
        return mood
    return "neutral"


def _topic_note_from_user_line(user_line: str) -> str:
    line = " ".join((user_line or "").split()).strip()
    if len(line) < 24 or _GREETING_ONLY.match(line):
        return ""
    # Prefer first clause; avoid dumping whole essays into continuity.
    for sep in (".", "!", "?", "…", "\n"):
        if sep in line:
            line = line.split(sep, 1)[0].strip()
            break
    return sanitize_unspoken_note(line)


def update_continuity_from_turn(
    current: Mapping[str, Any],
    *,
    user_line: str,
    affective_routing: Any | None = None,
    character: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Merge one chat turn signal into a decayed continuity block."""

    base = apply_continuity_decay(current)
    mood_name = "neutral"
    conf = 0.0
    if affective_routing is not None:
        mood_name = str(getattr(affective_routing, "mood", "neutral") or "neutral").strip().lower()
        try:
            conf = float(getattr(affective_routing, "confidence", 0.0) or 0.0)
        except TypeError, ValueError:
            conf = 0.0

    char_valence = 0.0
    char_arousal = float(base["arousal"])
    if isinstance(character, Mapping):
        mood = character.get("mood")
        if isinstance(mood, Mapping):
            char_valence = _clamp_signed(mood.get("valence"), 0.0)
            tension = _clamp_unit(mood.get("tension"), 0.2)
            energy = _clamp_unit(mood.get("energy", 0.5), 0.5)
            if "tension" in mood or "energy" in mood:
                char_arousal = _clamp(0.2 + tension * 0.6 + (energy - 0.5) * 0.2, 0.0, 1.0)

    target_valence = char_valence
    target_arousal = char_arousal
    if conf >= 0.2:
        # Soft pull toward affective confidence-weighted extremes for known moods.
        mood_pull = {
            "warm": (0.35, 0.35),
            "grief": (-0.35, 0.2),
            "tense": (-0.2, 0.7),
            "playful": (0.25, 0.55),
            "focus": (0.05, 0.45),
            "neutral": (0.0, 0.3),
        }.get(mood_name, (0.0, 0.3))
        target_valence = (1.0 - conf * 0.5) * target_valence + conf * 0.5 * mood_pull[0]
        target_arousal = (1.0 - conf * 0.4) * target_arousal + conf * 0.4 * mood_pull[1]

    prev_v = float(base["valence"])
    prev_a = float(base["arousal"])
    next_v = _clamp(prev_v + _clamp(target_valence - prev_v, -MAX_VALENCE_DRIFT, MAX_VALENCE_DRIFT), -1.0, 1.0)
    next_a = _clamp(prev_a + _clamp(target_arousal - prev_a, -MAX_AROUSAL_DRIFT, MAX_AROUSAL_DRIFT), 0.0, 1.0)
    tint = _mood_tint_from_affective(mood_name, valence=next_v)

    notes = list(base["unspoken_notes"])
    topic = _topic_note_from_user_line(user_line)
    if topic:
        notes = [topic, *[n for n in notes if n != topic]][:MAX_UNSPOKEN_NOTES]

    return normalize_continuity_block(
        {
            "mood_tint": tint,
            "valence": next_v,
            "arousal": next_a,
            "unspoken_notes": notes,
            "updated_at": _now_iso(),
            "decay_half_life_hours": base["decay_half_life_hours"],
        }
    )


def apply_continuity_after_chat_turn(
    profile: Mapping[str, Any],
    *,
    user_line: str,
    affective_routing: Any | None = None,
    character: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Read profile continuity, apply turn update, return new block (caller writes LP)."""

    return update_continuity_from_turn(
        get_continuity(profile),
        user_line=user_line,
        affective_routing=affective_routing,
        character=character,
    )


def continuity_prompt_section(block: Mapping[str, Any] | None) -> str:
    """Compact system-prompt slice; empty when neutral/rested."""

    live = apply_continuity_decay(normalize_continuity_block(block))
    tint = str(live["mood_tint"])
    valence = float(live["valence"])
    arousal = float(live["arousal"])
    notes = list(live["unspoken_notes"])
    if tint == "neutral" and abs(valence) < 0.05 and abs(arousal - 0.25) < 0.06 and not notes:
        return ""
    note_part = ""
    if notes:
        joined = "; ".join(notes[:2])
        note_part = f" notes=[{joined}]"
    sign = "+" if valence >= 0 else ""
    body = (
        "Continuity_self (decaying micro-state — same ongoing person, not long-term facts): "
        f"mood_tint={tint} valence={sign}{valence:.2f} arousal={arousal:.2f}{note_part}"
    )
    if len(body) > CONTINUITY_PROMPT_BUDGET_CHARS:
        body = body[: CONTINUITY_PROMPT_BUDGET_CHARS - 1].rstrip() + "…"
    return body


def merge_continuity_into_learned_preferences(
    lp: dict[str, Any],
    continuity: Mapping[str, Any],
) -> dict[str, Any]:
    out = dict(lp)
    out[CONTINUITY_NS] = normalize_continuity_block(continuity)
    return out


__all__ = (
    "CONTINUITY_NS",
    "CONTINUITY_PROMPT_BUDGET_CHARS",
    "CONTINUITY_SCHEMA",
    "MOOD_TINT_ALLOWLIST",
    "apply_continuity_after_chat_turn",
    "apply_continuity_decay",
    "companion_continuity_v1_enabled",
    "continuity_prompt_section",
    "default_continuity_block",
    "get_continuity",
    "merge_continuity_into_learned_preferences",
    "normalize_continuity_block",
    "sanitize_unspoken_note",
    "update_continuity_from_turn",
)
