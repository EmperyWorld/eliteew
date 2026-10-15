# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Instrumentation (UTF-8 byte breakdown + rough token estimate) and optional slimming of
# orchestration LLM variables so long desktop observations / domain_hints do not waste KV budget.
# Invariants:
# - Slimming applies only to copies assigned into the working variables dict; never mutates caller-owned nested lists.
# - Placeholder domain_hints preserve key names only when aggressive trim still exceeds budget (explicit ``_ewa_*`` keys).
# - Context logs compare component UTF-8 before vs after slim (observation / domain_hints only).
# Related:
# - api/ewa_platform/llm/http_orch_llm.py
# - api/ewa_platform/llm/intent_proposal.py
# ---
"""Orchestration LLM context size metrics and env-guarded payload slimming."""

from __future__ import annotations

import json
import logging
import os
from collections.abc import Mapping
from typing import Any


def json_utf8_byte_length(obj: Any) -> int:
    """Serialized JSON length in UTF-8 bytes (``default=str`` for odd leaf types)."""

    try:
        return len(json.dumps(obj, ensure_ascii=False, default=str).encode("utf-8"))
    except (TypeError, ValueError):  # fmt: skip
        return 0


def approx_tokens_from_utf8_bytes(n: int) -> int:
    """Rough lower bound (~4 bytes/token for mixed Latin/Cyrillic JSON)."""

    return max(0, n) // 4


def observation_windows_count_for_log(obs: Mapping[str, Any] | None) -> int | None:
    """Return ``len(windows)`` for ``window_list_snapshot``; ``None`` if not applicable."""

    if not isinstance(obs, Mapping):
        return None
    if obs.get("observation_kind") != "window_list_snapshot":
        return None
    wins = obs.get("windows")
    return len(wins) if isinstance(wins, list) else None


def orchestration_variable_component_utf8(variables: Mapping[str, Any]) -> dict[str, int]:
    """Per-field UTF-8 sizes for the orchestration ``complete(..., variables=...)`` mapping."""

    obs = variables.get("observation")
    h = variables.get("heuristic_intent")
    dh = variables.get("domain_hints")
    cw = variables.get("companion_wire")
    return {
        "observation": json_utf8_byte_length(obs) if isinstance(obs, Mapping) else 0,
        "heuristic_intent": json_utf8_byte_length(h) if isinstance(h, Mapping) else 0,
        "domain_hints": json_utf8_byte_length(dh) if isinstance(dh, Mapping) else 0,
        "companion_wire": json_utf8_byte_length(cw) if isinstance(cw, Mapping) else 0,
    }


def slim_observation_for_llm(
    obs: Mapping[str, Any],
    max_windows: int,
) -> tuple[dict[str, Any], dict[str, Any] | None]:
    """Keep only the last ``max_windows`` entries for ``window_list_snapshot`` (tail = most recent).

    Returns ``(wire_dict, truncation_meta_or_none)``.
    """

    if max_windows <= 0:
        return dict(obs), None
    kind = obs.get("observation_kind")
    wins = obs.get("windows")
    if kind != "window_list_snapshot" or not isinstance(wins, list) or len(wins) <= max_windows:
        return dict(obs), None
    out = dict(obs)
    dropped = len(wins) - max_windows
    out["windows"] = list(wins[-max_windows:])
    out["_ewa_context_slim"] = {"windows_dropped": dropped, "windows_kept": max_windows}
    return out, {"windows_dropped": dropped, "windows_kept": max_windows}


def _deep_trim_structure(
    obj: Any,
    *,
    max_str: int,
    max_list: int,
    max_depth: int,
) -> Any:
    if max_depth <= 0:
        if isinstance(obj, (dict, list)):
            return "[ewa_depth_cap]"
        return obj
    if isinstance(obj, dict):
        return {
            str(k)[:200]: _deep_trim_structure(v, max_str=max_str, max_list=max_list, max_depth=max_depth - 1)
            for k, v in obj.items()
        }
    if isinstance(obj, list):
        clipped = obj[:max_list]
        return [_deep_trim_structure(x, max_str=max_str, max_list=max_list, max_depth=max_depth - 1) for x in clipped]
    if isinstance(obj, str):
        if len(obj) > max_str:
            return obj[:max_str] + "…"
        return obj
    return obj


def slim_domain_hints_for_llm(
    hints: Mapping[str, Any],
    max_utf8: int,
) -> tuple[dict[str, Any], dict[str, Any] | None]:
    """Reduce ``domain_hints`` JSON UTF-8 size; may iterate str/list caps until under budget or emit a placeholder."""

    if max_utf8 <= 0:
        return dict(hints), None
    base = json_utf8_byte_length(hints)
    if base <= max_utf8:
        return dict(hints), None

    pairs = (
        (1600, 80, 10),
        (800, 40, 8),
        (400, 20, 6),
        (200, 12, 4),
    )
    for max_str, max_list, depth in pairs:
        candidate = _deep_trim_structure(dict(hints), max_str=max_str, max_list=max_list, max_depth=depth)
        if not isinstance(candidate, dict):
            candidate = {"_ewa_trimmed": candidate}
        if json_utf8_byte_length(candidate) <= max_utf8:
            meta = {
                "strategy": "deep_trim",
                "max_str": max_str,
                "max_list": max_list,
                "max_depth": depth,
                "utf8_before": base,
                "utf8_after": json_utf8_byte_length(candidate),
            }
            return candidate, meta

    keys = sorted(str(k) for k in hints)
    placeholder, ph_bytes = _domain_hints_placeholder_under_budget(
        keys_full=keys,
        utf8_before=base,
        budget_utf8=max_utf8,
    )
    return placeholder, {"strategy": "placeholder", "utf8_before": base, "utf8_after": ph_bytes}


def _domain_hints_placeholder_under_budget(
    *,
    keys_full: list[str],
    utf8_before: int,
    budget_utf8: int,
) -> tuple[dict[str, Any], int]:
    """Guarantee serialized UTF-8 length ``<= budget_utf8`` (drops optional fields first)."""

    for keys_take in (24, 16, 8, 4, 2, 1, 0):
        candidate: dict[str, Any] = {
            "_ewa_domain_hints_oversized": True,
            "keys_total": len(keys_full),
            "budget_utf8": budget_utf8,
        }
        if utf8_before <= 999_999:
            candidate["utf8_before"] = utf8_before
        if keys_take:
            candidate["keys_head"] = keys_full[:keys_take]
        n = json_utf8_byte_length(candidate)
        if n <= budget_utf8:
            return candidate, n

    minimal = {"_ewa_o": True}
    return minimal, json_utf8_byte_length(minimal)


def _int_env_nonnegative(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or not str(raw).strip():
        return default
    try:
        return max(0, int(str(raw).strip(), 10))
    except ValueError:
        return default


def apply_env_orchestration_llm_slimming(variables: dict[str, Any]) -> dict[str, Any]:
    """Mutate ``variables`` in place for orchestration LLM (observation / domain_hints only).

    Returns a metadata dict suitable for structured logs (may be empty aside from ``slimmed``: False).
    """

    meta: dict[str, Any] = {"slimmed": False}
    obs = variables.get("observation")
    max_w = _int_env_nonnegative("EWA_ORCH_LLM_SLIM_OBSERVATION_WINDOWS", 0)
    if isinstance(obs, dict) and max_w > 0:
        new_obs, t = slim_observation_for_llm(obs, max_w)
        if t is not None:
            variables["observation"] = new_obs
            meta["observation"] = t
            meta["slimmed"] = True

    hints = variables.get("domain_hints")
    max_b = _int_env_nonnegative("EWA_ORCH_LLM_SLIM_DOMAIN_HINTS_UTF8", 0)
    if isinstance(hints, dict) and max_b > 0:
        new_h, t = slim_domain_hints_for_llm(hints, max_b)
        if t is not None:
            variables["domain_hints"] = new_h
            meta["domain_hints"] = t
            meta["slimmed"] = True
    return meta


def log_orchestration_llm_context(
    logger: logging.Logger,
    *,
    component_utf8_before: Mapping[str, int],
    component_utf8_after: Mapping[str, int],
    observation_windows: int | None,
    user_content_utf8: int,
    system_content_utf8: int,
    orch_json_utf8: int,
    tools_hint_appended_utf8: int,
    tools_json_utf8: int,
    slim_meta: Mapping[str, Any],
) -> None:
    """Structured INFO log line; safe sizes only (no raw JSON bodies)."""

    total_user = int(user_content_utf8)
    total_sys = int(system_content_utf8)
    approx = approx_tokens_from_utf8_bytes(total_user + total_sys)
    ob = component_utf8_before.get("observation", 0)
    oa = component_utf8_after.get("observation", 0)
    hb = component_utf8_before.get("domain_hints", 0)
    ha = component_utf8_after.get("domain_hints", 0)
    logger.info(
        "[STEP] ewa_orch_llm_context orch_json_utf8=%s tools_hint_line_utf8=%s tools_json_utf8=%s "
        "user_total_utf8=%s system_utf8=%s approx_prompt_tokens~=%s "
        "obs_utf8=%s obs_utf8_after=%s hints_utf8=%s hints_utf8_after=%s obs_windows=%s "
        "companion_utf8=%s heuristic_utf8=%s slimmed=%s slim_detail=%s",
        orch_json_utf8,
        tools_hint_appended_utf8,
        tools_json_utf8,
        total_user,
        total_sys,
        approx,
        ob,
        oa,
        hb,
        ha,
        observation_windows,
        component_utf8_before.get("companion_wire", 0),
        component_utf8_before.get("heuristic_intent", 0),
        bool(slim_meta.get("slimmed")),
        json.dumps(slim_meta, ensure_ascii=False, default=str) if slim_meta.get("slimmed") else "{}",
    )
