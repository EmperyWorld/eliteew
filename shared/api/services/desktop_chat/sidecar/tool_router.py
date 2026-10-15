# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# HTTP Tool Router sidecar for Desktop AI Chat — one FC call maps user turn → tool decision.
# Invariants:
# - Never executes side effects; parsing failures → None (caller uses legacy run_tool_loop).
# - Env/admin default mode is ``partial`` (image+web when allowed); ``full`` is opt-in; ``shadow`` log-only.
# Related:
# - documentation/product/DESKTOP-AI-CHAT-TOOL-ROUTER.md
# - api/services/desktop_chat/sidecar/tool_router_dispatch.py
# ---
"""Dedicated function-calling router for Desktop AI Chat tool dispatch."""

from __future__ import annotations

import json
import logging
import os
import re
from collections.abc import Mapping
from typing import Any

import httpx

from api.schemas.pydantic.desktop_tool_router import (
    DESKTOP_EXECUTE_TOOL_FETCH,
    DESKTOP_EXECUTE_TOOL_IMAGE,
    DESKTOP_EXECUTE_TOOL_KB,
    DESKTOP_EXECUTE_TOOL_WEB,
    ROUTER_FULL_TOOLS,
    ROUTER_PARTIAL_TOOLS,
    DesktopToolRouterResultV1,
)
from api.services.desktop_chat.kbsew_search_settings import (
    kbsew_tool_visible_for_agent,
    resolve_kbsew_search_settings,
)
from api.services.desktop_chat.llm.runtime import resolve_desktop_tool_router_runtime
from api.utils.llm_openai_compat_http import httpx_compat_chat_completion_json

logger = logging.getLogger(__name__)

_DESKTOP_ROUTE_TURN_BASE_TOOL: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "desktop_route_turn",
        "description": (
            "Select exactly one desktop chat action for this user turn, or chat_only when no tool is needed."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "tool": {
                    "type": "string",
                    "enum": ["chat_only", "generate_image", "fetch_url", "web_search", "knowledge_base_search"],
                },
                "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                "prompt": {
                    "type": "string",
                    "description": "Image scene description in Russian when tool=generate_image.",
                },
                "aspect_ratio": {
                    "type": "string",
                    "description": "Optional aspect ratio for image: 1:1, 16:9, 9:16, 4:3, 3:4.",
                },
                "url": {"type": "string", "description": "HTTP(S) URL when tool=fetch_url."},
                "query": {
                    "type": "string",
                    "description": "Web search query in Russian when tool=web_search.",
                },
                "barrel_id": {
                    "type": "string",
                    "description": "KBSEW barrel UUID when tool=knowledge_base_search.",
                },
                "reason": {"type": "string"},
            },
            "required": ["tool", "confidence"],
        },
    },
}


def _desktop_route_turn_tool(*, tools_enabled: Mapping[str, bool]) -> dict[str, Any]:
    allowed = ["chat_only"]
    if tools_enabled.get("image"):
        allowed.append("generate_image")
    if tools_enabled.get("fetch_url"):
        allowed.append("fetch_url")
    if tools_enabled.get("web_search"):
        allowed.append("web_search")
    if tools_enabled.get("knowledge_base_search"):
        allowed.append("knowledge_base_search")
    tool = dict(_DESKTOP_ROUTE_TURN_BASE_TOOL)
    fn = dict(tool["function"])
    params = dict(fn["parameters"])
    props = dict(params["properties"])
    props["tool"] = {"type": "string", "enum": allowed}
    params["properties"] = props
    fn["parameters"] = params
    tool["function"] = fn
    return tool


_JSON_FENCE_RE = re.compile(r"^\s*```(?:json)?\s*(?P<body>.*?)\s*```\s*$", re.DOTALL | re.IGNORECASE)


def desktop_tool_router_enabled(defaults: Mapping[str, Any] | None = None) -> bool:
    if defaults is not None and "desktop_tool_router_enabled" in defaults:
        if not bool(defaults.get("desktop_tool_router_enabled")):
            return False
    else:
        raw = os.getenv("DESKTOP_AI_CHAT_TOOL_ROUTER_ENABLED", "").strip().lower()
        if raw not in ("1", "true", "yes", "on"):
            return False
    mode = desktop_tool_router_mode(defaults)
    return mode in ("shadow", "partial", "full")


def desktop_tool_router_mode(defaults: Mapping[str, Any] | None = None) -> str:
    if defaults is not None and isinstance(defaults.get("desktop_tool_router_mode"), str):
        return str(defaults.get("desktop_tool_router_mode")).strip().lower()
    # Wave 5 / desktop-ai-chat-013: default partial (image+web when allowed); full remains opt-in.
    return os.getenv("DESKTOP_AI_CHAT_TOOL_ROUTER_MODE", "partial").strip().lower()


def desktop_tool_router_min_confidence(defaults: Mapping[str, Any] | None = None) -> float:
    raw = None
    if defaults is not None:
        raw = defaults.get("desktop_tool_router_min_confidence")
    if raw is None:
        raw = os.getenv("DESKTOP_AI_CHAT_TOOL_ROUTER_MIN_CONFIDENCE", "0.62")
    try:
        v = float(raw)  # type: ignore[arg-type]
    except (TypeError, ValueError):  # fmt: skip
        v = 0.62
    return max(0.0, min(1.0, v))


def router_tool_allowed_in_current_mode(tool: str, *, mode: str) -> bool:
    if tool == "chat_only":
        return False
    if mode == "full":
        return tool in ROUTER_FULL_TOOLS
    if mode == "partial":
        return tool in ROUTER_PARTIAL_TOOLS
    return False


def _router_system_prompt(*, tools_enabled: Mapping[str, bool], kbsew_router_hint: str = "") -> str:
    parts = [
        "You are the EliteEW Desktop AI Chat **tool router**. User language: Russian.",
        "Pick exactly one tool via the desktop_route_turn function.",
        "Use chat_only for normal dialogue, opinions, and questions without a concrete tool action.",
    ]
    if tools_enabled.get("image"):
        parts.append(
            "Use generate_image when the user asks to draw, generate, or show a picture/image "
            "(fill prompt with a Russian scene description)."
        )
    if tools_enabled.get("fetch_url"):
        parts.append("Use fetch_url when the user explicitly asks to load or read a specific HTTP(S) URL.")
    if tools_enabled.get("web_search"):
        parts.append(
            "Use web_search when the user asks for current news, fresh facts, prices, events, or anything "
            "that requires looking up information on the internet (fill query with a concise Russian search phrase)."
        )
    if tools_enabled.get("knowledge_base_search"):
        hint = (kbsew_router_hint or "").strip()
        if hint:
            parts.append(hint)
        else:
            parts.append(
                "Use knowledge_base_search when the user asks to search a specific KBSEW knowledge barrel "
                "(fill query and optional barrel_id UUID from context)."
            )
    parts.append("confidence: 0.0-1.0 — how sure you are this tool should run now.")
    return " ".join(parts)


def _parse_router_arguments(raw: str) -> dict[str, Any] | None:
    s = (raw or "").strip()
    if not s:
        return None
    fence = _JSON_FENCE_RE.match(s)
    if fence:
        s = fence.group("body").strip()
    try:
        parsed = json.loads(s)
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None


def _extract_tool_call_arguments(message: Mapping[str, Any]) -> dict[str, Any] | None:
    tool_calls = message.get("tool_calls")
    if not isinstance(tool_calls, list) or not tool_calls:
        return None
    first = tool_calls[0]
    if not isinstance(first, dict):
        return None
    fn = first.get("function")
    if not isinstance(fn, dict):
        return None
    args_raw = fn.get("arguments")
    if isinstance(args_raw, dict):
        return args_raw
    if isinstance(args_raw, str):
        return _parse_router_arguments(args_raw)
    return None


def parse_desktop_tool_router_payload(blob: Mapping[str, Any]) -> DesktopToolRouterResultV1 | None:
    tool_raw = blob.get("tool")
    if tool_raw is None:
        tool_raw = blob.get("intent")
    tool = str(tool_raw or "chat_only").strip().lower()
    valid = {"chat_only", "generate_image", "fetch_url", "web_search", "knowledge_base_search"}
    if tool not in valid:
        return None
    try:
        conf = float(blob.get("confidence", 0.0))
    except (TypeError, ValueError):  # fmt: skip
        conf = 0.0
    conf = max(0.0, min(1.0, conf))

    def _opt_str(key: str) -> str | None:
        v = blob.get(key)
        if v is None:
            return None
        s = str(v).strip()
        return s or None

    return DesktopToolRouterResultV1(
        tool=tool,  # type: ignore[arg-type]
        confidence=conf,
        prompt=_opt_str("prompt"),
        aspect_ratio=_opt_str("aspect_ratio"),
        url=_opt_str("url"),
        query=_opt_str("query"),
        barrel_id=_opt_str("barrel_id"),
        reason=_opt_str("reason"),
    )


def router_plan_to_tool_args(plan: DesktopToolRouterResultV1) -> tuple[str, dict[str, Any]]:
    if plan.tool == "generate_image":
        args: dict[str, Any] = {"prompt": (plan.prompt or "").strip()}
        if plan.aspect_ratio:
            args["aspect_ratio"] = plan.aspect_ratio.strip()
        return DESKTOP_EXECUTE_TOOL_IMAGE, args
    if plan.tool == "fetch_url":
        return DESKTOP_EXECUTE_TOOL_FETCH, {"url": (plan.url or "").strip()}
    if plan.tool == "web_search":
        return DESKTOP_EXECUTE_TOOL_WEB, {"query": (plan.query or "").strip()}
    if plan.tool == "knowledge_base_search":
        return DESKTOP_EXECUTE_TOOL_KB, {
            "query": (plan.query or "").strip(),
            "barrel_id": (plan.barrel_id or "").strip(),
        }
    return "", {}


async def run_desktop_tool_router(
    *,
    user_excerpt: str,
    history_tail: str,
    defaults: Mapping[str, Any],
    web_search_allowed: bool = False,
    kbsew_agent: str = "desktop",
    kbsew_registry: list[Any] | None = None,
) -> DesktopToolRouterResultV1 | None:
    """One FC call to shared stack2 tool-router sidecar."""

    base, model, max_tok, num_ctx, timeout_sec = resolve_desktop_tool_router_runtime()
    if not base:
        return None

    tools_enabled = {
        "image": bool(defaults.get("tools_image_enabled", True)),
        "fetch_url": bool(defaults.get("tools_fetch_url_enabled", True)),
        "web_search": bool(web_search_allowed) and bool(defaults.get("tools_web_search_enabled", False)),
        "knowledge_base_search": kbsew_tool_visible_for_agent(resolve_kbsew_search_settings(defaults), kbsew_agent),
    }
    from api.services.kbsew.kbsew_orchestration import build_kbsew_router_hint

    kb_hint = build_kbsew_router_hint(kbsew_registry or [])
    system = _router_system_prompt(tools_enabled=tools_enabled, kbsew_router_hint=kb_hint)
    hist = (history_tail or "").strip() or "(нет истории)"
    user_block = f"Краткая история:\n{hist}\n\nПоследнее сообщение пользователя:\n{(user_excerpt or '').strip()[:6000]}"
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": user_block},
    ]

    try:
        async with httpx.AsyncClient() as client:
            out = await httpx_compat_chat_completion_json(
                client,
                base,
                model=model,
                messages=messages,
                options={
                    "temperature": 0.05,
                    "num_predict": max_tok,
                    "num_ctx": num_ctx,
                    "openai_visible_assistant_content_only": True,
                },
                extra_params={
                    "tools": [_desktop_route_turn_tool(tools_enabled=tools_enabled)],
                    "tool_choice": "required",
                },
                chat_template_kwargs={"enable_thinking": False},
                timeout=httpx.Timeout(timeout_sec),
            )
    except Exception as ex:
        logger.warning("[STEP] desktop_tool_router http_failed: %s", ex)
        return None

    message = out.get("message")
    if not isinstance(message, dict):
        raw_text = str(out.get("response") or "").strip()
        blob = _parse_router_arguments(raw_text) if raw_text else None
        if blob is None:
            return None
        return parse_desktop_tool_router_payload(blob)

    args = _extract_tool_call_arguments(message)
    if args is None:
        raw_text = str(message.get("content") or out.get("response") or "").strip()
        blob = _parse_router_arguments(raw_text) if raw_text else None
        if blob is None:
            return None
        return parse_desktop_tool_router_payload(blob)

    return parse_desktop_tool_router_payload(args)
