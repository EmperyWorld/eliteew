# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Parse optional JSON desktop-intent proposals from orchestration LLM completions (strict JSON or fenced block).
# Serializes orchestration user payloads (`observation`, heuristic intent, optional `domain_hints`,
# optional truncated `companion_wire`) for HTTP LLM requests.
# Invariants:
# - Returns wire dicts only when ``desktop_intent_wire_wellformed`` passes; no HTTP here.
# Related:
# - api/ewa_platform/contracts/desktop_intent.py
# - api/ewa_platform/core/orchestrator.py
# - api/ewa_platform/llm/http_orch_llm.py
# ---
"""LLM completion parsing for proposed desktop intents."""

from __future__ import annotations

import json
import re
from collections.abc import Mapping
from typing import Any

from api.ewa_platform.contracts.desktop_intent import desktop_intent_wire_wellformed

_JSON_OBJECT_RE = re.compile(r"\{[\s\S]*\}")


def parse_desktop_intent_from_llm_completion(text: str) -> dict[str, Any] | None:
    """Extract ``intent`` object from model output; return ``None`` if absent or ill-formed."""

    raw = (text or "").strip()
    if not raw:
        return None
    blob = _try_parse_json_blob(raw)
    if blob is None:
        return None
    intent = blob.get("intent")
    if intent is None:
        return None
    if isinstance(intent, Mapping) and desktop_intent_wire_wellformed(dict(intent)):
        return dict(intent)
    return None


def _try_parse_json_blob(raw: str) -> dict[str, Any] | None:
    try:
        data = json.loads(raw)
        return dict(data) if isinstance(data, dict) else None
    except json.JSONDecodeError:
        pass
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw, re.IGNORECASE)
    if fence:
        inner = fence.group(1).strip()
        try:
            data = json.loads(inner)
            return dict(data) if isinstance(data, dict) else None
        except json.JSONDecodeError:
            pass
    mobj = _JSON_OBJECT_RE.search(raw)
    if mobj:
        try:
            data = json.loads(mobj.group(0))
            return dict(data) if isinstance(data, dict) else None
        except json.JSONDecodeError:
            return None
    return None


ORCHESTRATION_LLM_PROMPT_KEY = "orch_turn_v1"


def orchestration_turn_llm_user_content(
    observation: Mapping[str, Any],
    heuristic_intent: Mapping[str, Any] | None,
    *,
    domain_hints: Mapping[str, Any] | None = None,
    companion_wire: Mapping[str, Any] | None = None,
) -> str:
    """Structured user message for ``complete`` variables serialization."""

    return json.dumps(
        {
            "observation": dict(observation),
            "heuristic_intent": dict(heuristic_intent) if heuristic_intent else None,
            "domain_hints": dict(domain_hints) if domain_hints else None,
            "companion_wire": dict(companion_wire) if companion_wire else None,
        },
        ensure_ascii=False,
    )
