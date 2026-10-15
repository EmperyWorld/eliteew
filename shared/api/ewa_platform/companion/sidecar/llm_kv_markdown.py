# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Parse **markdown / bullet** key–value lines from small companion side-LLM replies (intent planner, trust classify) when
# models ignore JSON-only instructions — same contract fields, no second HTTP call.
# Also exposes **suffix** helpers so callers can re-parse after long chain-of-thought preambles (CoT models).
# Invariants:
# - Best-effort only; callers validate with Pydantic / clamps.
# - Keys matched after stripping list markers and ``*`_ `` noise; scalar values strip surrounding **backticks**/quotes (Gemma-style `` `recall_memory` ``).
# Related:
# - api/ewa_platform/companion/sidecar/intent_planner.py
# - api/ewa_platform/companion/sidecar/trust_classify.py
# - api/ewa_platform/schemas/pydantic/companion_intent.py
# **Canonical path:** ``api.ewa_platform.companion.sidecar.llm_kv_markdown``; shim ``companion_llm_kv_markdown``.
# ---
"""Markdown bullet KV extraction for companion planner / trust classify replies."""

from __future__ import annotations

import re
from typing import Any

from api.ewa_platform.schemas.pydantic.companion_intent import INTENT_PLANNER_DISPATCH_TOOLS

_BULLET_STRIP = re.compile(r"^\s*(?:[-*•]\s*|\d+\.\s*)+")
_KEY_NOISE = re.compile(r"[\s*`\"']+")


def _normalize_kv_key(raw: str) -> str:
    t = raw.strip().lower()
    t = _KEY_NOISE.sub("", t)
    return t.strip("_:")


def _strip_kv_scalar(val: str) -> str:
    """Strip wrapping `` `…` `` / quotes from a single KV value (Gemma / some instruct templates wrap literals)."""

    v = (val or "").strip()
    while len(v) >= 2:
        if v[0] == v[-1] == "`":
            v = v[1:-1].strip()
            continue
        q = v[0]
        if q in "'\"" and v[-1] == q:
            v = v[1:-1].strip()
            continue
        break
    return v


def _strip_nullable(val: str | None) -> str | None:
    if val is None:
        return None
    v = _strip_kv_scalar(val.strip())
    if not v or v.lower() in ("null", "none", "n/a", "-"):
        return None
    return v


def parse_companion_markdown_kv(text: str) -> dict[str, str]:
    """Collect ``key -> value`` from bullet lines (``- key: value``, ``* key: value``)."""

    out: dict[str, str] = {}
    for raw_line in (text or "").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        line = _BULLET_STRIP.sub("", line)
        if ":" not in line:
            continue
        head, _, tail = line.partition(":")
        key = _normalize_kv_key(head)
        if not key:
            continue
        out[key] = tail.strip()
    return out


def suffix_starting_at_last_key_line(text: str, key: str) -> str | None:
    """Return text starting at the last line whose bullet-KV key equals ``key`` (normalized), or ``None``.

    Used when the model emits reasoning lines before the final ``- trust_delta:`` / ``- intent:`` block.
    """

    nk = _normalize_kv_key(key)
    lines = (text or "").splitlines()
    last_i: int | None = None
    for i, raw in enumerate(lines):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        de_bullet = _BULLET_STRIP.sub("", line)
        if ":" not in de_bullet:
            continue
        head, _, _tail = de_bullet.partition(":")
        if _normalize_kv_key(head) == nk:
            last_i = i
    if last_i is None:
        return None
    return "\n".join(lines[last_i:]).strip()


def trust_kv_suffix_after_cot(text: str) -> str | None:
    """Suffix from the first line of the **final** trust/abuse answer block (last occurrences of either key)."""

    lines = (text or "").splitlines()
    nd = _normalize_kv_key("trust_delta")
    na = _normalize_kv_key("abuse_at_peak")
    last_i_d: int | None = None
    last_i_a: int | None = None
    for i, raw in enumerate(lines):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        de_bullet = _BULLET_STRIP.sub("", line)
        if ":" not in de_bullet:
            continue
        head, _, _tail = de_bullet.partition(":")
        nk = _normalize_kv_key(head)
        if nk == nd:
            last_i_d = i
        elif nk == na:
            last_i_a = i
    if last_i_d is None and last_i_a is None:
        return None
    if last_i_d is None:
        start = last_i_a
    elif last_i_a is None:
        start = last_i_d
    else:
        start = min(last_i_d, last_i_a)
    assert start is not None
    return "\n".join(lines[start:]).strip()


def intent_kv_suffix_after_cot(text: str) -> str | None:
    """Last ``intent`` or ``tool`` bullet block (typically the model's final answer)."""

    suffix = suffix_starting_at_last_key_line(text, "intent")
    if suffix:
        return suffix
    return suffix_starting_at_last_key_line(text, "tool")


def _get_kv(kv: dict[str, str], canonical_key: str) -> str | None:
    """Lookup by canonical snake key; also match keys with only underscore differences."""

    nk = _normalize_kv_key(canonical_key)
    if nk in kv:
        return kv[nk]
    flat = nk.replace("_", "")
    for k, v in kv.items():
        if k.replace("_", "") == flat:
            return v
    return None


def trust_fields_from_markdown_kv(kv: dict[str, str]) -> dict[str, Any] | None:
    """``trust_delta`` / ``abuse_at_peak`` from markdown KV; ``None`` if neither key present."""

    raw_d = _get_kv(kv, "trust_delta")
    raw_a = _get_kv(kv, "abuse_at_peak")
    if raw_d is None and raw_a is None:
        return None
    out: dict[str, Any] = {}
    if raw_d is not None:
        out["trust_delta"] = _strip_kv_scalar(raw_d)
    if raw_a is not None:
        out["abuse_at_peak"] = _strip_kv_scalar(raw_a)
    return out


def intent_plan_dict_from_markdown_kv(kv: dict[str, str]) -> dict[str, Any] | None:
    """Build a dict for ``CompanionIntentPlan.from_blob``; requires a valid ``tool`` or ``intent`` literal."""

    if not kv:
        return None

    raw_tool = _get_kv(kv, "tool")
    if raw_tool:
        tool = _strip_kv_scalar(raw_tool).lower()
        if tool not in INTENT_PLANNER_DISPATCH_TOOLS:
            return None

        def fnum(name: str, default: float) -> float:
            s = _get_kv(kv, name)
            if not s:
                return default
            try:
                return float(_strip_kv_scalar(s).replace(",", "."))
            except ValueError:
                return default

        def opt(name: str) -> str | None:
            return _strip_nullable(_get_kv(kv, name))

        args_blob: dict[str, Any] = {}
        for slot in (
            "doc_file_name",
            "doc_body_text",
            "insert_source_file_query",
            "rename_old_query",
            "rename_new_name",
            "delete_file_query",
        ):
            val = opt(slot)
            if val is not None:
                args_blob[slot] = val

        return {
            "tool": tool,
            "confidence": fnum("confidence", 0.35 if tool == "chat_only" else 0.55),
            "args": args_blob,
            "understood_summary_ru": _strip_kv_scalar(_get_kv(kv, "understood_summary_ru") or ""),
            "understood_summary_en": _strip_kv_scalar(_get_kv(kv, "understood_summary_en") or ""),
        }

    raw_intent = _get_kv(kv, "intent")
    if not raw_intent:
        return None
    intent = _strip_kv_scalar(raw_intent).lower()
    if intent not in {
        "chat_only",
        "recall_memory",
        "doc_create",
        "doc_insert_into_open_editor",
        "file_rename",
        "file_delete",
        "doc_edit_requires_open_editor",
    }:
        return None

    def fnum(name: str, default: float) -> float:
        s = _get_kv(kv, name)
        if not s:
            return default
        try:
            return float(_strip_kv_scalar(s).replace(",", "."))
        except ValueError:
            return default

    def opt(name: str) -> str | None:
        return _strip_nullable(_get_kv(kv, name))

    blob: dict[str, Any] = {
        "intent": intent,
        "confidence": fnum("confidence", 0.35 if intent == "chat_only" else 0.55),
        "understood_summary_ru": _strip_kv_scalar(_get_kv(kv, "understood_summary_ru") or ""),
        "understood_summary_en": _strip_kv_scalar(_get_kv(kv, "understood_summary_en") or ""),
        "doc_file_name": opt("doc_file_name"),
        "doc_body_text": opt("doc_body_text"),
        "insert_source_file_query": opt("insert_source_file_query"),
        "rename_old_query": opt("rename_old_query"),
        "rename_new_name": opt("rename_new_name"),
        "delete_file_query": opt("delete_file_query"),
    }
    return blob


__all__ = (
    "intent_kv_suffix_after_cot",
    "intent_plan_dict_from_markdown_kv",
    "parse_companion_markdown_kv",
    "suffix_starting_at_last_key_line",
    "trust_fields_from_markdown_kv",
    "trust_kv_suffix_after_cot",
)
