# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Typed **Context_Anchor v1** contract stored in ``learned_preferences.companion_context_anchor_v1`` — normalize
# operator/LLM JSON, clamp list sizes, and render a compact markdown block for the system prompt.
# Invariants:
# - All fields optional at rest; normalization fills ``schema_version`` and drops empty strings.
# - ``max_chars`` enforcement is lossy but stable (tail sections truncated in fixed order).
# Related:
# - api/ewa_platform/companion/context/anchor_compose.py
# - api/ewa_platform/companion/turn/chat_turn.py
# - documentation/product/ewa/EWA-COMPANION-HCM-MEMORY.md
# **Canonical path:** ``api.ewa_platform.companion.context.anchor``; shim ``context_anchor``.
# ---
"""Companion context anchor v1 — contract + markdown render."""

from __future__ import annotations

import os
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from api.ewa_platform.companion.context.noise import sanitize_context_block_for_llm

CONTEXT_ANCHOR_LP_KEY = "companion_context_anchor_v1"
ANCHOR_SCHEMA_VERSION = 1


def _env_truthy(raw: str | None) -> bool:
    if raw is None:
        return False
    return str(raw).strip().lower() in ("1", "true", "yes", "on")


def context_anchor_feature_enabled() -> bool:
    return _env_truthy(os.getenv("EWA_COMPANION_CONTEXT_ANCHOR_ENABLED", "0"))


def context_anchor_max_chars() -> int:
    raw = os.getenv("EWA_COMPANION_CONTEXT_ANCHOR_MAX_CHARS", "6000").strip() or "6000"
    try:
        v = int(raw)
    except ValueError:
        v = 6000
    return max(400, min(v, 50_000))


def context_anchor_section_item_cap() -> int:
    raw = os.getenv("EWA_COMPANION_CONTEXT_ANCHOR_SECTION_ITEM_MAX", "12").strip() or "12"
    try:
        v = int(raw)
    except ValueError:
        v = 12
    return max(2, min(v, 64))


def _norm_str_list(raw: Any, cap: int) -> list[str]:
    if not isinstance(raw, Sequence) or isinstance(raw, str | bytes):
        return []
    out: list[str] = []
    seen: set[str] = set()
    for item in raw:
        s = str(item).strip()
        if not s or len(s) > 2048:
            continue
        key = s.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(s)
        if len(out) >= cap:
            break
    return out


def _norm_turn_range(raw: Any) -> dict[str, int] | None:
    if not isinstance(raw, Mapping):
        return None
    try:
        f = int(raw.get("from"))
        t = int(raw.get("to"))
    except (TypeError, ValueError):  # fmt: skip
        return None
    if f < 0 or t < f:
        return None
    return {"from": f, "to": t}


@dataclass(slots=True)
class ContextAnchorV1:
    schema_version: int = ANCHOR_SCHEMA_VERSION
    project_name: str = ""
    status: str = "active"
    updated_at_iso: str = ""
    core_truths: list[str] = field(default_factory=list)
    decisions: list[str] = field(default_factory=list)
    active_tasks: list[str] = field(default_factory=list)
    uncertainties: list[str] = field(default_factory=list)
    attached_resources: list[str] = field(default_factory=list)
    tech_constraints: list[str] = field(default_factory=list)
    interaction_rules: list[str] = field(default_factory=list)
    changelog_short: list[str] = field(default_factory=list)
    source_turn_range: dict[str, int] | None = None

    def to_lp_dict(self) -> dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "project_name": self.project_name,
            "status": self.status,
            "updated_at_iso": self.updated_at_iso,
            "core_truths": list(self.core_truths),
            "decisions": list(self.decisions),
            "active_tasks": list(self.active_tasks),
            "uncertainties": list(self.uncertainties),
            "attached_resources": list(self.attached_resources),
            "tech_constraints": list(self.tech_constraints),
            "interaction_rules": list(self.interaction_rules),
            "changelog_short": list(self.changelog_short),
            "source_turn_range": dict(self.source_turn_range) if self.source_turn_range else None,
        }


def normalize_context_anchor_v1(raw: Mapping[str, Any] | None) -> ContextAnchorV1 | None:
    """Parse loose JSON into a clamped model; ``None`` if nothing usable."""

    if not isinstance(raw, Mapping) or not raw:
        return None
    cap = context_anchor_section_item_cap()
    truths = _norm_str_list(raw.get("core_truths"), cap)
    decisions = _norm_str_list(raw.get("decisions"), cap)
    tasks = _norm_str_list(raw.get("active_tasks"), cap)
    uncert = _norm_str_list(raw.get("uncertainties"), cap)
    attach = _norm_str_list(raw.get("attached_resources"), cap)
    tech = _norm_str_list(raw.get("tech_constraints"), cap)
    rules = _norm_str_list(raw.get("interaction_rules"), cap)
    changelog = _norm_str_list(raw.get("changelog_short"), min(cap, 8))
    if not any((truths, decisions, tasks, uncert, attach, tech, rules, changelog)):
        return None
    try:
        sv = int(raw.get("schema_version") or ANCHOR_SCHEMA_VERSION)
    except (TypeError, ValueError):  # fmt: skip
        sv = ANCHOR_SCHEMA_VERSION
    proj = str(raw.get("project_name") or "").strip()[:200]
    st = str(raw.get("status") or "active").strip()[:64] or "active"
    upd = str(raw.get("updated_at_iso") or "").strip()
    if not upd:
        upd = datetime.now(UTC).isoformat(timespec="seconds")
    return ContextAnchorV1(
        schema_version=max(1, sv),
        project_name=proj,
        status=st,
        updated_at_iso=upd[:64],
        core_truths=truths,
        decisions=decisions,
        active_tasks=tasks,
        uncertainties=uncert,
        attached_resources=attach,
        tech_constraints=tech,
        interaction_rules=rules,
        changelog_short=changelog,
        source_turn_range=_norm_turn_range(raw.get("source_turn_range")),
    )


def anchor_dict_from_profile(profile: Mapping[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(profile, Mapping):
        return None
    lp = profile.get("learned_preferences")
    if not isinstance(lp, Mapping):
        return None
    blob = lp.get(CONTEXT_ANCHOR_LP_KEY)
    return dict(blob) if isinstance(blob, Mapping) else None


def render_context_anchor_markdown(anchor: ContextAnchorV1 | None) -> str:
    """Prompt-safe markdown; empty if no anchor."""

    if anchor is None:
        return ""
    sections: list[str] = []
    head = "## Context_anchor (persistent semantic summary)"
    meta_bits = [f"updated: {anchor.updated_at_iso}"]
    if anchor.project_name:
        meta_bits.append(f"project: {anchor.project_name}")
    if anchor.status:
        meta_bits.append(f"status: {anchor.status}")
    sections.append(head + "\n" + " · ".join(meta_bits))

    def _bul(title: str, items: Sequence[str]) -> None:
        if not items:
            return
        lines = [f"- {sanitize_context_block_for_llm(x, max_chars=1200, apply_episode_sanitizer=True)}" for x in items]
        lines = [ln for ln in lines if ln.strip() != "-"]
        if lines:
            sections.append(f"### {title}\n" + "\n".join(lines))

    _bul("Core truths", anchor.core_truths)
    _bul("Decisions", anchor.decisions)
    _bul("Active tasks", anchor.active_tasks)
    _bul("Uncertainties", anchor.uncertainties)
    _bul("Attached resources", anchor.attached_resources)
    _bul("Tech constraints", anchor.tech_constraints)
    _bul("Interaction rules", anchor.interaction_rules)
    _bul("Recent changelog", anchor.changelog_short)
    if anchor.source_turn_range:
        sections.append(
            f"### Source turns\n- indexed range: {anchor.source_turn_range.get('from')}–{anchor.source_turn_range.get('to')}",
        )
    text = "\n\n".join(sections).strip()
    cap = context_anchor_max_chars()
    if len(text) > cap:
        text = text[: cap - 1].rstrip() + "…"
    return sanitize_context_block_for_llm(text, max_chars=cap, apply_episode_sanitizer=True)


def merged_anchor_for_prompt(profile: Mapping[str, Any] | None) -> tuple[str, ContextAnchorV1 | None]:
    """Load + normalize + render; returns ``(\"\", None)`` when disabled or empty."""

    if not context_anchor_feature_enabled():
        return "", None
    d = anchor_dict_from_profile(profile)
    if not d:
        return "", None
    model = normalize_context_anchor_v1(d)
    if model is None:
        return "", None
    return render_context_anchor_markdown(model), model


def anchor_keyword_overlap_score(user_text: str, anchor: ContextAnchorV1 | None) -> float:
    """Cheap coverage proxy in ``[0,1]`` for retrieval short-circuit."""

    if anchor is None:
        return 0.0
    words: set[str] = set()
    for tok in user_text.lower().split():
        w = tok.strip(".,!?;:«»\"'()[]{}")
        if len(w) > 2:
            words.add(w)
    if not words:
        return 0.0
    blob = " ".join(
        list(anchor.core_truths) + list(anchor.decisions) + list(anchor.active_tasks) + list(anchor.uncertainties),
    ).lower()
    hit = sum(1 for w in words if w in blob)
    return min(1.0, hit / max(3, len(words) * 0.25))


__all__ = [
    "ANCHOR_SCHEMA_VERSION",
    "CONTEXT_ANCHOR_LP_KEY",
    "ContextAnchorV1",
    "anchor_dict_from_profile",
    "anchor_keyword_overlap_score",
    "context_anchor_feature_enabled",
    "context_anchor_max_chars",
    "context_anchor_section_item_cap",
    "merged_anchor_for_prompt",
    "normalize_context_anchor_v1",
    "render_context_anchor_markdown",
]
