# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Load packaged EliteEW platform topology catalog (nodes + declared edges).
# Invariants:
# - Catalog ships inside the API package (baked image has no monorepo docs tree).
# - Invalid / missing ids in edges raise at load for tests; runtime build filters.
# Related:
# - data/topology_catalog.json
# ---

from __future__ import annotations

import json
import logging
from functools import lru_cache
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

_CATALOG_PATH = Path(__file__).resolve().parent / "data" / "topology_catalog.json"


@lru_cache(maxsize=1)
def load_topology_catalog() -> dict[str, Any]:
    """Return the packaged topology catalog (cached)."""

    raw = json.loads(_CATALOG_PATH.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise ValueError("topology_catalog_root_not_object")
    nodes = raw.get("nodes")
    if not isinstance(nodes, list) or not nodes:
        raise ValueError("topology_catalog_nodes_empty")
    return raw


def catalog_path() -> Path:
    return _CATALOG_PATH


def validate_catalog_integrity(catalog: dict[str, Any] | None = None) -> list[str]:
    """Return human-readable integrity errors (empty = ok)."""

    data = catalog if catalog is not None else load_topology_catalog()
    errors: list[str] = []
    nodes = data.get("nodes") or []
    ids = {str(n.get("id") or "").strip() for n in nodes if isinstance(n, dict)}
    ids.discard("")
    if len(ids) != len([n for n in nodes if isinstance(n, dict) and n.get("id")]):
        errors.append("duplicate_or_missing_node_ids")

    for dep in data.get("dependencies") or []:
        if not isinstance(dep, dict):
            errors.append("dependency_not_object")
            continue
        src = str(dep.get("from") or "").strip()
        dst = str(dep.get("to") or "").strip()
        if src not in ids or dst not in ids:
            errors.append(f"dependency_unknown:{src}->{dst}")

    for flow in data.get("event_flows") or []:
        if not isinstance(flow, dict):
            errors.append("event_flow_not_object")
            continue
        topic = str(flow.get("topic") or "").strip()
        if not topic:
            errors.append("event_flow_missing_topic")
        for key in ("publishers", "subscribers"):
            for name in flow.get(key) or []:
                if str(name).strip() not in ids:
                    errors.append(f"event_flow_unknown:{topic}:{key}:{name}")
    return errors
