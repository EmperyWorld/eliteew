# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Pure helper predicates for policy (allowlist checks, intent kind classification).
# Invariants:
# - No I/O; may read module-level constants from allowlist.py.
# Related:
# - api/ewa_platform/policy/allowlist.py
# - api/ewa_platform/policy/engine.py
# ---
"""Pure policy predicates: allowlist lookup and intent structural checks for ``BasicDesktopPolicyEngine``."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from api.ewa_platform.contracts.desktop_intent import desktop_intent_wire_wellformed
from api.ewa_platform.policy.allowlist import DEFAULT_ALLOWED_APP_COMPONENTS


def app_component_allowed(app_component: str) -> bool:
    """Return True when ``app_component`` is in the configured allowlist."""

    return app_component in DEFAULT_ALLOWED_APP_COMPONENTS


def intent_has_required_fields(intent: Mapping[str, Any]) -> bool:
    """Minimal structural guard until JSON Schema validation runs in gateway."""

    return "intent_kind" in intent and isinstance(intent.get("intent_kind"), str)


def intent_structurally_valid(intent: Mapping[str, Any]) -> bool:
    """Full minimal v1 wire shape (discriminator + required fields per kind)."""

    return desktop_intent_wire_wellformed(intent)
