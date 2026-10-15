# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Build Admin Topology Map payload from packaged catalog + honest health overlay
# + optional Gen/Forge intention touches (Wave G2).
# Invariants:
# - No invented edges; unknown peers skipped with structured log.
# - Local probe only for stack0_api (this process); other nodes stay unknown.
# - Factory overlay annotates nodes only — never adds edges.
# Related:
# - catalog.py
# - factory_overlay.py
# - api/routers/desktop_admin_topology.py
# ---

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any, Literal

from api.services.platform_topology.catalog import load_topology_catalog
from api.services.platform_topology.factory_overlay import build_factory_touches

logger = logging.getLogger(__name__)

HealthStatus = Literal["ok", "degraded", "down", "unknown"]
EdgeKind = Literal["dependency", "event"]


def _utc_now() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _probe_local_api_health() -> HealthStatus:
    """This API process is serving — stack0_api is ok when the route runs."""

    return "ok"


def _health_for_node(node_id: str) -> HealthStatus:
    if node_id == "stack0_api":
        return _probe_local_api_health()
    return "unknown"


def _event_flow_pairs(
    flows: list[dict[str, Any]],
    known: set[str],
) -> list[dict[str, Any]]:
    """Aggregate publisher→subscriber pairs with shared topics (genEW honest graph)."""

    aggregated: dict[tuple[str, str], list[str]] = {}
    for flow in flows:
        if not isinstance(flow, dict):
            continue
        topic = str(flow.get("topic") or "").strip()
        if not topic:
            continue
        pubs = [str(x).strip() for x in (flow.get("publishers") or []) if str(x).strip()]
        subs = [str(x).strip() for x in (flow.get("subscribers") or []) if str(x).strip()]
        for src in pubs:
            if src not in known:
                logger.debug("[STEP] topology_event_skip unknown_publisher=%s", src)
                continue
            for dst in subs:
                if dst not in known or src == dst:
                    continue
                key = (src, dst)
                topics = aggregated.setdefault(key, [])
                if topic not in topics:
                    topics.append(topic)
    return [
        {
            "id": f"event:{src}->{dst}",
            "kind": "event",
            "source": src,
            "target": dst,
            "topics": topics,
        }
        for (src, dst), topics in sorted(aggregated.items())
    ]


def _list_factory_intentions_safe() -> list[dict[str, Any]]:
    """Best-effort factory list; never fail the topology map."""

    try:
        from api.ewa_platform.factory.config import factory_enabled
        from api.ewa_platform.factory.service import get_factory_service

        if not factory_enabled():
            return []
        return get_factory_service().list_intentions()
    except Exception as exc:
        logger.debug("[STEP] topology_factory_overlay_skip reason=%s", exc)
        return []


def build_topology_graph(
    *,
    intentions: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Return schema_versioned topology graph for Admin UI."""

    catalog = load_topology_catalog()
    nodes_raw = [n for n in (catalog.get("nodes") or []) if isinstance(n, dict)]
    known = {str(n.get("id") or "").strip() for n in nodes_raw}
    known.discard("")

    intention_rows = intentions if intentions is not None else _list_factory_intentions_safe()
    touches = build_factory_touches(intention_rows, known_nodes=known)
    active_count = len({t["intention_id"] for rows in touches.values() for t in rows if t.get("intention_id")})

    nodes_out: list[dict[str, Any]] = []
    for n in nodes_raw:
        node_id = str(n.get("id") or "").strip()
        if not node_id:
            continue
        node_touches = touches.get(node_id) or []
        primary = node_touches[0] if node_touches else None
        nodes_out.append(
            {
                "id": node_id,
                "label": str(n.get("label") or node_id),
                "band": str(n.get("band") or "prod_core"),
                "role": str(n.get("role") or "service"),
                "origin": str(n.get("origin") or "platform"),
                "features": [str(x) for x in (n.get("features") or []) if str(x).strip()],
                "health": _health_for_node(node_id),
                "factory_touch": bool(node_touches),
                "factory_stage": primary["stage"] if primary else None,
                "factory_status": primary["status"] if primary else None,
                "factory_touches": node_touches,
            }
        )

    edges: list[dict[str, Any]] = []
    for dep in catalog.get("dependencies") or []:
        if not isinstance(dep, dict):
            continue
        src = str(dep.get("from") or "").strip()
        dst = str(dep.get("to") or "").strip()
        if src not in known or dst not in known:
            logger.debug(
                "[STEP] topology_dep_skip unknown from=%s to=%s",
                src,
                dst,
            )
            continue
        edges.append(
            {
                "id": f"dep:{src}->{dst}",
                "kind": "dependency",
                "source": src,
                "target": dst,
                "topics": [],
            }
        )

    event_edges = _event_flow_pairs(
        [f for f in (catalog.get("event_flows") or []) if isinstance(f, dict)],
        known,
    )
    edges.extend(event_edges)

    touched_nodes = sum(1 for n in nodes_out if n["factory_touch"])

    return {
        "schema_version": 1,
        "probe_scope": "catalog_plus_local_api_plus_factory",
        "probed_at": _utc_now(),
        "source": str(catalog.get("source") or ""),
        "honest_contract": str(catalog.get("honest_contract") or ""),
        "nodes": nodes_out,
        "edges": edges,
        "counts": {
            "nodes": len(nodes_out),
            "dependency_edges": sum(1 for e in edges if e["kind"] == "dependency"),
            "event_edges": sum(1 for e in edges if e["kind"] == "event"),
            "factory_active": active_count,
            "factory_touched_nodes": touched_nodes,
        },
        "factory_overlay": {
            "active_intentions": active_count,
            "touched_nodes": touched_nodes,
            "pack_map": "platform_topology/data/pack_node_map.json",
        },
        "cli_hint": (
            "Edges are catalog-declared only (PRODUCTION-TOPOLOGY-STATE). "
            "Factory badges map pack_stems → nodes via pack_node_map (unknown → stack0_api)."
        ),
        "legend": {
            "dependency": "Declared hard runtime dependency",
            "event": "Declared AMQP/Socket/OIDC flow (topic list on edge)",
            "health_unknown": "No local probe for this node in Wave G1",
            "factory_touch": "Active (non-terminal) Gen/Forge intention mapped to this node",
        },
    }
