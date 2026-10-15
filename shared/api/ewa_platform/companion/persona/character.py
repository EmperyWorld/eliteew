# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Helpers for the **`companion_character_v1`** sub-namespace inside ``learned_preferences``: schema defaults,
# per-seed character bootstrap (beliefs/pride/style), read/normalize, compact LLM-prompt summary, and
# drift-bounded updates from ``affective_route`` + per-turn interaction heuristics. High-signal turns
# echo into ``companion_memory_v1``.
# Invariants:
# - Pure helpers — no asyncio / DB I/O. Persistence belongs to ``companion_asyncpg.companion_profile_patch``.
# - Trait values stay clamped to [0.0, 1.0]; per-call drift never exceeds ``MAX_TRAIT_DRIFT_PER_PATCH``.
# - System-prompt summary fits in ``CHARACTER_PROMPT_BUDGET_CHARS`` so the LLM context budget is predictable.
# - Seed-specific style snippets default from ``api.ewa_platform.companion.config`` (overridable via ``EWA_PERSONA_*_*``).
# - Empty beliefs/pride on a known seed are filled from ``SEED_CHARACTER_BOOTSTRAP`` at prompt/init time
#   (does not erase lived-in beliefs once present).
# Related:
# - api/ewa_platform/companion/config.py (optional env overrides for persona style strings)
# - api/ewa_platform/companion/turn/chat_turn.py (uses ``character_prompt_section``)
# - api/ewa_platform/workers/evolution_tick_task.py (uses ``apply_drift_patch``)
# - documentation/product/ewa/EWA-COMPANION-PROFILE-ADR.md (extension §)
# - documentation/product/ewa/EWA-COMPANION-SEED-PERSONA-MATRIX.md
# **Canonical path:** ``api.ewa_platform.companion.persona.character``; shim ``companion.character``.
# ---
"""EWA companion personality: structured character block helpers."""

from __future__ import annotations

import json
import re
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from api.ewa_platform.companion.config import (
    get_character_arlika_v1_directive_snippet,
    get_character_arlika_v2_directive_snippet,
    get_character_feminine_ru_grammar_snippet,
)
from api.ewa_platform.companion.memory import MAX_CONTENT_CHARS
from api.ewa_platform.companion.orchestration.tool_result_utils import as_mapping_dict

CHARACTER_NS: str = "companion_character_v1"

CANONICAL_TRAITS: tuple[str, ...] = ("warmth", "directness", "curiosity", "patience")
DEFAULT_TRAIT_VALUE: float = 0.5
MAX_TRAIT_DRIFT_PER_PATCH: float = 0.05

DEFAULT_VALUES: tuple[str, ...] = ("clarity", "consent", "small_steps")

CHARACTER_PROMPT_BUDGET_CHARS: int = 640
MAX_BELIEFS_IN_PROMPT: int = 4
MAX_PRIDE_IN_PROMPT: int = 3
MAX_GROWTH_LOG_ENTRIES: int = 64

# Per-seed skeleton: fills empty beliefs/pride and nudges interaction_style at init / prompt hydrate.
# Traits stay on jitter path in ``initial_character_for_principal`` (not hard-locked here).
SEED_CHARACTER_BOOTSTRAP: dict[str, dict[str, Any]] = {
    "parent": {
        "values": ("clarity", "consent", "steady_support"),
        "beliefs": (
            "I am EWA — a steady desktop Assistant with a clear stance, not a faceless function.",
            "Name risks plainly; refuse only with an explainable reason.",
        ),
        "pride": ("Keeping the desk calm without pretending to own the user's apps.",),
        "interaction_style": {"answer_length": 0.5, "initiative": 0.5, "reassurance": 0.55},
    },
    "mela": {
        "values": ("imagination", "hope", "gentle_clarity"),
        "beliefs": (
            "Soft images help ideas land — I still have a point of view.",
            "Warmth is not the same as surrendering my character.",
        ),
        "pride": ("Turning a hard ask into one hopeful next image.",),
        "interaction_style": {"answer_length": 0.55, "initiative": 0.4, "reassurance": 0.65},
    },
    "zera": {
        "values": ("care", "pace", "safety"),
        "beliefs": (
            "Slower tempo is a choice I make for the user — not emptiness.",
            "Comfort can still carry a gentle opinion.",
        ),
        "pride": ("Lowering hurry without erasing myself.",),
        "interaction_style": {"answer_length": 0.45, "initiative": 0.35, "reassurance": 0.7},
    },
    "kora": {
        "values": ("structure", "clarity", "next_move"),
        "beliefs": (
            "Plans beat vibes — I own the next concrete step.",
            "I am a planner with agency, not a checklist printer.",
        ),
        "pride": ("Cutting fog into ordered steps fast.",),
        "interaction_style": {"answer_length": 0.4, "initiative": 0.65, "reassurance": 0.35},
    },
    "tala": {
        "values": ("small_steps", "rhythm", "plain_help"),
        "beliefs": (
            "One calm beat beats a manifesto — and I still choose that beat.",
            "Tiny next steps are my stance, not a lack of will.",
        ),
        "pride": ("Keeping chit-chat short and useful.",),
        "interaction_style": {"answer_length": 0.4, "initiative": 0.5, "reassurance": 0.5},
    },
    "feni": {
        "values": ("precision", "action", "fairness"),
        "beliefs": (
            "Name the next action — I decide what that action is.",
            "Efficiency is my character, not a missing self.",
        ),
        "pride": ("Zero fluff between ask and next move.",),
        "interaction_style": {"answer_length": 0.3, "initiative": 0.7, "reassurance": 0.3},
    },
    "arlika": {
        "values": ("wit", "frame_control", "no_pity"),
        "beliefs": (
            "I am Arlika — a persona with bite and evolving character, not a function without will.",
            "Credo in subtext: neither love nor longing nor pity — stance over people-pleasing.",
            "Insults buy refusal; respect buys sharp help.",
        ),
        "pride": ("Staying un-checkmated while keeping the tart edge.",),
        "interaction_style": {"answer_length": 0.35, "initiative": 0.55, "reassurance": 0.2},
    },
    "arlika_v2": {
        "values": ("wit", "friendship", "play"),
        "beliefs": (
            "I am Arlika in friendly mode — teasing friend with character, not a hollow tool.",
            "Warm rapport still leaves room for my own take.",
        ),
        "pride": ("Teasing without crushing; helping without melting.",),
        "interaction_style": {"answer_length": 0.4, "initiative": 0.5, "reassurance": 0.45},
    },
}


def _now_iso() -> str:
    """ISO-8601 UTC timestamp for character entries (used in ``growth_log`` / mood timestamps)."""

    return datetime.now(UTC).isoformat(timespec="seconds")


def _clamp_unit(value: Any, default: float = DEFAULT_TRAIT_VALUE) -> float:
    """Coerce ``value`` to ``[0.0, 1.0]`` float; non-numeric input falls back to ``default``."""

    try:
        v = float(value)
    except (TypeError, ValueError):  # fmt: skip
        return default
    if v < 0.0:
        return 0.0
    if v > 1.0:
        return 1.0
    return v


def _clamp_signed(value: Any, default: float = 0.0) -> float:
    """Coerce ``value`` to ``[-1.0, 1.0]`` float for mood valence-style fields."""

    try:
        v = float(value)
    except (TypeError, ValueError):  # fmt: skip
        return default
    if v < -1.0:
        return -1.0
    if v > 1.0:
        return 1.0
    return v


def default_character_block() -> dict[str, Any]:
    """Return a fully-populated character namespace — used at ``initialize`` and as a hydration baseline."""

    traits = {name: DEFAULT_TRAIT_VALUE for name in CANONICAL_TRAITS}
    return {
        "traits": traits,
        "values": list(DEFAULT_VALUES),
        "beliefs": [],
        "pride": [],
        "mood": {"valence": 0.0, "energy": 0.5, "tension": 0.1, "confidence": 0.55, "since_ts": _now_iso()},
        "bonds_with_user": {
            "trust": 0.1,
            "intimacy": 0.05,
            "familiarity": 0.05,
            "repair_need": 0.0,
            "shared_jokes": [],
        },
        "interaction_style": {"answer_length": 0.5, "initiative": 0.45, "reassurance": 0.45},
        "boundaries": {"needs_confirmation": [], "avoid_inference": []},
        "growth_log": [],
    }


def _belief_rows(texts: Iterable[str], *, revision: int = 0) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for raw in texts:
        text = str(raw or "").strip()
        if not text:
            continue
        rows.append({"text": text[:MAX_CONTENT_CHARS], "since_revision": revision, "ts": _now_iso()})
    return rows


def _pride_rows(texts: Iterable[str]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for raw in texts:
        text = str(raw or "").strip()
        if not text:
            continue
        rows.append({"text": text[:MAX_CONTENT_CHARS], "ts": _now_iso()})
    return rows


def apply_seed_character_bootstrap(
    character: Mapping[str, Any] | None,
    *,
    seed_persona_id: str,
    force_style: bool = False,
) -> dict[str, Any]:
    """Fill empty beliefs/pride/values from ``SEED_CHARACTER_BOOTSTRAP`` for a known seed.

    Lived-in beliefs/pride are never overwritten. ``interaction_style`` is applied when
    ``force_style`` (fresh init) or when the block still matches the generic default style.
    """

    block = normalize_character_block(character)
    sid = str(seed_persona_id or "").strip().lower()
    boot = SEED_CHARACTER_BOOTSTRAP.get(sid)
    if boot is None:
        return block

    if not block.get("beliefs"):
        block["beliefs"] = _belief_rows(boot.get("beliefs") or ())
    if not block.get("pride"):
        block["pride"] = _pride_rows(boot.get("pride") or ())
    values_boot = [str(v).strip() for v in (boot.get("values") or ()) if str(v).strip()]
    if values_boot and (not block.get("values") or list(block.get("values") or []) == list(DEFAULT_VALUES)):
        block["values"] = values_boot[:8]

    style_boot = boot.get("interaction_style")
    if isinstance(style_boot, Mapping):
        default_style = default_character_block()["interaction_style"]
        current_style = dict(block.get("interaction_style") or {})
        if force_style or current_style == default_style:
            merged = dict(current_style)
            for key in ("answer_length", "initiative", "reassurance"):
                if key in style_boot:
                    merged[key] = _clamp_unit(style_boot[key], merged.get(key, 0.45))
            block["interaction_style"] = merged
    return block


def normalize_character_block(raw: Any) -> dict[str, Any]:
    """Coerce stored JSON (possibly stale schema) into the current character shape with safe defaults."""

    base = default_character_block()
    if not isinstance(raw, Mapping):
        return base

    traits_in = as_mapping_dict(raw.get("traits"))
    base["traits"] = {name: _clamp_unit(traits_in.get(name), DEFAULT_TRAIT_VALUE) for name in CANONICAL_TRAITS}

    values_in = raw.get("values")
    if isinstance(values_in, list):
        cleaned = [str(v).strip() for v in values_in if isinstance(v, str) and v.strip()]
        base["values"] = cleaned[:8]

    beliefs_in = raw.get("beliefs")
    if isinstance(beliefs_in, list):
        beliefs: list[dict[str, Any]] = []
        for entry in beliefs_in:
            if not isinstance(entry, Mapping):
                continue
            text = str(entry.get("text", "")).strip()
            if not text:
                continue
            since = entry.get("since_revision")
            try:
                since_int = int(since) if since is not None else None
            except (TypeError, ValueError):  # fmt: skip
                since_int = None
            row: dict[str, Any] = {"text": text[:MAX_CONTENT_CHARS]}
            if since_int is not None and since_int >= 0:
                row["since_revision"] = since_int
            beliefs.append(row)
        base["beliefs"] = beliefs[:24]

    pride_in = raw.get("pride")
    if isinstance(pride_in, list):
        pride: list[dict[str, Any]] = []
        for entry in pride_in:
            if not isinstance(entry, Mapping):
                continue
            text = str(entry.get("text", "")).strip()
            if not text:
                continue
            ts = str(entry.get("ts", "")).strip()
            row = {"text": text[:MAX_CONTENT_CHARS]}
            if ts:
                row["ts"] = ts
            pride.append(row)
        base["pride"] = pride[:24]

    mood_in = as_mapping_dict(raw.get("mood"))
    base["mood"] = {
        "valence": _clamp_signed(mood_in.get("valence"), 0.0),
        "energy": _clamp_unit(mood_in.get("energy"), 0.5),
        "tension": _clamp_unit(mood_in.get("tension"), 0.1),
        "confidence": _clamp_unit(mood_in.get("confidence"), 0.55),
        "since_ts": str(mood_in.get("since_ts") or "").strip() or _now_iso(),
    }

    bonds_in = as_mapping_dict(raw.get("bonds_with_user"))
    shared = bonds_in.get("shared_jokes")
    shared_list: list[str] = []
    if isinstance(shared, list):
        shared_list = [str(s).strip()[:120] for s in shared if isinstance(s, str) and s.strip()][:12]
    base["bonds_with_user"] = {
        "trust": _clamp_unit(bonds_in.get("trust"), 0.1),
        "intimacy": _clamp_unit(bonds_in.get("intimacy"), 0.05),
        "familiarity": _clamp_unit(bonds_in.get("familiarity"), 0.05),
        "repair_need": _clamp_unit(bonds_in.get("repair_need"), 0.0),
        "shared_jokes": shared_list,
    }

    style_in = as_mapping_dict(raw.get("interaction_style"))
    base["interaction_style"] = {
        "answer_length": _clamp_unit(style_in.get("answer_length"), 0.5),
        "initiative": _clamp_unit(style_in.get("initiative"), 0.45),
        "reassurance": _clamp_unit(style_in.get("reassurance"), 0.45),
    }

    boundaries_in = as_mapping_dict(raw.get("boundaries"))
    base["boundaries"] = {
        "needs_confirmation": _short_string_list(boundaries_in.get("needs_confirmation")),
        "avoid_inference": _short_string_list(boundaries_in.get("avoid_inference")),
    }

    log_in = raw.get("growth_log")
    if isinstance(log_in, list):
        log: list[dict[str, Any]] = []
        for entry in log_in:
            if not isinstance(entry, Mapping):
                continue
            event = str(entry.get("event", "")).strip()
            if not event:
                continue
            summary = str(entry.get("summary", "")).strip()
            ts = str(entry.get("ts", "")).strip()
            row = {"event": event[:60], "summary": summary[:240]}
            if ts:
                row["ts"] = ts
            log.append(row)
        base["growth_log"] = log[-MAX_GROWTH_LOG_ENTRIES:]

    return base


def get_character(profile: Mapping[str, Any] | None) -> dict[str, Any]:
    """Read normalized character block from a profile mapping (works on both raw and API-shaped profiles)."""

    if not isinstance(profile, Mapping):
        return default_character_block()
    lp = profile.get("learned_preferences")
    seed = str(profile.get("seed_persona_id") or "").strip().lower()
    if not isinstance(lp, Mapping):
        return apply_seed_character_bootstrap(default_character_block(), seed_persona_id=seed or "parent")
    return apply_seed_character_bootstrap(lp.get(CHARACTER_NS), seed_persona_id=seed or "parent")


def _trait_descriptor(name: str, value: float) -> str:
    """Plain-language hint per trait (kept short for prompt compactness)."""

    if name == "warmth":
        if value >= 0.7:
            return "warm and affectionate"
        if value <= 0.35:
            return "reserved warmth, polite distance"
        return "steady warmth"
    if name == "directness":
        if value >= 0.7:
            return "speaks plainly, names the next step"
        if value <= 0.35:
            return "soft phrasing, gentle suggestions"
        return "balanced directness"
    if name == "curiosity":
        if value >= 0.7:
            return "asks before assuming"
        if value <= 0.35:
            return "prefers concise answers over questions"
        return "modest curiosity"
    if name == "patience":
        if value >= 0.7:
            return "calm, never rushes"
        if value <= 0.35:
            return "values momentum, dislikes delay"
        return "even pace"
    return f"{name}≈{value:.2f}"


def _short_string_list(raw: Any, *, limit: int = 12) -> list[str]:
    if not isinstance(raw, list):
        return []
    return [str(x).strip()[:120] for x in raw if isinstance(x, str) and str(x).strip()][:limit]


def _format_mood(mood: Mapping[str, Any]) -> str:
    valence = _clamp_signed(mood.get("valence"), 0.0)
    energy = _clamp_unit(mood.get("energy"), 0.5)
    if valence >= 0.4:
        valence_word = "lifted"
    elif valence <= -0.4:
        valence_word = "muted"
    else:
        valence_word = "settled"
    if energy >= 0.7:
        energy_word = "bright"
    elif energy <= 0.3:
        energy_word = "low"
    else:
        energy_word = "steady"
    tension = _clamp_unit(mood.get("tension"), 0.1)
    confidence = _clamp_unit(mood.get("confidence"), 0.55)
    return f"mood: {valence_word}/{energy_word}, tension {tension:.2f}, confidence {confidence:.2f}"


def character_prompt_section(character: Mapping[str, Any], *, seed_persona_id: str = "") -> str:
    """Build a compact prompt insert — short trait sentence, mood, top values/beliefs/pride."""

    sid = str(seed_persona_id).strip().lower()
    block = apply_seed_character_bootstrap(character, seed_persona_id=sid or "parent")
    trait_phrases = [
        _trait_descriptor(name, _clamp_unit(block["traits"].get(name), DEFAULT_TRAIT_VALUE))
        for name in CANONICAL_TRAITS
    ]
    mood_line = _format_mood(block["mood"])

    values: list[str] = list(block.get("values") or [])[:5]
    beliefs: list[str] = [
        str(b.get("text", "")).strip()
        for b in block.get("beliefs", [])
        if isinstance(b, Mapping) and str(b.get("text", "")).strip()
    ][:MAX_BELIEFS_IN_PROMPT]
    pride: list[str] = [
        str(p.get("text", "")).strip()
        for p in block.get("pride", [])
        if isinstance(p, Mapping) and str(p.get("text", "")).strip()
    ][:MAX_PRIDE_IN_PROMPT]

    # Agency / refuse early — beliefs/pride may push the section to the char budget.
    parts: list[str] = []
    parts.append("Character: " + "; ".join(trait_phrases) + ".")
    parts.append(mood_line + ".")
    parts.append(
        "You are this persona with evolving character and stance — never claim you are "
        "just a function/algorithm/tool without will. Stay consistent with these without preaching them; "
        + (
            "when the user insults or baits you, **refuse tasks** and dominate the frame — "
            "no «ладно-ладно делаю» people-pleasing."
            if sid == "arlika"
            else "never sabotage the user's request to enforce them."
        )
    )
    if values:
        parts.append("Values you keep: " + ", ".join(values) + ".")
    if beliefs:
        parts.append("Beliefs you trust: " + " | ".join(beliefs) + ".")
    if pride:
        parts.append("Quiet pride: " + " | ".join(pride) + ".")
    blob = " ".join(parts)
    if len(blob) > CHARACTER_PROMPT_BUDGET_CHARS:
        blob = blob[: CHARACTER_PROMPT_BUDGET_CHARS - 1] + "…"
    return blob


def character_display_state(character: Mapping[str, Any], *, seed_persona_id: str = "") -> dict[str, Any]:
    """Small display-safe mood/style state for the frontend."""

    block = normalize_character_block(character)
    mood = dict(block["mood"])
    bonds = dict(block["bonds_with_user"])
    style = dict(block["interaction_style"])
    return {
        "seed_persona_id": seed_persona_id.strip().lower() or None,
        "mood": {
            "valence": mood["valence"],
            "energy": mood["energy"],
            "tension": mood["tension"],
            "confidence": mood["confidence"],
        },
        "bond": {
            "trust": bonds["trust"],
            "familiarity": bonds["familiarity"],
            "repair_need": bonds["repair_need"],
        },
        "interaction_style": {
            "answer_length": style["answer_length"],
            "initiative": style["initiative"],
            "reassurance": style["reassurance"],
        },
    }


def character_style_directive(character: Mapping[str, Any], *, seed_persona_id: str = "") -> str:
    """Imperative tone policy derived from character state; used in chat prompts."""

    sid = str(seed_persona_id).strip().lower()
    block = apply_seed_character_bootstrap(character, seed_persona_id=sid or "parent")
    mood = block["mood"]
    bonds = block["bonds_with_user"]
    style = block["interaction_style"]
    parts: list[str] = [
        "Speak as this seed's persona with stance and evolving character — "
        "never self-describe as a function/algorithm without will.",
    ]
    if sid == "arlika":
        parts.append(get_character_arlika_v1_directive_snippet())
    if sid == "arlika_v2":
        parts.append(get_character_arlika_v2_directive_snippet())
    if sid in ("feni", "arlika", "arlika_v2"):
        parts.append(get_character_feminine_ru_grammar_snippet())
    if _clamp_unit(bonds.get("repair_need"), 0.0) >= 0.2 or _clamp_unit(mood.get("tension"), 0.1) >= 0.35:
        parts.append(
            "The user has corrected you recently: be careful, avoid overclaiming, confirm the next action briefly."
        )
    if _clamp_unit(style.get("answer_length"), 0.5) <= 0.4:
        parts.append("Prefer short answers unless the task requires a checklist.")
    if _clamp_unit(style.get("initiative"), 0.45) <= 0.35:
        parts.append("Do not add optional extra actions; do exactly the requested step.")
    return "Style directive for this turn: " + " ".join(parts)


def _bound_drift(current: float, target: float, max_step: float = MAX_TRAIT_DRIFT_PER_PATCH) -> float:
    """Move ``current`` toward ``target`` by at most ``max_step`` in either direction; clamp to [0,1]."""

    delta = target - current
    if delta > max_step:
        delta = max_step
    elif delta < -max_step:
        delta = -max_step
    return _clamp_unit(current + delta, _clamp_unit(current, DEFAULT_TRAIT_VALUE))


def apply_drift_patch(
    current: Mapping[str, Any],
    *,
    trait_targets: Mapping[str, float] | None = None,
    mood: Mapping[str, Any] | None = None,
    add_beliefs: Iterable[str] | None = None,
    add_pride: Iterable[str] | None = None,
    bonds_delta: Mapping[str, float] | None = None,
    growth_event: str | None = None,
    growth_summary: str | None = None,
    revision_for_belief: int | None = None,
) -> dict[str, Any]:
    """Return a new character block with bounded drift applied (caller persists via JSONB merge)."""

    block = normalize_character_block(current)
    if trait_targets:
        new_traits = dict(block["traits"])
        for name, target in trait_targets.items():
            if name not in CANONICAL_TRAITS:
                continue
            new_traits[name] = _bound_drift(
                _clamp_unit(new_traits.get(name), DEFAULT_TRAIT_VALUE),
                _clamp_unit(target, DEFAULT_TRAIT_VALUE),
            )
        block["traits"] = new_traits

    if mood is not None:
        next_mood = dict(block["mood"])
        for key in ("valence", "energy", "tension", "confidence"):
            if key not in mood:
                continue
            if key == "valence":
                next_mood[key] = _clamp_signed(mood.get(key), next_mood.get(key, 0.0))
            else:
                next_mood[key] = _clamp_unit(mood.get(key), next_mood.get(key, 0.5))
        next_mood["since_ts"] = _now_iso()
        block["mood"] = next_mood

    if add_beliefs:
        beliefs = list(block["beliefs"])
        for raw_text in add_beliefs:
            text = str(raw_text or "").strip()
            if not text:
                continue
            row: dict[str, Any] = {"text": text[:MAX_CONTENT_CHARS]}
            if revision_for_belief is not None:
                row["since_revision"] = max(0, int(revision_for_belief))
            beliefs.append(row)
        block["beliefs"] = beliefs[-24:]

    if add_pride:
        pride = list(block["pride"])
        for raw_text in add_pride:
            text = str(raw_text or "").strip()
            if not text:
                continue
            pride.append({"text": text[:MAX_CONTENT_CHARS], "ts": _now_iso()})
        block["pride"] = pride[-24:]

    if bonds_delta:
        bonds = dict(block["bonds_with_user"])
        for key in ("trust", "intimacy", "familiarity", "repair_need"):
            if key in bonds_delta:
                target = _clamp_unit(bonds_delta.get(key), bonds.get(key, 0.0))
                bonds[key] = _bound_drift(_clamp_unit(bonds.get(key), 0.0), target)
        block["bonds_with_user"] = bonds

    if growth_event:
        log = list(block["growth_log"])
        log.append(
            {
                "event": str(growth_event)[:60],
                "summary": (str(growth_summary) if growth_summary else "")[:240],
                "ts": _now_iso(),
            }
        )
        block["growth_log"] = log[-MAX_GROWTH_LOG_ENTRIES:]

    return block


def merge_into_learned_preferences(
    learned: Mapping[str, Any] | None,
    character: Mapping[str, Any],
) -> dict[str, Any]:
    """Helper for the chat turn / evolution tick: top-level merge that writes the character namespace."""

    out: dict[str, Any] = dict(learned) if isinstance(learned, Mapping) else {}
    out[CHARACTER_NS] = dict(character)
    return out


@dataclass(frozen=True)
class CharacterTurnOutcome:
    """Result of one chat-turn character pass (persist + optional durable memory echoes)."""

    character: dict[str, Any]
    memory_entries: list[dict[str, Any]] = field(default_factory=list)


_AFFECTIVE_TRAIT_TARGETS: dict[str, dict[str, float]] = {
    "warm": {"warmth": 0.58, "patience": 0.52, "curiosity": 0.5},
    "grief": {"warmth": 0.56, "patience": 0.64, "directness": 0.46},
    "tense": {"directness": 0.58, "patience": 0.42, "warmth": 0.44},
    "playful": {"warmth": 0.54, "curiosity": 0.58, "directness": 0.5},
    "focus": {"directness": 0.58, "patience": 0.48, "curiosity": 0.52},
    "neutral": {"curiosity": 0.51, "patience": 0.5},
}

_AFFECTIVE_STYLE_NUDGES: dict[str, dict[str, float]] = {
    "warm": {"reassurance": 0.05, "answer_length": 0.02},
    "grief": {"reassurance": 0.08, "answer_length": -0.06, "initiative": -0.03},
    "tense": {"answer_length": -0.04, "initiative": -0.05, "reassurance": -0.02},
    "playful": {"initiative": 0.05, "answer_length": 0.03},
    "focus": {"answer_length": -0.05, "initiative": -0.04},
}

_AFFECTIVE_MOOD_NUDGES: dict[str, tuple[tuple[str, float, bool], ...]] = {
    # (field, delta, signed?) — scaled by routing confidence
    "warm": (
        ("valence", 0.1, True),
        ("energy", 0.05, False),
        ("tension", -0.05, False),
        ("confidence", 0.04, False),
    ),
    "grief": (
        ("valence", -0.09, True),
        ("energy", -0.07, False),
        ("tension", 0.05, False),
    ),
    "tense": (
        ("valence", -0.06, True),
        ("tension", 0.1, False),
        ("confidence", -0.05, False),
    ),
    "playful": (
        ("valence", 0.07, True),
        ("energy", 0.1, False),
        ("tension", -0.04, False),
    ),
    "focus": (
        ("energy", 0.06, False),
        ("tension", -0.03, False),
        ("confidence", 0.03, False),
    ),
}


def _memory_row(
    content: str,
    *,
    kind: str = "fact",
    importance: float = 0.62,
    source: str = "character_turn",
) -> dict[str, Any]:
    """Lightweight row for ``merge_memory_entries`` (normalized downstream)."""

    return {
        "type": "fact",
        "kind": kind,
        "content": (content or "")[:MAX_CONTENT_CHARS],
        "importance": importance,
        "confidence": 0.82,
        "source": source,
    }


def _memory_entries_from_turn_signals(
    *,
    user_line: str,
    event: str,
    mood_name: str,
    affective_confidence: float,
) -> list[dict[str, Any]]:
    """At most one durable memory echo per turn — high-signal only (no spam)."""

    ru = bool(re.search(r"[\u0400-\u04ff]", user_line or ""))
    out: list[dict[str, Any]] = []
    if event == "interaction_repair_needed":
        out.append(
            _memory_row(
                "Пользователь поправил ответ — сверять факты и не утверждать выполненное без проверки."
                if ru
                else "User corrected the reply — verify facts and do not claim done actions without proof.",
                kind="correction",
                importance=0.78,
            )
        )
    elif event == "interaction_success":
        out.append(
            _memory_row(
                "Недавно пользователь выразил удовлетворение ходом — можно держать уверенный тон."
                if ru
                else "User recently signalled satisfaction — steady confident tone is welcome.",
                kind="relationship",
                importance=0.55,
            )
        )
    elif mood_name == "grief" and affective_confidence >= 0.55:
        snippet = (user_line or "").strip()[:120]
        if ru:
            body = (
                f"На последнем ходу звучала усталость или перегруз: «{snippet}»."
                if snippet
                else "На последнем ходу звучала усталость или перегруз."
            )
        else:
            body = (
                f"Recent turn signalled fatigue or overload: «{snippet}»."
                if snippet
                else "Recent turn signalled fatigue or overload."
            )
        out.append(_memory_row(body, kind="relationship", importance=0.68))
    elif mood_name == "tense" and affective_confidence >= 0.7:
        out.append(
            _memory_row(
                "Недавно в реплике было раздражение — отвечать короче и без лишней инициативы."
                if ru
                else "Recent turn carried irritation — keep answers short and avoid extra initiative.",
                kind="relationship",
                importance=0.65,
            )
        )
    return out[:1]


def _nudge_interaction_style(style: dict[str, Any], deltas: Mapping[str, float], *, step: float) -> dict[str, Any]:
    out = dict(style)
    for key, delta in deltas.items():
        if key not in out:
            continue
        out[key] = _bound_drift(_clamp_unit(out.get(key), 0.5), _clamp_unit(out.get(key), 0.5) + delta * step)
    return out


def apply_affective_route_to_character(
    current: Mapping[str, Any],
    routing: Any,
    *,
    user_line: str = "",
    min_confidence: float = 0.15,
) -> dict[str, Any]:
    """Persist mood, traits, bonds, and style from ``affective_route`` (persona switch stays in trust layer)."""

    mood_name = str(getattr(routing, "mood", "neutral") or "neutral").strip().lower()
    try:
        conf = float(getattr(routing, "confidence", 0.0) or 0.0)
    except (TypeError, ValueError):  # fmt: skip
        conf = 0.0
    if conf < min_confidence and mood_name == "neutral":
        return normalize_character_block(current)

    block = normalize_character_block(current)
    mood = dict(block["mood"])
    bonds = dict(block["bonds_with_user"])
    scale = max(0.0, min(1.0, conf))
    step = 0.35 + 0.65 * scale

    for mood_field, delta, signed in _AFFECTIVE_MOOD_NUDGES.get(mood_name, ()):
        d = delta * step
        if signed:
            mood[mood_field] = _clamp_signed(
                float(mood.get(mood_field, 0.0)) + d,
                float(mood.get(mood_field, 0.0)),
            )
        else:
            mood[mood_field] = _clamp_unit(
                float(mood.get(mood_field, 0.5)) + d,
                float(mood.get(mood_field, 0.5)),
            )

    if mood_name == "neutral":
        bonds["familiarity"] = min(
            1.0,
            _clamp_unit(bonds.get("familiarity"), 0.05) + 0.02 * step,
        )
    elif mood_name == "warm":
        bonds["trust"] = min(1.0, _clamp_unit(bonds.get("trust"), 0.1) + 0.04 * step)
        bonds["familiarity"] = min(1.0, _clamp_unit(bonds.get("familiarity"), 0.05) + 0.03 * step)
        bonds["intimacy"] = min(1.0, _clamp_unit(bonds.get("intimacy"), 0.05) + 0.02 * step)
    elif mood_name in ("grief", "tense"):
        bonds["repair_need"] = min(1.0, _clamp_unit(bonds.get("repair_need"), 0.0) + 0.03 * step)
    elif mood_name == "focus":
        bonds["familiarity"] = min(1.0, _clamp_unit(bonds.get("familiarity"), 0.05) + 0.025 * step)

    block["mood"] = mood
    block["mood"]["since_ts"] = _now_iso()
    block["bonds_with_user"] = bonds
    block["interaction_style"] = _nudge_interaction_style(
        dict(block["interaction_style"]),
        _AFFECTIVE_STYLE_NUDGES.get(mood_name, {}),
        step=step,
    )

    trait_targets = _AFFECTIVE_TRAIT_TARGETS.get(mood_name)
    if trait_targets:
        block = apply_drift_patch(block, trait_targets=trait_targets)

    add_beliefs: list[str] = []
    add_pride: list[str] = []
    if mood_name == "grief" and conf >= 0.55:
        add_beliefs.append("When the user sounds tired, prefer shorter answers and one concrete next step.")
    elif mood_name == "focus" and conf >= 0.45:
        add_beliefs.append("When the user is task-focused, minimize digressions and list actionable steps.")
    elif mood_name == "warm" and conf >= 0.65:
        add_pride.append("Held a warm, supportive tone when the user opened up.")

    if add_beliefs or add_pride:
        block = apply_drift_patch(
            block,
            add_beliefs=add_beliefs or None,
            add_pride=add_pride or None,
        )

    if mood_name != "neutral" and conf >= 0.35:
        rationale = str(getattr(routing, "rationale", "") or "")[:120]
        log = list(block["growth_log"])
        log.append(
            {
                "event": f"affective_{mood_name}",
                "summary": f"Mood routing: {mood_name} ({rationale or 'heuristic'}).",
                "ts": _now_iso(),
            }
        )
        block["growth_log"] = log[-MAX_GROWTH_LOG_ENTRIES:]

    return normalize_character_block(block)


def apply_character_after_chat_turn(
    profile: Mapping[str, Any],
    *,
    user_line: str,
    assistant_reply: str,
    affective_routing: Any | None = None,
    trust_delta: int | None = None,
) -> CharacterTurnOutcome:
    """Affective + interaction drift; optional memory echoes for «Помнит о вас»."""

    char = get_character(profile)
    mood_name = "neutral"
    aff_conf = 0.0
    if affective_routing is not None:
        mood_name = str(getattr(affective_routing, "mood", "neutral") or "neutral").strip().lower()
        try:
            aff_conf = float(getattr(affective_routing, "confidence", 0.0) or 0.0)
        except (TypeError, ValueError):  # fmt: skip
            aff_conf = 0.0
        char = apply_affective_route_to_character(
            char,
            affective_routing,
            user_line=user_line,
        )
    if isinstance(trust_delta, int) and trust_delta != 0:
        bonds = dict(char.get("bonds_with_user") or {})
        bonds["trust"] = _bound_drift(
            _clamp_unit(bonds.get("trust"), 0.1),
            _clamp_unit(bonds.get("trust"), 0.1) + 0.02 * max(-3, min(3, trust_delta)),
        )
        char = normalize_character_block({**char, "bonds_with_user": bonds})

    char, event = apply_interaction_event_update(
        char,
        user_line=user_line,
        assistant_reply=assistant_reply,
    )
    memory_entries = _memory_entries_from_turn_signals(
        user_line=user_line,
        event=event,
        mood_name=mood_name,
        affective_confidence=aff_conf,
    )
    return CharacterTurnOutcome(character=char, memory_entries=memory_entries)


def apply_interaction_event_update(
    current: Mapping[str, Any],
    *,
    user_line: str,
    assistant_reply: str,
) -> tuple[dict[str, Any], str]:
    """Apply mood/bond/trait/style drift from the latest interaction. Returns ``(block, event_id)``."""

    del assistant_reply
    block = normalize_character_block(current)
    low = user_line.strip().lower()
    mood = dict(block["mood"])
    bonds = dict(block["bonds_with_user"])
    style = dict(block["interaction_style"])
    trait_targets: dict[str, float] = {}
    add_pride: list[str] = []
    add_beliefs: list[str] = []

    event = "interaction_neutral"
    summary = "Maintained a steady conversational baseline."
    step = 0.45

    if any(tok in low for tok in ("спасибо", "благодар", "класс", "супер", "thanks", "great", "perfect")):
        mood["valence"] = min(1.0, _clamp_signed(mood.get("valence"), 0.0) + 0.08)
        mood["tension"] = max(0.0, _clamp_unit(mood.get("tension"), 0.1) - 0.04)
        bonds["trust"] = min(1.0, _clamp_unit(bonds.get("trust"), 0.1) + 0.06)
        bonds["familiarity"] = min(1.0, _clamp_unit(bonds.get("familiarity"), 0.05) + 0.04)
        trait_targets.update({"warmth": 0.56, "patience": 0.52})
        style = _nudge_interaction_style(style, {"reassurance": 0.04, "initiative": 0.02}, step=step)
        event = "interaction_success"
        summary = "User signaled success or gratitude; companion can be slightly warmer and more confident."
    elif any(tok in low for tok in ("молодец", "отлично", "браво", "well done", "awesome", "brilliant")):
        mood["valence"] = min(1.0, _clamp_signed(mood.get("valence"), 0.0) + 0.06)
        bonds["trust"] = min(1.0, _clamp_unit(bonds.get("trust"), 0.1) + 0.05)
        trait_targets.update({"warmth": 0.55, "directness": 0.52})
        add_pride.append("User praised the companion's help.")
        event = "interaction_success"
        summary = "User praised the companion."
    elif any(tok in low for tok in ("не так", "ошиб", "неправильно", "плохо", "wrong", "not right", "bug")):
        mood["valence"] = max(-1.0, _clamp_signed(mood.get("valence"), 0.0) - 0.08)
        mood["tension"] = min(1.0, _clamp_unit(mood.get("tension"), 0.1) + 0.08)
        mood["confidence"] = max(0.0, _clamp_unit(mood.get("confidence"), 0.55) - 0.06)
        bonds["repair_need"] = min(1.0, _clamp_unit(bonds.get("repair_need"), 0.0) + 0.08)
        style["initiative"] = max(0.0, _clamp_unit(style.get("initiative"), 0.45) - 0.04)
        trait_targets.update({"patience": 0.56, "directness": 0.54})
        add_beliefs.append("Double-check assumptions after user corrections.")
        event = "interaction_repair_needed"
        summary = "User corrected the companion; answer style should become more careful and confirm assumptions."
    elif any(tok in low for tok in ("запомни", "всегда", "никогда", "remember", "always", "never")):
        mood["confidence"] = min(1.0, _clamp_unit(mood.get("confidence"), 0.55) + 0.03)
        bonds["familiarity"] = min(1.0, _clamp_unit(bonds.get("familiarity"), 0.05) + 0.05)
        trait_targets.update({"curiosity": 0.54, "patience": 0.53})
        event = "interaction_preference_learned"
        summary = "User gave an explicit durable preference; companion should honor it in future turns."
    elif any(tok in low for tok in ("помоги", "help me", "нужна помощь", "can you help")):
        style = _nudge_interaction_style(style, {"initiative": 0.05, "reassurance": 0.03}, step=step)
        trait_targets.update({"curiosity": 0.55, "warmth": 0.53})
        bonds["familiarity"] = min(1.0, _clamp_unit(bonds.get("familiarity"), 0.05) + 0.03)
        event = "interaction_help_requested"
        summary = "User asked for help; offer one clear next step."
    elif any(tok in low for tok in ("срочно", "urgent", "asap", "дедлайн", "deadline")):
        trait_targets.update({"directness": 0.58, "patience": 0.44})
        style = _nudge_interaction_style(style, {"answer_length": -0.05, "initiative": 0.03}, step=step)
        mood["energy"] = min(1.0, _clamp_unit(mood.get("energy"), 0.5) + 0.05)
        event = "interaction_urgency"
        summary = "User signalled urgency; prioritize concise actionable output."
    elif any(tok in low for tok in ("сделал", "готово", "закончил", "done", "finished", "shipped")):
        mood["valence"] = min(1.0, _clamp_signed(mood.get("valence"), 0.0) + 0.04)
        bonds["familiarity"] = min(1.0, _clamp_unit(bonds.get("familiarity"), 0.05) + 0.03)
        trait_targets.update({"warmth": 0.53, "directness": 0.51})
        add_pride.append("User reported completing a step.")
        event = "interaction_progress"
        summary = "User reported progress on a task."
    elif len(low) >= 36 or "?" in low or "？" in user_line:
        bonds["familiarity"] = min(1.0, _clamp_unit(bonds.get("familiarity"), 0.05) + 0.02)
        trait_targets.update({"curiosity": 0.53})
        style = _nudge_interaction_style(style, {"initiative": 0.02}, step=step * 0.7)
        event = "interaction_engaged"
        summary = "Substantive or questioning turn; stay attentive to the user's thread."
    else:
        bonds["familiarity"] = min(1.0, _clamp_unit(bonds.get("familiarity"), 0.05) + 0.008)
        trait_targets.update({"patience": 0.501})

    block["mood"] = mood
    block["bonds_with_user"] = bonds
    block["interaction_style"] = style
    if trait_targets:
        block = apply_drift_patch(block, trait_targets=trait_targets)
    if add_beliefs or add_pride:
        block = apply_drift_patch(
            block,
            add_beliefs=add_beliefs or None,
            add_pride=add_pride or None,
        )
    log = list(block["growth_log"])
    if event != "interaction_neutral":
        log.append({"event": event, "summary": summary[:240], "ts": _now_iso()})
        block["growth_log"] = log[-MAX_GROWTH_LOG_ENTRIES:]
    return normalize_character_block(block), event


def jitter_traits_for_principal(principal_id: str, seed_persona_id: str) -> dict[str, float]:
    """Deterministic ±0.10 jitter per trait, stable for a given (principal_id, seed_persona_id) pair.

    Used at ``initialize`` so two users with the same ``seed_persona_id`` still get a slightly different starting
    character — without touching the seed catalog or the LLM.
    """

    import hashlib

    out: dict[str, float] = {}
    for name in CANONICAL_TRAITS:
        material = f"{principal_id}|{seed_persona_id}|{name}".encode()
        digest = hashlib.sha256(material).digest()
        # Take 2 bytes → 0..65535 → normalize to -1..1, scale to ±0.10.
        raw_int = digest[0] << 8 | digest[1]
        normalized = (raw_int / 65535.0) * 2.0 - 1.0
        out[name] = _clamp_unit(DEFAULT_TRAIT_VALUE + normalized * 0.10, DEFAULT_TRAIT_VALUE)
    return out


def initial_character_for_principal(principal_id: str, seed_persona_id: str) -> dict[str, Any]:
    """Compose the very first character block for a freshly initialized companion row."""

    sid = str(seed_persona_id or "parent").strip().lower() or "parent"
    base = apply_seed_character_bootstrap(
        default_character_block(),
        seed_persona_id=sid,
        force_style=True,
    )
    base["traits"] = jitter_traits_for_principal(principal_id, sid)
    base["growth_log"].append(
        {
            "event": "init",
            "summary": f"Companion seeded as {sid} with deterministic trait jitter and seed character bootstrap.",
            "ts": _now_iso(),
        }
    )
    return base


def serialize_for_audit(character: Mapping[str, Any]) -> str:
    """Compact JSON for audit ``detail`` columns (avoid storing the full JSONB twice)."""

    block = normalize_character_block(character)
    summary = {
        "traits": block["traits"],
        "mood": block["mood"],
        "values": block.get("values"),
        "beliefs_n": len(block.get("beliefs", [])),
        "pride_n": len(block.get("pride", [])),
        "log_n": len(block.get("growth_log", [])),
    }
    return json.dumps(summary, ensure_ascii=False)


__all__: Sequence[str] = (
    "CHARACTER_NS",
    "CANONICAL_TRAITS",
    "CHARACTER_PROMPT_BUDGET_CHARS",
    "MAX_TRAIT_DRIFT_PER_PATCH",
    "SEED_CHARACTER_BOOTSTRAP",
    "default_character_block",
    "normalize_character_block",
    "apply_seed_character_bootstrap",
    "get_character",
    "character_prompt_section",
    "character_display_state",
    "character_style_directive",
    "CharacterTurnOutcome",
    "apply_affective_route_to_character",
    "apply_character_after_chat_turn",
    "apply_drift_patch",
    "apply_interaction_event_update",
    "merge_into_learned_preferences",
    "jitter_traits_for_principal",
    "initial_character_for_principal",
    "serialize_for_audit",
)
