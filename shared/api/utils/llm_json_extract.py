# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Robust extraction of JSON objects/arrays from LLM text (fences, CoT prefixes, JSONC, balanced slices).
# Invariants:
# - ``extract_slides_list_from_llm`` / ``salvage_json_array_objects`` recover truncated EWRP deck JSON.
# - Balanced ``{``/``[`` slicing respects string escapes (no greedy ``{.*}`` truncation).
# Related:
# - api/utils/llm_openai_compat_http.py
# - api/services/presentation_content_generator_service.py
# ---
"""Parse structured JSON from free-form LLM completions (thinking models, markdown fences)."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

logger = logging.getLogger(__name__)

# Gemma/Qwen-style CoT tags (built from parts so tooling does not strip them).
_THINK_OPEN = "\u003c" + "think" + "\u003e"
_THINK_CLOSE = "\u003c/" + "think" + "\u003e"
_THINK_CLOSE_TAGS: tuple[str, ...] = (_THINK_CLOSE, "</think>")
_THINK_OPEN_TAGS: tuple[str, ...] = (_THINK_OPEN, "<think>")
# llama-server / Gemma 4: ``<|channel>thought`` … ``<|channel|>`` before JSON payload.
_CHANNEL_MARKUP_RE = re.compile(r"<\|[^>\n|]*\|?[^>\n]*>", re.IGNORECASE)
_PARSE_INPUT_IN_ERROR_RE = re.compile(
    r"Failed to parse input at pos \d+:\s*(.*)",
    re.DOTALL | re.IGNORECASE,
)


def strip_llm_channel_markup(raw_text: str) -> str:
    """Remove ``<|channel…|>`` control tokens that break llama-server JSON parsing."""
    text = (raw_text or "").strip()
    if not text:
        return text
    # Gemma 4 / llama-server channel markers (also bare ``<channel|>`` seen in server error text).
    text = re.sub(r"<\|?channel\|>\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"<\|channel>(?:thought|\*)?\s*", "", text, flags=re.IGNORECASE)
    text = _CHANNEL_MARKUP_RE.sub("", text)
    return text.strip()


def salvage_text_from_llama_server_error(error_text: str) -> str | None:
    """Recover model output embedded in llama-server HTTP 500 ``error.message``."""
    if not error_text:
        return None
    probe = error_text
    js_start = error_text.find('{"error"')
    if js_start < 0:
        js_start = error_text.find("{")
    if js_start >= 0:
        try:
            envelope = json.loads(error_text[js_start:])
            msg = envelope.get("error", {}).get("message") if isinstance(envelope, dict) else None
            if isinstance(msg, str) and msg.strip():
                probe = msg
        except json.JSONDecodeError:
            pass
    if "Failed to parse input" not in probe:
        return None
    match = _PARSE_INPUT_IN_ERROR_RE.search(probe)
    if not match:
        return None
    payload = match.group(1).strip()
    for trailer in ('","type":"server_error"}', '","type": "server_error"}'):
        cut = payload.find(trailer)
        if cut >= 0:
            payload = payload[:cut]
    payload = strip_llm_channel_markup(strip_llm_thinking_prefix(payload))
    return payload.strip() or None


def strip_llm_thinking_prefix(raw_text: str) -> str:
    """Drop chain-of-thought wrappers so the JSON tail is visible to the extractor."""
    text = strip_llm_channel_markup(raw_text)
    if not text:
        return text
    lower = text.lower()
    cut = 0
    for tag in _THINK_CLOSE_TAGS:
        idx = lower.rfind(tag.lower())
        if idx >= 0:
            cut = max(cut, idx + len(tag))
    if cut > 0:
        text = text[cut:].strip()
        lower = text.lower()
    for opener in _THINK_OPEN_TAGS:
        if lower.startswith(opener.lower()):
            close_idx = lower.find(_THINK_CLOSE.lower())
            if close_idx > 0:
                text = text[close_idx + len(_THINK_CLOSE) :].strip()
            else:
                nl = text.find("\n\n")
                if nl > 0:
                    text = text[nl + 2 :].strip()
            break
    return text


def _sanitize_llm_json_candidate(raw: str) -> str:
    text = _strip_json_comments_outside_strings(raw)
    return _strip_trailing_commas_outside_strings(text)


def _strip_json_comments_outside_strings(s: str) -> str:
    n = len(s)
    out: list[str] = []
    i = 0
    in_string = False
    escape = False
    while i < n:
        ch = s[i]
        if in_string:
            out.append(ch)
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_string = False
            i += 1
            continue
        if ch == '"':
            in_string = True
            out.append(ch)
            i += 1
            continue
        if ch == "/" and i + 1 < n:
            nxt = s[i + 1]
            if nxt == "*":
                i += 2
                while i + 1 < n and not (s[i] == "*" and s[i + 1] == "/"):
                    i += 1
                i = min(i + 2, n)
                continue
            if nxt == "/":
                while i < n and s[i] != "\n":
                    i += 1
                continue
        out.append(ch)
        i += 1
    return "".join(out)


def _strip_trailing_commas_outside_strings(s: str) -> str:
    n = len(s)
    out: list[str] = []
    i = 0
    in_string = False
    escape = False
    while i < n:
        ch = s[i]
        if in_string:
            out.append(ch)
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_string = False
            i += 1
            continue
        if ch == '"':
            in_string = True
            out.append(ch)
            i += 1
            continue
        if ch == ",":
            j = i + 1
            while j < n and s[j] in " \t\n\r":
                j += 1
            if j < n and s[j] in "}]":
                i = j
                continue
        out.append(ch)
        i += 1
    return "".join(out)


def _strip_invalid_json_control_chars(s: str) -> str:
    return "".join(c for c in s if c in "\n\r\t" or ord(c) >= 32)


def salvage_json_array_objects(raw_text: str) -> list[Any]:
    """Collect complete JSON objects from a (possibly truncated) top-level array."""
    text = strip_llm_thinking_prefix(raw_text or "")
    start = text.find("[")
    if start < 0:
        return []
    decoder = json.JSONDecoder()
    idx = start + 1
    n = len(text)
    items: list[Any] = []
    while idx < n:
        while idx < n and text[idx] in " \t\n\r,":
            idx += 1
        if idx >= n or text[idx] == "]":
            break
        try:
            obj, end = decoder.raw_decode(text, idx)
        except json.JSONDecodeError:
            break
        items.append(obj)
        idx = end
    return items


def extract_slides_list_from_llm(raw_text: str) -> list[dict[str, Any]] | None:
    """Extract slide/outline dicts from LLM text (array, ``slides`` wrapper, or truncated array)."""
    if not (raw_text or "").strip():
        return None

    parsed: Any | None = None
    try:
        parsed = extract_llm_json_payload(raw_text)
    except ValueError:
        parsed = None

    if isinstance(parsed, list):
        dicts = [item for item in parsed if isinstance(item, dict)]
        if dicts and all("title" in item or "slideNumber" in item for item in dicts):
            return dicts

    if isinstance(parsed, dict):
        slides_raw = parsed.get("slides")
        if isinstance(slides_raw, list):
            dicts = [item for item in slides_raw if isinstance(item, dict)]
            if dicts:
                return dicts
        if parsed.get("slideNumber") is not None and parsed.get("title") is not None:
            parsed = None

    text = strip_llm_thinking_prefix(raw_text)
    slides_match = re.search(r'"slides"\s*:\s*\[', text, flags=re.IGNORECASE)
    if slides_match:
        bracket = text.find("[", slides_match.start())
        if bracket >= 0:
            salvaged = salvage_json_array_objects(text[bracket:])
            dicts = [item for item in salvaged if isinstance(item, dict)]
            if dicts:
                return dicts

    salvaged = salvage_json_array_objects(text)
    dicts = [item for item in salvaged if isinstance(item, dict)]
    if dicts and all(item.get("slideNumber") is not None or item.get("title") for item in dicts):
        return dicts
    return None


def extract_llm_json_payload(raw_text: str) -> Any:  # noqa: ANN401
    """Return parsed dict or list from model text; raises ValueError when nothing usable."""
    text = strip_llm_thinking_prefix(raw_text)
    text = text.strip()
    if not text:
        raise ValueError("empty model output")

    # Prefer the last fenced JSON block (models often echo a draft then the final block).
    fences = list(re.finditer(r"```(?:json|JSON)?\s*([\s\S]*?)```", text))
    if fences:
        text = fences[-1].group(1).strip()
    elif text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)

    original_after_fence = text
    text = _sanitize_llm_json_candidate(text)
    sanitized_applied = text != original_after_fence
    text = _strip_invalid_json_control_chars(text)

    def _load_structured(candidate: str) -> Any:  # noqa: ANN401
        try:
            parsed = json.loads(candidate)
        except json.JSONDecodeError:
            parsed = None
        if isinstance(parsed, (dict, list)):
            return parsed
        return None

    parsed = _load_structured(text)
    if parsed is not None:
        return parsed

    if sanitized_applied:
        parsed = _load_structured(original_after_fence)
        if parsed is not None:
            return parsed

    def _balanced_json_slice(candidate: str) -> str | None:
        n = len(candidate)
        start = 0
        while start < n and candidate[start] not in "{[":
            start += 1
        if start >= n:
            return None
        stack: list[str] = []
        in_string = False
        escape_next = False
        i = start
        while i < n:
            ch = candidate[i]
            if in_string:
                if escape_next:
                    escape_next = False
                elif ch == "\\":
                    escape_next = True
                elif ch == '"':
                    in_string = False
                i += 1
                continue
            if ch == '"':
                in_string = True
                i += 1
                continue
            if ch in "{[":
                stack.append("}" if ch == "{" else "]")
            elif ch in "}]" and stack and ch == stack[-1]:
                stack.pop()
                if not stack:
                    return candidate[start : i + 1]
            i += 1
        return None

    balanced = _balanced_json_slice(text)
    if balanced:
        parsed = _load_structured(balanced)
        if parsed is not None:
            return parsed

    # Last resort: try every balanced segment (CoT + multiple JSON blobs).
    scan = strip_llm_thinking_prefix(raw_text)
    for match in re.finditer(r"[\[{]", scan):
        seg = _balanced_json_slice(scan[match.start() :])
        if seg:
            parsed = _load_structured(seg)
            if parsed is not None:
                return parsed

    raise ValueError("Model did not return valid JSON")
