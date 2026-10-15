# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Describes per-user orchestration scope (opaque ids + numeric caps) without secrets.
# Invariants:
# - No JWT or long-lived credential material — only identifiers and limits surfaced to workers/gateways.
# Related:
# - api/ewa_platform/contracts/policy_context.py
# - api/ewa_platform/runtime/clock.py
# ---
"""Runtime session scope helpers (optional compose root may attach limits beside ``PolicyContext``)."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class OrchestrationRuntimeScope:
    """Per-connection limits derived after auth (e.g. concurrent desktop orchestration turns)."""

    user_id: str
    max_parallel_sessions: int = 1
