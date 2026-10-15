# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
#   Non-stream JSON object LLM calls for Desktop AI Chat sidecars (classifier, orchestrator, picker).
# Invariants:
#   - Never raises on parse failure; returns empty dict and logs debug.
#   - Thinking disabled; always requests json_object unless desktop_json_response_format disabled.
# Related:
#   - api/utils/llm_json_extract.py
#   - api/services/desktop_chat_ensemble/conversational_route.py
# ---
"""JSON sidecar LLM helper for desktop chat ensemble."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from api.services.desktop_chat.llm.runtime import (
    desktop_http_llm_options,
    desktop_json_response_format_enabled,
    resolve_desktop_chat_llm_runtime,
)
from api.utils.llm_json_extract import extract_llm_json_payload
from api.utils.llm_openai_compat_http import httpx_compat_chat_completion_json

logger = logging.getLogger(__name__)


async def desktop_llm_json_object(
    messages: list[dict[str, Any]],
    *,
    model: str,
    defaults: dict[str, Any] | None = None,
    schema_hint: str = "",
    timeout: float | None = None,
    max_tokens: int = 128,
    temperature: float = 0.05,
) -> dict[str, Any]:
    """Return parsed JSON object from sidecar LLM; {} on failure."""

    defs = defaults or {}
    base, resolved_model, _, num_ctx, default_timeout = resolve_desktop_chat_llm_runtime(
        model=model,
        defaults=defs,
    )
    timeout_sec = timeout if timeout is not None else default_timeout
    opts = desktop_http_llm_options(
        num_predict=max(32, min(max_tokens, 4096)),
        num_ctx=num_ctx,
        temperature=temperature,
    )
    extra: dict[str, Any] = {"reasoning_format": "none"}
    response_format: dict[str, str] | None = None
    if desktop_json_response_format_enabled(defs):
        response_format = {"type": "json_object"}

    msgs = list(messages)
    if schema_hint and msgs and msgs[0].get("role") == "system":
        msgs = [{**msgs[0], "content": f"{msgs[0].get('content', '')}\n\n{schema_hint}"}, *msgs[1:]]

    try:
        async with httpx.AsyncClient() as client:
            out = await httpx_compat_chat_completion_json(
                client,
                base,
                model=resolved_model,
                messages=msgs,
                options=opts,
                response_format=response_format,
                chat_template_kwargs={"enable_thinking": False},
                extra_params=extra,
                timeout=httpx.Timeout(timeout_sec),
            )
    except Exception as ex:
        logger.warning("[STEP] desktop_llm_json_sidecar http_failed: %s", ex)
        return {}

    raw = str(out.get("response") or "").strip()
    if not raw:
        return {}

    try:
        parsed = extract_llm_json_payload(raw)
        if isinstance(parsed, dict):
            return parsed
    except ValueError:
        pass

    logger.debug("desktop_llm_json_sidecar parse_miss chars=%s", len(raw))
    return {}
