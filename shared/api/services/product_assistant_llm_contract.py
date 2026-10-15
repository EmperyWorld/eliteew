# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# JSON-schema контракт ответа llama.cpp для справочника (reply_markdown) и разбор payload.
# Invariants:
# - Генерация через httpx_compat_generate_json + json_schema; без I/O в этом модуле.
# Related:
# - api/routers/product_desktop.py
# - api/utils/llm_openai_compat_http.py
# - documentation/laama-cpp.md
# ---

from __future__ import annotations

import json
import logging
import re
from typing import Any

from api.services.product_assistant_prompt_helpers import (
    ASSISTANT_DEGENERATE_FALLBACK,
    guard_assistant_reply_quality,
    sanitize_assistant_model_reply,
    strip_assistant_json_envelope,
)
from api.utils.llm_json_extract import extract_llm_json_payload, strip_llm_channel_markup, strip_llm_thinking_prefix

logger = logging.getLogger(__name__)

_REPLY_MARKDOWN_JSON_RE = re.compile(
    r'"reply_markdown"\s*:\s*"((?:[^"\\]|\\.)*)(?:"|$)',
    re.DOTALL,
)

ASSISTANT_REPLY_JSON_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "reply_markdown": {
            "type": "string",
            "description": (
                "Единственный ответ помощника пользователю на русском в Markdown: "
                "без префиксов «Пользователь:»/«Помощник:», без имитации следующего хода диалога."
            ),
        },
        "off_topic_refusal": {
            "type": "boolean",
            "description": "True, если вопрос не про продукт EliteEW и ответ — вежливый отказ.",
        },
    },
    "required": ["reply_markdown"],
    "additionalProperties": False,
}

ASSISTANT_JSON_SYSTEM_SUFFIX = (
    "\n\nФормат ответа: верни только один JSON-объект по схеме с полем reply_markdown "
    "(строка Markdown для пользователя). Без текста, комментариев и markdown-ограждений вне JSON."
)


def _json_unescape_string(raw: str) -> str:
    candidate = (raw or "").strip()
    if not candidate:
        return ""
    try:
        parsed = json.loads(f'"{candidate}"')
    except json.JSONDecodeError:
        return candidate.replace("\\n", "\n").replace("\\t", "\t").replace('\\"', '"').replace("\\\\", "\\")
    return parsed if isinstance(parsed, str) else candidate


def salvage_assistant_reply_markdown(raw: str) -> str | None:
    """Best-effort extract reply_markdown from truncated or multi-block JSON output."""
    text = strip_llm_thinking_prefix(strip_llm_channel_markup(raw or "")).strip()
    if not text:
        return None
    probes = [text, *re.findall(r"```(?:json|JSON)?\s*([\s\S]*?)```?", text, flags=re.IGNORECASE)]
    candidates: list[str] = []
    for probe in probes:
        for match in _REPLY_MARKDOWN_JSON_RE.finditer(probe):
            value = _json_unescape_string(match.group(1)).strip()
            if value:
                candidates.append(value)
    if not candidates:
        return None
    candidates.sort(key=len, reverse=True)
    for candidate in candidates:
        cleaned = sanitize_assistant_model_reply(candidate).strip()
        if cleaned:
            return cleaned
    return candidates[0].strip() or None


def _finalize_parsed_reply(reply: str, *, user_message: str, parsed_from_json: bool) -> tuple[str, bool]:
    cleaned = sanitize_assistant_model_reply(reply).strip()
    guarded = guard_assistant_reply_quality(cleaned or reply.strip(), user_message=user_message)
    return guarded, parsed_from_json


def parse_assistant_reply_markdown(raw: str, *, user_message: str = "") -> tuple[str, bool]:
    """Extract ``reply_markdown`` from schema-constrained model output.

    Returns ``(markdown, parsed_from_json)``. On JSON failure, salvage then quality guard.
    """
    text = (raw or "").strip()
    if not text:
        return guard_assistant_reply_quality("", user_message=user_message), False
    try:
        payload = extract_llm_json_payload(text)
    except ValueError:
        logger.debug("[STEP] assistant_llm_json_parse_fallback raw_chars=%s", len(text))
        salvaged = salvage_assistant_reply_markdown(text)
        if salvaged:
            return _finalize_parsed_reply(salvaged, user_message=user_message, parsed_from_json=False)
        legacy = sanitize_assistant_model_reply(strip_assistant_json_envelope(text)).strip()
        return guard_assistant_reply_quality(
            legacy or ASSISTANT_DEGENERATE_FALLBACK,
            user_message=user_message,
        ), False
    if not isinstance(payload, dict):
        salvaged = salvage_assistant_reply_markdown(text)
        if salvaged:
            return _finalize_parsed_reply(salvaged, user_message=user_message, parsed_from_json=False)
        legacy = sanitize_assistant_model_reply(strip_assistant_json_envelope(text)).strip()
        return guard_assistant_reply_quality(
            legacy or ASSISTANT_DEGENERATE_FALLBACK,
            user_message=user_message,
        ), False
    reply = payload.get("reply_markdown") or payload.get("reply")
    if isinstance(reply, str) and reply.strip():
        return _finalize_parsed_reply(reply.strip(), user_message=user_message, parsed_from_json=True)
    salvaged = salvage_assistant_reply_markdown(text)
    if salvaged:
        return _finalize_parsed_reply(salvaged, user_message=user_message, parsed_from_json=False)
    legacy = sanitize_assistant_model_reply(strip_assistant_json_envelope(text)).strip()
    return guard_assistant_reply_quality(
        legacy or ASSISTANT_DEGENERATE_FALLBACK,
        user_message=user_message,
    ), False


def iter_assistant_reply_sse_chunks(text: str, *, chunk_size: int = 32) -> list[str]:
    """Split finalized markdown into SSE token chunks (UTF-8 safe via str slices)."""
    body = text or ""
    if not body:
        return []
    if chunk_size < 1:
        chunk_size = 32
    return [body[i : i + chunk_size] for i in range(0, len(body), chunk_size)]
