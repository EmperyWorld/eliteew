# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Pure helpers for **how much chat history** and **how many characters per row** are sent to the HTTP companion LLM.
# Keeps llama-server prompt-eval and KV checkpoints predictable without shrinking the stored transcript in
# ``desktop_friend_chat_v1`` (still capped elsewhere at 240×8000 in ``chat_turn``). Tail size is gated by two
# orthogonal knobs that compose as **min(count_cap, token_cap)**: a message-count cap
# (``EWA_COMPANION_CHAT_LLM_HISTORY_MAX_MESSAGES``) and, when set, a token-budget cap
# (``EWA_COMPANION_CHAT_LLM_HISTORY_TOKEN_BUDGET``) — the latter is read alongside the session-compress threshold.
# Invariants:
# - No asyncio / httpx / asyncpg — safe to import from unit tests without loading ``chat_turn``.
# - Arlika v1/v2 user-only message shaping matches ``chat_turn`` contract (assistant lines omitted for LLM ``messages``).
# - Token estimator must stay in sync with :mod:`api.ewa_platform.companion.memory.chat_condense` (4-chars heuristic).
# Related:
# - api/ewa_platform/companion/turn/chat_turn.py (system prompt + persistence)
# - api/ewa_platform/companion/memory/chat_condense.py (session compression on token threshold)
# - documentation/product/ewa/EWA-COMPANION-CHAT-PIPELINE-2026-05.md
# **Canonical path:** ``api.ewa_platform.companion.sidecar.llm_bandwidth``; shim ``companion_llm_bandwidth``.
# ---
"""Companion HTTP LLM transcript bandwidth (count tail + per-message char cap + optional token-budget cap)."""

from __future__ import annotations

import logging
import os
from collections.abc import Mapping
from typing import Any

from api.ewa_platform.companion.sidecar.trust_state import ARLIKA_V2_SEED

logger = logging.getLogger(__name__)

ARLIKA_SEED: str = "arlika"
MAX_STORED_MESSAGES: int = 240
MAX_MESSAGE_CHARS: int = 8000


def companion_arlika_v1_hostile(profile: Mapping[str, Any]) -> bool:
    return str(profile.get("seed_persona_id") or "").strip().lower() == ARLIKA_SEED


def companion_arlika_user_only_llm(profile: Mapping[str, Any]) -> bool:
    s = str(profile.get("seed_persona_id") or "").strip().lower()
    return s in (ARLIKA_SEED, ARLIKA_V2_SEED)


def messages_for_llm_chat(profile: Mapping[str, Any], history: list[dict[str, str]]) -> list[dict[str, str]]:
    """Messages passed to the main companion LLM (Arlika: user rows only)."""

    if not companion_arlika_user_only_llm(profile):
        return history
    return [dict(m) for m in history if m.get("role") == "user"]


def companion_llm_history_max_messages() -> int:
    """Env ``EWA_COMPANION_CHAT_LLM_HISTORY_MAX_MESSAGES`` (default **48**); clamp ``[4, MAX_STORED_MESSAGES]``."""

    raw = os.getenv("EWA_COMPANION_CHAT_LLM_HISTORY_MAX_MESSAGES", "48").strip() or "48"
    try:
        v = int(raw)
    except ValueError:
        v = 48
    return max(4, min(v, MAX_STORED_MESSAGES))


def companion_llm_message_chars_cap() -> int:
    """Env ``EWA_COMPANION_CHAT_LLM_MESSAGE_MAX_CHARS`` (default **4096**); clamp ``[256, MAX_MESSAGE_CHARS]``."""

    raw = os.getenv("EWA_COMPANION_CHAT_LLM_MESSAGE_MAX_CHARS", "4096").strip() or "4096"
    try:
        v = int(raw)
    except ValueError:
        v = 4096
    return max(256, min(v, MAX_MESSAGE_CHARS))


_CHARS_PER_TOKEN_HEURISTIC: int = 4
_PER_MESSAGE_TOKEN_OVERHEAD: int = 4


def companion_llm_history_token_budget() -> int:
    """Env ``EWA_COMPANION_CHAT_LLM_HISTORY_TOKEN_BUDGET`` — optional token-budget cap (in addition to msg-count).

    Returns ``0`` when disabled. When > 0, :func:`companion_llm_user_assistant_slice_for_http` drops *oldest*
    user/assistant rows after the count-tail until the estimated token total fits the budget. Same 4-chars
    heuristic as :func:`api.ewa_platform.companion.memory.chat_condense.estimate_companion_history_tokens`.
    """

    raw = os.getenv("EWA_COMPANION_CHAT_LLM_HISTORY_TOKEN_BUDGET", "0").strip() or "0"
    try:
        v = int(raw)
    except ValueError:
        return 0
    return max(0, min(v, 200_000))


def _estimate_tokens_for_row(content: str) -> int:
    if not content:
        return 0
    return (len(content) // _CHARS_PER_TOKEN_HEURISTIC) + _PER_MESSAGE_TOKEN_OVERHEAD


def _truncate_row(s: str, limit: int) -> str:
    t = s.strip()
    if len(t) <= limit:
        return t
    return t[: limit - 1].rstrip() + "…"


def companion_llm_user_assistant_slice_for_http(
    profile: Mapping[str, Any],
    history: list[dict[str, str]],
) -> list[dict[str, str]]:
    """Tail ``history``, apply Arlika user-only filter, truncate each row, optionally enforce token budget."""

    cap_n = companion_llm_history_max_messages()
    cap_c = companion_llm_message_chars_cap()
    if len(history) > cap_n:
        logger.info(
            "[STEP] companion_llm_history_tail stored=%s llm_slice=%s msg_chars_cap=%s",
            len(history),
            cap_n,
            cap_c,
        )
        tail = history[-cap_n:]
    else:
        tail = history
    thin = messages_for_llm_chat(profile, tail)
    truncated: list[dict[str, str]] = [
        {"role": str(m["role"]), "content": _truncate_row(str(m.get("content", "")), cap_c)}
        for m in thin
        if m.get("role") in ("user", "assistant")
    ]

    token_budget = companion_llm_history_token_budget()
    if token_budget <= 0 or not truncated:
        return truncated

    total = sum(_estimate_tokens_for_row(r.get("content", "")) for r in truncated)
    if total <= token_budget:
        return truncated

    pre_count = len(truncated)
    pre_tokens = total
    while truncated and total > token_budget:
        oldest = truncated.pop(0)
        total -= _estimate_tokens_for_row(oldest.get("content", ""))
    logger.info(
        "[STEP] companion_llm_history_token_cap pre_count=%s pre_tokens=%s kept_count=%s kept_tokens=%s budget=%s",
        pre_count,
        pre_tokens,
        len(truncated),
        total,
        token_budget,
    )
    return truncated
