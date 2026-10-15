# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Shrink **learned_preferences** fragments that are embedded inside ``Companion_profile_json`` in the system
# prompt so ``companion_profile_llm_wire`` JSON stays small and valid (actions ring buffer, daily rollup snippet).
# Invariants:
# - Returns a **shallow copy** of the mapping with selected keys rewritten — safe to run on a throwaway dict
#   from ``_slim_profile_for_wire`` before ``json.dumps``.
# - Does not remove namespaces already popped by ``chat_turn._slim_profile_for_wire`` (chat / character / memory).
# Related:
# - api/ewa_platform/companion/turn/chat_turn.py
# - api/ewa_platform/companion/ux/actions_log.py
# - api/ewa_platform/companion/episodic/daily_rollup.py
# ---
"""Learned-preferences slimming for companion LLM wire JSON."""

from __future__ import annotations

import os
from collections.abc import Mapping
from typing import Any

from api.ewa_platform.companion.context.noise import collapse_idle_observation_tokens
from api.ewa_platform.companion.ux.actions_log import ACTION_LOG_NS, MAX_ACTION_LOG_ENTRIES

_ROLLUP_NS = "companion_daily_rollup_v1"
_CONDENSED_NS = "companion_chat_condensed_v1"


def _wire_action_log_cap() -> int:
    raw = os.getenv("EWA_COMPANION_LLM_WIRE_ACTION_LOG_MAX", "12").strip() or "12"
    try:
        v = int(raw)
    except ValueError:
        v = 12
    return max(4, min(v, MAX_ACTION_LOG_ENTRIES))


def _rollup_snippet_cap() -> int:
    raw = os.getenv("EWA_COMPANION_LLM_WIRE_ROLLUP_SNIPPET_MAX", "360").strip() or "360"
    try:
        v = int(raw)
    except ValueError:
        v = 360
    return max(80, min(v, 2000))


def _squash_idle_observation_repeat(snippet: str) -> str:
    """Collapse long runs of identical ``observation:idle`` fragments inside rollup snippets."""

    return collapse_idle_observation_tokens((snippet or "").strip())


def _slim_action_log_row(row: Any) -> Any:
    if not isinstance(row, Mapping):
        return row
    d = dict(row)
    src = d.get("source")
    if isinstance(src, str) and len(src) > 64:
        d["source"] = src[:63].rstrip() + "…"
    acts = d.get("actions")
    if isinstance(acts, list) and len(acts) > 24:
        d["actions"] = acts[-24:]
    return d


def _slim_rollup(blob: dict[str, Any]) -> dict[str, Any]:
    out = dict(blob)
    sn = out.get("snippet")
    if isinstance(sn, str):
        sn2 = _squash_idle_observation_repeat(sn)
        cap = _rollup_snippet_cap()
        if len(sn2) > cap:
            sn2 = sn2[: cap - 1].rstrip() + "…"
        out["snippet"] = sn2
    return out


def slim_learned_preferences_for_llm_prompt(lp: Mapping[str, Any]) -> dict[str, Any]:
    """Return a copy of ``learned_preferences`` with wire-only caps applied for the LLM profile JSON."""

    out: dict[str, Any] = dict(lp)
    out.pop(_CONDENSED_NS, None)
    cap = _wire_action_log_cap()
    al = out.get(ACTION_LOG_NS)
    if isinstance(al, list):
        tail = al[-cap:] if len(al) > cap else al
        out[ACTION_LOG_NS] = [_slim_action_log_row(x) for x in tail]
    rollup = out.get(_ROLLUP_NS)
    if isinstance(rollup, Mapping):
        out[_ROLLUP_NS] = _slim_rollup(dict(rollup))
    return out


__all__ = ("slim_learned_preferences_for_llm_prompt",)
