# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# License / telemetry policy gate for MCP server allowlist entries.
# Invariants:
# - Allowed licenses: MIT, Apache-2.0 only.
# - telemetry_ok must be false (no phone-home servers).
# Related:
# - documentation/platform/ELITEEW-MCP-HOST-AND-SERVERS.md
# ---
"""MCP Host policy helpers."""

from __future__ import annotations

_ALLOWED_LICENSES = frozenset({"MIT", "Apache-2.0", "Apache-2", "APACHE-2.0"})


def normalize_license(raw: str | None) -> str:
    return str(raw or "").strip()


def license_allowed(raw: str | None) -> bool:
    key = normalize_license(raw)
    if key in _ALLOWED_LICENSES:
        return True
    # Accept common Apache spelling without hyphen variants already covered.
    return key.upper().replace(" ", "") in {"APACHE2.0", "APACHE2", "MIT"}


def telemetry_forbidden(telemetry_ok: bool | None) -> bool:
    """True when the entry is forbidden because telemetry is enabled/required."""
    return bool(telemetry_ok)
