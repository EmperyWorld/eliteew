# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# **Context controller** — feature-flagged pruning policy hooks and quality gates that decide when to refresh
# ``companion_context_anchor_v1`` and how aggressively to trim ``companion_chat_condensed_v1`` before the system prompt.
# Invariants:
# - Never raises; all decisions are best-effort and logged at INFO for operator traceability.
# - Actual LLM compose lives in ``context_anchor_compose``; this module only schedules and applies caps.
# Related:
# - api/ewa_platform/companion/context/anchor_compose.py
# - api/ewa_platform/companion/memory/chat_condense.py
# - api/ewa_platform/companion/sidecar/llm_bandwidth.py
# **Canonical path:** ``api.ewa_platform.companion.context.controller``; shim ``context_controller``.
# ---
"""Context prune / refresh policy for companion learned_preferences blobs."""

from __future__ import annotations

import logging
import os
import time
from collections.abc import Mapping
from typing import Any

from api.ewa_platform.companion.context.anchor import merged_anchor_for_prompt
from api.ewa_platform.companion.context.anchor_compose import (
    maybe_refresh_companion_context_anchor_v1,
)
from api.ewa_platform.companion.context.noise import (
    sanitize_context_block_for_llm,
    trim_condensed_against_anchor,
)
from api.ewa_platform.companion.sidecar.llm_bandwidth import companion_llm_history_max_messages

logger = logging.getLogger(__name__)

_CONDENSED_KEY = "companion_chat_condensed_v1"


def context_controller_enabled() -> bool:
    raw = os.getenv("EWA_COMPANION_CONTEXT_CONTROLLER_ENABLED", "0").strip().lower()
    return raw in ("1", "true", "yes", "on")


def context_prune_history_max_messages() -> int:
    raw = os.getenv("EWA_COMPANION_CONTEXT_PRUNE_HISTORY_MAX_MESSAGES", "0").strip() or "0"
    try:
        v = int(raw)
    except ValueError:
        v = 0
    return max(0, min(v, 512))


def context_prune_prompt_budget_threshold() -> int:
    raw = os.getenv("EWA_COMPANION_CONTEXT_PRUNE_PROMPT_BUDGET_THRESHOLD", "120000").strip() or "120000"
    try:
        v = int(raw)
    except ValueError:
        v = 120_000
    return max(10_000, min(v, 500_000))


def context_prune_latency_threshold_ms() -> int:
    raw = os.getenv("EWA_COMPANION_CONTEXT_PRUNE_LATENCY_THRESHOLD_MS", "0").strip() or "0"
    try:
        v = int(raw)
    except ValueError:
        v = 0
    return max(0, min(v, 120_000))


def estimate_prompt_weight_chars(
    *,
    system_prompt: str,
    history: list[dict[str, str]],
    per_message_cap: int = 4096,
) -> int:
    """Rough char budget for controller metrics (not token-accurate)."""

    w = len(system_prompt or "")
    for m in history:
        if not isinstance(m, dict):
            continue
        c = m.get("content")
        if isinstance(c, str):
            w += min(len(c), per_message_cap)
    return w


def should_refresh_anchor(
    *,
    history_len: int,
    last_refresh_turn: int | None,
    prompt_weight: int,
    last_retrieval_ms: float | None,
) -> tuple[bool, str]:
    """Return ``(should, reason)`` for anchor refresh."""

    if not context_controller_enabled():
        return False, "controller_disabled"
    every_n = int(os.getenv("EWA_COMPANION_CONTEXT_ANCHOR_REFRESH_EVERY_N_TURNS", "8").strip() or "8")
    every_n = max(1, min(every_n, 128))
    if last_refresh_turn is not None and (history_len - last_refresh_turn) >= every_n:
        return True, "every_n_turns"
    cap_hist = context_prune_history_max_messages()
    llm_cap = companion_llm_history_max_messages()
    if cap_hist and history_len > cap_hist + llm_cap:
        return True, "history_tail_pressure"
    thr = context_prune_prompt_budget_threshold()
    if thr and prompt_weight >= thr:
        return True, "prompt_budget"
    lat_thr = context_prune_latency_threshold_ms()
    if lat_thr and last_retrieval_ms is not None and last_retrieval_ms >= float(lat_thr):
        return True, "retrieval_latency"
    return False, "noop"


def prune_condensed_blob_in_lp(
    lp: dict[str, Any],
    *,
    anchor_markdown_for_dedup: str,
    max_paragraphs: int = 24,
) -> None:
    """Clamp condensed paragraphs in-place (quality gate)."""

    blob = lp.get(_CONDENSED_KEY)
    if not isinstance(blob, Mapping):
        return
    paras = blob.get("paragraphs")
    if not isinstance(paras, list):
        return
    cleaned: list[str] = []
    for p in paras:
        if not isinstance(p, str):
            continue
        s = sanitize_context_block_for_llm(p, max_chars=8000, apply_episode_sanitizer=True)
        if s:
            cleaned.append(s)
    while len(cleaned) > max_paragraphs:
        cleaned.pop(0)
    merged_text = "\n\n".join(cleaned)
    merged_text = trim_condensed_against_anchor(merged_text, anchor_markdown_for_dedup)
    cleaned2 = [x.strip() for x in merged_text.split("\n\n") if x.strip()][-max_paragraphs:]
    blob2 = dict(blob)
    blob2["paragraphs"] = cleaned2
    lp[_CONDENSED_KEY] = blob2


async def run_context_controller_for_turn(
    lp: dict[str, Any],
    *,
    profile: Mapping[str, Any],
    history: list[dict[str, str]],
    principal_id: str,
    user_line: str,
    intent_plan: Any | None,
    pool: Any | None,
    system_prompt_for_estimate: str,
    last_retrieval_ms: float | None = None,
) -> dict[str, Any]:
    """Mutate ``lp`` (condense + anchor) per policy; returns telemetry dict."""

    t0 = time.monotonic()
    telem: dict[str, Any] = {
        "context_controller": context_controller_enabled(),
        "anchor_refresh_attempted": False,
        "anchor_refresh_reason": None,
        "condense_pruned": False,
    }
    if not isinstance(lp, dict):
        return telem
    anchor_md, _anchor_model = merged_anchor_for_prompt(profile)
    w = estimate_prompt_weight_chars(system_prompt=system_prompt_for_estimate, history=history)
    prev_range = None
    lp_anchor = lp.get("companion_context_anchor_v1")
    if isinstance(lp_anchor, Mapping):
        tr = lp_anchor.get("source_turn_range")
        if isinstance(tr, Mapping):
            try:
                prev_range = int(tr.get("to"))
            except (TypeError, ValueError):  # fmt: skip
                prev_range = None
    should, reason = should_refresh_anchor(
        history_len=len(history),
        last_refresh_turn=prev_range,
        prompt_weight=w,
        last_retrieval_ms=last_retrieval_ms,
    )
    telem["anchor_should_refresh"] = should
    telem["anchor_should_reason"] = reason
    telem["prompt_weight_estimate"] = w
    if should:
        telem["anchor_refresh_attempted"] = True
        await maybe_refresh_companion_context_anchor_v1(
            lp,
            profile=profile,
            history=history,
            principal_id=principal_id,
            user_line=user_line,
            intent_plan=intent_plan,
            pool=pool,
            trigger_reason=reason,
        )
        telem["anchor_refresh_reason"] = reason
        merge_lp = dict(lp)
        merged_prof = {**dict(profile), "learned_preferences": merge_lp}
        anchor_md, _ = merged_anchor_for_prompt(merged_prof)
    if context_controller_enabled():
        prune_condensed_blob_in_lp(lp, anchor_markdown_for_dedup=anchor_md)
        telem["condense_pruned"] = True
    telem["context_controller_ms"] = round((time.monotonic() - t0) * 1000.0, 2)
    return telem


__all__ = [
    "context_controller_enabled",
    "context_prune_history_max_messages",
    "context_prune_latency_threshold_ms",
    "context_prune_prompt_budget_threshold",
    "estimate_prompt_weight_chars",
    "prune_condensed_blob_in_lp",
    "run_context_controller_for_turn",
    "should_refresh_anchor",
]
