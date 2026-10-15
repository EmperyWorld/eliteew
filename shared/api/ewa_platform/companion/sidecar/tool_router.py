# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# HTTP **Tool Router** sidecar for EWA companion — one structured FC call (Qwen3-class model on stack2) maps
# ``user_line`` → ``CompanionToolRouterResultV1`` without CoT chat fallback.
# Invariants:
# - Never executes side effects; parsing failures → ``None`` (caller uses legacy regex / intent planner / main LLM).
# - ``temperature`` low, ``max_tokens`` capped; thinking mode disabled via ``chat_template_kwargs`` when supported.
# - Costly tools (music/image/presentation) do **not** set ``_tool_router_bypass_line_match`` — handlers keep line gates.
# Related:
# - documentation/product/ewa/EWA-COMPANION-TOOL-ROUTER.md
# - api/ewa_platform/companion/orchestration/tool_router_dispatch.py
# ---
"""Dedicated function-calling router for EWA companion tool dispatch."""

from __future__ import annotations

import json
import logging
import os
import re
import time
from collections.abc import Mapping
from typing import Any, Final, get_args

import httpx

from api.ewa_platform.companion.orchestration.tool_result_utils import as_mapping_dict
from api.ewa_platform.schemas.pydantic.companion_tool_router import (
    CompanionRouterTool,
    CompanionToolRouterResultV1,
)
from api.utils.llm_openai_compat_http import httpx_compat_chat_completion_json
from api.utils.tool_router_sidecar_runtime import (
    shared_tool_router_base_url,
    shared_tool_router_model,
)

logger = logging.getLogger(__name__)

_tool_router_disabled_until_monotonic = 0.0

# Expensive / irreversible side-effect tools: keep handler line-match gates (no router bypass).
_COSTLY_ROUTER_TOOLS_REQUIRE_LINE_MATCH: Final[frozenset[str]] = frozenset(
    {
        "music_generation",
        "music_generation_xl_base",
        "music_xl_base_interactive",
        "music_studio_open",
        "image_generation",
        "presentation_generation",
        "calendar_v1",
    }
)

_COMPANION_ROUTE_TURN_OPENAI_TOOL: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "companion_route_turn",
        "description": (
            "Select exactly one companion server tool for this user turn, or chat_only when no executable action."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "intent": {
                    "type": "string",
                    "enum": [
                        "chat_only",
                        "plan_v1",
                        "plan_task_complete_v1",
                        "calendar_v1",
                        "check_task_status",
                        "file_rewrite",
                        "music_generation",
                        "music_xl_base_interactive",
                        "music_generation_xl_base",
                        "operations_status",
                        "operation_cancel",
                        "image_generation",
                        "presentation_generation",
                        "social_post_compose",
                        "music_studio_open",
                        "theme_set",
                        "app_open",
                        "file_create",
                        "file_rename",
                        "file_delete",
                        "doc_insert",
                        "paperless_import",
                        "catalog_list",
                        "catalog_discuss",
                        "file_open",
                    ],
                },
                "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                "theme": {"type": "string"},
                "style": {"type": "string"},
                "autoplay": {"type": "boolean"},
                "app_component": {"type": "string"},
                "prompt": {"type": "string"},
                "aspect_ratio": {"type": "string"},
                "image_tool_mode": {"type": "string"},
                "source_unified_content_id": {"type": "string"},
                "doc_file_name": {"type": "string"},
                "doc_body_text": {"type": "string"},
                "insert_source_file_query": {"type": "string"},
                "rename_old_query": {"type": "string"},
                "rename_new_name": {"type": "string"},
                "delete_file_query": {"type": "string"},
                "file_query": {"type": "string"},
                "unified_content_id": {"type": "string"},
                "paperless_id": {"type": "integer", "minimum": 1},
                "topic": {"type": "string"},
                "title": {"type": "string"},
                "num_slides": {"type": "integer", "minimum": 1, "maximum": 30},
                "presentation_theme": {"type": "string"},
                "default_slide_layout": {"type": "string"},
                "run_id": {"type": "string"},
                "task_id": {"type": "string"},
                "understood_summary_ru": {"type": "string"},
                "understood_summary_en": {"type": "string"},
            },
            "required": ["intent", "confidence"],
        },
    },
}

_JSON_FENCE_RE = re.compile(r"^\s*```(?:json)?\s*(?P<body>.*?)\s*```\s*$", re.DOTALL | re.IGNORECASE)


def companion_tool_router_enabled() -> bool:
    mode = companion_tool_router_mode()
    if mode not in ("shadow", "partial", "full"):
        return False
    raw = os.getenv("EWA_COMPANION_TOOL_ROUTER_ENABLED", "").strip().lower()
    return raw in ("1", "true", "yes", "on")


def companion_tool_router_mode() -> str:
    return os.getenv("EWA_COMPANION_TOOL_ROUTER_MODE", "shadow").strip().lower()


def companion_tool_router_should_skip_legacy_planner() -> bool:
    """When router actively dispatches (partial/full), skip the legacy JSON intent planner by default."""

    if not companion_tool_router_enabled():
        return False
    if companion_tool_router_mode() == "shadow":
        return False
    force = os.getenv("EWA_COMPANION_INTENT_PLANNER_FORCE", "").strip().lower()
    return force not in ("1", "true", "yes", "on")


def companion_tool_router_min_confidence() -> float:
    try:
        v = float(os.getenv("EWA_COMPANION_TOOL_ROUTER_MIN_CONFIDENCE", "0.62").strip())
    except ValueError:
        v = 0.62
    return max(0.0, min(1.0, v))


def companion_tool_router_base_url() -> str:
    return shared_tool_router_base_url(primary_url_env="EWA_COMPANION_TOOL_ROUTER_URL")


def _tool_router_failure_cooldown_sec() -> float:
    from api.ewa_platform.settings.access import ewa_getenv_float

    return max(0.0, min(ewa_getenv_float("EWA_COMPANION_TOOL_ROUTER_FAILURE_COOLDOWN_SEC", default=60.0), 600.0))


def companion_tool_router_model() -> str:
    return shared_tool_router_model(primary_model_env="EWA_COMPANION_TOOL_ROUTER_MODEL")


def _router_system_prompt(*, russian_user: bool) -> str:
    from api.ewa_platform.companion.prompt_blocks.service import get_prompt_block

    lang = "Russian" if russian_user else "English"
    tmpl = get_prompt_block("sidecar.tool_router")
    if "{lang}" in tmpl:
        return tmpl.replace("{lang}", lang)
    return tmpl.replace("User language preference: English.", f"User language preference: {lang}.")


def _shell_hint_for_router(shell_norm: Mapping[str, Any] | None) -> str:
    if not shell_norm:
        return "No desktop shell snapshot."
    try:
        from api.ewa_platform.companion.storage.doceditor_translate_body import (
            resolve_doc_editor_unified_id_for_shell,
        )

        uc = resolve_doc_editor_unified_id_for_shell(shell_norm)
        if uc:
            return f"DocEditor open unified_content_id={uc}."
    except Exception as exc:  # noqa: BLE001 — hint only; router falls back to generic shell text
        logger.debug(
            "tool_router shell DocEditor hint skipped: %s",
            exc,
            exc_info=True,
        )
    return "Shell snapshot present."


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


def parse_tool_router_payload(blob: Mapping[str, Any]) -> CompanionToolRouterResultV1 | None:
    intent_raw = blob.get("intent")
    if intent_raw is None:
        intent_raw = blob.get("tool")
    intent = str(intent_raw or "chat_only").strip().lower()
    valid: set[str] = set(get_args(CompanionRouterTool))
    if intent not in valid:
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

    def _opt_int(key: str) -> int | None:
        raw = blob.get(key)
        if raw is None:
            return None
        try:
            val = int(raw)
        except TypeError, ValueError:
            return None
        return max(1, min(val, 30))

    autoplay_raw = blob.get("autoplay")
    autoplay: bool | None = None
    if isinstance(autoplay_raw, bool):
        autoplay = autoplay_raw
    elif autoplay_raw is not None:
        autoplay = str(autoplay_raw).strip().lower() in ("1", "true", "yes", "on")

    return CompanionToolRouterResultV1(
        tool=intent,  # type: ignore[arg-type]
        confidence=conf,
        theme=_opt_str("theme"),
        style=_opt_str("style"),
        autoplay=autoplay,
        app_component=_opt_str("app_component"),
        prompt=_opt_str("prompt"),
        aspect_ratio=_opt_str("aspect_ratio"),
        image_tool_mode=_opt_str("image_tool_mode"),
        source_unified_content_id=_opt_str("source_unified_content_id"),
        doc_file_name=_opt_str("doc_file_name"),
        rename_old_query=_opt_str("rename_old_query"),
        rename_new_name=_opt_str("rename_new_name"),
        delete_file_query=_opt_str("delete_file_query"),
        insert_source_file_query=_opt_str("insert_source_file_query"),
        doc_body_text=_opt_str("doc_body_text"),
        file_query=_opt_str("file_query"),
        unified_content_id=_opt_str("unified_content_id"),
        topic=_opt_str("topic"),
        title=_opt_str("title"),
        num_slides=_opt_int("num_slides"),
        presentation_theme=_opt_str("presentation_theme"),
        default_slide_layout=_opt_str("default_slide_layout"),
        run_id=_opt_str("run_id"),
        task_id=_opt_str("task_id"),
        understood_summary_ru=_opt_str("understood_summary_ru") or "",
        understood_summary_en=_opt_str("understood_summary_en") or "",
    )


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


async def run_companion_tool_router(
    client: httpx.AsyncClient,
    *,
    user_line: str,
    shell_norm: Mapping[str, Any] | None,
    russian_user: bool,
    recent_music_theme: str | None = None,
) -> CompanionToolRouterResultV1 | None:
    """Call Tool Router HTTP LLM once; return validated plan or ``None`` on failure."""

    from api.ewa_platform.companion.orchestration.branch_line_gates import user_line_may_probe_tool_router

    if not companion_tool_router_enabled():
        return None
    if not user_line_may_probe_tool_router(user_line):
        logger.info(
            "[STEP] companion_tool_router_skipped reason=chit_chat_or_empty line_chars=%d",
            len((user_line or "").strip()),
        )
        return None
    base = companion_tool_router_base_url()
    if not base:
        return None
    global _tool_router_disabled_until_monotonic
    now = time.monotonic()
    if now < _tool_router_disabled_until_monotonic:
        logger.info(
            "[STEP] companion_tool_router_skipped reason=temporary_cooldown remaining_sec=%.1f",
            _tool_router_disabled_until_monotonic - now,
        )
        return None
    model = companion_tool_router_model()
    try:
        max_tok = int(os.getenv("EWA_COMPANION_TOOL_ROUTER_MAX_TOKENS", "384").strip() or "384")
    except ValueError:
        max_tok = 384
    # Qwen3-4B Instruct FC needs room for companion_route_turn enums + slots (was hard-capped at 128).
    max_tok = max(64, min(max_tok, 1024))
    try:
        timeout_sec = float(os.getenv("EWA_COMPANION_TOOL_ROUTER_TIMEOUT_SEC", "12").strip() or "12")
    except ValueError:
        timeout_sec = 12.0
    timeout_sec = max(3.0, min(timeout_sec, 45.0))
    timeout = httpx.Timeout(timeout_sec)

    shell_hint = _shell_hint_for_router(shell_norm)
    music_hint = ""
    if recent_music_theme:
        music_hint = f"\nRecent music generation theme hint: {recent_music_theme[:200]}"

    messages = [
        {"role": "system", "content": _router_system_prompt(russian_user=russian_user)},
        {
            "role": "user",
            "content": f"Desktop hint: {shell_hint}{music_hint}\n\nUser message:\n{user_line}",
        },
    ]

    try:
        out = await httpx_compat_chat_completion_json(
            client,
            base,
            model=model,
            messages=messages,
            options={
                "temperature": 0.05,
                "num_predict": max_tok,
                "openai_visible_assistant_content_only": True,
            },
            extra_params={
                "tools": [_COMPANION_ROUTE_TURN_OPENAI_TOOL],
                "tool_choice": "required",
                "reasoning_format": "none",
            },
            chat_template_kwargs={"enable_thinking": False},
            timeout=timeout,
        )
        msg = as_mapping_dict(out.get("message"))
        blob = _extract_tool_call_arguments(msg if isinstance(msg, Mapping) else {})
        if blob is None:
            text = str(out.get("response", "") or "").strip()
            blob = _parse_router_arguments(text)
        if not blob:
            logger.info(
                "companion_tool_router_unparseable finish_reason=%s preview=%r",
                out.get("finish_reason"),
                str(out.get("response", ""))[:240],
            )
            return None
        plan = parse_tool_router_payload(blob)
        if plan is None:
            logger.info("companion_tool_router_invalid_payload preview=%r", str(blob)[:240])
            return None
        logger.info(
            "[STEP] companion_tool_router_decision tool=%s confidence=%.2f mode=%s",
            plan.tool,
            float(plan.confidence),
            companion_tool_router_mode(),
        )
        return plan
    except Exception as exc:  # noqa: BLE001
        err_type = type(exc).__name__
        err_text = str(exc).strip() or repr(exc)
        if isinstance(exc, httpx.TimeoutException | httpx.ConnectError):
            _tool_router_disabled_until_monotonic = time.monotonic() + _tool_router_failure_cooldown_sec()
        logger.warning(
            "companion_tool_router_failed err_type=%s err=%s url=%s",
            err_type,
            err_text,
            base.rstrip("/"),
        )
        return None


def router_plan_to_tool_args(plan: CompanionToolRouterResultV1) -> dict[str, Any]:
    """Map router slots → ``tool_registry`` handler args.

    Low-risk tools keep ``_tool_router_bypass_line_match`` so paraphrase coverage works.
    Costly tools (music/image/presentation) omit bypass — existing handler line gates must match.
    """

    tool_name = str(plan.tool or "").strip()
    bypass = tool_name not in _COSTLY_ROUTER_TOOLS_REQUIRE_LINE_MATCH
    args: dict[str, Any] = {"_tool_router_bypass_line_match": bypass}
    if plan.theme:
        args["theme"] = plan.theme
    if plan.style:
        args["style"] = plan.style
    if plan.autoplay is not None:
        args["autoplay"] = plan.autoplay
    if plan.app_component:
        args["app_component"] = plan.app_component
    if plan.prompt:
        args["prompt"] = plan.prompt
    if plan.aspect_ratio:
        args["aspect_ratio"] = plan.aspect_ratio
    if plan.image_tool_mode:
        args["image_tool_mode"] = plan.image_tool_mode
    if plan.source_unified_content_id:
        args["source_unified_content_id"] = plan.source_unified_content_id
    if plan.doc_file_name:
        args["doc_file_name"] = plan.doc_file_name
    if plan.doc_body_text:
        args["doc_body_text"] = plan.doc_body_text
    if plan.insert_source_file_query:
        args["insert_source_file_query"] = plan.insert_source_file_query
    if plan.rename_old_query:
        args["rename_old_query"] = plan.rename_old_query
    if plan.rename_new_name:
        args["rename_new_name"] = plan.rename_new_name
    if plan.delete_file_query:
        args["delete_file_query"] = plan.delete_file_query
    if plan.file_query:
        args["file_query"] = plan.file_query
    if plan.unified_content_id:
        args["unified_content_id"] = plan.unified_content_id
    if plan.topic:
        args["topic"] = plan.topic
    if plan.title:
        args["title"] = plan.title
    if plan.num_slides is not None:
        args["num_slides"] = int(plan.num_slides)
    if plan.presentation_theme:
        args["presentation_theme"] = plan.presentation_theme
    if plan.default_slide_layout:
        args["default_slide_layout"] = plan.default_slide_layout
    if plan.run_id:
        args["run_id"] = plan.run_id
    if plan.task_id:
        args["task_id"] = plan.task_id
    return args


def router_tool_allowed_in_current_mode(tool: CompanionRouterTool) -> bool:
    mode = companion_tool_router_mode()
    if mode == "shadow":
        return False
    if tool == "chat_only":
        return False
    if mode == "partial":
        from api.ewa_platform.schemas.pydantic.companion_tool_router import ROUTER_PARTIAL_TOOLS

        return tool in ROUTER_PARTIAL_TOOLS
    if mode == "full":
        from api.ewa_platform.schemas.pydantic.companion_tool_router import ROUTER_FULL_TOOLS

        return tool in ROUTER_FULL_TOOLS
    return False


__all__ = (
    "companion_tool_router_base_url",
    "companion_tool_router_enabled",
    "companion_tool_router_min_confidence",
    "companion_tool_router_mode",
    "companion_tool_router_model",
    "companion_tool_router_should_skip_legacy_planner",
    "parse_tool_router_payload",
    "router_plan_to_tool_args",
    "router_tool_allowed_in_current_mode",
    "run_companion_tool_router",
)
