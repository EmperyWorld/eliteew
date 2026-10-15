# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
#   Resolve Desktop AI Chat LLM runtime (base URL, model, caps) and stream via httpx_compat.
# Invariants:
#   - Gemma 4 on stack2-llama-chat: enable_thinking=false + reasoning_format=none (same as companion).
#   - CoT/reasoning never surfaced as visible reply (openai_visible_assistant_content_only).
#   - Ensemble blueprint streams through ``desktop_stream_chat_completion`` (httpx_compat + stack2 slot gate).
#   - ``defaults.desktop_llm_job_class=deep`` (agentic experts) routes to ``LLAMA_DEEP_URL``; missing deep → interactive.
# Related:
#   - api/utils/llm_openai_compat_http.py
#   - documentation/platform/STACK2-LLM-CONTRACT.md
#   - api/services/desktop_chat/service.py
# ---
"""Desktop AI Chat LLM runtime and streaming helpers."""

from __future__ import annotations

import os
from collections.abc import AsyncIterator, Mapping
from typing import Any

import httpx

from api.core.unified_config import unified_settings
from api.services.desktop_chat.generation_budgets_settings import (
    desktop_chat_num_predict,
    desktop_chat_timeout_sec,
)
from api.services.llm_runtime.job_class import LlmJobClass, resolve_llm_base_url
from api.utils.llm_openai_compat_http import (
    LLAMA_COMPAT_MAX_NUM_CTX,
    httpx_compat_chat_completion_json,
    httpx_compat_chat_completion_stream,
)
from api.utils.tool_router_sidecar_runtime import (
    shared_tool_router_base_url,
    shared_tool_router_model,
)

# Align with EWA companion on the same Gemma chat server (productive long-form, low CoT waste).
_DEFAULT_CHAT_TEMPERATURE = 0.55


def _env_truthy(name: str, default: str = "0") -> bool:
    return os.getenv(name, default).strip().lower() in ("1", "true", "yes", "on")


def desktop_json_response_format_enabled(defaults: Mapping[str, Any] | None = None) -> bool:
    """Native stack2 json_object for desktop JSON sidecars; opt-out via env or defaults."""
    if defaults and "desktop_json_response_format" in defaults:
        return bool(defaults.get("desktop_json_response_format"))
    return _env_truthy("DESKTOP_AI_CHAT_JSON_RESPONSE_FORMAT", "1")


def desktop_chat_template_kwargs() -> dict[str, Any]:
    """Gemma 4 chat-template kwargs for stack2-llama-chat (thinking off by default)."""
    return {"enable_thinking": False}


def desktop_chat_extra_params() -> dict[str, Any]:
    """OpenAI-compat extra_params so reasoning channel stays off on Gemma 4."""
    return {"reasoning_format": "none"}


def resolve_desktop_chat_temperature(defaults: Mapping[str, Any] | None = None) -> float:
    raw = None
    if defaults is not None and defaults.get("desktop_chat_temperature") is not None:
        raw = defaults.get("desktop_chat_temperature")
    try:
        temp = float(
            raw
            if raw is not None
            else os.getenv("DESKTOP_AI_CHAT_TEMPERATURE", str(_DEFAULT_CHAT_TEMPERATURE)).strip()
            or str(_DEFAULT_CHAT_TEMPERATURE)
        )
    except (TypeError, ValueError):  # fmt: skip
        temp = _DEFAULT_CHAT_TEMPERATURE
    return max(0.0, min(temp, 1.5))


def resolve_desktop_chat_llm_runtime(
    *,
    model: str | None = None,
    defaults: Mapping[str, Any] | None = None,
    job_class: LlmJobClass | str | None = "interactive",
) -> tuple[str, str, int, int | None, float]:
    """base, model, num_predict, num_ctx, timeout_sec."""

    from api.services.llm_runtime.job_class import DeepLlmUnavailableError

    defaults_map: dict[str, Any] = dict(defaults) if defaults else {}
    requested = job_class
    if requested in (None, "interactive") and defaults_map.get("desktop_llm_job_class"):
        requested = str(defaults_map.get("desktop_llm_job_class") or "interactive")
    jc = str(requested or "interactive").strip().lower()
    try:
        base = resolve_llm_base_url(job_class=jc)
    except DeepLlmUnavailableError:
        import logging

        logging.getLogger(__name__).info(
            "[STEP] desktop_llm_deep_fallback reason=url_unavailable requested=%s",
            jc,
        )
        base = resolve_llm_base_url(job_class="interactive")
        jc = "interactive"
    if not base:
        base = unified_settings.llama_url.strip().rstrip("/")
    model_raw = (
        (model or "").strip()
        or (str(defaults_map.get("default_llama_model")).strip() if defaults_map.get("default_llama_model") else "")
        or os.getenv("DESKTOP_AI_CHAT_MODEL", "").strip()
        or unified_settings.bi_ai_model
        or unified_settings.default_ai_model
        or "mistral"
    ).strip()

    if defaults_map.get("desktop_chat_num_predict") is None:
        env_np = os.getenv("DESKTOP_AI_CHAT_NUM_PREDICT", "").strip()
        if env_np:
            defaults_map["desktop_chat_num_predict"] = env_np
    num_predict = desktop_chat_num_predict(defaults_map)

    try:
        raw_ctx = os.getenv("DESKTOP_AI_CHAT_NUM_CTX", "0").strip() or "0"
        num_ctx_raw = int(raw_ctx)
    except ValueError:
        num_ctx_raw = 0
    num_ctx: int | None = None
    if num_ctx_raw > 0:
        num_ctx = max(2048, min(num_ctx_raw, LLAMA_COMPAT_MAX_NUM_CTX))

    if defaults_map.get("desktop_chat_timeout_sec") is None:
        env_to = os.getenv("DESKTOP_AI_CHAT_TIMEOUT_SEC", "").strip()
        if env_to:
            defaults_map["desktop_chat_timeout_sec"] = env_to
    timeout_sec = float(desktop_chat_timeout_sec(defaults_map))
    if jc in ("deep", "research", "heavy"):
        # Dense 31B steps need headroom vs interactive MoE.
        timeout_sec = max(timeout_sec, 180.0)
        timeout_sec = min(timeout_sec, 600.0)

    return base, model_raw, num_predict, num_ctx, timeout_sec


def resolve_desktop_tool_router_runtime() -> tuple[str, str, int, int, float]:
    """Sidecar base URL, model, max_tokens, num_ctx, timeout_sec."""

    base = shared_tool_router_base_url(primary_url_env="DESKTOP_AI_CHAT_TOOL_ROUTER_URL")
    model = shared_tool_router_model(primary_model_env="DESKTOP_AI_CHAT_TOOL_ROUTER_MODEL")
    try:
        max_tok = int(os.getenv("DESKTOP_AI_CHAT_TOOL_ROUTER_MAX_TOKENS", "512").strip() or "512")
    except ValueError:
        max_tok = 512
    # STACK2-LLM-CONTRACT: tool-router FC budget 64…1024 (do not silent-cap at 128).
    max_tok = max(64, min(max_tok, 1024))

    try:
        num_ctx = int(os.getenv("DESKTOP_AI_CHAT_TOOL_ROUTER_NUM_CTX", "8192").strip() or "8192")
    except ValueError:
        num_ctx = 8192
    num_ctx = max(2048, min(num_ctx, LLAMA_COMPAT_MAX_NUM_CTX))
    try:
        timeout_sec = float(os.getenv("DESKTOP_AI_CHAT_TOOL_ROUTER_TIMEOUT_SEC", "12").strip() or "12")
    except ValueError:
        timeout_sec = 12.0
    timeout_sec = max(3.0, min(timeout_sec, 60.0))
    return base, model, max_tok, num_ctx, timeout_sec


def desktop_http_llm_options(
    *,
    num_predict: int,
    num_ctx: int | None = None,
    temperature: float | None = None,
    defaults: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    temp = temperature if temperature is not None else resolve_desktop_chat_temperature(defaults)
    out: dict[str, Any] = {
        "temperature": temp,
        "num_predict": num_predict,
        "openai_visible_assistant_content_only": True,
    }
    if num_ctx is not None and num_ctx > 0:
        out["num_ctx"] = num_ctx
    return out


async def desktop_stream_chat_completion(
    *,
    messages: list[dict[str, Any]],
    model: str,
    defaults: Mapping[str, Any] | None = None,
    temperature: float | None = None,
    max_tokens: int | None = None,
) -> AsyncIterator[str]:
    """Stream visible assistant text chunks via httpx_compat."""

    base, resolved_model, num_predict, num_ctx, timeout_sec = resolve_desktop_chat_llm_runtime(
        model=model,
        defaults=defaults,
    )
    if max_tokens is not None:
        num_predict = max(256, min(int(max_tokens), num_predict))
    opts = desktop_http_llm_options(
        num_predict=num_predict,
        num_ctx=num_ctx,
        temperature=temperature,
        defaults=defaults,
    )
    timeout = httpx.Timeout(timeout_sec)
    async with httpx.AsyncClient() as client:
        async for piece in httpx_compat_chat_completion_stream(
            client,
            base,
            model=resolved_model,
            messages=messages,
            options=opts,
            timeout=timeout,
            chat_template_kwargs=desktop_chat_template_kwargs(),
            extra_params=desktop_chat_extra_params(),
        ):
            yield piece


async def desktop_chat_completion(
    *,
    messages: list[dict[str, Any]],
    model: str,
    defaults: Mapping[str, Any] | None = None,
    temperature: float | None = None,
    max_tokens: int | None = None,
    chat_template_kwargs: dict[str, Any] | None = None,
    extra_params: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Non-stream chat via httpx_compat; returns compat dict (``response``, token counts)."""

    base, resolved_model, num_predict, num_ctx, timeout_sec = resolve_desktop_chat_llm_runtime(
        model=model,
        defaults=defaults,
    )
    cap = max_tokens if max_tokens is not None else num_predict
    opts = desktop_http_llm_options(
        num_predict=max(32, min(int(cap), num_predict)),
        num_ctx=num_ctx,
        temperature=temperature,
        defaults=defaults,
    )
    timeout = httpx.Timeout(timeout_sec)
    template_kwargs = chat_template_kwargs if chat_template_kwargs is not None else desktop_chat_template_kwargs()
    extras = extra_params if extra_params is not None else desktop_chat_extra_params()
    async with httpx.AsyncClient() as client:
        return await httpx_compat_chat_completion_json(
            client,
            base,
            model=resolved_model,
            messages=messages,
            options=opts,
            timeout=timeout,
            chat_template_kwargs=template_kwargs,
            extra_params=extras,
        )
