# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Workflow DAG AI helpers: vision analysis, summarization, classification via stack2 LLM.
# Invariants:
# - Large upstream text is truncated at the tool boundary before LLM calls (not stored twice in DAG state).
# - Vision reuses companion attachment validation + multimodal/OCR fallback pipeline.
# Related:
# - api/ewa_platform/companion/turn/vision_attachment.py
# - api/ewa_platform/companion/orchestration/tool_registry.py
# ---

from __future__ import annotations

import base64
import logging
import os
from collections.abc import Mapping
from typing import Any

import httpx

from api.ewa_platform.companion.contracts.vision_formats import companion_vision_mime_from_magic
from api.ewa_platform.companion.orchestration.tool_registry import ToolContext
from api.ewa_platform.companion.turn.companion_image_ocr_analyze import (
    build_llm_user_line_with_image_ocr,
    companion_ocr_text_from_image_attachment,
    format_companion_image_ocr_context,
)
from api.ewa_platform.companion.turn.turn_llm_runtime import (
    companion_chat_template_kwargs,
    companion_http_llm_options,
    companion_llm_extra_params,
    resolved_llm_runtime,
)
from api.ewa_platform.companion.turn.vision_attachment import (
    build_openai_user_content_with_image,
    companion_vision_enabled,
    companion_vision_multimodal_enabled,
    resolve_companion_vision_data_url,
)
from api.utils.llm_openai_compat_http import httpx_compat_chat_completion_json

logger = logging.getLogger(__name__)

_VISION_FETCH_MAX_BYTES = 4 * 1024 * 1024


def workflow_ai_max_input_chars(kind: str) -> int:
    env_map = {
        "summarize": "EWA_COMPANION_WF_LLM_SUMMARIZER_MAX_INPUT_CHARS",
        "classify": "EWA_COMPANION_WF_LLM_CLASSIFIER_MAX_INPUT_CHARS",
        "vision_prompt": "EWA_COMPANION_WF_VISION_ANALYZER_MAX_PROMPT_CHARS",
    }
    defaults = {"summarize": 24_000, "classify": 8_000, "vision_prompt": 2_000}
    raw = os.getenv(env_map[kind], str(defaults[kind])).strip() or str(defaults[kind])
    try:
        value = int(raw)
    except ValueError:
        value = defaults[kind]
    return max(256, min(value, 128_000))


def truncate_workflow_text(text: str, *, max_chars: int) -> str:
    body = str(text or "").strip()
    if len(body) <= max_chars:
        return body
    return body[: max_chars - 20].rstrip() + "\n… [truncated]"


def _first_text(*values: Any) -> str:
    for value in values:
        text = str(value or "").strip()
        if text:
            return text
    return ""


async def _fetch_image_attachment_from_url(image_url: str) -> dict[str, Any]:
    url = str(image_url or "").strip()
    if not url:
        msg = "image_url_required"
        raise ValueError(msg)
    timeout = httpx.Timeout(30.0)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        response = await client.get(url)
        response.raise_for_status()
        data = response.content
    if len(data) > _VISION_FETCH_MAX_BYTES:
        msg = "image_url_too_large"
        raise ValueError(msg)
    mime = companion_vision_mime_from_magic(data)
    if mime is None:
        msg = "image_url_unsupported_format"
        raise ValueError(msg)
    return {
        "mime_type": mime,
        "data_base64": base64.b64encode(data).decode("ascii"),
    }


def _attachment_from_mapping(raw: Mapping[str, Any]) -> dict[str, Any] | None:
    if not raw:
        return None
    if str(raw.get("data_base64") or raw.get("dataBase64") or "").strip():
        return {
            "mime_type": str(raw.get("mime_type") or raw.get("mimeType") or "image/jpeg"),
            "data_base64": str(raw.get("data_base64") or raw.get("dataBase64") or ""),
        }
    return None


async def resolve_vision_attachment_from_args(
    args: Mapping[str, Any],
    ctx: ToolContext,
) -> dict[str, Any]:
    nested = args.get("attachment")
    if isinstance(nested, Mapping):
        built = _attachment_from_mapping(nested)
        if built is not None:
            return built

    built = _attachment_from_mapping(args)
    if built is not None:
        return built

    image_url = _first_text(args.get("image_url"), args.get("url"))
    if image_url:
        return await _fetch_image_attachment_from_url(image_url)

    attachment_id = _first_text(args.get("attachment_id"))
    ctx_attachment = ctx.image_attachment if isinstance(ctx.image_attachment, Mapping) else None
    if attachment_id and ctx_attachment is not None:
        ctx_id = _first_text(ctx_attachment.get("attachment_id"), ctx_attachment.get("id"))
        if not ctx_id or ctx_id == attachment_id:
            built = _attachment_from_mapping(ctx_attachment)
            if built is not None:
                return built

    msg = "vision_input_required"
    raise ValueError(msg)


async def _chat_completion_text(
    *,
    system_prompt: str,
    user_content: str | list[dict[str, Any]],
    temperature: float,
    max_tokens: int,
) -> str:
    base_url, model, num_predict, num_ctx, timeout_sec = resolved_llm_runtime()
    timeout = httpx.Timeout(timeout_sec)
    options = companion_http_llm_options(min(max_tokens, num_predict), num_ctx)
    options["temperature"] = temperature
    options["max_tokens"] = min(max_tokens, num_predict)
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content},
    ]
    async with httpx.AsyncClient(timeout=timeout) as client:
        out = await httpx_compat_chat_completion_json(
            client,
            base_url,
            model=model,
            messages=messages,
            options=options,
            timeout=timeout,
            chat_template_kwargs=companion_chat_template_kwargs(),
            extra_params=companion_llm_extra_params() or None,
        )
    return str(out.get("response") or "").strip()


async def run_vision_analysis(
    args: Mapping[str, Any],
    ctx: ToolContext,
) -> str:
    if not companion_vision_enabled():
        msg = "companion_vision_disabled"
        raise ValueError(msg)

    attachment = await resolve_vision_attachment_from_args(args, ctx)
    prompt = truncate_workflow_text(
        _first_text(args.get("prompt"), args.get("question"), args.get("user_line"), ctx.user_line)
        or "Опиши, что на изображении.",
        max_chars=workflow_ai_max_input_chars("vision_prompt"),
    )

    if companion_vision_multimodal_enabled():
        data_url = resolve_companion_vision_data_url(attachment)
        user_content: str | list[dict[str, Any]] = build_openai_user_content_with_image(prompt, data_url)
        system = (
            "You analyze a single image for a workflow automation step. "
            "Reply with a concise factual description in the same language as the prompt."
        )
        return await _chat_completion_text(
            system_prompt=system,
            user_content=user_content,
            temperature=0.2,
            max_tokens=1024,
        )

    ocr_text = await companion_ocr_text_from_image_attachment(attachment)
    ocr_context = format_companion_image_ocr_context(ocr_text=ocr_text)
    user_line = build_llm_user_line_with_image_ocr(user_line=prompt, image_ocr_context=ocr_context)
    system = (
        "You analyze image content from OCR text for a workflow step. "
        "Describe what is visible; if OCR is empty, state the limitation briefly."
    )
    return await _chat_completion_text(
        system_prompt=system,
        user_content=user_line,
        temperature=0.2,
        max_tokens=1024,
    )


async def run_llm_summarize(args: Mapping[str, Any], ctx: ToolContext) -> str:
    _ = ctx
    source = truncate_workflow_text(
        _first_text(args.get("text"), args.get("body"), args.get("reply"), args.get("prompt")),
        max_chars=workflow_ai_max_input_chars("summarize"),
    )
    if not source:
        msg = "summarize_text_required"
        raise ValueError(msg)
    instruction = _first_text(args.get("instruction")) or "Summarize the text clearly and preserve key facts."
    system = (
        "You compress long workflow documents into concise summaries. "
        "Output summary prose only — no markdown fences, no channel/thought control tags, "
        "no XML-like markup."
    )
    user_payload = f"Instruction: {instruction}\n\nText:\n{source}"
    return await _chat_completion_text(
        system_prompt=system,
        user_content=user_payload,
        temperature=0.15,
        max_tokens=2048,
    )


async def run_llm_classify(args: Mapping[str, Any], ctx: ToolContext) -> tuple[str, bool, str]:
    _ = ctx
    source = truncate_workflow_text(
        _first_text(args.get("text"), args.get("body"), args.get("reply")),
        max_chars=workflow_ai_max_input_chars("classify"),
    )
    if not source:
        msg = "classify_text_required"
        raise ValueError(msg)
    categories = _first_text(args.get("categories"), args.get("labels")) or "positive,negative,neutral"
    rules = _first_text(args.get("rules"), args.get("contains"))
    system = (
        "Classify workflow text into exactly one category from the provided list. "
        "Reply as two lines:\n- category: <one label>\n- matched: <true or false>"
    )
    user_payload = f"Categories: {categories}\nRules: {rules or 'none'}\n\nText:\n{source}"
    raw = await _chat_completion_text(
        system_prompt=system,
        user_content=user_payload,
        temperature=0.0,
        max_tokens=256,
    )
    category = "unknown"
    matched = False
    for line in raw.splitlines():
        lower = line.strip().lower()
        if lower.startswith("- category:") or lower.startswith("category:"):
            category = line.split(":", 1)[-1].strip() or category
        if lower.startswith("- matched:") or lower.startswith("matched:"):
            tail = line.split(":", 1)[-1].strip().lower()
            matched = tail in {"true", "1", "yes"}
    analysis = f"category={category}; matched={matched}"
    return category, matched, analysis


__all__ = (
    "resolve_vision_attachment_from_args",
    "run_llm_classify",
    "run_llm_summarize",
    "run_vision_analysis",
    "truncate_workflow_text",
    "workflow_ai_max_input_chars",
)
