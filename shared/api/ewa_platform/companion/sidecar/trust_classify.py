# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# One short HTTP LLM call per companion chat turn to estimate **trust_delta** and **abuse_at_peak** for Arlika
# transformation gating. On failures returns a safe no-op so chat still works. Tolerates CoT-style models by suffix
# re-parse and configurable ``EWA_COMPANION_TRUST_CLASSIFY_MAX_TOKENS``.
# Invariants:
# - Accept **JSON** (via ``parse_llm_json_object``) **or** markdown bullet ``- trust_delta: …`` / ``abuse_at_peak: …``;
#   never raises to ``chat_turn`` callers. HTTP call uses ``openai_sidecar_merge_reasoning`` when ``content`` is empty but KV is in ``reasoning_content``.
# - ``trust_delta`` clamped to ``[-2, 2]``; ``abuse_at_peak`` is returned at any trust score (transform no longer requires score 10).
# Related:
# - api/ewa_platform/companion/sidecar/intent_planner.py (shared JSON slice helper)
# - api/ewa_platform/companion/sidecar/llm_kv_markdown.py
# - api/ewa_platform/companion/sidecar/trust_state.py
# - api/utils/llm_openai_compat_http.py
# **Canonical path:** ``api.ewa_platform.companion.sidecar.trust_classify``; shim ``companion_trust_classify``.
# ---
"""LLM classifier for EWA companion trust / abuse-at-peak detection (JSON or markdown KV)."""

from __future__ import annotations

import logging
import os
from typing import Any

import httpx

from api.ewa_platform.companion.sidecar.intent_planner import parse_llm_json_object
from api.ewa_platform.companion.sidecar.llm_kv_markdown import (
    parse_companion_markdown_kv,
    trust_fields_from_markdown_kv,
    trust_kv_suffix_after_cot,
)
from api.utils.llm_openai_compat_http import httpx_compat_chat_completion_json

logger = logging.getLogger(__name__)


def _coerce_delta(val: Any) -> int:
    try:
        d = int(val)
    except (TypeError, ValueError):  # fmt: skip
        return 0
    return max(-2, min(2, d))


def _coerce_abuse(val: Any) -> bool:
    if val is True:
        return True
    if val is False:
        return False
    if isinstance(val, str):
        return val.strip().lower() in ("true", "1", "yes")
    return False


def parse_trust_classify_model_text(text: str) -> dict[str, Any] | None:
    """Parse trust JSON or markdown KV from raw model output, including CoT-prefixed replies."""

    t = (text or "").strip()
    if not t:
        return None
    suffix = trust_kv_suffix_after_cot(t)
    for cand in ([suffix] if suffix else []) + [t]:
        if not cand:
            continue
        parsed = parse_llm_json_object(cand)
        if not parsed:
            md = trust_fields_from_markdown_kv(parse_companion_markdown_kv(cand))
            if md:
                parsed = md
        if parsed:
            return parsed
    return None


def _trust_classify_max_tokens() -> int:
    try:
        raw = int(os.getenv("EWA_COMPANION_TRUST_CLASSIFY_MAX_TOKENS", "512").strip() or "512")
    except ValueError:
        raw = 512
    return max(64, min(raw, 4096))


async def classify_companion_trust_turn(
    client: httpx.AsyncClient,
    *,
    base_url: str,
    model: str,
    timeout: httpx.Timeout,
    user_message: str,
    current_trust_score: int,
) -> tuple[int, bool]:
    """Return ``(trust_delta, abuse_at_peak)`` — ``abuse_at_peak`` gates hostile Arlika v1 transform at any trust score."""

    score = max(0, min(10, int(current_trust_score)))
    user_line = (user_message or "").strip()[:4000]

    from api.ewa_platform.companion.prompt_blocks.service import get_prompt_block

    tmpl = get_prompt_block("sidecar.trust_classify")
    try:
        system = tmpl.format(score=score)
    except KeyError, ValueError:
        system = tmpl.replace("{score}", str(score))

    user_payload = f"User message:\n{user_line}"

    messages: list[dict[str, Any]] = [
        {"role": "system", "content": system},
        {"role": "user", "content": user_payload},
    ]
    short_timeout: httpx.Timeout
    try:
        to_sec = float(os.getenv("EWA_COMPANION_TRUST_CLASSIFY_TIMEOUT_SEC", "25").strip() or "25")
    except ValueError:
        to_sec = 25.0
    to_sec = max(5.0, min(to_sec, 120.0))
    short_timeout = httpx.Timeout(to_sec)

    try:
        mtok = _trust_classify_max_tokens()
        out = await httpx_compat_chat_completion_json(
            client,
            base_url,
            model=model,
            messages=messages,
            options={"temperature": 0.1, "max_tokens": mtok, "openai_sidecar_merge_reasoning": True},
            chat_template_kwargs={"enable_thinking": False},
            extra_params={"reasoning_format": "none"},
            timeout=short_timeout,
        )
        text = str(out.get("response", "") or "").strip()
        fin = out.get("finish_reason")
        parsed = parse_trust_classify_model_text(text)
        if not parsed:
            has_kv_markers = "trust_delta" in text.lower() or "abuse_at_peak" in text.lower()
            logger.info(
                "companion_trust_classify_unparseable len=%s finish_reason=%s kv_markers=%s preview=%r",
                len(text),
                fin,
                has_kv_markers,
                text[:240],
            )
            return 0, False
        delta = _coerce_delta(parsed.get("trust_delta"))
        abuse = _coerce_abuse(parsed.get("abuse_at_peak"))
        return delta, abuse
    except (TimeoutError, httpx.HTTPError, OSError, ValueError, TypeError, RuntimeError) as exc:
        logger.warning("companion_trust_classify_failed err=%s", exc)
        return 0, False


def trust_classify_model_from_env(fallback: str) -> str:
    m = os.getenv("EWA_COMPANION_TRUST_CLASSIFY_MODEL", "").strip()
    return m or (fallback or "").strip() or "mistral"
