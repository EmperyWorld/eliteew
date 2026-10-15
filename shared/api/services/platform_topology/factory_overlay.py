# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Map active Gen/Forge intentions onto topology node ids (Wave G2 overlay).
# Invariants:
# - Only non-terminal intentions; unknown packs fall back to default_nodes.
# - Never invent edges — only annotate existing catalog nodes.
# Related:
# - documentation/platform/docker-re_doc/ADMIN-TOPOLOGY-MAP.md
# ---

from __future__ import annotations

import json
import logging
from functools import lru_cache
from pathlib import Path
from typing import Any

from api.ewa_platform.factory.models import TERMINAL_STATUSES, FactoryStatus

logger = logging.getLogger(__name__)

_MAP_PATH = Path(__file__).resolve().parent / "data" / "pack_node_map.json"


@lru_cache(maxsize=1)
def load_pack_node_map() -> dict[str, Any]:
    return json.loads(_MAP_PATH.read_text(encoding="utf-8"))


def resolve_pack_nodes(pack_stems: list[str], *, known_nodes: set[str]) -> list[str]:
    """Resolve pack stems to topology node ids present in the catalog."""

    mapping = load_pack_node_map()
    packs_raw = mapping.get("packs")
    packs: dict[str, Any] = packs_raw if isinstance(packs_raw, dict) else {}
    defaults = [str(x).strip() for x in (mapping.get("default_nodes") or ["stack0_api"]) if str(x).strip()]
    out: list[str] = []
    seen: set[str] = set()

    stems = [str(s).strip() for s in pack_stems if str(s).strip()]
    if not stems:
        stems = ["_default"]

    for stem in stems:
        candidates: list[Any] | list[str] = defaults
        if stem in packs:
            mapped = packs.get(stem)
            if isinstance(mapped, list):
                candidates = mapped
        for node_id in candidates:
            nid = str(node_id).strip()
            if not nid or nid in seen:
                continue
            if nid not in known_nodes:
                logger.debug("[STEP] topology_pack_skip unknown_node=%s pack=%s", nid, stem)
                continue
            seen.add(nid)
            out.append(nid)
    return out


def build_factory_touches(
    intentions: list[dict[str, Any]],
    *,
    known_nodes: set[str],
) -> dict[str, list[dict[str, Any]]]:
    """
    Return node_id → list of active intention touch summaries.

    Active = status not terminal (completed/failed/cancelled).
    """

    by_node: dict[str, list[dict[str, Any]]] = {}
    for row in intentions:
        if not isinstance(row, dict):
            continue
        status_raw = str(row.get("status") or "").strip()
        try:
            status = FactoryStatus(status_raw)
        except ValueError:
            continue
        if status in TERMINAL_STATUSES:
            continue
        touch = {
            "intention_id": str(row.get("id") or ""),
            "title": str(row.get("title") or ""),
            "stage": str(row.get("stage") or ""),
            "status": status_raw,
            "pack_stems": [str(x) for x in (row.get("pack_stems") or [])],
        }
        if not touch["intention_id"]:
            continue
        for node_id in resolve_pack_nodes(
            list(touch["pack_stems"]),
            known_nodes=known_nodes,
        ):
            by_node.setdefault(node_id, []).append(touch)
    return by_node
