# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Normalized snapshot passed to policy (roles, flags, limits) without calling Keycloak or HTTP.
# Invariants:
# - Populate only from gateway layer using already-verified token claims; never embed secrets.
# Related:
# - api/ewa_platform/policy/engine.py
# - api/ewa_platform/io/envelope.py (auth_context_ref resolution)
# ---
"""Policy evaluation context (data-only).

Future fields MAY add ``tenant_id: str | None``, ``rate_limit_bucket``, etc.;
gateways SHOULD keep this object free of bearer tokens/secrets.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(slots=True)
class PolicyContext:
    """principal_id plus role names surfaced to ``BasicDesktopPolicyEngine.evaluate``."""

    principal_id: str
    role_names: frozenset[str] = field(default_factory=frozenset)
