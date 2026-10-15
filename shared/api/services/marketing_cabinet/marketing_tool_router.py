# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# HTTP Tool Router sidecar for marketing cabinet tool-agent — OpenAI FC call to LAN stack2
# (e.g. 192.168.1.141:8083) maps user question → marketing whitelist tool_calls.
# Invariants:
# - Never executes side effects; parsing failures → None (caller may 502 unless legacy stack2 fallback env on).
# - Uses MARKETING_AGENT_TOOLS_LLAMA schemas only (not companion_route_turn).
# Related:
# - documentation/product/marketing/MARKETING-TOOL-AGENT.md
# - api/services/marketing_cabinet/marketing_tool_agent_core.py
# ---
"""Dedicated function-calling router for marketing cabinet tool-agent."""

from __future__ import annotations

import logging
import os
from typing import Any

import httpx

from api.routers.marketing_cabinet.marketing_agent_tools import (
    MARKETING_AGENT_TOOLS_LLAMA,
    parse_marketing_tool_calls_from_chat_result,
)
from api.utils.llm_openai_compat_http import httpx_compat_chat_completion_json
from api.utils.tool_router_sidecar_runtime import (
    shared_tool_router_base_url,
    shared_tool_router_model,
    shared_tool_router_url_explicitly_set,
)

logger = logging.getLogger(__name__)


def marketing_tool_router_enabled() -> bool:
    raw = os.getenv("MARKETING_CABINET_TOOL_ROUTER_ENABLED", "").strip().lower()
    if raw in ("0", "false", "off", "no"):
        return False
    if raw in ("1", "true", "yes", "on"):
        return True
    return shared_tool_router_url_explicitly_set(primary_url_env="MARKETING_CABINET_TOOL_ROUTER_URL")


def resolve_marketing_tool_router_runtime() -> tuple[str, str, int, float]:
    """Sidecar base URL, model, max_tokens, timeout_sec."""

    base = shared_tool_router_base_url(primary_url_env="MARKETING_CABINET_TOOL_ROUTER_URL")
    model = shared_tool_router_model(primary_model_env="MARKETING_CABINET_TOOL_ROUTER_MODEL")
    try:
        max_tok = int(os.getenv("MARKETING_CABINET_TOOL_ROUTER_MAX_TOKENS", "512").strip() or "512")
    except ValueError:
        max_tok = 512
    max_tok = max(64, min(max_tok, 2048))
    try:
        timeout_sec = float(os.getenv("MARKETING_CABINET_TOOL_ROUTER_TIMEOUT_SEC", "45").strip() or "45")
    except ValueError:
        timeout_sec = 45.0
    timeout_sec = max(5.0, min(timeout_sec, 120.0))
    return base, model, max_tok, timeout_sec


async def run_marketing_tool_router(
    *,
    system_prompt: str,
    user_prompt: str,
) -> tuple[list[dict[str, Any]], str] | None:
    """
    One FC call to shared tool-router sidecar (LAN .141 or stack2).

    Returns (planned_tools, router_model) or None on failure (caller may fall back to Llama).
    """

    if not marketing_tool_router_enabled():
        return None

    base, model, max_tok, timeout_sec = resolve_marketing_tool_router_runtime()
    if not base:
        return None

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    try:
        async with httpx.AsyncClient() as client:
            out = await httpx_compat_chat_completion_json(
                client,
                base,
                model=model,
                messages=messages,
                options={
                    "temperature": 0.1,
                    "num_predict": max_tok,
                    "openai_visible_assistant_content_only": True,
                },
                extra_params={
                    "tools": MARKETING_AGENT_TOOLS_LLAMA,
                    "tool_choice": "required",
                },
                chat_template_kwargs={"enable_thinking": False},
                timeout=httpx.Timeout(timeout_sec),
            )
    except Exception as ex:
        logger.warning("[STEP] marketing_tool_router http_failed: %s", ex)
        return None

    planned = parse_marketing_tool_calls_from_chat_result(out)
    if not planned:
        logger.warning("[STEP] marketing_tool_router empty_tool_calls model=%s", model)
        return None

    logger.info(
        "[STEP] marketing_tool_router done planned=%s model=%s base=%s",
        [p.get("name") for p in planned],
        model,
        base,
    )
    return planned, model
