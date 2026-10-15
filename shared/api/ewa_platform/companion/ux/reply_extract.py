# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Extract visible reply **plus** memory rows + allowlisted desktop actions from a raw LLM string. Prefer a typed JSON
# envelope when present; otherwise fall back to ``<<MEMORY>>`` / ``<<ACTIONS>>`` tails (backward compatible).
# Invariants:
# - Never raises: malformed JSON or unknown shapes degrade to legacy tail parsers on the trimmed text.
# - Memory rows from JSON envelope are validated via ``normalize_memory_list``.
# Related:
# - api/ewa_platform/companion/turn/chat_turn.py
# - api/ewa_platform/companion/memory/ (``normalize_memory_list``, ``parse_memory_tail``)
# - api/ewa_platform/companion/actions/
# ---
"""Parse companion LLM output: structured JSON envelope or markdown tails."""

from __future__ import annotations

import json
import logging
import re
from collections.abc import Mapping
from typing import Any

from api.ewa_platform.companion.actions import (
    MAX_ACTIONS_PER_TURN,
    normalize_actions_list_from_json,
    parse_actions_tail,
)
from api.ewa_platform.companion.memory import normalize_memory_list, parse_memory_tail
from api.ewa_platform.companion.ux.control_tails import strip_malformed_control_tails

logger = logging.getLogger(__name__)

_MEMORY_FIELD_RE = re.compile(r'"memory"\s*:')
_ACTIONS_FIELD_RE = re.compile(r'"actions"\s*:')


def _json_string_unescape(raw: str) -> str:
    if not raw:
        return ""
    try:
        return str(json.loads(f'"{raw}"'))
    except json.JSONDecodeError:
        return raw.replace('\\"', '"').replace("\\n", "\n").replace("\\t", "\t").replace("\\\\", "\\")


def _loose_extract_visible_reply_from_envelope(trimmed: str) -> str | None:
    """Best-effort ``visible_reply`` when ``json.loads`` fails (unescaped quotes in prose)."""

    if '"visible_reply"' not in trimmed:
        return None
    key_pos = trimmed.find('"visible_reply"')
    colon = trimmed.find(":", key_pos)
    if colon < 0:
        return None
    open_q = trimmed.find('"', colon + 1)
    if open_q < 0:
        return None
    for field_re in (_MEMORY_FIELD_RE, _ACTIONS_FIELD_RE):
        match = field_re.search(trimmed, open_q + 1)
        if match:
            segment = trimmed[open_q + 1 : match.start()]
            seg = segment.rstrip().rstrip(",").rstrip()
            if seg.endswith('"'):
                seg = seg[:-1]
            out = _json_string_unescape(seg).strip()
            if out:
                return out
    close_brace = trimmed.rfind("}", open_q)
    if close_brace > open_q:
        segment = trimmed[open_q + 1 : close_brace]
        seg = segment.rstrip().rstrip(",").rstrip()
        if seg.endswith('"'):
            seg = seg[:-1]
        out = _json_string_unescape(seg).strip()
        return out or None
    return None


def reply_stream_should_buffer_json_envelope(accumulated_raw: str) -> bool:
    """True when streamed tokens look like the structured JSON envelope (do not forward raw chunks)."""

    t = (accumulated_raw or "").lstrip()
    return t.startswith("{") and '"visible_reply"' in t[:200]


def structured_turn_instruction() -> str:
    """One short paragraph appended to system prompt explaining the JSON-first contract."""

    from api.ewa_platform.companion.prompt_blocks.service import get_prompt_block

    return get_prompt_block("emit.structured_turn")


def extract_visible_reply_memory_actions(reply_raw: str) -> tuple[str, list[dict[str, Any]], list[dict[str, Any]]]:
    """Return ``(visible_reply, normalized_new_memory_entries, normalized_actions)``."""

    if not isinstance(reply_raw, str):
        return "", [], []

    trimmed = reply_raw.strip()
    mem_json_rows: list[dict[str, Any]] = []
    act_json_rows: list[dict[str, Any]] = []

    envelope_text = trimmed
    if trimmed.startswith("{") and trimmed.endswith("}"):
        try:
            parsed: Any = json.loads(trimmed)
            if isinstance(parsed, Mapping) and isinstance(parsed.get("visible_reply"), str):
                envelope_text = str(parsed.get("visible_reply") or "").strip()
                mem_json_rows = normalize_memory_list(parsed.get("memory"))
                act_json_rows = normalize_actions_list_from_json(parsed.get("actions"))
        except json.JSONDecodeError:
            logger.debug("companion_reply_json_probe_failedchars=%s", len(trimmed))
            loose = _loose_extract_visible_reply_from_envelope(trimmed)
            envelope_text = loose if loose is not None else trimmed

    vis_mem, tail_mem_rows = parse_memory_tail(envelope_text)
    vis_act, tail_act_rows = parse_actions_tail(vis_mem)

    mem_all = [*mem_json_rows]
    seen_hash = {row.get("content_hash") or row.get("content") for row in mem_json_rows if isinstance(row, dict)}
    for row in tail_mem_rows:
        if not isinstance(row, dict):
            continue
        ident = row.get("content_hash") or row.get("content")
        if ident in seen_hash:
            continue
        mem_all.append(row)
        seen_hash.add(ident)

    combined_actions = [*act_json_rows, *tail_act_rows][:MAX_ACTIONS_PER_TURN]
    visible = strip_malformed_control_tails(vis_act.strip())
    return visible, mem_all[:80], combined_actions


__all__ = (
    "extract_visible_reply_memory_actions",
    "reply_stream_should_buffer_json_envelope",
    "structured_turn_instruction",
)
