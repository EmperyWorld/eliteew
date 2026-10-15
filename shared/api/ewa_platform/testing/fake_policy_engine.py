# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Configurable policy stub (allow-all vs deny-all) for orchestration tests.
# Invariants:
# - Default deny-all to mirror safe production default; tests opt into allow.
# Related:
# - api/ewa_platform/policy/engine.py
# ---
"""Fake policy engine."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from api.ewa_platform.contracts.policy_context import PolicyContext


class FakePolicyEngine:
    """Wraps a simple allow flag."""

    def __init__(self, *, allow: bool = False) -> None:
        self._allow = allow

    def evaluate(self, ctx: PolicyContext, intent: Mapping[str, Any]) -> bool:
        return self._allow
