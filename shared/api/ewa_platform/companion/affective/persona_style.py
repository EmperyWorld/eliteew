# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Backend module `ewa_platform/companion/affective/persona_style.py`; preserves its existing EliteEW API/service responsibilities.
# Invariants:
# - Keep existing public contracts and side effects stable across Python 3.14 syntax remediation.
# Related:
# - documentation/worklog/session-summaries/2026-05-28-0124-eliteew-api-worker-audit.md
# ---

# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Cognitive style descriptors for every EWA companion seed persona — project "Mela's Ascension"
# Module C1. Each ``seed_persona_id`` ships with a small data table that goes beyond lexicon: how
# direct/playful she speaks, how she weights episodic memory recall (valence / recency bias), and
# how eager she is to propose desktop actions. Reader (``memory_retrieval``) and prompt builder
# (``chat_turn._build_system_prompt``) consume this table to bias retrieval and behaviour without
# touching the persona prompt strings themselves.
# Invariants:
# - Numeric fields resolve via ``resolve_persona_numeric`` (env-specific → ``PARENT`` → canonical matrix); values are clamped in the resolver.
# - Unknown seeds fall back to the ``parent`` (EWA) descriptor — never raise.
# - ``rank_episodic_hits`` is **pure** (no I/O) and stable: it accepts a list of hits and returns a
#   new list reordered by ``score + bias`` so the chat path can call it inline.
# - Action propensity is **advisory** — it does NOT gate execution. C3 (PR-6) handles validation.
# - Persona directive text MUST be short (one short paragraph) to keep the system prompt cheap.
# Related:
# - api/ewa_platform/companion/config.py (canonical matrix + ``EWA_PERSONA_*`` env overrides)
# - api/ewa_platform/companion/turn/chat_turn.py (system prompt assembly)
# - api/ewa_platform/companion/memory/retrieval.py (memory recall ranking)
# - api/ewa_platform/persistence_vector/companion_qdrant.py (episodic hits shape)
# - documentation/product/ewa/EWA-COMPANION-PERSONA-VISION.md
# ---
"""Cognitive style descriptors for EWA companion seeds (HCM Module C1)."""

from dataclasses import dataclass, field
from typing import Any

from api.ewa_platform.companion.config import (
    CANONICAL_PERSONA_NUMERICS,
    resolve_persona_numeric,
)


def _clamp_unit(value: Any, default: float = 0.5) -> float:
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
    try:
        v = float(value)
    except (TypeError, ValueError):  # fmt: skip
        return default
    if v < -1.0:
        return -1.0
    if v > 1.0:
        return 1.0
    return v


@dataclass(frozen=True, slots=True)
class MemoryWeight:
    """How a persona biases episodic recall (used in ``memory_retrieval`` ranking)."""

    valence_bias: float = 0.0  # positive ⇒ prefer warm episodes; negative ⇒ prefer harsh/correction
    recency_bias: float = 0.5  # 0 ⇒ ignore recency; 1 ⇒ recency dominates over semantic score


@dataclass(frozen=True, slots=True)
class PersonaStyle:
    """Cognitive style for one ``seed_persona_id``."""

    seed_id: str
    directness: float = 0.6  # 0 ⇒ metaphor-heavy; 1 ⇒ blunt next-action
    playfulness: float = 0.4  # 0 ⇒ formal; 1 ⇒ playful/sarcastic
    memory_weight: MemoryWeight = field(default_factory=MemoryWeight)
    action_propensity: dict[str, float] = field(default_factory=dict)


def _build_persona_style(seed_key: str) -> PersonaStyle:
    """Build a frozen style row; numerics come from env + canonical matrix in ``companion.config``."""

    return PersonaStyle(
        seed_id=seed_key,
        directness=resolve_persona_numeric(seed_key, "directness"),
        playfulness=resolve_persona_numeric(seed_key, "playfulness"),
        memory_weight=MemoryWeight(
            valence_bias=resolve_persona_numeric(seed_key, "valence_bias"),
            recency_bias=resolve_persona_numeric(seed_key, "recency_bias"),
        ),
        action_propensity={
            "open_app": resolve_persona_numeric(seed_key, "open_app"),
            "patch_desktop_config": resolve_persona_numeric(seed_key, "patch_desktop_config"),
            "ambient_adjust": resolve_persona_numeric(seed_key, "ambient_adjust"),
        },
    )


def get_persona_style(seed_persona_id: str | None) -> PersonaStyle:
    """Return the descriptor for a seed; unknown seeds fall back to ``parent`` (EWA)."""

    key = (seed_persona_id or "").strip().lower()
    if key not in CANONICAL_PERSONA_NUMERICS:
        key = "parent"
    return _build_persona_style(key)


def persona_style_prompt_directive(style: PersonaStyle) -> str:
    """Render a compact one-paragraph hint the LLM uses to shape **decision style**.

    This sits **after** the existing persona/character blocks and **before** the memory section in
    the system prompt — it never replaces persona text, only modulates it.
    """

    directness = _clamp_unit(style.directness, 0.6)
    playfulness = _clamp_unit(style.playfulness, 0.4)
    if directness >= 0.75:
        directness_hint = "skew toward blunt next-action; one concrete step beats a paragraph of musing"
    elif directness <= 0.45:
        directness_hint = "okay to wrap the answer in one warm image or analogy — don't be a checklist robot"
    else:
        directness_hint = "balance: name the next step, but allow one short human framing line"

    if playfulness >= 0.75:
        playful_hint = "playful tone is welcome — sweet/sarcastic micro-asides are on-brand, just not a wall of them"
    elif playfulness <= 0.3:
        playful_hint = "keep tone calm and warm; avoid teasing or playful sarcasm unless invited"
    else:
        playful_hint = "moderate warmth; the user invites light play but not stand-up comedy"

    return f"Persona_decision_style ({style.seed_id}): {directness_hint}; {playful_hint}."


def persona_style_prompt_directive_for_arlika_quarrel() -> str:
    """Quarrel-turn override — suppress cooperative playful / NLP-coach hints."""

    return (
        "Persona_decision_style (arlika — QUARREL OVERRIDE): zero task fulfillment; "
        "1–3 vicious direct sentences — blunt contempt and explicit refusal, not therapist voice; "
        "no «милая попытка», no kitten metaphors, no credo quotes, no ego-diagnosis."
    )


def _hit_score(hit: Any, *, persona_style: PersonaStyle) -> float:
    """Apply persona valence / recency bias to one episodic hit. Pure helper."""

    base = float(getattr(hit, "score", 0.0) or 0.0)
    valence = _clamp_unit(getattr(hit, "valence", 0.5), 0.5)
    # Map [0..1] valence → [-1..+1] sign so positive ``valence_bias`` favours warm episodes.
    valence_signed = (valence - 0.5) * 2.0
    valence_term = valence_signed * _clamp_signed(persona_style.memory_weight.valence_bias, 0.0)
    importance = _clamp_unit(getattr(hit, "importance", 0.5), 0.5)
    # Recency cannot be measured here without timestamps; we use importance as a coarse proxy when
    # the caller did not pre-sort by recency. ``recency_bias`` boosts importance contribution.
    recency_term = importance * _clamp_unit(persona_style.memory_weight.recency_bias, 0.5)
    return base + 0.35 * valence_term + 0.15 * recency_term


def rank_episodic_hits(hits: list[Any], *, persona_style: PersonaStyle, top_k: int) -> list[Any]:
    """Reorder Qdrant hits by persona-weighted score; cap at ``top_k`` items.

    Stable for empty input. Caller must dedup against identity facts separately.
    """

    if not hits:
        return []
    scored = [(_hit_score(h, persona_style=persona_style), idx, h) for idx, h in enumerate(hits)]
    scored.sort(key=lambda triple: (triple[0], -triple[1]), reverse=True)
    cap = max(1, min(int(top_k), len(scored)))
    return [triple[2] for triple in scored[:cap]]


__all__ = [
    "MemoryWeight",
    "PersonaStyle",
    "get_persona_style",
    "persona_style_prompt_directive",
    "persona_style_prompt_directive_for_arlika_quarrel",
    "rank_episodic_hits",
]
