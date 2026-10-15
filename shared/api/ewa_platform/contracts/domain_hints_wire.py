# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Wire-shape predicates and normalization for ``domain_hints`` telemetry emitted by the desktop orchestrator
# (documents workspace + content manager read-only hints).
# Invariants:
# - JSON-safe dicts only; unknown keys may pass through on normalized documents hint via ``additional`` bucket avoided —
#   optional diagnostic keys (e.g. ``status_code``) are preserved when already scalar-safe.
# Related:
# - api/ewa_platform/schemas/json/domain_hints_v1.json
# - api/ewa_platform/io/domain_hints.py
# - api/ewa_platform/core/orchestrator.py
# ---
"""Domain hints wire helpers (documents / content manager v1)."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any


def documents_workspace_hint_wire_wellformed(data: Mapping[str, Any]) -> bool:
    """Return True when ``data`` matches normalized documents workspace hint wire shape."""

    src = data.get("source")
    if not isinstance(src, str) or not src.strip():
        return False
    oc = data.get("open_document_count")
    if not isinstance(oc, int) or oc < 0:
        return False
    items = data.get("items")
    return isinstance(items, list)


def content_manager_hint_wire_wellformed(data: Mapping[str, Any]) -> bool:
    """Return True when ``data`` matches normalized content-manager hint wire shape."""

    src = data.get("source")
    if not isinstance(src, str) or not src.strip():
        return False
    roots = data.get("roots")
    if not isinstance(roots, list):
        return False
    return all(isinstance(x, str) for x in roots)


def normalize_documents_workspace_hint_wire(data: Mapping[str, Any]) -> dict[str, Any]:
    """Coerce driver/adapter mappings into a canonical v1 hint dict (never raises)."""

    raw_items = data.get("items")
    items_in = raw_items if isinstance(raw_items, list) else []
    items: list[dict[str, Any]] = []
    for x in items_in:
        if isinstance(x, Mapping):
            items.append(dict(x))

    oc_raw = data.get("open_document_count")
    oc = len(items)
    if isinstance(oc_raw, int) and oc_raw >= 0:
        oc = max(oc_raw, len(items))

    src_raw = data.get("source")
    src = src_raw.strip() if isinstance(src_raw, str) and src_raw.strip() else "unspecified_source_normalized"

    out: dict[str, Any] = {
        "open_document_count": oc,
        "items": items,
        "source": src,
    }
    sc = data.get("status_code")
    if isinstance(sc, int):
        out["status_code"] = sc
    return out


def normalize_content_manager_hint_wire(data: Mapping[str, Any]) -> dict[str, Any]:
    """Coerce driver/adapter mappings into a canonical v1 hint dict (never raises)."""

    roots_in = data.get("roots")
    roots: list[str] = []
    if isinstance(roots_in, list):
        for x in roots_in:
            if isinstance(x, str) and x.strip():
                roots.append(x.strip())

    src_raw = data.get("source")
    src = src_raw.strip() if isinstance(src_raw, str) and src_raw.strip() else "unspecified_source_normalized"

    out: dict[str, Any] = {"roots": roots, "source": src}
    sc = data.get("status_code")
    if isinstance(sc, int):
        out["status_code"] = sc
    return out
