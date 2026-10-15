# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Short HTTP LLM JSON pass per **Arlika** turn: detect whether the user line is an **argumentative quarrel** (перепалка).
# If the classifier fails, return ``None`` (do not reduce wrath — safe no-op).
# Invariants:
# - JSON object only; tolerant parsing; never raises. HTTP options include ``openai_sidecar_merge_reasoning`` for empty ``content``.
# - ``argumentative_quarrel`` true ⇒ wrath must not decrement this turn.
# - ``None`` = unreachable/error reply — caller ``trust_turn`` may coerce to calm when ``EWA_COMPANION_ARLIKA_WRATH_CLASSIFY_FAIL_OPEN``.
# Related:
# - api/ewa_platform/companion/sidecar/trust_turn.py
# - api/utils/llm_openai_compat_http.py
# **Canonical path:** ``api.ewa_platform.companion.sidecar.arlika_wrath_classify``; shim ``companion_arlika_wrath_classify``.
# ---
"""LLM helper: quarrel vs calm for Arlika wrath decay."""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any

import httpx

from api.utils.llm_openai_compat_http import httpx_compat_chat_completion_json

logger = logging.getLogger(__name__)

_JSON_OBJ_RE = re.compile(r"\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}")


def _parse_json_obj(text: str) -> dict[str, Any] | None:
    raw = (text or "").strip()
    if not raw:
        return None
    raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.IGNORECASE)
    raw = re.sub(r"\s*```\s*$", "", raw)
    try:
        out = json.loads(raw)
        return out if isinstance(out, dict) else None
    except json.JSONDecodeError:
        pass
    m = _JSON_OBJ_RE.search(raw)
    if not m:
        return None
    try:
        out = json.loads(m.group(0))
        return out if isinstance(out, dict) else None
    except json.JSONDecodeError:
        return None


def _coerce_bool(val: Any) -> bool:
    if val is True:
        return True
    if val is False:
        return False
    if isinstance(val, str):
        return val.strip().lower() in ("true", "1", "yes")
    return False


async def classify_arlika_wrath_quarrel(
    client: httpx.AsyncClient,
    *,
    base_url: str,
    model: str,
    timeout: httpx.Timeout,
    user_message: str,
) -> bool | None:
    """``True`` = quarrel (no wrath decay); ``False`` = calm (decay); ``None`` = classify failed (no decay)."""

    user_line = (user_message or "").strip()[:4000]

    from api.ewa_platform.companion.prompt_blocks.service import get_prompt_block

    system = get_prompt_block("sidecar.arlika_wrath_classify")

    messages: list[dict[str, Any]] = [
        {"role": "system", "content": system},
        {"role": "user", "content": f"User message:\n{user_line}"},
    ]
    try:
        to_sec = float(os.getenv("EWA_COMPANION_WRATH_CLASSIFY_TIMEOUT_SEC", "25").strip() or "25")
    except ValueError:
        to_sec = 25.0
    to_sec = max(5.0, min(to_sec, 120.0))
    short_timeout = httpx.Timeout(to_sec)

    try:
        out = await httpx_compat_chat_completion_json(
            client,
            base_url,
            model=model,
            messages=messages,
            options={"temperature": 0.1, "max_tokens": 80, "openai_sidecar_merge_reasoning": True},
            response_format={"type": "json_object"},
            chat_template_kwargs={"enable_thinking": False},
            timeout=short_timeout,
        )
        text = str(out.get("response", "") or "").strip()
        parsed = _parse_json_obj(text)
        if not parsed:
            logger.warning("arlika_wrath_classify_unparseable raw=%r", text[:200])
            return None
        return _coerce_bool(parsed.get("argumentative_quarrel"))
    except (TimeoutError, httpx.HTTPError, OSError, ValueError, TypeError, RuntimeError) as exc:
        logger.warning("arlika_wrath_classify_failed err=%s", exc)
        return None


def wrath_classify_model_from_env(fallback: str) -> str:
    m = os.getenv("EWA_COMPANION_WRATH_CLASSIFY_MODEL", "").strip()
    return m or (fallback or "").strip() or "mistral"


__all__: tuple[str, ...] = (
    "classify_arlika_wrath_quarrel",
    "wrath_classify_model_from_env",
)
