# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Pure **graph transformer** for EWA Atoms: temporal chains (Comets), semantic links (Stars by tag overlap), and
# affective overlay edges (Nebulae → nearby Star/Comet within a time window).
# Invariants:
# - No I/O; deterministic given sorted inputs; edge ids are fresh UUIDs as strings.
# Related:
# - api/ewa_platform/persistence_pg/atoms_asyncpg.py
# - documentation/product/ewa/EWA-ATOM-LAYER.md
# ---
"""Atom graph edge generation (pure functions)."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any
from uuid import uuid4

from api.ewa_platform.contracts.atoms_v1 import (
    AnyAtomV1,
    CometAtomV1,
    NebulaAtomV1,
    StarAtomV1,
)


def _jaccard_tags(a: Sequence[str], b: Sequence[str]) -> float:
    sa = {str(x).strip().lower() for x in a if str(x).strip()}
    sb = {str(x).strip().lower() for x in b if str(x).strip()}
    if not sa and not sb:
        return 1.0
    if not sa or not sb:
        return 0.0
    return len(sa & sb) / float(len(sa | sb))


def build_atom_graph_edges(
    atoms: Sequence[AnyAtomV1],
    *,
    semantic_tag_threshold: float = 0.25,
    affective_window_seconds: float = 900.0,
) -> list[dict[str, Any]]:
    """Return edge rows ready for ``atom_edges_insert`` (principal_id filled by caller)."""

    items = list(atoms)
    edges: list[dict[str, Any]] = []

    comets = sorted(
        (a for a in items if isinstance(a, CometAtomV1)),
        key=lambda c: (c.timestamp, str(c.id)),
    )
    for left, right in zip(comets, comets[1:], strict=False):
        if right.timestamp < left.timestamp:
            continue
        edges.append(
            {
                "id": str(uuid4()),
                "from_atom_id": str(left.id),
                "to_atom_id": str(right.id),
                "link_kind": "temporal",
                "weight": 1.0,
                "meta": {"reason": "comet_chain"},
            },
        )

    stars = [a for a in items if isinstance(a, StarAtomV1)]
    stars_sorted = sorted(stars, key=lambda s: str(s.id))
    for i, sa in enumerate(stars_sorted):
        for sb in stars_sorted[i + 1 :]:
            if _jaccard_tags(sa.tags, sb.tags) >= float(semantic_tag_threshold):
                a_id, b_id = sorted((str(sa.id), str(sb.id)))
                edges.append(
                    {
                        "id": str(uuid4()),
                        "from_atom_id": a_id,
                        "to_atom_id": b_id,
                        "link_kind": "semantic",
                        "weight": round(_jaccard_tags(sa.tags, sb.tags), 4),
                        "meta": {"reason": "shared_tags"},
                    },
                )

    nebulae = [a for a in items if isinstance(a, NebulaAtomV1)]
    targets = [a for a in items if isinstance(a, (StarAtomV1, CometAtomV1))]
    window = max(30.0, float(affective_window_seconds))
    for neb in nebulae:
        for tgt in targets:
            if neb.id == tgt.id:
                continue
            delta = abs((neb.timestamp - tgt.timestamp).total_seconds())
            if delta <= window:
                w = min(1.0, 0.08 + float(neb.arousal) * 0.55)
                edges.append(
                    {
                        "id": str(uuid4()),
                        "from_atom_id": str(neb.id),
                        "to_atom_id": str(tgt.id),
                        "link_kind": "affective",
                        "weight": round(w, 4),
                        "meta": {"delta_seconds": delta, "reason": "nebular_proximity"},
                    },
                )

    return edges


__all__ = ["build_atom_graph_edges"]
