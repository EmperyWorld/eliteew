# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Compact companion identity + context_anchor for agentic Think prompts —
# never the full HCM ``compose_memory_window`` dump.
# Invariants:
# - Hard char cap; identity top-N + rendered anchor only; no Qdrant episodic pull.
# Related:
# - api/ewa_platform/agentic/kernel/prompt_builder.py
# - api/ewa_platform/companion/context/anchor.py
# - api/ewa_platform/companion/memory/hcm_store.py
# - documentation/product/ewa/EWA-COMPANION-MEMORY-EFFECTIVENESS-PLAN.md (Wave F4)
# ---
"""Compact companion grounding for agentic Think."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from api.ewa_platform.companion.context.anchor import (
    anchor_dict_from_profile,
    normalize_context_anchor_v1,
    render_context_anchor_markdown,
)
from api.ewa_platform.companion.memory.hcm_store import get_memory, select_top_memories

DEFAULT_COMPANION_GROUNDING_MAX_CHARS = 1800
WM_COMPANION_GROUNDING_KEY = "companion_grounding_md"


def _identity_bullets(profile: Mapping[str, Any], *, limit: int = 8) -> list[str]:
    mem = get_memory(profile)
    non_story = [dict(r) for r in mem if isinstance(r, Mapping) and str(r.get("kind") or "").strip().lower() != "story"]
    top = select_top_memories(non_story)
    lines: list[str] = []
    for row in top:
        if len(lines) >= limit:
            break
        body = str(row.get("content") or "").strip()
        if not body:
            continue
        kind = str(row.get("kind") or row.get("type") or "fact").strip()
        lines.append(f"- [{kind}] {body}")
    return lines


def format_compact_companion_grounding(
    profile: Mapping[str, Any] | None,
    *,
    max_chars: int = DEFAULT_COMPANION_GROUNDING_MAX_CHARS,
) -> str:
    """Return markdown suitable for Think ``Companion grounding`` section."""

    if not isinstance(profile, Mapping):
        return ""
    cap = max(400, min(int(max_chars), 4000))
    parts: list[str] = []
    identity_lines = _identity_bullets(profile)
    if identity_lines:
        parts.append("Identity:\n" + "\n".join(identity_lines))
    blob = anchor_dict_from_profile(profile)
    if blob:
        model = normalize_context_anchor_v1(dict(blob))
        if model is not None:
            rendered = render_context_anchor_markdown(model).strip()
            if rendered:
                anchor_cap = min(900, cap // 2)
                if len(rendered) > anchor_cap:
                    rendered = rendered[: anchor_cap - 1].rstrip() + "…"
                parts.append(rendered)
    text = "\n\n".join(parts).strip()
    if len(text) > cap:
        return text[: cap - 1].rstrip() + "…"
    return text


def working_memory_with_companion_grounding(
    working_memory: Mapping[str, Any] | None,
    profile: Mapping[str, Any] | None,
) -> dict[str, Any]:
    """Copy WM and set/refresh compact grounding from profile."""

    wm = dict(working_memory) if isinstance(working_memory, Mapping) else {}
    text = format_compact_companion_grounding(profile)
    if text:
        wm[WM_COMPANION_GROUNDING_KEY] = text
    return wm


__all__ = (
    "DEFAULT_COMPANION_GROUNDING_MAX_CHARS",
    "WM_COMPANION_GROUNDING_KEY",
    "format_compact_companion_grounding",
    "working_memory_with_companion_grounding",
)
