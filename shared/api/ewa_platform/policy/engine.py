# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Policy evaluation for orchestration intents (allow/deny) without Keycloak imports;
# includes ``BasicDesktopPolicyEngine`` (structural + allowlist + role gates).
# Invariants:
# - Inputs are ``PolicyContext`` + intent mapping; output is a simple boolean or structured verdict.
# Related:
# - api/ewa_platform/contracts/policy_context.py
# - api/ewa_platform/policy/rules.py
# ---
"""Policy engine protocol and implementations."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any, Protocol, runtime_checkable

from api.ewa_platform.contracts.desktop_intent import DesktopIntentKind
from api.ewa_platform.contracts.policy_context import PolicyContext
from api.ewa_platform.policy import rules


@runtime_checkable
class PolicyEngine(Protocol):
    """Decides whether an orchestration step is permitted."""

    def evaluate(self, ctx: PolicyContext, intent: Mapping[str, Any]) -> bool: ...


class StubPolicyEngine:
    """Deny-all stub until allowlists are configured (safe default)."""

    def evaluate(self, ctx: PolicyContext, intent: Mapping[str, Any]) -> bool:
        return False


class AllowAllPolicyEngine:
    """Development-only engine that approves every intent."""

    def evaluate(self, ctx: PolicyContext, intent: Mapping[str, Any]) -> bool:
        return True


@dataclass(slots=True)
class BasicDesktopPolicyEngine:
    """Production-shaped policy: safe intents always; ``open_app`` gated by ``allowed_app_components``."""

    allowed_app_components: frozenset[str] = field(default_factory=frozenset)

    def evaluate(self, ctx: PolicyContext, intent: Mapping[str, Any]) -> bool:
        if not rules.intent_structurally_valid(intent):
            return False
        kind = intent.get("intent_kind")
        if kind in (
            DesktopIntentKind.FOCUS_WINDOW.value,
            DesktopIntentKind.CLOSE_WINDOW.value,
            DesktopIntentKind.PATCH_SHELL_STATE.value,
            DesktopIntentKind.PATCH_DESKTOP_CONFIG.value,
        ):
            return True
        if kind == DesktopIntentKind.OPEN_APP.value:
            ac = str(intent.get("app_component", "")).strip()
            return ac in self.allowed_app_components
        if kind == DesktopIntentKind.NAVIGATE_DEEP_LINK.value:
            return "orchestration_deep_link" in ctx.role_names
        return False
