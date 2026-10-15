# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Map short corpus aliases (docs/api/fe) to eliteew-* KBSEW barrel names for MCP tools.
# Invariants:
# - Keep in sync with tools/eliteew-kbsew-mcp/eliteew_kbsew_mcp/corpus.py.
# Related:
# - api/services/mcp_host/transports/kbsew_native.py
# ---

from __future__ import annotations

from typing import Any

CORPUS_TO_BARREL_NAME: dict[str, str] = {
    "docs": "eliteew-docs",
    "documentation": "eliteew-docs",
    "eliteew-docs": "eliteew-docs",
    "api": "eliteew-api",
    "python": "eliteew-api",
    "eliteew-api": "eliteew-api",
    "fe": "eliteew-frontend",
    "frontend": "eliteew-frontend",
    "ts": "eliteew-frontend",
    "typescript": "eliteew-frontend",
    "eliteew-frontend": "eliteew-frontend",
}


def normalize_corpus(raw: str | None) -> str | None:
    text = str(raw or "").strip().lower()
    if not text:
        return None
    return CORPUS_TO_BARREL_NAME.get(text)


def allowed_corpus_aliases() -> list[str]:
    """Stable sorted alias list for unknown_corpus error payloads."""
    return sorted(CORPUS_TO_BARREL_NAME.keys())


def resolve_barrel_id_from_list(
    *,
    corpus: str | None,
    barrels: list[dict[str, Any]],
) -> tuple[str | None, str | None]:
    target = normalize_corpus(corpus)
    if not target:
        return None, None
    for row in barrels:
        if not isinstance(row, dict):
            continue
        name = str(row.get("name") or "").strip()
        if name == target:
            bid = str(row.get("id") or "").strip()
            return (bid or None), target
    return None, target
