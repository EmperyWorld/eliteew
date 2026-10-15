# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Normalize optional ``domain_hints`` payloads before persistence/events (parity with ``io/desktop_payload.py`` pattern).
# Invariants:
# - Delegates canonical shapes to ``contracts/domain_hints_wire.py``.
# Related:
# - api/ewa_platform/contracts/domain_hints_wire.py
# - api/ewa_platform/core/orchestrator.py
# ---
"""Domain hints wire normalization (v1)."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from api.ewa_platform.contracts.domain_hints_wire import (
    content_manager_hint_wire_wellformed,
    documents_workspace_hint_wire_wellformed,
    normalize_content_manager_hint_wire,
    normalize_documents_workspace_hint_wire,
)


def ensure_documents_workspace_hint_wire_or_raise(data: Mapping[str, Any]) -> dict[str, Any]:
    """Normalize then validate documents hint wire shape; raise ``ValueError`` if still ill-formed."""

    norm = normalize_documents_workspace_hint_wire(data)
    if not documents_workspace_hint_wire_wellformed(norm):
        msg = "documents workspace hint wire payload is not well-formed after normalization"
        raise ValueError(msg)
    return norm


def ensure_content_manager_hint_wire_or_raise(data: Mapping[str, Any]) -> dict[str, Any]:
    """Normalize then validate content-manager hint wire shape; raise ``ValueError`` if still ill-formed."""

    norm = normalize_content_manager_hint_wire(data)
    if not content_manager_hint_wire_wellformed(norm):
        msg = "content manager hint wire payload is not well-formed after normalization"
        raise ValueError(msg)
    return norm
