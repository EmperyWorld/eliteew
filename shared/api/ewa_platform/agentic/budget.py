# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Session wall-clock and iteration budgets for agentic autonomous loop.
# Invariants:
# - policy_json.budget overrides env defaults; FSM event budget_exceeded → paused.
# Related:
# - api/ewa_platform/agentic/kernel/loop.py
# - api/ewa_platform/agentic/starter.py
# ---

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from api.ewa_platform.agentic.config import (
    agentic_session_default_max_total_iterations,
    agentic_session_default_max_wall_clock_sec,
)

_BUDGET_WALL_ANCHOR_KEY = "budget_wall_anchor_at"


def _coerce_utc_datetime(value: Any) -> datetime | None:
    if not isinstance(value, datetime):
        if isinstance(value, str) and value.strip():
            try:
                value = datetime.fromisoformat(value.replace("Z", "+00:00"))
            except ValueError:
                return None
        else:
            return None
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def budget_wall_anchor_at(session: Mapping[str, Any]) -> datetime | None:
    """Wall-clock budget anchor — excludes queue wait before first loop tick."""

    status = str(session.get("status") or "")
    if status == "init":
        return None

    wm = session.get("working_memory_json")
    if isinstance(wm, Mapping):
        anchored = _coerce_utc_datetime(wm.get(_BUDGET_WALL_ANCHOR_KEY))
        if anchored is not None:
            return anchored

    iteration_count = int(session.get("iteration_count") or 0)
    if iteration_count <= 0:
        updated = _coerce_utc_datetime(session.get("updated_at"))
        if updated is not None:
            return updated

    return _coerce_utc_datetime(session.get("created_at"))


def with_budget_wall_anchor(working_memory_json: Mapping[str, Any] | None) -> dict[str, Any]:
    """Ensure working memory records when autonomous execution started."""

    wm = dict(working_memory_json or {})
    if _BUDGET_WALL_ANCHOR_KEY not in wm:
        wm[_BUDGET_WALL_ANCHOR_KEY] = datetime.now(tz=UTC).isoformat()
    return wm


@dataclass(frozen=True)
class SessionBudgetPolicy:
    max_wall_clock_sec: int | None
    max_total_iterations: int | None


def merge_default_budget(policy_json: Mapping[str, Any] | None) -> dict[str, Any]:
    """Ensure policy_json includes budget defaults from env when omitted."""

    out = dict(policy_json or {})
    budget_raw = out.get("budget")
    budget = dict(budget_raw) if isinstance(budget_raw, Mapping) else {}
    if "max_wall_clock_sec" not in budget:
        default_wall = agentic_session_default_max_wall_clock_sec()
        if default_wall is not None:
            budget["max_wall_clock_sec"] = default_wall
    if "max_total_iterations" not in budget:
        default_iter = agentic_session_default_max_total_iterations()
        if default_iter is not None:
            budget["max_total_iterations"] = default_iter
    out["budget"] = budget
    return out


def parse_budget_policy(policy_json: Mapping[str, Any] | None) -> SessionBudgetPolicy:
    merged = merge_default_budget(policy_json)
    budget = merged.get("budget")
    if not isinstance(budget, Mapping):
        return SessionBudgetPolicy(max_wall_clock_sec=None, max_total_iterations=None)

    wall_raw = budget.get("max_wall_clock_sec")
    iter_raw = budget.get("max_total_iterations")
    wall: int | None = None
    iters: int | None = None
    if wall_raw is not None:
        try:
            wall = max(1, int(wall_raw))
        except TypeError, ValueError:
            wall = None
    if iter_raw is not None:
        try:
            iters = max(1, int(iter_raw))
        except TypeError, ValueError:
            iters = None
    return SessionBudgetPolicy(max_wall_clock_sec=wall, max_total_iterations=iters)


def session_budget_exceeded(
    session: Mapping[str, Any],
    *,
    policy_json: Mapping[str, Any] | None = None,
) -> tuple[bool, str]:
    """Return (exceeded, reason_key) for loop entry guard."""

    policy = parse_budget_policy(policy_json or session.get("policy_json"))
    iteration_count = int(session.get("iteration_count") or 0)
    if policy.max_total_iterations is not None and iteration_count >= policy.max_total_iterations:
        return True, "max_total_iterations"

    if policy.max_wall_clock_sec is not None:
        started = budget_wall_anchor_at(session)
        if started is not None:
            elapsed = (datetime.now(tz=UTC) - started).total_seconds()
            if elapsed >= policy.max_wall_clock_sec:
                return True, "max_wall_clock_sec"
    return False, ""
