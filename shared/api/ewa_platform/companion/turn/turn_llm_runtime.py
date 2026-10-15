# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared companion HTTP LLM runtime env + SSE wire helpers for sync and stream turn entrypoints.
# Invariants:
# - ``openai_visible_assistant_content_only`` stays enabled in HTTP LLM options.
# - Gemma 4 chat template on stack2 llama-chat: default ``enable_thinking=false`` + ``reasoning_format=none``
#   unless ``EWA_COMPANION_CHAT_ENABLE_THINKING=1`` (visible bubble still strips CoT via content-only).
# Related:
# - api/ewa_platform/companion/turn/chat_turn.py
# - api/ewa_platform/companion/turn/turn_dedup.py
# - documentation/product/ewa/EWA-COMPANION-STACK2-OPERATOR.md
# ---

from __future__ import annotations

import json
import os
from collections.abc import Mapping
from typing import Any

from api.core.unified_config import unified_settings
from api.services.llm_runtime.job_class import LlmJobClass, resolve_llm_base_url
from api.utils.llm_openai_compat_http import LLAMA_COMPAT_MAX_NUM_CTX


def env_truthy(raw: str | None) -> bool:
    if raw is None:
        return False
    return str(raw).strip().lower() in ("1", "true", "yes", "on")


def companion_chat_enable_thinking() -> bool:
    """Whether llama-server Gemma 4 template should open a real thought channel (default off)."""

    return env_truthy(os.getenv("EWA_COMPANION_CHAT_ENABLE_THINKING"))


def companion_chat_template_kwargs() -> dict[str, Any]:
    """``chat_template_kwargs`` for Gemma 4 Canonical / Qwen Instruct sidecars on companion paths."""

    return {"enable_thinking": companion_chat_enable_thinking()}


def companion_llm_extra_params() -> dict[str, Any]:
    """OpenAI-compat extras aligned with live llama-chat defaults (reasoning off when not thinking)."""

    if companion_chat_enable_thinking():
        return {}
    return {"reasoning_format": "none"}


def resolved_llm_runtime(
    *,
    job_class: LlmJobClass | str | None = "interactive",
) -> tuple[str, str, int, int | None, float]:
    """Read base/model/num_predict/num_ctx/timeout from env — shared across sync and stream paths."""

    base = resolve_llm_base_url(job_class=job_class)
    if not base:
        base = unified_settings.llama_url.strip().rstrip("/")
    model_raw = (
        os.getenv("EWA_COMPANION_CHAT_MODEL", "").strip()
        or os.getenv("EWA_ORCH_LLM_MODEL", "").strip()
        or unified_settings.default_ai_model
        or "mistral"
    ).strip()
    try:
        num_predict = int(os.getenv("EWA_COMPANION_CHAT_NUM_PREDICT", "4096").strip() or "4096")
    except ValueError:
        num_predict = 4096
    num_predict = max(256, min(num_predict, 32000))
    try:
        raw_ctx = os.getenv("EWA_COMPANION_CHAT_NUM_CTX", "262144").strip() or "262144"
        num_ctx_raw = int(raw_ctx)
    except ValueError:
        num_ctx_raw = LLAMA_COMPAT_MAX_NUM_CTX
    num_ctx: int | None = None if num_ctx_raw <= 0 else max(2048, min(num_ctx_raw, LLAMA_COMPAT_MAX_NUM_CTX))
    try:
        timeout_sec = float(os.getenv("EWA_COMPANION_CHAT_TIMEOUT_SEC", "180").strip() or "180")
    except ValueError:
        timeout_sec = 180.0
    timeout_sec = max(30.0, min(timeout_sec, 600.0))
    return base, model_raw, num_predict, num_ctx, timeout_sec


def companion_http_llm_options(num_predict: int, num_ctx: int | None) -> dict[str, Any]:
    """HTTP LLM ``options``: temperature + output cap; optional Llama ``num_ctx``."""

    out: dict[str, Any] = {
        "temperature": 0.55,
        "num_predict": num_predict,
        "openai_visible_assistant_content_only": True,
    }
    if num_ctx is not None and num_ctx > 0:
        out["num_ctx"] = num_ctx
    return out


def companion_transform_sse_payload(transform_kind: str | None) -> dict[str, Any]:
    """SSE ``transform`` body for Arlika clip / EWA restore / v2 dual-mode clips."""

    k = (transform_kind or "arlika").strip().lower()
    if k == "ewa_restore":
        return {"kind": "ewa_restore", "show_dramatic_video": True}
    if k == "ewa_to_arly":
        return {"kind": "ewa_to_arly", "show_dramatic_video": True}
    if k == "arly_to_ewa":
        return {"kind": "arly_to_ewa", "show_dramatic_video": True}
    return {"kind": "arlika", "show_dramatic_video": True}


def sse_event(event_name: str, payload: Mapping[str, Any]) -> str:
    """Format one SSE event line block: ``event: …\\ndata: <json>\\n\\n``."""

    body = json.dumps(dict(payload), ensure_ascii=False, default=str)
    return f"event: {event_name}\ndata: {body}\n\n"


__all__ = (
    "companion_chat_enable_thinking",
    "companion_chat_template_kwargs",
    "companion_http_llm_options",
    "companion_llm_extra_params",
    "companion_transform_sse_payload",
    "env_truthy",
    "resolved_llm_runtime",
    "sse_event",
)
