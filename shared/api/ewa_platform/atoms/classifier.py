# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Deterministic **v0** classifier from raw user text into **Star / Comet / Nebula** atoms plus a stub **LLM v1** hook
# (returns ``None`` until wired to ``ewa_platform/llm``).
# Invariants:
# - No asyncio blocking; regex/heuristics only in v0; output always satisfies ``atoms_v1`` constraints.
# Related:
# - api/ewa_platform/persistence_pg/episodes_asyncpg.py (``MAX_EPISODE_BODY_CHARS`` for classifier slice)
# - api/services/ewa_companion/memory.py (remember-line patterns, spirit only)
# - api/ewa_platform/contracts/atoms_v1.py
# ---
"""Atom type classification from unstructured text (v0 heuristics)."""

from __future__ import annotations

import os
import re

from api.ewa_platform.contracts.atoms_v1 import (
    AnyAtomV1,
    CometAtomV1,
    NebulaAtomV1,
    StarAtomV1,
)
from api.ewa_platform.persistence_pg.episodes_asyncpg import MAX_EPISODE_BODY_CHARS

_EWA_ATOM_ENV = "EWA_ATOM_LAYER_ENABLED"

_REMEMBER_LINE_RU = re.compile(r"(?is)^\s*запомни(?:\s+пожалуйста)?[,:]?\s*(?:что\s+)?(.{2,400})\s*$")
_REMEMBER_LINE_EN = re.compile(r"(?is)^\s*remember(?:\s+that)?[,:]?\s*(.{2,400})\s*$")
_NOTE_THAT_EN = re.compile(r"(?is)^\s*note\s+to\s+self[,:]?\s*(.{2,400})\s*$")
_EVENT_MARKERS = re.compile(
    r"(?is)\b(вчера|позавчера|сегодня|только\s*что|yesterday|today|last\s+night|"
    r"when\s+i|когда\s+я|после\s+того\s+как|after\s+i|открыл|открыла|opened|clicked|нажал|нажала)\b",
)
_EMOTION_LEX = re.compile(
    r"(?is)\b(радост|счастлив|грустн|тоскл|злюсь|бесит|страшно|волнуюсь|happy|sad|angry|"
    r"anxious|excited|depressed|love\s+it|hate\s+it)\b|[\U0001F600-\U0001F64F]{1,3}",
)


def atom_layer_enabled() -> bool:
    """Feature flag (default **off**): operators enable atom persistence without redeploy semantics change."""

    raw = os.getenv(_EWA_ATOM_ENV, "0").strip().lower()
    return raw in ("1", "true", "yes", "on")


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, float(x)))


def _episode_valence_to_nebula(val_episode_0_1: float) -> tuple[float, str]:
    """Map HCM episodic valence ``[0,1]`` to Nebula ``valence`` ``[-1,1]`` + a neutral-ish color."""

    v = (_clamp01(val_episode_0_1) - 0.5) * 2.0
    if v > 0.35:
        color = "#2ECC71"
    elif v < -0.35:
        color = "#5DADE2"
    else:
        color = "#BDC3C7"
    return v, color


def classify_raw_text_v0(
    text: str,
    *,
    importance_hint: float = 0.5,
    valence_episode_0_1: float = 0.5,
    tags_extra: tuple[str, ...] = (),
) -> AnyAtomV1:
    """Rule-based parse into a single atom (MVP: one atom per ingested line)."""

    raw = (text or "").strip()[:MAX_EPISODE_BODY_CHARS]
    tags = ["source:companion_episode", *tags_extra]
    imp = _clamp01(importance_hint)

    m_ru = _REMEMBER_LINE_RU.match(raw)
    m_en = _REMEMBER_LINE_EN.match(raw) or _NOTE_THAT_EN.match(raw)
    if m_ru or m_en:
        match = m_ru or m_en
        body = match.group(1).strip() if match else raw
        return StarAtomV1(
            importance=max(imp, 0.62),
            tags=[*tags, "classifier:v0", "kind:explicit_memory"],
            payload=body or raw,
            origin_source="user",
            veracity_score=0.78,
        )

    if _EMOTION_LEX.search(raw):
        val, color = _episode_valence_to_nebula(valence_episode_0_1)
        return NebulaAtomV1(
            importance=max(imp, 0.48),
            tags=[*tags, "classifier:v0", "kind:affective"],
            payload=raw,
            valence=val,
            arousal=min(1.0, 0.35 + abs(val) * 0.4),
            color_hex=color,
        )

    if _EVENT_MARKERS.search(raw):
        return CometAtomV1(
            importance=max(imp, 0.55),
            tags=[*tags, "classifier:v0", "kind:event_marked"],
            payload=raw,
            duration_iso="PT120S",
            impact_magnitude=min(1.0, 0.45 + len(raw) / 800.0),
            trajectory_vector=(0.15, 0.25, 0.9),
        )

    return CometAtomV1(
        importance=max(0.35, imp * 0.92),
        tags=[*tags, "classifier:v0", "kind:default_comet"],
        payload=raw,
        duration_iso="PT60S",
        impact_magnitude=min(1.0, 0.22 + len(raw) / 1200.0),
        trajectory_vector=(0.0, 0.0, 1.0),
    )


async def classify_raw_text_llm_v1(
    text: str,
    *,
    importance_hint: float = 0.5,
    valence_episode_0_1: float = 0.5,
    tags_extra: tuple[str, ...] = (),
) -> AnyAtomV1 | None:
    """Reserved: structured LLM extraction behind ``ewa_platform/llm`` — returns ``None`` (caller falls back to v0)."""

    _ = (text, importance_hint, valence_episode_0_1, tags_extra)
    return None


__all__ = [
    "atom_layer_enabled",
    "classify_raw_text_llm_v1",
    "classify_raw_text_v0",
]
