# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Circuit breaker for agentic replanning loops — prevents Celery worker death spirals.
# Invariants:
# - replanning_count in working_memory_json; exceed max → failed + Reasoning_Loop_Detected.
# Related:
# - api/ewa_platform/agentic/kernel/loop.py
# - api/ewa_platform/persistence_pg/agentic_asyncpg.py
# ---

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from api.ewa_platform.agentic.config import agentic_max_replanning_attempts

REASONING_LOOP_DETECTED = "Reasoning_Loop_Detected"
WM_REPLANNING_COUNT = "replanning_count"
WM_TERMINATE_REASON = "terminate_reason"
WM_THINK_PARSE_FAIL_COUNT = "think_parse_fail_count"


def working_memory_from_session(session: Mapping[str, Any]) -> dict[str, Any]:
    raw = session.get("working_memory_json")
    if isinstance(raw, Mapping):
        return dict(raw)
    return {}


def evaluate_replanning_step(
    wm: Mapping[str, Any],
    *,
    max_replanning: int | None = None,
) -> tuple[str, dict[str, Any], str | None]:
    """Increment replanning_count; return (next_status, wm_patch, event_reason).

    Returns ``awaiting_human`` when the circuit opens; else ``replanning``.
    """

    cap = max_replanning if max_replanning is not None else agentic_max_replanning_attempts()
    count = int(wm.get(WM_REPLANNING_COUNT) or 0) + 1
    patch: dict[str, Any] = {WM_REPLANNING_COUNT: count}
    if count > cap:
        patch[WM_TERMINATE_REASON] = REASONING_LOOP_DETECTED
        return "awaiting_human", patch, REASONING_LOOP_DETECTED
    return "replanning", patch, None


def reset_circuit_on_success(wm: Mapping[str, Any]) -> dict[str, Any]:
    """Clear replanning / parse fail counters after a successful completed Act only."""

    patch = dict(wm)
    patch[WM_REPLANNING_COUNT] = 0
    patch[WM_THINK_PARSE_FAIL_COUNT] = 0
    patch.pop(WM_TERMINATE_REASON, None)
    return patch


def circuit_is_open(session: Mapping[str, Any]) -> bool:
    wm = working_memory_from_session(session)
    count = int(wm.get(WM_REPLANNING_COUNT) or 0)
    return count > agentic_max_replanning_attempts()
