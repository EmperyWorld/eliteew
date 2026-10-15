# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Compose / refresh ``learned_preferences.companion_context_anchor_v1`` from the live tail, optional HTTP LLM JSON
# (strict schema), and a deterministic **heuristic fallback** when the LLM path fails.
# Invariants:
# - Mutates ``lp`` in-place only when normalized anchor is non-empty.
# - Never raises into chat; failures are ``[STEP]`` warnings.
# Related:
# - api/ewa_platform/companion/context/anchor.py
# - api/ewa_platform/companion/sidecar/llm_bandwidth.py
# - api/utils/llm_openai_compat_http.py
# **Canonical path:** ``api.ewa_platform.companion.context.anchor_compose``; shim ``context_anchor_compose``.
# ---
"""LLM + heuristic composer for companion context anchor v1."""

from __future__ import annotations

import json
import logging
import os
import re
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Any

import httpx

from api.core.unified_config import unified_settings
from api.ewa_platform.companion.context.anchor import (
    CONTEXT_ANCHOR_LP_KEY,
    ContextAnchorV1,
    context_anchor_feature_enabled,
    normalize_context_anchor_v1,
)
from api.ewa_platform.companion.context.noise import sanitize_context_block_for_llm
from api.ewa_platform.companion.sidecar.llm_bandwidth import companion_llm_history_max_messages
from api.utils.llm_openai_compat_http import httpx_compat_chat_completion_json

logger = logging.getLogger(__name__)


def _tail_messages(history: list[dict[str, str]], *, limit: int = 12) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for m in history[-max(1, limit) :]:
        if not isinstance(m, dict):
            continue
        role = str(m.get("role") or "").strip()
        content = str(m.get("content") or "").strip()
        if role not in ("user", "assistant") or not content:
            continue
        out.append({"role": role, "content": content[:2000]})
    return out


def _format_tail(tail: list[dict[str, str]]) -> str:
    lines: list[str] = []
    for m in tail:
        lines.append(f"{m['role'].upper()}: {m['content']}")
    return "\n".join(lines)


def _heuristic_anchor_from_tail(
    tail: list[dict[str, str]],
    *,
    intent_plan: Any | None,
    trigger_reason: str,
) -> ContextAnchorV1 | None:
    facts: list[str] = []
    tasks: list[str] = []
    user_lines = [m["content"] for m in tail if m.get("role") == "user"]
    if user_lines:
        last_u = user_lines[-1][:400]
        facts.append(f"Last user focus: {last_u}")
    if intent_plan is not None:
        it = str(getattr(intent_plan, "intent", "") or "").strip()
        conf = getattr(intent_plan, "confidence", 0.0)
        if it and it != "chat_only":
            tasks.append(f"Planner intent: {it} (confidence {conf})")
        su = (
            str(getattr(intent_plan, "understood_summary_ru", "") or "").strip()
            or str(getattr(intent_plan, "understood_summary_en", "") or "").strip()
        )
        if su:
            facts.append(f"Understood summary: {su[:320]}")
    if not facts and not tasks:
        return None
    return ContextAnchorV1(
        updated_at_iso=datetime.now(UTC).isoformat(timespec="seconds"),
        status="heuristic",
        core_truths=facts[:8],
        active_tasks=tasks[:8],
        tech_constraints=[f"anchor_refresh:{trigger_reason}"][:4],
        source_turn_range=None,
    )


_JSON_FENCE_RE = re.compile(r"^\s*```(?:json)?\s*(?P<body>.*?)\s*```\s*$", re.DOTALL | re.IGNORECASE)


def _extract_json_object(text: str) -> dict[str, Any] | None:
    s = (text or "").strip()
    if not s:
        return None
    m = _JSON_FENCE_RE.match(s)
    if m:
        s = m.group("body").strip()
    try:
        payload = json.loads(s)
    except json.JSONDecodeError:
        start = s.find("{")
        end = s.rfind("}")
        if start < 0 or end <= start:
            return None
        try:
            payload = json.loads(s[start : end + 1])
        except json.JSONDecodeError:
            return None
    return payload if isinstance(payload, dict) else None


def _env_llm_compose_enabled() -> bool:
    raw = os.getenv("EWA_COMPANION_CONTEXT_ANCHOR_LLM", "1").strip().lower()
    return raw in ("1", "true", "yes", "on")


async def _llm_compose_anchor_json(
    dialogue_excerpt: str,
    *,
    principal_id: str,
) -> dict[str, Any] | None:
    if not _env_llm_compose_enabled():
        return None
    base = unified_settings.llama_url.strip().rstrip("/")
    if not base:
        return None
    model = (
        os.getenv("EWA_COMPANION_CONTEXT_ANCHOR_MODEL", "").strip()
        or os.getenv("EWA_COMPANION_CHAT_MODEL", "").strip()
        or unified_settings.default_ai_model
    )
    try:
        t_out = float(os.getenv("EWA_COMPANION_CONTEXT_ANCHOR_TIMEOUT_SEC", "45").strip() or "45")
    except ValueError:
        t_out = 45.0
    timeout = httpx.Timeout(max(12.0, min(t_out, 90.0)))
    from api.ewa_platform.companion.prompt_blocks.service import get_prompt_block

    sys_msg = get_prompt_block("workflow.anchor_compose")
    user_msg = "Dialogue excerpt:\n" + dialogue_excerpt
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            out = await httpx_compat_chat_completion_json(
                client,
                base,
                model=model,
                messages=[
                    {"role": "system", "content": sys_msg},
                    {"role": "user", "content": user_msg},
                ],
                options={"temperature": 0.2, "num_predict": 768},
                timeout=timeout,
            )
    except Exception as exc:  # noqa: BLE001
        logger.warning("[STEP] companion_context_anchor_llm_failed principal=%s err=%s", principal_id, exc)
        return None
    raw = str(out.get("response") or "").strip()
    return _extract_json_object(raw)


async def maybe_refresh_companion_context_anchor_v1(
    lp: dict[str, Any],
    *,
    profile: Mapping[str, Any],
    history: list[dict[str, str]],
    principal_id: str,
    user_line: str,
    intent_plan: Any | None,
    pool: Any | None = None,
    trigger_reason: str = "manual",
) -> ContextAnchorV1 | None:
    """Write anchor into ``lp`` when feature enabled and payload normalizes."""

    del profile, pool, user_line  # reserved for future richer compose (catalog / PG)
    if not context_anchor_feature_enabled():
        return None
    cap = companion_llm_history_max_messages()
    tail = _tail_messages(history, limit=min(16, max(4, cap // 4)))
    dialogue = _format_tail(tail)
    dialogue = sanitize_context_block_for_llm(dialogue, max_chars=12_000, apply_episode_sanitizer=True)
    model: ContextAnchorV1 | None = None
    raw_json = await _llm_compose_anchor_json(dialogue, principal_id=principal_id)
    if raw_json is not None:
        raw_json = dict(raw_json)
        raw_json.setdefault("updated_at_iso", datetime.now(UTC).isoformat(timespec="seconds"))
        model = normalize_context_anchor_v1(raw_json)
    if model is None:
        model = _heuristic_anchor_from_tail(tail, intent_plan=intent_plan, trigger_reason=trigger_reason)
    if model is None:
        return None
    span_to = max(0, len(history) - 1)
    span_from = max(0, span_to - len(tail) + 1)
    d = model.to_lp_dict()
    d["source_turn_range"] = {"from": span_from, "to": span_to}
    d["refresh_trigger"] = trigger_reason[:128]
    lp[CONTEXT_ANCHOR_LP_KEY] = d
    logger.info(
        "[STEP] companion_context_anchor_refreshed principal=%s reason=%s truths=%s tasks=%s",
        principal_id,
        trigger_reason,
        len(model.core_truths),
        len(model.active_tasks),
    )
    return model


__all__ = ["maybe_refresh_companion_context_anchor_v1"]
