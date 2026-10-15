# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Stable error codes for **ewa_platform** orchestration and I/O boundaries (no stack traces here).
# Invariants:
# - StrEnum values are wire-stable strings; rename only with a new API version.
# Related:
# - api/ewa_platform/contracts/orchestration.py
# - api/ewa_platform/io/envelope.py
# ---
"""Platform and orchestration error codes.

Future: add a small dataclass ``PlatformError`` (code + message + details) if HTTP
gateways need a uniform error body. For now only enumerations are defined.
"""

from __future__ import annotations

from enum import StrEnum


class AmkaPlatformErrorCode(StrEnum):
    """Cross-cutting failure labels for orchestration and envelope handling."""

    INVALID_ENVELOPE = "invalid_envelope"
    ORCHESTRATION_NOT_FOUND = "orchestration_not_found"
    POLICY_DENIED = "policy_denied"
    DESKTOP_INTENT_FAILED = "desktop_intent_failed"
    INTERNAL = "internal"
