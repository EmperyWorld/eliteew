# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Backend module `ewa_platform/companion/memory/chat_condense.py`; preserves its existing EliteEW API/service responsibilities.
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
# Maintain ``learned_preferences.companion_chat_condensed_v1`` — a rolling **text archive** of transcript
# prefixes that no longer fit the HTTP LLM tail (see ``companion_llm_history_max_messages``), so older facts
# stay reachable in the system prompt without re-sending every dropped message. The condenser fires on
# **either** of two gates: (a) enough new dropped rows have accumulated (``EWA_COMPANION_CHAT_CONDENSE_MIN_MESSAGES``),
# or (b) the live LLM tail exceeds ``EWA_COMPANION_SESSION_COMPRESS_TOKEN_BUDGET`` estimated tokens — this is the
# "session-compress on token threshold" knob operators tune from backend env.
# Invariants:
# - Best-effort: failures are logged; callers keep normal ``companion_profile_patch`` semantics.
# - Condensation runs when ``EWA_COMPANION_CHAT_CONDENSE_ENABLED`` is truthy **or** the token-budget threshold
#   is configured (``EWA_COMPANION_SESSION_COMPRESS_TOKEN_BUDGET`` > 0). The threshold-set case auto-enables the
#   feature so a single env var is enough to turn session compression on in production.
# - Token estimate uses the cheap 4-chars/token heuristic on user+assistant rows only; same numbers are reused
#   by ``llm_bandwidth.companion_llm_user_assistant_slice_for_http`` so the *visible* LLM tail can also be
#   token-capped from one place.
# - Never stores raw llama-server telemetry — summaries pass through the same episode sanitizer heuristics lightly
#   by trimming only; the model is instructed to output factual prose only.
# Related:
# - api/ewa_platform/companion/turn/chat_turn.py
# - api/ewa_platform/companion/sidecar/llm_bandwidth.py
# - api/ewa_platform/companion/episodic/body_sanitize.py
# - api/utils/llm_openai_compat_http.py
# ---
"""Rolling condensation of companion chat prefixes into ``companion_chat_condensed_v1`` (msg-count or token-budget gate)."""

from __future__ import annotations

import logging
import os
import re
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Any

import httpx

from api.core.unified_config import unified_settings
from api.ewa_platform.companion.episodic.body_sanitize import sanitize_companion_episode_body_for_storage
from api.ewa_platform.companion.sidecar.llm_bandwidth import companion_llm_history_max_messages
from api.utils.llm_openai_compat_http import httpx_compat_chat_completion_json

logger = logging.getLogger(__name__)

_CONDENSED_KEY = "companion_chat_condensed_v1"
_CHARS_PER_TOKEN_HEURISTIC: int = 4
_PER_MESSAGE_TOKEN_OVERHEAD: int = 4


def companion_session_compress_token_threshold() -> int:
    """Env ``EWA_COMPANION_SESSION_COMPRESS_TOKEN_BUDGET`` — token budget that auto-fires session compression.

    Returns ``0`` when disabled. When > 0 it ALSO implicitly enables the condenser without setting
    ``EWA_COMPANION_CHAT_CONDENSE_ENABLED=1`` so a single env knob suffices. Sensible production values are
    ``4000..16000``; the gate uses the 4 chars / 1 token heuristic on the live LLM tail.
    """

    raw = os.getenv("EWA_COMPANION_SESSION_COMPRESS_TOKEN_BUDGET", "0").strip() or "0"
    try:
        v = int(raw)
    except ValueError:
        return 0
    return max(0, min(v, 200_000))


def companion_chat_condense_enabled() -> bool:
    """``EWA_COMPANION_CHAT_CONDENSE_ENABLED`` truthy **or** ``EWA_COMPANION_SESSION_COMPRESS_TOKEN_BUDGET`` > 0."""

    raw = os.getenv("EWA_COMPANION_CHAT_CONDENSE_ENABLED", "0").strip().lower()
    if raw in ("1", "true", "yes", "on"):
        return True
    return companion_session_compress_token_threshold() > 0


def estimate_companion_history_tokens(messages: list[dict[str, str]] | list[Mapping[str, Any]]) -> int:
    """Cheap ``len(content) / 4 + per-msg overhead`` estimator over user/assistant rows; system/tool rows ignored.

    Used by both the condenser trigger and the live-tail token cap in :mod:`llm_bandwidth`. The 4-chars/token
    heuristic intentionally avoids importing a tokenizer; for Cyrillic it overestimates slightly which is the safe
    side for budget gates.
    """

    if not messages:
        return 0
    total = 0
    for m in messages:
        if not isinstance(m, Mapping):
            continue
        role = str(m.get("role") or "").strip()
        if role not in ("user", "assistant"):
            continue
        content = str(m.get("content") or "")
        if not content:
            continue
        total += (len(content) // _CHARS_PER_TOKEN_HEURISTIC) + _PER_MESSAGE_TOKEN_OVERHEAD
    return total


def _min_new_messages() -> int:
    # Align with catalog default + migration 035 (was 6 before settings DB plane).
    raw = os.getenv("EWA_COMPANION_CHAT_CONDENSE_MIN_MESSAGES", "8").strip() or "8"
    try:
        v = int(raw)
    except ValueError:
        v = 8
    return max(2, min(v, 64))


def _max_blob_chars() -> int:
    raw = os.getenv("EWA_COMPANION_CHAT_CONDENSE_MAX_CHARS", "8000").strip() or "8000"
    try:
        v = int(raw)
    except ValueError:
        v = 8000
    return max(1200, min(v, 24_000))


def _condense_model() -> str:
    return (
        os.getenv("EWA_COMPANION_CHAT_CONDENSE_MODEL", "").strip()
        or os.getenv("EWA_COMPANION_CHAT_MODEL", "").strip()
        or os.getenv("EWA_ORCH_LLM_MODEL", "").strip()
        or unified_settings.default_ai_model
    )


def _format_history_chunk(messages: list[dict[str, str]], *, per_line_cap: int = 1200) -> str:
    lines: list[str] = []
    for m in messages:
        role = str(m.get("role") or "").strip()
        content = str(m.get("content") or "").strip()
        if role not in ("user", "assistant") or not content:
            continue
        if len(content) > per_line_cap:
            content = content[: per_line_cap - 1].rstrip() + "…"
        lines.append(f"{role.upper()}: {content}")
    return "\n".join(lines).strip()


def _merge_paragraphs(paragraphs: list[str], *, cap: int) -> list[str]:
    out = [p.strip() for p in paragraphs if isinstance(p, str) and p.strip()]
    joined = "\n\n".join(out)
    while len(joined) > cap and len(out) > 1:
        out.pop(0)
        joined = "\n\n".join(out)
    if len(joined) > cap and out:
        out[-1] = out[-1][: cap - 80].rstrip() + "…"
        out = [out[-1]]
    return out


def companion_condensed_block_from_profile(profile: Mapping[str, Any]) -> str:
    """Return markdown-ish text for the system prompt from ``companion_chat_condensed_v1``."""

    lp_raw = profile.get("learned_preferences")
    if not isinstance(lp_raw, Mapping):
        return ""
    blob = lp_raw.get(_CONDENSED_KEY)
    if not isinstance(blob, Mapping):
        return ""
    paras = blob.get("paragraphs")
    if not isinstance(paras, list):
        return ""
    text = "\n\n".join(str(p).strip() for p in paras if isinstance(p, str) and str(p).strip())
    text = sanitize_companion_episode_body_for_storage(text, max_chars=_max_blob_chars())
    return text.strip()


async def maybe_update_companion_chat_condensed_v1(
    lp: dict[str, Any],
    *,
    history: list[dict[str, str]],
    principal_id: str,
) -> None:
    """Mutate ``lp`` in-place when new transcript rows rolled out of the LLM tail should be summarized.

    Two independent triggers (OR-gated):

    - **Message-count gate** — same as before: enough new dropped rows ``≥ _min_new_messages()`` accumulated between
      the prior ``covered_up_to_index`` and the current LLM tail start.
    - **Token-budget gate** — ``EWA_COMPANION_SESSION_COMPRESS_TOKEN_BUDGET``: when the **live** LLM tail estimate
      exceeds the budget, force compression even if the message-count gate would still wait. Forces ``tail_start``
      backward to peel additional older messages into the summary so the next turn's tail fits the budget.
    """

    if not companion_chat_condense_enabled():
        return
    cap = companion_llm_history_max_messages()
    hist = [dict(m) for m in history if isinstance(m, dict)]
    l_hist = len(hist)
    tail_start = max(0, l_hist - cap)

    token_budget = companion_session_compress_token_threshold()
    live_tail_tokens = estimate_companion_history_tokens(hist[tail_start:]) if l_hist else 0
    token_trigger = bool(token_budget) and live_tail_tokens > token_budget

    if tail_start <= 0 and not token_trigger:
        return

    if token_trigger:
        new_tail_start = tail_start
        rolling_tokens = live_tail_tokens
        while new_tail_start < l_hist - 4 and rolling_tokens > token_budget:
            m = hist[new_tail_start]
            content = str(m.get("content") or "") if isinstance(m, Mapping) else ""
            est = (len(content) // _CHARS_PER_TOKEN_HEURISTIC) + _PER_MESSAGE_TOKEN_OVERHEAD if content else 0
            rolling_tokens = max(0, rolling_tokens - est)
            new_tail_start += 1
        tail_start = max(tail_start, new_tail_start)

    prev_blob = lp.get(_CONDENSED_KEY)
    prev_idx = 0
    prev_paras: list[str] = []
    if isinstance(prev_blob, Mapping):
        try:
            prev_idx = max(0, int(prev_blob.get("covered_up_to_index") or 0))
        except (TypeError, ValueError):  # fmt: skip
            prev_idx = 0
        raw_paras = prev_blob.get("paragraphs")
        if isinstance(raw_paras, list):
            prev_paras = [str(p).strip() for p in raw_paras if isinstance(p, str) and str(p).strip()]

    prev_idx = min(prev_idx, tail_start)
    new_slice = hist[prev_idx:tail_start]
    msg_trigger = len(new_slice) >= _min_new_messages()
    if not msg_trigger and not token_trigger:
        return
    if not new_slice:
        return

    trigger_reason = "token" if token_trigger and not msg_trigger else ("token+message" if token_trigger else "message")
    logger.info(
        "[STEP] companion_session_compress_trigger principal=%s reason=%s tail_tokens=%s budget=%s "
        "new_msgs=%s min_msgs=%s tail_start=%s prev_idx=%s",
        principal_id,
        trigger_reason,
        live_tail_tokens,
        token_budget,
        len(new_slice),
        _min_new_messages(),
        tail_start,
        prev_idx,
    )

    dialogue = _format_history_chunk(new_slice)
    if len(dialogue) < 80:
        return

    base = unified_settings.llama_url.strip().rstrip("/")
    if not base:
        return
    try:
        t_out = float(os.getenv("EWA_COMPANION_CHAT_CONDENSE_TIMEOUT_SEC", "75").strip() or "75")
    except ValueError:
        t_out = 75.0
    timeout = httpx.Timeout(max(20.0, min(t_out, 120.0)))
    model = _condense_model()
    from api.ewa_platform.companion.prompt_blocks.service import get_prompt_block

    sys_msg = get_prompt_block("workflow.chat_condense")
    user_msg = "Summarize the following dialogue excerpt (older turns no longer in the live LLM tail):\n\n" + dialogue
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
                options={"temperature": 0.25, "num_predict": 512},
                timeout=timeout,
            )
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "[STEP] companion_chat_condense_llm_failed principal=%s err=%s",
            principal_id,
            exc,
        )
        return

    raw_reply = str(out.get("response") or "").strip()
    raw_reply = re.sub(r"^```[A-Za-z0-9_-]*\s*", "", raw_reply)
    raw_reply = re.sub(r"\s*```$", "", raw_reply).strip()
    if not raw_reply:
        return
    cleaned = sanitize_companion_episode_body_for_storage(raw_reply, max_chars=6000)
    if not cleaned:
        return

    merged_paras = _merge_paragraphs(prev_paras + [cleaned], cap=_max_blob_chars())
    lp[_CONDENSED_KEY] = {
        "version": 1,
        "paragraphs": merged_paras,
        "covered_up_to_index": tail_start,
        "updated_at_iso": datetime.now(UTC).isoformat(timespec="seconds"),
    }
    logger.info(
        "[STEP] companion_chat_condense_ok principal=%s covered_up_to=%s new_msgs=%s",
        principal_id,
        tail_start,
        len(new_slice),
    )


__all__ = (
    "companion_chat_condense_enabled",
    "companion_condensed_block_from_profile",
    "companion_session_compress_token_threshold",
    "estimate_companion_history_tokens",
    "maybe_update_companion_chat_condensed_v1",
)
