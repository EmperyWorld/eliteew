# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Normalize orchestrator short-circuit response dicts with ``orchestration_branch`` metadata.
# Invariants:
# - ``orchestration_branch`` is set for every terminal orchestration return (grep / episodic / guards).
# Related:
# - api/ewa_platform/companion/orchestration/task_orchestrator.py
# - documentation/product/ewa/EWA-COMPANION-ORCHESTRATION-HARDENING-PLAN.md
# ---

from __future__ import annotations

from collections.abc import Mapping
from typing import Any


def tag_orchestration_branch(response: Mapping[str, Any], branch: str) -> dict[str, Any]:
    """Return a copy of ``response`` with authoritative ``orchestration_branch``."""

    out = dict(response)
    out["orchestration_branch"] = (branch or "").strip()
    return out


def orchestration_response(
    *,
    branch: str,
    reply: str,
    actions: list[dict[str, Any]] | None = None,
    task_run: Any = None,
) -> dict[str, Any]:
    """Build a short-circuit orchestration payload."""

    return {
        "reply": reply,
        "actions": list(actions or []),
        "task_run": task_run,
        "orchestration_branch": (branch or "").strip(),
    }


__all__ = ("orchestration_response", "tag_orchestration_branch")
