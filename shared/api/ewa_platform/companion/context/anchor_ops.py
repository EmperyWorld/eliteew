# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Operator HTTP helpers for **context anchor** read/refresh/patch and **diagnose** (risk flags) without pulling the
# full companion chat turn path.
# Invariants:
# - All mutations go through ``companion_profile_patch`` with explicit ``audit_action`` / ``audit_detail_override``.
# - Refresh uses ``maybe_refresh_companion_context_anchor_v1`` (LLM optional + heuristic fallback).
# Related:
# - api/ewa_platform/gateways/routers/companion_profile.py
# - api/ewa_platform/companion/context/anchor_compose.py
# - api/ewa_platform/companion/context/anchor.py
# **Canonical path:** ``api.ewa_platform.companion.context.anchor_ops``; shim ``context_anchor_ops``.
# ---
"""HTTP-oriented helpers for companion context anchor operations."""

from __future__ import annotations

import json
from collections.abc import Mapping
from typing import Any

import asyncpg

from api.ewa_platform.companion.context.anchor import (
    CONTEXT_ANCHOR_LP_KEY,
    merged_anchor_for_prompt,
    normalize_context_anchor_v1,
)
from api.ewa_platform.companion.context.anchor_compose import maybe_refresh_companion_context_anchor_v1
from api.ewa_platform.companion.context.noise import noise_risk_flags, sanitize_context_block_for_llm
from api.ewa_platform.companion.memory import get_memory, memory_prompt_section
from api.ewa_platform.companion.memory.chat_condense import companion_condensed_block_from_profile
from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg


def context_anchor_get_blob(profile: Mapping[str, Any]) -> dict[str, Any] | None:
    lp = profile.get("learned_preferences")
    if not isinstance(lp, Mapping):
        return None
    blob = lp.get(CONTEXT_ANCHOR_LP_KEY)
    return dict(blob) if isinstance(blob, Mapping) else None


async def companion_context_anchor_refresh(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    user_line: str = "",
    trigger_reason: str = "operator_api_refresh",
) -> tuple[dict[str, Any] | None, dict[str, Any]]:
    """Persist refreshed anchor; returns ``(patched_profile_or_none, telemetry)``."""

    row = await companion_pg.companion_profile_fetch(pool, principal_id=principal_id)
    if row is None:
        return None, {"ok": False, "reason": "no_profile"}
    lp_raw = row.get("learned_preferences")
    lp: dict[str, Any] = dict(lp_raw) if isinstance(lp_raw, Mapping) else {}
    chat_ns = "desktop_friend_chat_v1"
    blob = lp.get(chat_ns)
    hist: list[dict[str, str]] = []
    if isinstance(blob, Mapping):
        msgs = blob.get("messages")
        if isinstance(msgs, list):
            for m in msgs[-64:]:
                if not isinstance(m, dict):
                    continue
                role = str(m.get("role") or "").strip()
                content = str(m.get("content") or "").strip()
                if role in ("user", "assistant") and content:
                    hist.append({"role": role, "content": content})
    chars_before = len(json.dumps(context_anchor_get_blob(row) or {}, ensure_ascii=False))
    model = await maybe_refresh_companion_context_anchor_v1(
        lp,
        profile=row,
        history=hist,
        principal_id=principal_id,
        user_line=user_line or (hist[-1].get("content", "") if hist else ""),
        intent_plan=None,
        pool=pool,
        trigger_reason=trigger_reason,
    )
    if model is None:
        return row, {"ok": False, "reason": "anchor_refresh_noop", "chars_before": chars_before}
    chars_after = len(json.dumps(lp.get(CONTEXT_ANCHOR_LP_KEY) or {}, ensure_ascii=False))
    rev = int(row.get("companion_revision") or 1)
    patched = await companion_pg.companion_profile_patch(
        pool,
        principal_id=principal_id,
        learned_preferences=lp,
        expect_revision=rev,
        audit_action="companion_context_anchor_refresh",
        audit_detail_override={
            "trigger_reason": trigger_reason,
            "chars_before": chars_before,
            "chars_after": chars_after,
            "model_ok": True,
        },
    )
    telem = {
        "ok": patched is not None,
        "chars_before": chars_before,
        "chars_after": chars_after,
        "normalized": model.to_lp_dict(),
    }
    return patched, telem


async def companion_context_anchor_patch_merge(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    patch: Mapping[str, Any],
) -> dict[str, Any] | None:
    """Shallow-merge user fields into anchor JSON (operator override)."""

    row = await companion_pg.companion_profile_fetch(pool, principal_id=principal_id)
    if row is None:
        return None
    lp_raw = row.get("learned_preferences")
    lp: dict[str, Any] = dict(lp_raw) if isinstance(lp_raw, Mapping) else {}
    anchor_raw = lp.get(CONTEXT_ANCHOR_LP_KEY)
    cur = dict(anchor_raw) if isinstance(anchor_raw, Mapping) else {}
    merged = {**cur, **dict(patch)}
    chars_before = len(json.dumps(cur, ensure_ascii=False))
    norm = normalize_context_anchor_v1(merged)
    if norm is None:
        lp[CONTEXT_ANCHOR_LP_KEY] = merged
    else:
        lp[CONTEXT_ANCHOR_LP_KEY] = norm.to_lp_dict()
    chars_after = len(json.dumps(lp.get(CONTEXT_ANCHOR_LP_KEY) or {}, ensure_ascii=False))
    rev = int(row.get("companion_revision") or 1)
    return await companion_pg.companion_profile_patch(
        pool,
        principal_id=principal_id,
        learned_preferences=lp,
        expect_revision=rev,
        audit_action="companion_context_anchor_patch",
        audit_detail_override={"chars_before": chars_before, "chars_after": chars_after},
    )


def companion_context_diagnose_bundle(profile: Mapping[str, Any], *, system_prompt_sample: str = "") -> dict[str, Any]:
    md, _ = merged_anchor_for_prompt(profile)
    condensed = companion_condensed_block_from_profile(profile)
    mem = memory_prompt_section(get_memory(profile))
    flags = noise_risk_flags(
        condensed=sanitize_context_block_for_llm(condensed, max_chars=8000),
        anchor_snippet=md[:4000],
        memory_section=mem,
        system_prompt_sample=system_prompt_sample[:8000],
    )
    anchor_blob = context_anchor_get_blob(profile)
    return {
        "flags": flags,
        "anchor_present": bool(anchor_blob),
        "condensed_chars": len(condensed or ""),
        "memory_section_chars": len(mem or ""),
    }


__all__ = [
    "companion_context_anchor_patch_merge",
    "companion_context_anchor_refresh",
    "companion_context_diagnose_bundle",
    "context_anchor_get_blob",
]
