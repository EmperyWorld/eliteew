# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Canonical JSON key and relaxed structural checks for the optional ``ewa_hints`` subtree inside EliteEW
# persisted desktop ``shell_state`` (explicit documents/content hints for EWA orchestration adapters).
# Invariants:
# - Does not fetch HTTP; callers normalize driver-facing payloads via ``domain_hints_wire`` after derivation.
# Related:
# - api/ewa_platform/schemas/json/domain_hints_v1.json ($defs EwaShellHintsSubtreeV1)
# - api/ewa_platform/adapters/eliteew_shell_domain_hints_http.py
# ---
"""Shell-state subtree contract for EWA hints (v1)."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

EWA_SHELL_HINTS_SUBTREE_KEY = "ewa_hints"


def read_ewa_hints_subtree(shell_state: Mapping[str, Any]) -> Mapping[str, Any] | None:
    """Return the hints subtree mapping or ``None`` when absent / wrong JSON type."""

    raw = shell_state.get(EWA_SHELL_HINTS_SUBTREE_KEY)
    if raw is None:
        return None
    if not isinstance(raw, Mapping):
        return None
    return raw


def shell_hints_subtree_relaxed_wellformed(hints_root: Mapping[str, Any]) -> bool:
    """Return False when reserved nested keys are not objects (corrupt subtree → adapters must fall back)."""

    for key in ("documents_workspace", "content_manager"):
        if key not in hints_root:
            continue
        val = hints_root[key]
        if val is None:
            continue
        if not isinstance(val, Mapping):
            return False
    return True
